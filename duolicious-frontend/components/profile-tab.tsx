import {
  Linking,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import {
  useCallback,
  useState,
} from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ButtonForOption } from './button/option';
import { VerificationBadge } from './verification-badge';
import { DuoliciousTopNavBar } from './top-nav-bar';
import { OptionScreen } from './option-screen';
import { Title } from './title';
import { DefaultLongTextInput } from './default-long-text-input';
import {
  basicsOptionGroups,
  contactOptionGroups,
  deactivationOptionGroups,
  deletionOptionGroups,
  generalSettingsOptionGroups,
  notificationSettingsOptionGroups,
  privacySettingsOptionGroups,
  verificationOptionGroups,
} from '../data/option-groups';
import { Images } from './images';
import { DefaultText } from './default-text';
import { sessionToken } from '../kv-storage/session-token';
import { api } from '../api/api';
import { setSignedInUser } from '../App';

const Stack = createNativeStackNavigator();

const ProfileTab = ({navigation}) => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Profile Tab" component={ProfileTab_} />
      <Stack.Screen name="Profile Option Screen" component={OptionScreen} />
    </Stack.Navigator>
  );
};

const ProfileTab_ = ({navigation}) => {
  return (
    <>
      <DuoliciousTopNavBar/>
      <ScrollView
        contentContainerStyle={{
          paddingLeft: 10,
          paddingRight: 10,
          paddingBottom: 20,
          maxWidth: 600,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        <Title>Profile Pictures</Title>
        <Images/>
        <About navigation={navigation}/>
      </ScrollView>
    </>
  );
};

const About = ({navigation}) => {
  const [isLoadingSignOut, setIsLoadingSignOut] = useState(false);

  const Button_ = (props) => {
    return <ButtonForOption
      navigation={navigation}
      navigationScreen="Profile Option Screen"
      {...props}
    />;
  }

  const signOut = useCallback(async () => {
    setIsLoadingSignOut(true);
    if ((await api('post', '/sign-out')).ok) {
      await sessionToken(null);
      setSignedInUser(undefined);
    }
    setIsLoadingSignOut(false);
  }, [navigation]);

  return (
    <View>
      <Title>About</Title>
      <DefaultLongTextInput/>
      <View style={{flexDirection: 'row'}}>
        <Title>Verification</Title>
        <VerificationBadge/>
      </View>
      <Button_ optionGroups={verificationOptionGroups}/>
      <Title>Basics</Title>
      {
        basicsOptionGroups.map((_, i) => {
          return <Button_ key={i} optionGroups={basicsOptionGroups.slice(i)}/>
        })
      }
      <Title>General Settings</Title>
      {
        generalSettingsOptionGroups.map((_, i) => {
          return <Button_ key={i} optionGroups={generalSettingsOptionGroups.slice(i)}/>
        })
      }
      <Title>Notification Settings</Title>
      {
        notificationSettingsOptionGroups.map((_, i) => {
          return <Button_ key={i} optionGroups={notificationSettingsOptionGroups.slice(i)}/>
        })
      }
      <Title>Privacy Settings</Title>
      {
        privacySettingsOptionGroups.map((_, i) => {
          return <Button_ key={i} optionGroups={privacySettingsOptionGroups.slice(i)}/>
        })
      }

      <Title>Sign Out</Title>
      <ButtonForOption onPress={signOut} label="Sign Out" setting="" loading={isLoadingSignOut}/>

      <Title>Deactivate Your Account</Title>
      <Button_ optionGroups={deactivationOptionGroups} setting="" showSkipButton={false}/>

      <Title>Delete Your Account</Title>
      <Button_ optionGroups={deletionOptionGroups} setting=""/>

      <Title>Contact Us</Title>
      <Button_ optionGroups={contactOptionGroups} setting="" showSkipButton={false}/>

      <Title style={{textAlign: 'center', color: '#999'}}>About</Title>
      <Pressable
        onPress={() => Linking.openURL('https://github.com/duolicious')}
      >
        <DefaultText
          style={{
            textAlign: 'center',
            color: '#999',
          }}
        >
          Duolicious is free software licensed under the AGPLv3. The source code used to make Duolicious is available
          <DefaultText style={{fontWeight: '600', color: '#37f'}}>
            {' '}here
          </DefaultText>
          .
        </DefaultText>
      </Pressable>
    </View>
  );
};

export default ProfileTab;
