import { Platform } from 'react-native';
import {
  getPathFromState as rnGetPathFromState,
  getStateFromPath as rnGetStateFromPath,
} from '@react-navigation/native';
import { UUID_REGEX_SOURCE } from '../util/util';
import { getSignedInUser, isWebLoggedOut } from '../events/signed-in-user';

// Custom profile URLs live at the top level: /<url_slug>, derived from the
// display name. The backend never mints a slug equal to one of the app's
// top-level routes, and React Navigation matches static segments before param
// segments, so those routes stay reachable.
//
// COUPLING: the backend's RESERVED_SLUGS (urlslug/__init__.py) is the
// authoritative list of slugs that must never be minted, and it must mirror
// every top-level route below. Adding a new top-level route here means adding
// it there too, or that route becomes shadowable by a user's slug.
const SLUG_REGEX_SOURCE = '[a-z0-9_-]+';

// Nested routes under /profile (see the Profile navigator in the linking
// config). The legacy /profile/<x> redirect must leave these alone, so they're
// named once here rather than re-listed inline.
const PROFILE_SUBROUTES = ['settings', 'clubs', 'invites'];

// Route names that render the generic OptionScreen-driven wizard. These
// rely on an in-memory payload that's not URL-serializable, so we don't
// persist their paths in `last_path` (see `onNavigationStateChange`).
const WIZARD_ROUTE_NAMES = new Set([
  'Create Account Or Sign In Screen',
  'Profile Option Screen',
  'Search Filter Option Screen',
]);

const GATED_LOGGED_OUT_PATHS = new Set([
  '/qa', '/feed', '/inbox', '/visitors', '/profile',
]);

const isBannerRoute = (state: any): boolean => {
  const root = state?.routes?.[state.index ?? 0];
  if (!root) return false;
  if (root.name === 'Prospect Profile Screen') return true;
  if (root.name === 'Home') {
    const tab = root.state?.routes?.[root.state.index ?? 0]?.name;
    return tab === 'Search';
  }
  return false;
};

const focusedRouteIsWizard = (state: any): boolean => {
  let node: any = state;
  while (node && Array.isArray(node.routes)) {
    const idx = typeof node.index === 'number' ? node.index : 0;
    const route = node.routes[idx];
    if (!route) return false;
    if (WIZARD_ROUTE_NAMES.has(route.name)) return true;
    node = route.state;
  }
  return false;
};

