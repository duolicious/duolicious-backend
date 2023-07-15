import {
  ActivityIndicator,
  Animated,
  LayoutAnimation,
  Linking,
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
import { TraitsTab } from './components/traits-tab';
import { ConversationScreen } from './components/conversation-screen';
import { GalleryScreen, ProspectProfileScreen } from './components/prospect-profile-screen';
import { WelcomeScreen } from './components/welcome-screen';
import { InDepthScreen } from './components/prospect-profile-screen';
import { sessionToken } from './session-token/session-token';
import { japi } from './api/api';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// TODO: iOS UI testing
// TODO: Delete 'getRandomInt' definitions
// TODO: Delete 'delay' definitions
// TODO: Notifications for new messages
// TODO: Privacy Policy, Terms and Conditions
// TODO: r9k algorithm on intros, or plagiarism detection?
// TODO: Add the ability to reply to things (e.g. pictures, quiz responses) from people's profiles. You'll need to change the navigation to make it easier to reply to things. Consider breaking profiles into sections which can be replied to, each having one image or block of text. Letting people reply to specific things on the profile will improve intro quality.
// TODO: A profile prompts. e.g. "If I had three wishes, I'd wish for...", "My favourite move is..."
// TODO: Picture verification and a way to filter users by verified pics

// TODO: Add more ways to sign up. Make sign-up really, really easy
// TODO: Think more about mechanisms in place to stop women getting too many messages. Think about the setting which lets women message first. e.g. The initial message filter tells you what you *shouldn't* do; It'd be nice to have something which tells you what you should do. Is it okay to let anyone message anyone else by default?
//
// TODO: Users should alter their own scores, not the scores of others
// TODO: X-Frame-Options: DENY
// TODO: Try minifying the app
// TODO: Quiz card stack doesn't update after logging out


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
      <Tab.Screen name="Inbox" component={InboxTab} />
      <Tab.Screen name="Traits" component={TraitsTab} />
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

let isSignedIn: boolean;
let setIsSignedIn: React.Dispatch<React.SetStateAction<typeof isSignedIn>>;

let referrerId: string | undefined;
let setReferrerId: React.Dispatch<React.SetStateAction<typeof referrerId>>;

let units: 'Metric' | 'Imperial';
let setUnits: React.Dispatch<React.SetStateAction<typeof units>>;

const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  [referrerId, setReferrerId] = useState<string | undefined>();
  [isSignedIn, setIsSignedIn] = useState(false);
  [units, setUnits] = useState('Metric');

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
      const response = await japi('post', '/check-session-token');
      if (response.ok) {
        setIsSignedIn(Boolean(response?.json?.onboarded));
        setUnits(response?.json?.units === 'Imperial' ? 'Imperial' : 'Metric');
      } else {
        setIsSignedIn(false);
      }
    }
  }, []);

  const updateReferrerId = useCallback(async () => {
    setReferrerId((await Linking.getInitialURL()).match(/\/me\/(\d+)$/)?.at(1));
  }, []);

  useEffect(() => {
    (async () => {
      await Promise.all([
        loadFonts(),
        lockScreenOrientation(),
        fetchSignInState(),
        updateReferrerId(),
      ]);

      setIsLoading(false);
    })();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (!isLoading) {
      await SplashScreen.hideAsync();
    }
  }, [isLoading]);

  return (
    <>
      {!isLoading &&
        <NavigationContainer
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
              referrerId !== undefined ? (
                <Tab.Screen name="Traits Screen" component={TraitsTab} />
              ) : isSignedIn ? (
                <>
                  <Tab.Screen name="Home" component={HomeTabs} />
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
  referrerId,
  setIsSignedIn,
  units,
};
