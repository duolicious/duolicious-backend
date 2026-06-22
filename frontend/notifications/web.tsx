import { AppState, Platform } from 'react-native';
import {
  NOTIFICATION_ICON_URL as icon,
  NOTIFICATION_SOUND_URL as sound,
} from '../env/env';

const playSound = async () => {
  try {
    await new Audio(sound).play();
  } catch (error) {
    console.error('Failed to play sound', error);
  }
};

const notifyOnWeb = async (
  sender: string,
  body: string,
  sendWhenActive: boolean = false,
): Promise<void> => {
  if (Platform.OS !== 'web') {
    ;
  } else if (!('Notification' in window)) {
    console.warn('This browser does not support desktop notifications');
  } else if (AppState.currentState === 'active' && !sendWhenActive) {
    console.warn('App is active, not sending notification');
  } else if (Notification.permission === 'denied') {
    console.warn('Notification permission denied');
  } else if (Notification.permission === 'granted') {
    await playSound();
    new Notification(sender, { body, icon });
  }
};

export {
  notifyOnWeb,
};
