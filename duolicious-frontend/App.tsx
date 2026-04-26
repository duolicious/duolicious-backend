import {
  Animated,
  Platform,
  UIManager,
} from 'react-native';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  DefaultTheme,
  NavigationContainer,
  createNavigationContainerRef,
  getPathFromState as rnGetPathFromState,
  getStateFromPath as rnGetStateFromPath,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as Font from 'expo-font';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TabBar } from './components/navigation/tab-bar';
import { SearchTab } from './components/search-tab';
import { QuizTab } from './components/quiz-tab';
import { ProfileTab } from './components/profile-tab';
import { InboxTab } from './components/inbox-tab';
import { FeedTab } from './components/feed-tab';
import { VisitorsTab, fetchVisitors } from './components/visitors-tab';
import { ConversationScreen } from './components/conversation-screen/conversation-screen';
import { ServerStatus, UtilityScreen } from './components/utility-screen';
import { ProspectProfileScreen } from './components/prospect-profile-screen';
import { InviteScreen, WelcomeScreen } from './components/welcome-screen';
import { sessionToken, sessionPersonUuid } from './kv-storage/session-token';
import { lastPath } from './kv-storage/last-path';
import { clearAllKv } from './kv-storage/kv-storage';
import { japi, SUPPORTED_API_VERSIONS } from './api/api';
import { login, logout } from './chat/application-layer';
import { useInboxStats } from './chat/application-layer/hooks/inbox-stats';
import { STATUS_URL } from './env/env';
import { delay } from './util/util';
import { ColorPickerModal } from './components/modal/color-picker-modal/color-picker-modal';
import { GifPickerModal } from './components/modal/gif-picker-modal';
import { ReportModal } from './components/modal/report-modal';
import { ImageCropper } from './components/image-cropper';
import {
  useNotificationObserverOnMobile,
  getLastNotificationResponseOnMobile,
} from './notifications/mobile';
import { verificationWatcher } from './verification/verification';
import { ClubItem } from './club/club';
import { Toast } from './components/toast';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createWebNavigator } from './components/navigation/web-navigator';
import { isMobile } from './util/util';
import { Logo16 } from './components/logo';
import { useScrollbarStyle } from './components/navigation/scroll-bar-hooks';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ErrorBoundary } from './components/error-boundary';
import { TooltipListener } from './components/tooltip';
import { VerificationCameraModal } from './components/verification-camera';
import { notify } from './events/events';
import { PointOfSaleModal } from './components/modal/point-of-sale-modal';
import { setSignedInUser, useSignedInUser, getSignedInUser } from './events/signed-in-user';
import { useAppThemeLoader, useAppTheme } from './app-theme/app-theme';
import { computeStartupNavigationState } from './navigation/startup';
import { resetUserScopedClientState } from './navigation/reset-client-state';

verificationWatcher();

ExpoSplashScreen.preventAutoHideAsync();

const Stack = createNativeStackNavigator();
const Tab = isMobile() ? createBottomTabNavigator() : createWebNavigator();

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const HomeTabs = () => {
  return (
    <Tab.Navigator
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        animation: 'shift',
      }}
      tabBar={props => <TabBar {...props} />}
    >
      <Tab.Screen name="Q&A" component={QuizTab} options={{ title: 'Q&A' }} />
      <Tab.Screen name="Search" component={SearchTab} options={{ title: 'Search' }} />
      <Tab.Screen name="Feed" component={FeedTab} options={{ title: 'Feed' }} />
      <Tab.Screen name="Inbox" component={InboxTab} options={{ title: 'Inbox' }} />
      <Tab.Screen name="Visitors" component={VisitorsTab} options={{ title: 'Visitors' }} />
      <Tab.Screen name="Profile" component={ProfileTab} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
};

const WebSplashScreen = ({loading}) => {
  const [isFaded, setIsFaded] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!loading) {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => setIsFaded(true));
    }
  }, [loading]);

  if (isFaded) {
    return null;
  } else {
    return (
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          alignItems: 'center',
          flexDirection: 'column',
          justifyContent: 'space-around',
          backgroundColor: '#70f',
          opacity: opacity,
          zIndex: 999,
        }}
      >
        <Logo16 size={96} fadeOutDelay={0} fadeInDelay={0} doAnimate={true} />
      </Animated.View>
    );
  }
};

