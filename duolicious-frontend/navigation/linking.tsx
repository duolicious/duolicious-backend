import { Platform } from 'react-native';
import {
  getPathFromState as rnGetPathFromState,
  getStateFromPath as rnGetStateFromPath,
} from '@react-navigation/native';
import { UUID_REGEX_SOURCE } from '../util/util';
import { getSignedInUser, isWebLoggedOut } from '../events/signed-in-user';

const SLUG_REGEX_SOURCE = '[a-z0-9_-]+';

const PROFILE_SUBROUTES = ['settings', 'clubs', 'invites'];

const WIZARD_ROUTE_NAMES = new Set([
  'Create Account Or Sign In Screen',
  'Profile Option Screen',
  'Search Filter Option Screen',
]);

const GATED_LOGGED_OUT_PATHS = new Set([
  '/qa', '/feed', '/inbox', '/visitors', '/profile',
]);

const focusedProspectHandle = (state: any): string | undefined => {
  const root = state?.routes?.[state.index ?? 0];
  if (root?.name !== 'Prospect Profile Screen') return undefined;
  const nested = root.state?.routes?.[root.state.index ?? 0];
  return nested?.params?.personUuid;
};

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
        screens: {
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
    getStateFromPath: (path: string, options: any) => {
      let normalized = path.replace(/\/{2,}/g, '/');

      if (normalized === '/me' || normalized.startsWith('/me/')) normalized = '/';
      if (normalized === '/welcome' || normalized.startsWith('/welcome/')) normalized = '/';

      const legacyProfile = normalized.match(/^\/profile\/([^/?]+)(\?.*)?$/);
      if (legacyProfile &&
          !PROFILE_SUBROUTES.includes(legacyProfile[1])) {
        normalized = `/${legacyProfile[1]}${legacyProfile[2] ?? ''}`;
      }

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

      const state = rnGetStateFromPath(normalized, options);
      if (state) return state;
      if (getSignedInUser()) return rnGetStateFromPath('/qa', options);
      if (isWebLoggedOut()) return rnGetStateFromPath('/search', options);
      return { routes: [{ name: 'Welcome' }] };
    },
    getPathFromState: rnGetPathFromState,
  };
};

export { createLinking, isBannerRoute, focusedProspectHandle, focusedRouteIsWizard };
