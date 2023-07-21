import {
  Text,
  View,
} from 'react-native';
import {
  useCallback,
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
import { sessionToken } from '../session-token/session-token';

// TODO: You should use the same pattern as for the profile options

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
          <DefaultText
            style={{
              alignSelf: 'center',
              color: 'white',
              fontSize: 20,
            }}
          >
            Welcome to
          </DefaultText>
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
              marginTop: 60,
              marginBottom: 20,
              alignSelf: 'center',
              color: 'white',
            }}
          >
            Enter your email to begin
          </DefaultText>
          <DefaultTextInput
            placeholder="Email address"
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
            onSubmitEditing={() => submit()}
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
