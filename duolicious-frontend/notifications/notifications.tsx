import { AppState, Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { registerPushToken } from '../xmpp/xmpp';

const setNofications = () => {
  if (!Device.isDevice) {
    return;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: AppState.currentState !== 'active',
      shouldPlaySound: AppState.currentState !== 'active',
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }
}

const registerForPushNotificationsAsync = async (): Promise<void> => {
  if (!Device.isDevice) {
    return;
  }

  const { status } = await Notifications.getPermissionsAsync();
  const finalStatus =
    status === 'granted' ?
    status :
    (await Notifications.requestPermissionsAsync()).status;

  if (finalStatus !== 'granted') {
    console.error('Failed to get push token for push notification!');
    return;
  }

  const projectId = Constants.expoConfig?.extra?.eas.projectId;
  const token = await Notifications.getExpoPushTokenAsync({ projectId });

  registerPushToken(token.data);
};

export {
  setNofications,
  registerForPushNotificationsAsync,
};