const SplashScreen = ({loading}) => {
  if (Platform.OS === 'web') {
    return <WebSplashScreen loading={loading} />;
  } else {
    return null;
  }
};

const otpDestination = { value: '' };
const isImagePickerOpen = { value: false };

const navigationContainerRef = createNavigationContainerRef<any>();

// Strict UUID v1-v5 shape (8-4-4-4-12 hex). Used in path patterns to
// disambiguate prospect uuids from sibling static paths (e.g. `/profile/:uuid`
// vs `/profile/settings`).
const UUID_REGEX_SOURCE =
  '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';

// Route names that render the generic OptionScreen-driven wizard. These
// rely on an in-memory payload that's not URL-serializable, so we don't
// persist their paths in `last_path` (see `onNavigationStateChange`).
const WIZARD_ROUTE_NAMES = new Set([
  'Create Account Or Sign In Screen',
  'Profile Option Screen',
  'Search Filter Option Screen',
]);

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

const App = () => {
  const [initialState, setInitialState] = useState<any>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [serverStatus, setServerStatus] = useState<ServerStatus>("ok");
  const [signedInUser] = useSignedInUser();
  const pendingPostLoginStateRef = useRef<any | null>(null);
  useAppThemeLoader();
  const { appTheme } = useAppTheme();

  const linking = useMemo(() => {
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
          // NOTE: No `path` here. If we set `path: 'profile'`, it conflicts with
          // the Profile tab's `/profile` route (React Navigation requires unique patterns).
          // We deliberately do NOT set `initialRouteName: 'Prospect Profile'`
          // either, because every child route here is parameterised by the
          // same `personUuid` and there's no way to forward that param down
          // to the synthesised parent. A direct deep-link to `/in-depth/:uuid`
          // therefore mounts In-Depth alone, and back navigation falls
          // through to the synthesised `Home/Search` set up by
          // `withHomeBackStack` in `navigation/startup.ts`.
          screens: {
            // Avoid conflicts with `/profile/settings` etc
            'Prospect Profile': `profile/:personUuid(${UUID_REGEX_SOURCE})`,
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
        // `/me` and `/welcome` previously served different purposes than any
        // current screen. Per the routing brief these legacy URLs shouldn't
        // quietly land users on something unexpected, so we drop them at the
        // app root.
        let normalized = path;
        if (normalized === '/me' || normalized.startsWith('/me/')) normalized = '/';
        if (normalized === '/welcome' || normalized.startsWith('/welcome/')) normalized = '/';

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

        // For anything we don't recognise, fall back to the app root rather
        // than returning `undefined` (which would render a blank screen).
        const state = rnGetStateFromPath(normalized, options);
        if (state) return state;
        return getSignedInUser()
          ? rnGetStateFromPath('/qa', options)
          : { routes: [{ name: 'Welcome' }] };
      },
      getPathFromState: rnGetPathFromState,
    };
  }, []);

  const loadFonts = useCallback(async () => {
    await Font.loadAsync({
      Trueno: require('./assets/fonts/TruenoRound.otf'),
      TruenoBold: require('./assets/fonts/TruenoRoundBd.otf'),

      MontserratBlack: require('./assets/fonts/montserrat/static/Montserrat-Black.ttf'),
      MontserratBold: require('./assets/fonts/montserrat/static/Montserrat-Bold.ttf'),
      MontserratExtraBold: require('./assets/fonts/montserrat/static/Montserrat-ExtraBold.ttf'),
      MontserratExtraLight: require('./assets/fonts/montserrat/static/Montserrat-ExtraLight.ttf'),
      MontserratLight: require('./assets/fonts/montserrat/static/Montserrat-Light.ttf'),
      MontserratMedium: require('./assets/fonts/montserrat/static/Montserrat-Medium.ttf'),
      MontserratRegular: require('./assets/fonts/montserrat/static/Montserrat-Regular.ttf'),
      MontserratSemiBold: require('./assets/fonts/montserrat/static/Montserrat-SemiBold.ttf'),
      MontserratThin: require('./assets/fonts/montserrat/static/Montserrat-Thin.ttf'),
    });
  }, []);

  const lockScreenOrientation = useCallback(async () => {
    try {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
      }
    } catch (e) {
      console.warn(e);
    }
  }, []);

  const restoreSessionAndNavigate = useCallback(async () => {
    const existingPersonUuid = await sessionPersonUuid();
    const existingSessionToken = await sessionToken();
    const notification = await getLastNotificationResponseOnMobile();

    // `computeStartupNavigationState` owns every routing decision at startup:
    // URL deep-links, public-vs-protected screens, push notifications, the
    // pending-club flow, and persisted last-path restoration. The only thing
    // we still do here is the auth side-effects (token check, logout, set
    // signed-in user) and pass the resulting auth state in.
    const applyStartupNav = async (
      isAuthenticated: boolean,
      pendingClub: ClubItem | null = null,
    ) => {
      const result = await computeStartupNavigationState({
        linking,
        isAuthenticated,
        notification,
        pendingClub,
      });
      if (result.postLoginRedirectState) {
        pendingPostLoginStateRef.current = result.postLoginRedirectState;
      }
      setInitialState(result.initialState);
    };

    if (!existingPersonUuid || !existingSessionToken) {
      await sessionPersonUuid(null);
      await sessionToken(null);
      await lastPath(null);
      resetUserScopedClientState();
      setSignedInUser(undefined);
      logout();
      await applyStartupNav(false);
      return;
    }

    if (typeof existingSessionToken !== 'string') {
      return;
    }

    // Log into XMPP
    login(existingPersonUuid, existingSessionToken);

    const response = await japi(
      'post',
      '/check-session-token',
      undefined,
      { retryOnServerError: true }
    );

    if (response.clientError || response?.json?.onboarded === false) {
      await sessionPersonUuid(null);
      await sessionToken(null);
      await lastPath(null);
      resetUserScopedClientState();
      setSignedInUser(undefined);
      logout();
      await applyStartupNav(false);
      return;
    }

    const clubs: ClubItem[] = response?.json?.clubs;
    const personId = response?.json?.person_id as number;
    const personUuid = response?.json?.person_uuid as string;
    const pendingClub = response?.json?.pending_club as ClubItem | null;

    setSignedInUser({
      personId: personId,
      personUuid: personUuid,
      units: response?.json?.units === 'Imperial' ? 'Imperial' : 'Metric',
      sessionToken: existingSessionToken,
      pendingClub: pendingClub,
      estimatedEndDate: new Date(response?.json?.estimated_end_date),
      name: response?.json?.name,
      hasGold: response?.json?.has_gold,
    });

    notify<ClubItem[]>('updated-clubs', clubs);

    await applyStartupNav(true, pendingClub);
  }, [linking]);

  // Centralised post-sign-in redirect. Runs both when `signedInUser` changes
  // (the post-OTP-flow case) and when the NavigationContainer reports ready
  // (the cold-start-with-existing-session case, where `signedInUser` may
  // have been populated *before* the container mounted, so the effect's
  // ref-lookup would have early-returned).
  //
  // Two responsibilities:
  //   1. If a protected URL was deep-linked while logged-out, restore it
  //      after the user signs in (`pendingPostLoginStateRef`).
  //   2. Otherwise, if the user is parked on the logged-out Welcome stack
  //      (just completed OTP, or typed `/sign-in`/`/welcome` while already
  //      signed in), forward them to the canonical landing tab so they
  //      aren't stranded on the sign-in form.
  const applyPostSignInRedirect = useCallback(() => {
    if (!getSignedInUser()) return;

    const navigationContainer = navigationContainerRef.current;
    if (!navigationContainer) return;

    const pending = pendingPostLoginStateRef.current;
    pendingPostLoginStateRef.current = null;

    if (pending) {
      navigationContainer.reset(pending);
      return;
    }

    const rootState: any = navigationContainer.getRootState?.();
    const topRouteName: string | undefined =
      rootState?.routes?.[rootState?.index ?? 0]?.name;
    if (topRouteName === 'Welcome') {
      navigationContainer.reset({
        routes: [
          { name: 'Home', state: { routes: [{ name: 'Q&A' }] } },
        ],
      });
    }
  }, []);

  useEffect(() => {
    // On sign-out drop any remaining pending state so a stale entry from
    // this session can't latch onto a subsequent sign-in as a different
    // user on the same browser.
    if (!signedInUser) {
      pendingPostLoginStateRef.current = null;
      return;
    }
    applyPostSignInRedirect();
  }, [signedInUser?.personUuid, applyPostSignInRedirect]);

  const fetchServerStatusState = useCallback(async () => {
    let response: Response | null = null
    try {
      response = await fetch(STATUS_URL, { cache: 'no-store' });
    } catch (_) {};

    if (response === null || !response.ok) {
      // If even the status server is down, things are *very* not-okay. But odds
      // are it can't be contacted because the user has a crappy internet
      // connection. The "You're offline" notice should still provide some
      // feedback.
      setServerStatus("ok");
      return;
    }

    const j: any = await response.json();
    const apiVersion = j.api_version;
    const reportedStatus = j.statuses[j.status_index];

    const latestServerStatus: ServerStatus = (() => {
      if (reportedStatus === "down for maintenance") {
        return reportedStatus;
      } else if (!SUPPORTED_API_VERSIONS.includes(apiVersion)) {
        return "please update";
      } else if (reportedStatus === "ok") {
        return reportedStatus;
      } else {
        return "down for maintenance";
      }
    })();

    if (serverStatus !== latestServerStatus) {
      setServerStatus(latestServerStatus);
    }
  }, [serverStatus]);

  const loadApp = useCallback(async () => {
    await Promise.all([
      loadFonts(),
      lockScreenOrientation(),
      restoreSessionAndNavigate(),
      fetchServerStatusState(),
    ]);

    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadApp();
  }, []);

  useEffect(() => {
    // Without this flag, an infinite loop will start each time this effect
    // starts, which would effectively be whenever the server's status changes.
    // That would lead to multiple infinite loops running concurrently.
    let doBreak = false;

    (async () => {
      while (true) {
        await delay(5000);
        await fetchServerStatusState();
        if (doBreak) break;
      }
    })();

    return () => { doBreak = true; };
  }, [fetchServerStatusState]);

  useEffect(() => {
    if (!signedInUser) {
      return;
    }

    let doBreak = false;

    (async () => {
      while (true) {
        await fetchVisitors();
        await delay(60_000);
        if (doBreak) break;
      }
    })();

    return () => { doBreak = true; };
  }, [signedInUser?.personUuid]);

  const onError = useCallback(async () => {
    await clearAllKv();

    loadApp();
  }, []);

  const onNavigationStateChange = useCallback(async (state) => {
    if (!state) return;

    // URL-bar sync is left entirely to React Navigation's linking integration.
    // Doing a `window.history.replaceState` here in addition to RN's own
    // pushState corrupts the browser history stack: our handler runs
    // synchronously from the state-change emit, while RN's pushState is
    // queued as a microtask, so our replace overwrites the URL of the
    // *previous* browser entry before RN appends a new one - effectively
    // collapsing two history entries into one and breaking the back button.

    // Read auth synchronously rather than closing over `signedInUser`. During
    // sign-out we clear the user before triggering the navigation reset, and
    // a stale closure would persist the post-logout path under the previous
    // identity (or vice versa).
    if (!getSignedInUser()) return;

    // Don't persist transient wizard URLs. OptionScreen-backed routes
    // (`Profile Option Screen`, `Search Filter Option Screen`,
    // `Create Account Or Sign In Screen`) depend on an in-memory payload
    // that doesn't survive a hard refresh. If we persisted the wizard URL,
    // the next cold-start would hydrate the wizard with no payload and
    // immediately `popToTop` to the parent screen — a visible flicker.
    // Walking the focused route chain lets us detect this regardless of how
    // deeply nested the wizard is.
    if (focusedRouteIsWizard(state)) return;

    // Persist just the canonical path - not the full navigation tree - so we
    // can restore the user's last place on next startup. We let React
    // Navigation's `getPathFromState` do the serialization so this stays in
    // lock-step with whatever URL structure the linking config exposes.
    try {
      // The `as any` is unfortunate but unavoidable: React Navigation's
      // PathConfig types insist every `screens`-bearing entry also declare
      // its own `path`, but our `Home` deliberately doesn't have one (its
      // children inherit the empty root). The runtime invariant being relied
      // on here is that `Home` is always the implicit root of the path tree,
      // so any path produced by getPathFromState round-trips back to a
      // valid state via getStateFromPath.
      const path = rnGetPathFromState(state, linking.config as any);
      if (typeof path === 'string') {
        await lastPath(path.startsWith('/') ? path : `/${path}`);
      }
    } catch (e) {
      // Some transient navigation states aren't representable as URLs (e.g.
      // mid-transition or screens not in the linking config). Skip those
      // and warn so misconfiguration doesn't silently break last-path
      // restoration in production - but use `warn` rather than `error`
      // because intermittent failures on transient states are expected.
      console.warn('Failed to persist last navigation path', e);
    }
  }, [linking]);

  // Only need live updates on web (for browser tab title)
  const stats = useInboxStats(Platform.OS === 'web');

  const numUnread =
    (stats?.numUnreadChats ?? 0) +
    (stats?.numUnreadIntros ?? 0);

  useNotificationObserverOnMobile((screen: string, params: any) => {
    const navigationContainer = navigationContainerRef.current;

    if (!navigationContainer) return;
    if (!screen) return;

    navigationContainer.navigate(screen, params);
  });

  useEffect(() => {
    (async () => {
      if (!isLoading) {
        await ExpoSplashScreen.hideAsync();
      }
    })();
  }, [isLoading]);

  useScrollbarStyle();

  if (serverStatus !== "ok") {
    return <UtilityScreen serverStatus={serverStatus} />
  }

  return (
    <ErrorBoundary onError={onError}>
      <SafeAreaProvider>
        {!isLoading && initialState !== undefined &&
          <GestureHandlerRootView>
            <NavigationContainer
              ref={navigationContainerRef}
              linking={linking}
              initialState={
                initialState ?
                { ...initialState, stale: true } :
                undefined
              }
              onReady={applyPostSignInRedirect}
              onStateChange={onNavigationStateChange}
              theme={{
                ...DefaultTheme,
                colors: {
                  ...DefaultTheme.colors,
                  background: appTheme.primaryColor,
                },
              }}
              documentTitle={{
                // The focused screen can set its own `title` option (e.g. the
                // prospect profile sets it to the prospect's name once the
                // API resolves) and we splice it in front of "Duolicious".
                // Screens that don't set a title fall through to the bare
                // app name.
                formatter: (options) => {
                  const prefix = numUnread ? `(${numUnread}) ` : '';
                  const screenTitle = options?.title;
                  return prefix + (
                    screenTitle ? `${screenTitle} - Duolicious` : 'Duolicious'
                  );
                },
              }}
            >
              <Stack.Navigator
                screenOptions={{
                  headerShown: false,
                  presentation: 'card',
                  navigationBarColor: appTheme.primaryColor,
                }}
              >
                <Stack.Screen
                  name="Welcome"
                  component={WelcomeScreen} />
                <Stack.Screen
                  name="Home"
                  component={HomeTabs} />
                <Stack.Screen
                  name="Conversation Screen"
                  component={ConversationScreen} />
                <Stack.Screen
                  name="Prospect Profile Screen"
                  component={ProspectProfileScreen} />
                <Stack.Screen
                  name="Invite Screen"
                  component={InviteScreen}
                  options={{ title: 'Invitation' }} />
              </Stack.Navigator>
            </NavigationContainer>
            <TooltipListener/>
            <ReportModal/>
            <ImageCropper/>
            <ColorPickerModal/>
            <GifPickerModal/>
            <Toast/>
            <PointOfSaleModal/>
            <VerificationCameraModal/>
          </GestureHandlerRootView>
        }
        <SplashScreen loading={isLoading} />
      </SafeAreaProvider>
    </ErrorBoundary>
  );
};

export default App;
export {
  isImagePickerOpen,
  navigationContainerRef,
  otpDestination,
};
