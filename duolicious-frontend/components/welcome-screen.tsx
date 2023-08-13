import {
  Text,
  View,
} from 'react-native';
import {
  useCallback,
  useMemo,
  useState,
} from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DefaultText } from './default-text';
import { DefaultTextInput } from './default-text-input';
import { ButtonWithCenteredText } from './button/centered-text';
import { OtpInput } from './otp-input';
import { createAccountOptionGroups } from '../data/option-groups';
import { OptionScreen } from './option-screen';
import { japi } from '../api/api';
import { sessionToken } from '../kv-storage/session-token';

const callToActionList = [
  "Meet people who get you.",
  "Where your weird meets their weird. And it’s, like, super romantic.",
  "Find someone to share memes and existential dread. Cute, right?",
  "Your future ‘we met on an app’ story just got less boring.",
  "Because your next awkward first date story needs an upgrade.",
  "Because your type isn’t ‘generic with a hint of blah’.",
  "The only app where ‘quirky’ isn’t code for ‘has five cats’. Unless that’s your vibe.",
  "We’re not saying we’re the best dating app, but... Actually, yeah, that’s exactly what we’re saying.",
  "Where your quirks aren’t just accepted, they’re kinda the selling point.",
  "Let’s face it, you’re a catch. We’re just the net helping you realize it.",
  "Your solo act is legendary. Time for an equally epic encore with a partner in crime.",
  "If dating's a game, you’re the MVP. Ready to play?",
  "Because ‘forever alone’ is so last decade.",
  "Ready to find someone who’s also too good for most dating apps?",
  "Love might be overrated, but hey, let’s overrate it together.",
  "Where ‘single and thriving’ can also mean ‘open to distractions’.",
  "Your charisma called. It asked for a partner in charm.",
  "The sequel to your single life? We promise it’s a blockbuster.",
  "Your love life could use a plot twist. Ready for the next chapter?",
  "Matching you based on more than just your ability to craft a sassy bio.",
];

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

const WelcomeScreen_ = ({navigation}) => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailNotSent, setEmailNotSent] = useState(false);
  const callToAction = useMemo(() =>
    callToActionList[Math.floor(Math.random() * callToActionList.length)],
    []
  );

  const submit = async (suffix?: string) => {
    const suffix_ = suffix ?? '';
    const email_ = email + (email.endsWith(suffix_) ? '': suffix_);

    setEmailNotSent(false);
    setIsLoading(true);
    setEmail(email_);

    const response = await japi(
      'post',
      '/request-otp',
      { email: email_ }
    );

    setIsLoading(false);

    if (response.ok) {
      await sessionToken(response.json.session_token);

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
      setEmailNotSent(true);
    }
  };

  const SuffixButton = useCallback(({suffix}) => (
    <ButtonWithCenteredText
      onPress={() => !isLoading && submit(suffix)}
      borderWidth={0}
      secondary={true}
      containerStyle={{
        marginTop: 5,
        marginBottom: 5,
        margin: 5,
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
    <View
      style={{
        backgroundColor: '#70f',
        width: '100%',
        height: '100%',
      }}
    >
      <View
        style={{
          width: '100%',
          height: '100%',
          maxWidth: 600,
          alignSelf: 'center',
          flexDirection: 'column',
        }}
      >
        <View style={{
          justifyContent: 'center',
          flexGrow: 1
        }}>
          <Text
            style={{
              color: 'white',
              alignSelf: 'center',
              fontFamily: 'TruenoBold',
              fontSize: 60,
            }}
          >
            Duolicious
          </Text>
          <DefaultText
            style={{
              alignSelf: 'center',
              color: 'white',
              fontSize: 20,
              textAlign: 'center',
              marginLeft: 20,
              marginRight: 20,
            }}
          >
            {callToAction}
          </DefaultText>
          <DefaultTextInput
            style={{
              marginTop: 80,
            }}
            placeholder="Enter your email to begin"
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
            onSubmitEditing={() => submit()}
            autoFocus={true}
          />
          <DefaultText
            style={{
              alignSelf: 'center',
              marginTop: 5,
              marginLeft: 20,
              marginRight: 20,
              color: 'white',
              opacity: emailNotSent ? 1 : 0,
            }}
          >
            We couldn't send an email there. Try again.
          </DefaultText>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              marginLeft: 20,
              marginRight: 20,
            }}
          >
            <SuffixButton suffix="@gmail.com"/>
            <SuffixButton suffix="@yahoo.com"/>
            <SuffixButton suffix="@hotmail.com"/>
            <SuffixButton suffix="@outlook.com"/>
            <SuffixButton suffix="@live.com"/>
            <SuffixButton suffix="@aol.com"/>
          </View>
        </View>
        <View
          style={{
            justifyContent: 'center',
            padding: 20,
            paddingBottom: 40,
            alignSelf: 'flex-start',
            width: '100%',
          }}
        >
          <ButtonWithCenteredText
            onPress={() => submit()}
            borderWidth={0}
            secondary={true}
            loading={isLoading}
          >
            Create Account or Sign In
          </ButtonWithCenteredText>
        </View>
      </View>
    </View>
  );
};

export {
  WelcomeScreen,
};