const createLinking = () => {
  const prefixes =
    Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin
      ? [window.location.origin]
      : [];

  // The URL structure below is the single source of truth for every path
  // the app exposes. React Navigation handles serialization/deserialization
  // for us via getPathFromState / getStateFromPath - we don't hand-roll
  // redirects or strip params manually anywhere else.
  //
  // `Welcome` and `Home` both effectively live at the app root, but since
  // React Navigation forbids two screens sharing a pattern, we hang each
  // top-level destination off a distinct child path:
  //   - Logged out: `/` -> Welcome / Welcome Screen
  //   - Logged in:  `/qa`, `/search`, `/profile`, ... (Home's tabs)
  // `Home` itself has no `path`, so its tabs' paths are matched directly
  // at the URL root. This avoids a `Home` vs `Welcome` conflict at `''`.
  //
  // OptionScreen-backed routes ("Create Account Or Sign In", profile
  // settings, search filter editor) are transient wizards driven by an
  // in-memory payload that doesn't survive a hard refresh. We still give
  // each wizard a clean URL so back/forward and copy-paste behave normally
  // mid-flow, but we set `initialRouteName` on every nested navigator so
  // that a hard refresh or bookmark on a wizard URL hydrates the parent
  // screen *underneath* the wizard. When the wizard then sees no payload
  // and calls `navigation.popToTop()`, the user lands on the parent
  // (welcome, profile tab, filter list) instead of a blank screen.
  const config = {
    screens: {
      Welcome: {
        path: '',
        initialRouteName: 'Welcome Screen',
        screens: {
          'Welcome Screen': '',
          'Welcome Email Screen': 'email',
          'Create Account Or Sign In Screen': 'sign-in',
        },
      },
      Home: {
        screens: {
          'Q&A': 'qa',
          Search: {
            path: 'search',
            initialRouteName: 'Search Screen',
            screens: {
              'Search Screen': '',
              'Search Filter Screen': {
                path: 'filters',
                initialRouteName: 'Search Filter Tab',
                screens: {
                  'Search Filter Tab': '',
                  'Search Filter Option Screen': 'edit',
                  'Q&A Filter Screen': 'qa',
                },
              },
            },
          },
          Feed: 'feed',
          Inbox: 'inbox',
          Visitors: 'visitors',
          Profile: {
            path: 'profile',
            initialRouteName: 'Profile Tab',
            screens: {
              'Profile Tab': '',
              'Profile Option Screen': 'settings',
              'Club Selector': 'clubs',
              'Invite Picker': 'invites',
            },
          },
        },
      },
      'Conversation Screen': `chat/:personUuid(${UUID_REGEX_SOURCE})`,
      'Prospect Profile Screen': {
        // NOTE: No `path` here. We deliberately do NOT set
        // `initialRouteName: 'Prospect Profile'` either, because every child
        // route here is parameterised by the same `personUuid` and there's no
        // way to forward that param down to the synthesised parent. A direct
        // deep-link to `/in-depth/:uuid` therefore mounts In-Depth alone, and
        // back navigation falls through to the synthesised `Home/Search` set
        // up by `withHomeBackStack` in `navigation/startup.ts`.
        screens: {
          // Profiles live at the top level: /<username>. The param accepts a
          // uuid (legacy/shared links) or a url_slug. The backend never mints
          // a slug equal to a top-level route, and React Navigation matches
          // static segments (feed, inbox, profile, ...) before this param, so
          // those routes stay reachable. Legacy /profile/<x> links are
          // rewritten to /<x> in getStateFromPath below.
          'Prospect Profile': `:personUuid(${UUID_REGEX_SOURCE}|${SLUG_REGEX_SOURCE})`,
          'Gallery Screen': 'gallery/:photoUuid',
          'In-Depth': `in-depth/:personUuid(${UUID_REGEX_SOURCE})`,
        },
      },
      'Invite Screen': 'invite/:clubName',
    },
  };

  return {
    prefixes,
    config,
    // Pure path-to-state resolver. URL-bar normalization (sign-out, legacy
    // redirects, unauthorized deep-links) lives in `onNavigationStateChange`
    // below, which fires after RN's linking integration has already had its
    // say on the URL. Keeping this function free of `window.history` side
    // effects makes it predictable and easy to reason about in isolation.
    getStateFromPath: (path: string, options: any) => {
      // Collapse duplicate slashes up front. React Navigation resolves
      // `//asdf` to the same state as `/asdf` (it dedupes slashes internally),
      // but it stamps the *raw* path onto the focused route's `path`. On web
      // the linking integration then feeds that raw path to
      // `history.replaceState`, where `//asdf` is parsed as a protocol-relative
      // URL (`http://asdf/`) and rejected cross-origin with a SecurityError
      // that crashes the app. Normalizing here keeps the stored path same-origin.
      let normalized = path.replace(/\/{2,}/g, '/');

      // `/me` and `/welcome` previously served different purposes than any
      // current screen. Per the routing brief these legacy URLs shouldn't
      // quietly land users on something unexpected, so we drop them at the
      // app root.
      if (normalized === '/me' || normalized.startsWith('/me/')) normalized = '/';
      if (normalized === '/welcome' || normalized.startsWith('/welcome/')) normalized = '/';

      // Profiles used to live at /profile/<uuid-or-slug>; they're now at the
      // top level (/<username>). Rewrite legacy links so shared URLs keep
      // working, but leave the real /profile, /profile/settings,
      // /profile/clubs and /profile/invites routes alone. Rewriting up front
      // (rather than resolving here) lets the path flow through the same
      // logged-out gating below as a native /<username> URL.
      const legacyProfile = normalized.match(/^\/profile\/([^/?]+)(\?.*)?$/);
      if (legacyProfile &&
          !PROFILE_SUBROUTES.includes(legacyProfile[1])) {
        normalized = `/${legacyProfile[1]}${legacyProfile[2] ?? ''}`;
      }

      // The app root `/` is shared between the logged-out Welcome screen
      // and the logged-in Home tabs. We want `/` to land on the default
      // Q&A tab for signed-in users rather than `{ routes: [{ name: 'Home' }] }`,
      // which would let the bottom-tab navigator keep whichever tab was
      // previously focused. Delegate to React Navigation's resolver so
      // this stays in sync with whatever path the Q&A tab is mapped to.
      const pathname = normalized.split('?')[0].replace(/\/$/, '') || '/';
      if (pathname === '/' && getSignedInUser()) {
        return rnGetStateFromPath('/qa', options);
      }
      if (pathname === '/' && isWebLoggedOut()) {
        return rnGetStateFromPath('/search', options);
      }
      if (isWebLoggedOut() && GATED_LOGGED_OUT_PATHS.has(pathname)) {
        return rnGetStateFromPath('/search', options);
      }

      // For anything we don't recognise, fall back to the app root rather
      // than returning `undefined` (which would render a blank screen).
      const state = rnGetStateFromPath(normalized, options);
      if (state) return state;
      if (getSignedInUser()) return rnGetStateFromPath('/qa', options);
      if (isWebLoggedOut()) return rnGetStateFromPath('/search', options);
      return { routes: [{ name: 'Welcome' }] };
    },
    getPathFromState: rnGetPathFromState,
  };
};

export { createLinking, isBannerRoute, focusedRouteIsWizard };
