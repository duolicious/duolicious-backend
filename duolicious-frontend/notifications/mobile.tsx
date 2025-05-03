import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

const unpackNotificationResponse = (
  response: Notifications.NotificationResponse | null,
) => {
  if (!response) {
    return null;
  }

  const screen = response.notification.request.content.data.screen as string;
  const params = response.notification.request.content.data.params as any;

  return { screen, params };
}

const useNotificationObserverOnMobile = (
  func: (screen: string, params: any) => void,
  deps?: React.DependencyList | undefined,
) => {
  if (Platform.OS === 'web') {
    return;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
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

const getLastNotificationResponseOnMobile = async () => {
  if (Platform.OS === 'web') {
    return null;
  }

  const notification = await Notifications.getLastNotificationResponseAsync();

  return unpackNotificationResponse(notification);
};

export {
  getLastNotificationResponseOnMobile,
  useNotificationObserverOnMobile,
};
