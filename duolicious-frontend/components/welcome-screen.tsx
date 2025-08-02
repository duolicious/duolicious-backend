import {
  Animated,
  Keyboard,
  Linking,
  Platform,
  SafeAreaView,
  StatusBar,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DefaultText } from './default-text';
import { DefaultTextInput } from './default-text-input';
import { ButtonWithCenteredText } from './button/centered-text';
import { createAccountOptionGroups } from '../data/option-groups';
import { OptionScreen } from './option-screen';
import { japi } from '../api/api';
import { sessionToken } from '../kv-storage/session-token';
import { Logo16 } from './logo';
import { KeyboardDismissingView } from './keyboard-dismissing-view';
import { otpDestination } from '../App';
import { signedInUser } from '../App';
import { joinClub } from '../club/club';
import { isMobile } from '../util/util';

const activeMembersText = (
  numActiveMembers: number,
  minActiveMembers: number,
  minText: string,
) => {
  if (numActiveMembers < minActiveMembers) {
    return minText;
  } else {
    return (
      `${numActiveMembers.toLocaleString()} active member` +
      (numActiveMembers === 1 ? '' : 's')
    );
  }
};

const ActiveMembers = ({
  numActiveMembers,
  minActiveMembers,
  color,
  minText = 'on the Duolicious dating app',
}: {
  numActiveMembers: number,
  minActiveMembers: number
  color: string,
  minText?: string,
}) => {
  const opacity = useRef(new Animated.Value(1)).current;

  const [displayText, setDisplayText] = useState(
    activeMembersText(numActiveMembers, minActiveMembers, minText));

  const [nextDisplayText, setNextDisplayText] = useState(displayText);

  const isFirstRender = useRef(true);

  useEffect(() => {
    setNextDisplayText(
      activeMembersText(numActiveMembers, minActiveMembers, minText));
  }, [numActiveMembers, minActiveMembers]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false; // Mark as not first render anymore
      return; // Skip animation on first render
    }

    // Fade out, change text, and fade in sequence
    Animated.sequence([
      // Fade out
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true
      })
    ]).start(() => {
      setDisplayText(nextDisplayText);

      // Fade in
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true
      }).start();
    });
  }, [nextDisplayText]);

  return (
    <Animated.Text
      style={{
        textAlign: 'center',
        color,
        opacity,
        fontFamily: 'MontserratRegular',
      }}
    >
      {displayText}
    </Animated.Text>
  );
};

const Stack = createNativeStackNavigator();

const WelcomeScreen = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Welcome Screen" component={WelcomeScreen_} />
      <Stack.Screen name="Create Account Or Sign In Screen" component={OptionScreen} />
    </Stack.Navigator>
  );
};

