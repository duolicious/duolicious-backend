import {
  Platform,
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
import { OtpInput } from './otp-input';
import { createAccountOptionGroups } from '../data/option-groups';
import { OptionScreen } from './option-screen';
import { japi } from '../api/api';
import {
  randomGagMaintenanceNotice,
  randomGagUpdateNotice,
} from '../data/gag-utility-notices';

const UtilityScreen = ({
  serverStatus
}: {
  serverStatus:
    | "down for maintenance"
    | "please update"
}) => {
  const getBody = () => {
    if (serverStatus === "down for maintenance") {
      return randomGagMaintenanceNotice();
    }
    if (serverStatus === "please update") {
      return randomGagUpdateNotice();
    }

    // Just in case the type signature is a lie
    return randomGagMaintenanceNotice();
  };

  const getTitle = () => {
    if (serverStatus === "down for maintenance") {
      return "Down For Maintenance";
    }
    if (serverStatus === "please update") {
      if (Platform.OS === 'web') {
        return "Please Refresh This Page 😇"
      } else {
        return "Please Update Your App 😇"
      }
    }

    // Just in case the type signature is a lie
    return "Down For Maintenance";
  };

  const title_ = useMemo(getTitle, [serverStatus]);
  const body_ = useMemo(getBody, [serverStatus]);

  return (
    <View
      style={{
        backgroundColor: '#70f',
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: '100%',
          maxWidth: 600,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 10,
        }}
      >
        <Text
          style={{
            color: 'white',
            alignSelf: 'center',
            fontFamily: 'TruenoBold',
            fontSize: 24,
            textAlign: 'center',
          }}
          selectable={false}
        >
          Duolicious
        </Text>
        <DefaultText
          style={{
            fontSize: 48,
            color: 'white',
            marginTop: 40,
            marginBottom: 40,
            textAlign: 'center',
          }}
        >
          {title_}
        </DefaultText>
        <DefaultText
          style={{
            color: 'white',
            textAlign: 'center',
          }}
        >
          {body_}
        </DefaultText>
      </View>
    </View>
  );
};

export {
  UtilityScreen,
};
