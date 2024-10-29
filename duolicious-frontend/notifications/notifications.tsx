import { AppState, Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { registerPushToken } from '../xmpp/xmpp';
import { useEffect } from 'react';

const setNofications = () => {
  if (Platform.OS === 'web') {
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
  if (Platform.OS === 'web') {
    registerPushToken(null);
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

const unpackNotificationResponse = (
  response: Notifications.NotificationResponse | null,
) => {
  if (!response) {
    return null;
  }

  const screen: string = response.notification.request.content.data.screen;
  const params: any = response.notification.request.content.data.params;

  return { screen, params };
}

const useNotificationObserver = (
  func: (screen: string, params: any) => void,
  deps?: React.DependencyList | undefined,
) => {
  if (Platform.OS === 'web') {
    return;
  }

  useEffect(() => {
    const subscription = Notifications
      .addNotificationResponseReceivedListener(response => {
        const notification = unpackNotificationResponse(response);

        if (notification) {
          func(notification.screen, notification.params);
        }
      });

    return () => subscription.remove();
  }, deps);
};

const getLastNotificationResponseAsync = async () => {
  if (Platform.OS === 'web') {
    return null;
  }

  const notification = await Notifications.getLastNotificationResponseAsync();

  return unpackNotificationResponse(notification);
};

export {
  getLastNotificationResponseAsync,
  registerForPushNotificationsAsync,
  setNofications,
  useNotificationObserver,
};