const InviteScreen = ({navigation, route}) => {
  const [loading, setLoading] = useState(false);

  const clubName = route.params?.clubName as string | undefined;
  const [numUsers, setNumUsers] = useState<number | undefined>(undefined);

  if (typeof clubName !== 'string') {
    throw new Error('clubName should be a string');
  }

  const submit = async () => {
    if (signedInUser) {
      setLoading(true);

      await joinClub(clubName, numUsers ?? 0, true);

      setLoading(false);

      if (Platform.OS === 'web') {
        history.pushState((history?.state ?? 0) + 1, "", "/#");
      }

      navigation.reset({
        routes: [
          {
            name: "Home",
            state: {
              routes: [
                {
                  name: "Search"
                }
              ]
            }
          }
        ]
      });
    } else {
      navigation.reset({
        routes: [
          {
            name: 'Welcome',
            state: {
              routes: [
                {
                  name: 'Welcome Screen',
                  params: { clubName, numUsers }
                },
              ]
            },
          },
        ],
      });
    }
  };

  useEffect(() => {
    const updateNumUsers = async () => {
      const response = await japi(
          'GET',
          '/stats?club-name=' + encodeURIComponent(clubName));

      if (!response.ok)
        return;

      setNumUsers(response.json.num_active_users);
    };

    if (numUsers === undefined) {
      updateNumUsers();
    }
  }, [clubName, numUsers]);

  return (
    <SafeAreaView
      style={{
        backgroundColor: '#70f',
        width: '100%',
        height: '100%',
      }}
    >
      <KeyboardDismissingView
        style={{
          width: '100%',
          height: '100%',
          maxWidth: 600,
          alignSelf: 'center',
          flexDirection: 'column',
        }}
      >
        <View
          style={{
            marginTop: 10 + (Platform.OS === 'web' ? 0 : StatusBar.currentHeight ?? 0),
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
          }}
        >
          <Logo16 size={32} rectSize={0.3} />
          <Text
            style={{
              color: 'white',
              alignSelf: 'center',
              fontFamily: 'TruenoBold',
              fontSize: 20,
            }}
            selectable={false}
          >
            Duolicious
          </Text>
        </View>
        <View
          style={{
            alignSelf: 'center',
            justifyContent: 'center',
            flex: 1,
            width: '100%',
            paddingHorizontal: 10,
          }}
        >
          <View
            style={{
              backgroundColor: 'white',
              borderRadius: 10,
              shadowOffset: {
                width: 0,
                height: 2,
              },
              shadowOpacity: 0.5,
              shadowRadius: 10,
              elevation: 3,
              paddingTop: 20,
              width: '100%',
            }}
          >
            <View
              style={{
                alignSelf: 'center',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                width: '100%',
                paddingHorizontal: 10,
              }}
            >
              <DefaultText
                style={{
                  textAlign: 'center',
                  color: '#555',
                }}
              >
                You’re invited to join
              </DefaultText>
              <DefaultText
                style={{
                  textAlign: 'center',
                  color: 'black',
                  fontSize: 26,
                  fontFamily: 'MontserratBlack',
                  flexShrink: 1,
                  width: '100%',
                }}
              >
                {clubName}
              </DefaultText>
              <ActiveMembers
                numActiveMembers={numUsers ?? -1}
                minActiveMembers={10}
                color="#555"
              />
            </View>
            <View
              style={{
                justifyContent: 'center',
                padding: 20,
                paddingTop: 40,
                alignSelf: 'flex-start',
                width: '100%',
              }}
            >
              <ButtonWithCenteredText
                onPress={submit}
                borderWidth={0}
                loading={loading}
              >
                <DefaultText style={{fontWeight: '700'}}>
                  Accept Invite
                </DefaultText>
              </ButtonWithCenteredText>
              <DefaultText
                style={{
                  color: '#777',
                  textAlign: 'center',
                  alignSelf: 'center',
                  lineHeight: 28,
                }}
              >
                By joining you agree to our {}
                <DefaultText
                  style={{
                    fontWeight: '600',
                  }}
                  onPress={() => Linking.openURL('https://duolicious.app/terms')}
                >
                  Terms
                </DefaultText>
                {}, {}
                <DefaultText
                  style={{ fontWeight: '600' }}
                  onPress={() => Linking.openURL('https://duolicious.app/privacy')}
                >
                  Privacy Policy
                </DefaultText>
                {} and {}
                <DefaultText
                  style={{ fontWeight: '600' }}
                  onPress={() => Linking.openURL('https://duolicious.app/guidelines')}
                >
                  Community Guidelines
                </DefaultText>
              </DefaultText>
            </View>
          </View>
        </View>
      </KeyboardDismissingView>
    </SafeAreaView>
  );
};

