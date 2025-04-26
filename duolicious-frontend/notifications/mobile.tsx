import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

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
