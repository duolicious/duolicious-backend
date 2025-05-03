import { AppState, Platform } from 'react-native';
import { registerPushToken } from '../chat/application-layer';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { notifyOnWeb } from './web';

type MaybeToken = { token: string | null } | null;

const requestPermissionOnWeb = async (): Promise<MaybeToken> => {
  if (Platform.OS !== 'web') {
    return { token: null };
  }

  if (Notification.permission === 'granted') {
    return { token: null };
  }

  const permission = await Notification.requestPermission();

  if (permission !== 'granted') {
    console.warn('Permissions not granted');
    return { token: null };
  }

  notifyOnWeb(
    'Duolicious',
    'Here’s what a message will look like 💜',
    true
  );

  return { token: null };
};


const requestPermissionOnMobile = async (): Promise<MaybeToken> => {
  const { status } = await Notifications.getPermissionsAsync();
  const finalStatus =
    status === 'granted' ?
    status :
    (await Notifications.requestPermissionsAsync()).status;

  if (finalStatus !== 'granted') {
    console.error('Failed to get push token for push notification!');
    return null;
  }

  // The setNotificationChannelAsync must be called before
  // getDevicePushTokenAsync or getExpoPushTokenAsync to obtain a push token.
  //
  // SRC: https://docs.expo.dev/versions/latest/sdk/notifications/#permissions

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: AppState.currentState !== 'active',
      shouldShowList: AppState.currentState !== 'active',
      shouldPlaySound: AppState.currentState !== 'active',
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas.projectId;
  const token = await Notifications.getExpoPushTokenAsync({ projectId });

  return { token: token.data };
};


const getAndRegisterPushToken = async (): Promise<void> => {
  const maybeToken = Platform.OS === 'web'
    ? await requestPermissionOnWeb()
    : await requestPermissionOnMobile();

  if (!maybeToken) {
    return;
  }

  registerPushToken(maybeToken.token);
};

export {
  getAndRegisterPushToken,
};