const WelcomeScreen_ = ({navigation, route}) => {
  const clubName_ = (route.params?.clubName) as string | undefined;
  const [numUsers, setNumUsers] = useState<number | undefined>(route.params?.numUsers);

  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loginStatus, setLoginStatus] = useState("")

  const { height } = useWindowDimensions();

  const setEmailSafely = (e: string) => {
    const sanitizedText = e.replace(/\s/g, '');
    setEmail(sanitizedText);
  };

  const submit = async (suffix?: string) => {
    const suffix_ = suffix ?? '';
    const email_ = email + (email.endsWith(suffix_) ? '': suffix_);

    setLoginStatus("");
    setIsLoading(true);
    setEmailSafely(email_);
    otpDestination.value = email_;

    Keyboard.dismiss();

    const response = await japi(
      'post',
      '/request-otp',
      {
        email: email_,
        ...(clubName_ && { pending_club_name: clubName_ }),
      },
      { timeout: 9999 * 1000 },
    );

    setIsLoading(false);

    if (response.ok) {
      await sessionToken(response.json.session_token);

      if (Platform.OS === 'web') {
        history.pushState((history?.state ?? 0) + 1, "", "/#");
      }

      navigation.navigate(
        'Create Account Or Sign In Screen',
        {
          optionGroups: createAccountOptionGroups,
          showSkipButton: false,
          showCloseButton: false,
          showBackButton: true,
          buttonBorderWidth: 0,
          backgroundColor: '#70f',
          color: 'white',
        },
      );
    } else {
      setLoginStatus(
        response.status === 400 ? 'We don’t support that email provider' :
        response.status === 403 ? 'Your account is banned' :
        response.status === 429 ? 'You’re doing that too much' :
        response.status === 460 ? 'Network blocked. Are you using a VPN?' :
        'We couldn’t connect to Duolicious'
      );
    }
  };

  useEffect(() => {
    const updateNumUsers = async () => {
      const response = await japi('GET', '/stats');

      if (!response.ok)
        return;

      setNumUsers(response.json.num_active_users);
    };

    if (numUsers === undefined) {
      updateNumUsers();
    }
  }, [numUsers]);

  const SuffixButton = useCallback(({suffix}) => (
    <ButtonWithCenteredText
      onPress={() => !isLoading && submit(suffix)}
      borderWidth={0}
      secondary={true}
      containerStyle={{
        marginTop: 0,
        marginBottom: 0,
        height: undefined,
      }}
      backgroundColor="rgb(228, 204, 255)"
      textStyle={{
        padding: 10,
        fontSize: 12,
        color: '#70f',
      }}
    >
      {suffix}
    </ButtonWithCenteredText>
  ), [isLoading, submit]);

  return (
    <SafeAreaView
      style={{
        backgroundColor: '#70f',
        width: '100%',
        height: '100%',
      }}
    >
      <KeyboardDismissingView
        style={{
          width: '100%',
          height: '100%',
          maxWidth: 600,
          alignSelf: 'center',
          flexDirection: 'column',
        }}
      >
        <View
          style={{
            marginTop: 10 + (Platform.OS === 'web' ? 0 : StatusBar.currentHeight ?? 0),
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
          }}
        >
          <Logo16 size={32} rectSize={0.3} doAnimate={true} />
          <Text
            style={{
              color: 'white',
              alignSelf: 'center',
              fontFamily: 'TruenoBold',
              fontSize: 20,
            }}
            selectable={false}
          >
            Duolicious
          </Text>
        </View>
        <View
          style={{
            flex: 1,
            alignSelf: 'center',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          <DefaultText
            style={{
              width: 320,
              textAlign: 'center',
              color: 'white',
              fontSize: 26,
              fontFamily: 'MontserratBlack',
            }}
          >
            {clubName_ ?
              `Join ${clubName_} on Duolicious` :
              'Cute dates & dank memes await...'}
          </DefaultText>
          {(Platform.OS === 'web' || height > 500) &&
            <ActiveMembers
              numActiveMembers={numUsers ?? -1}
              minActiveMembers={0}
              color="white"
              minText={'\xa0'}
            />
          }
        </View>
        <View style={{
          justifyContent: 'flex-start',
          flex: 1,
        }}>
          <DefaultTextInput
            placeholder="Enter your email to begin"
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            autoCapitalize="none"
            inputMode="email"
            value={email}
            onChangeText={setEmailSafely}
            onSubmitEditing={isMobile() ? undefined : () => submit()}
            autoFocus={Platform.OS !== 'ios'}
          />
          <DefaultText
            style={{
              alignSelf: 'center',
              marginTop: 5,
              marginLeft: 20,
              marginRight: 20,
              color: 'white',
              opacity: loginStatus !== "" ? 1 : 0
            }}
          >
            {loginStatus || '\xa0'}
          </DefaultText>
          {(Platform.OS === 'web' || height > 500) &&
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                marginTop: 5,
                marginLeft: 20,
                marginRight: 20,
                gap: 10,
              }}
            >
              <SuffixButton suffix="@gmail.com" />
              <SuffixButton suffix="@proton.me" />
              <SuffixButton suffix="@yahoo.com" />
              <SuffixButton suffix="@hotmail.com" />
              <SuffixButton suffix="@outlook.com" />
            </View>
          }
        </View>
        <View
          style={{
            justifyContent: 'center',
            paddingHorizontal: 20,
            paddingBottom: 10,
            alignSelf: 'flex-start',
            width: '100%',
          }}
        >
          <ButtonWithCenteredText
            onPress={() => submit()}
            secondary={true}
            loading={isLoading}
            extraChildren={
              <View style={{ flexDirection: 'row' }}>
                <DefaultText style={{ fontSize: 16, textAlign: 'center', fontWeight: '700' }}>
                  Sign Up
                </DefaultText>
                <DefaultText style={{ fontSize: 16 }}>
                  {} or {}
                </DefaultText>
                <DefaultText style={{ fontSize: 16, textAlign: 'center', fontWeight: '700' }}>
                  Sign In
                </DefaultText>
              </View>
            }
          />
          <DefaultText
            style={{
              color: 'white',
              textAlign: 'center',
              alignSelf: 'center',
              lineHeight: 28,
            }}
          >
            By signing up you agree to our {}
            <DefaultText
              style={{
                fontWeight: '600',
              }}
              onPress={() => Linking.openURL('https://duolicious.app/terms')}
            >
              Terms
            </DefaultText>
            {}, {}
            <DefaultText
              style={{ fontWeight: '600' }}
              onPress={() => Linking.openURL('https://duolicious.app/privacy')}
            >
              Privacy Policy
            </DefaultText>
            {} and {}
            <DefaultText
              style={{ fontWeight: '600' }}
              onPress={() => Linking.openURL('https://duolicious.app/guidelines')}
            >
              Community Guidelines
            </DefaultText>
          </DefaultText>
        </View>
      </KeyboardDismissingView>
    </SafeAreaView>
  );
};

export {
  InviteScreen,
  WelcomeScreen,
};
