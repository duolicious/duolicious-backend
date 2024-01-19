import {
  Linking,
  Platform,
  StatusBar,
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
import { sessionToken } from '../kv-storage/session-token';
import { Logo16 } from './logo';

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
            {/* Date, chat & make new friends */}
            Online dating exclusively for 4chan
          </DefaultText>
        </View>
        <View style={{
          justifyContent: 'flex-start',
          flex: 1,
        }}>
          <DefaultTextInput
            style={{
            }}
            placeholder="Enter your email to begin"
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            autoCapitalize="none"
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
            We couldn’t send an email there
          </DefaultText>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              marginLeft: 20,
              marginRight: 20,
            }}
          >
            <SuffixButton suffix="@gmail.com" />
            <SuffixButton suffix="@proton.me" />
            <SuffixButton suffix="@yahoo.com" />
            <SuffixButton suffix="@hotmail.com" />
            <SuffixButton suffix="@outlook.com" />
          </View>
        </View>
        <View
          style={{
            justifyContent: 'center',
            padding: 20,
            paddingBottom: 20,
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
            <Text style={{fontWeight: '700'}}>Sign Up</Text>
            {} or {}
            <Text style={{fontWeight: '700'}}>Sign In</Text>
          </ButtonWithCenteredText>
          <DefaultText
            style={{
              color: 'white',
              textAlign: 'center',
              alignSelf: 'center',
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
            {} and {}
            <DefaultText
              style={{ fontWeight: '600' }}
              onPress={() => Linking.openURL('https://duolicious.app/privacy')}
            >
              Privacy Policy
            </DefaultText>
          </DefaultText>
        </View>
      </View>
    </View>
  );
};

export {
  WelcomeScreen,
};
