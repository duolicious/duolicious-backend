import {
  Text,
  View,
} from 'react-native';
import {
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

// TODO: Pressing enter at enter field should continue
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

      <Stack.Screen name="Create Account Screen" component={OptionScreen} />

      <Stack.Screen name="Welcome Back Screen" component={WelcomeBackScreen} />
    </Stack.Navigator>
  );
};

const WelcomeScreen_ = ({navigation}) => {
  const [email, setEmail] = useState("");
  const [buttonIsLoading, setButtonIsLoading] = useState(false);
  const [emailNotSent, setEmailNotSent] = useState(false);

  const onPressCreateAccountOrSignIn = async () => {
    setButtonIsLoading(true);

    const response = await japi(
      'post',
      '/request-otp',
      { email: email }
    );

    setButtonIsLoading(false);

    if (response.ok) {
      navigation.navigate(
        'Create Account Screen',
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
            onPress={onPressCreateAccountOrSignIn}
            borderWidth={0}
            secondary={true}
            loading={buttonIsLoading}
          >
            Create Account or Sign In
          </ButtonWithCenteredText>
        </View>
      </View>
    </View>
  );
};

const WelcomeBackScreen = ({navigation}) => {
  const [isCodeIncorrect, setIsCodeIncorrect] = useState(false);

  const onPressSignIn = () => {
    navigation.reset({
      index: 0,
      routes: [{name: 'Q&A'}],
    });
  };

  return (
    <View
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#70f',
        justifyContent: 'center',
      }}
    >
      <DefaultText
        style={{
          textAlign: 'center',
          alignSelf: 'center',
          color: 'white',
          fontSize: 20,
        }}
      >
        Welcome back,
      </DefaultText>
      <DefaultText
        style={{
          textAlign: 'center',
          alignSelf: 'center',
          color: 'white',
          fontSize: 60,
        }}
      >
        Rahim!
      </DefaultText>
      <DefaultText
        style={{
          textAlign: 'center',
          marginTop: 60,
          marginBottom: 20,
          alignSelf: 'center',
          color: 'white',
        }}
      >
        To sign in, enter the one-time code you just received
      </DefaultText>
      <OtpInput codeLength={6}/>
      <DefaultText
        style={{
          textAlign: 'center',
          color: '#faa',
          fontWeight: '600',
          height: 30,
        }}
      >
        {isCodeIncorrect ? 'Incorrect code' : ''}
      </DefaultText>
      <ButtonWithCenteredText
        containerStyle={{
          marginTop: 0,
          marginLeft: 20,
          marginRight: 20,
        }}
        fontSize={14}
      >
        Resend code
      </ButtonWithCenteredText>
      <ButtonWithCenteredText
        containerStyle={{
          marginTop: 40,
          marginLeft: 20,
          marginRight: 20,
        }}
        borderColor="black"
        secondary={true}
        onPress={onPressSignIn}
      >
        Sign in
      </ButtonWithCenteredText>
    </View>
  );
};

export {
  WelcomeScreen,
};
