import {
  Animated,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  StatusBar,
  Text,
  UIManager,
} from 'react-native';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  DefaultTheme,
  NavigationContainer,
  getPathFromState,
  getStateFromPath,
} from '@react-navigation/native';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as Font from 'expo-font';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SplashScreen from 'expo-splash-screen';

import { TabBar } from './components/tab-bar';
import SearchTab from './components/search-tab';
import { QuizTab } from './components/quiz-tab';
import ProfileTab from './components/profile-tab';
import InboxTab from './components/inbox-tab';
import { ConversationScreen } from './components/conversation-screen';
import { GalleryScreen, ProspectProfileScreen } from './components/prospect-profile-screen';
import { WelcomeScreen } from './components/welcome-screen';
import { VisitorsTab } from './components/visitors-tab';
import { InDepthScreen } from './components/prospect-profile-screen';
import { sessionToken } from './session-token/session-token';
import { japi } from './api/api';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// TODO: Sign-up cards?
// TODO: iOS UI testing
// TODO: Delete 'getRandomInt' definitions
// TODO: Delete 'delay' definitions
// TODO: Notifications for new messages
// TODO: Tab bar on top for web platform?
// TODO: Privacy Policy, Terms and Conditions
// TODO: r9k algorithm on intros, or plagiarism detection?
// TODO: Replace commitLink at build time
// TODO: Add the ability to reply to things (e.g. pictures, quiz responses) from people's profiles. You'll need to change the navigation to make it easier to reply to things. Consider breaking profiles into sections which can be replied to, each having one image or block of text. Letting people reply to specific things on the profile will improve intro quality.
// TODO: A profile prompts. e.g. "If I had three wishes, I'd wish for...", "My favourite move is..."
// TODO: Add a tutorial for first users
// TODO: Picture verification and a way to filter users by verified pics

// TODO: At the end of sign-up: "That's all we need to get started! You can always add more info via the "Profile" tab, once you're signed in..."
// TODO: Add more ways to sign up. Make sign-up really, really easy
// TODO: Ensure there's enough questions to accurately assess the traits you assert to assess
// TODO: Think more about mechanisms in place to stop women getting too many messages. Think about the setting which lets women message first. e.g. The initial message filter tells you what you *shouldn't* do; It'd be nice to have something which tells you what you should do. Is it okay to let anyone message anyone else by default?
//
// TODO: Have a sharable personality profile which can be easily accessed
// TODO: Users should alter their own scores, not the scores of others
// TODO: Sign-up page should say "Step 1/5"
// TODO: Add placeholders for profile pictures. The placeholders should appear upon 404
// TODO: X-Frame-Options: DENY
// TODO: Try minifying the app


SplashScreen.preventAutoHideAsync();

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

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
      screenOptions={{ headerShown: false }}
      tabBar={props => <TabBar {...props} />}
    >
      <Tab.Screen name="Q&A" component={QuizTab} />
      <Tab.Screen name="Search" component={SearchTab} />
      <Tab.Screen name="Visitors" component={VisitorsTab} />
      <Tab.Screen name="Inbox" component={InboxTab} />
      <Tab.Screen name="Profile" component={ProfileTab} />
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

  if (Platform.OS !== 'web' || isFaded) {
    return <></>;
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
        <ActivityIndicator size={60} color="white"/>
      </Animated.View>
    );
  }
};

let isSignedIn;
let setIsSignedIn;

const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  [isSignedIn, setIsSignedIn] = useState(false);

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

  const fetchSignInState = useCallback(async () => {
    const existingSessionToken = await sessionToken();
    if (existingSessionToken === null) {
      setIsSignedIn(false);
    } else {
      setIsSignedIn(
        (await japi('post', '/check-session-token'))?.json?.onboarded ?? false
      );
    }
  }, []);

  useEffect(() => {
    (async () => {
      await Promise.all([
        loadFonts(),
        lockScreenOrientation(),
        fetchSignInState(),
      ]);

      setIsLoading(false);
    })();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (!isLoading) {
      await SplashScreen.hideAsync();
    }
  }, [isLoading]);

  const linking = {
    prefixes: [],
    getStateFromPath: getStateFromPath,
    getPathFromState(state, config) {
      const path = getPathFromState(state, config);
      const validPaths = [
        '/Q%26A',
        '/Search',
        '/Visitors',
        '/Inbox',
        '/Profile',
      ];
      for (let validPath of validPaths) {
        if (path.startsWith(validPath)) {
          return validPath;
        }
      }
      return '/';
    },
  };

  return (
    <>
      {!isLoading &&
        <NavigationContainer
          linking={linking}
          theme={{
            ...DefaultTheme,
            colors: {
              ...DefaultTheme.colors,
              background: 'white',
            },
          }}
          onReady={onLayoutRootView}
          documentTitle={{
            formatter: () => "Duolicious"
          }}
        >
          <StatusBar
            translucent={true}
            backgroundColor="transparent"
            barStyle="dark-content"
          />
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              presentation: 'modal',
            }}
          >
            {
              isSignedIn ? (
                <>
                  <Tab.Screen name="Home" component={HomeTabs} />

                  <Tab.Screen name="TODO" component={ProspectProfileScreen} />

                  <Tab.Screen name="Conversation Screen" component={ConversationScreen} />
                  <Tab.Screen name="Gallery Screen" component={GalleryScreen} />
                  <Tab.Screen name="Prospect Profile Screen" component={ProspectProfileScreen} />
                </>
              ) : (
                <>
                  <Tab.Screen name="Welcome" component={WelcomeScreen} />
                </>
              )
            }
          </Stack.Navigator>
        </NavigationContainer>
      }
      <WebSplashScreen loading={isLoading}/>
    </>
  );
};

export default App;
export {
  isSignedIn,
  setIsSignedIn
};
