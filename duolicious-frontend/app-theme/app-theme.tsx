import { StatusBar } from 'react-native';
import { useEffect, useState } from 'react';
import { listen, notify, lastEvent } from '../events/events';
import { appThemeName as kvAppThemeName } from '../kv-storage/app-theme';
import { useSignedInUser } from '../events/signed-in-user';
import { assertNever } from '../util/util';

type AppThemeName = 'light' | 'dark';

type AppTheme = {
  primaryColor: string
  secondaryColor: string
  hintColor: string
  inputColor: string
  card: {
    borderTopColor: string
    borderLeftColor: string
    borderRightColor: string
    borderBottomColor: string
  },
  interactiveBorderColor: string
  quizCardColor: string
  quizCardBackgroundColor: string
  speechBubbleOtherUserBackgroundColor: string
  speechBubbleOtherUserColor: string
  brandColor: string
  avatarBackgroundColor: string
  avatarColor: string
};

type AppThemes = Record<AppThemeName, AppTheme>;

const APP_THEME: AppThemes = {
  light: {
    primaryColor: '#ffffff',
    secondaryColor: '#000000',
    hintColor: '#999999',
    inputColor: '#eeeeee',
    card: {
      borderTopColor: '#eeeeee',
      borderLeftColor: '#dddddd',
      borderRightColor: '#dddddd',
      borderBottomColor: '#dddddd',
    },
    interactiveBorderColor: '#dddddd',
    quizCardBackgroundColor: '#ffffff',
    quizCardColor: '#7700ff',
    speechBubbleOtherUserBackgroundColor: '#eeeeee',
    speechBubbleOtherUserColor: '#000000',
    brandColor: '#7700ff',
    avatarBackgroundColor: '#f1e5ff',
    avatarColor: 'rgba(119, 0, 255, 0.2)',
  },
  dark: {
    primaryColor: '#1a1a1e',
    secondaryColor: '#ffffff',
    hintColor: '#999999',
    inputColor: '#222327',
    card: {
      borderTopColor: '#000000',
      borderLeftColor: '#000000',
      borderRightColor: '#000000',
      borderBottomColor: '#000000',
    },
    interactiveBorderColor: '#000000',
    quizCardBackgroundColor: '#2c2c33',
    quizCardColor: '#000000',
    speechBubbleOtherUserBackgroundColor: '#2a2b35',
    speechBubbleOtherUserColor: '#ffffff',
    brandColor: '#ffffff',
    avatarBackgroundColor: '#2a2b35',
    avatarColor: '#ffffff',
  }
};

const EVENT_KEY = 'updated-theme';

const setAppBarStyle = (appThemeName: AppThemeName) => {
  if (appThemeName === 'dark') {
    StatusBar.setBarStyle('light-content');
  } else if (appThemeName === 'light') {
    StatusBar.setBarStyle('dark-content');
  } else {
    assertNever(appThemeName);
  }

  StatusBar.setTranslucent(true);

  StatusBar.setBackgroundColor('transparent');
};

// React hook for components to subscribe to changes
const useAppTheme = (): { appThemeName: AppThemeName, appTheme: AppTheme } => {
  const initialAppThemeName = lastEvent<AppThemeName>(EVENT_KEY) ?? 'light';

  const [appThemeName, setAppThemeName] = useState<AppThemeName>(
    initialAppThemeName
  );

  useEffect(() => {
    return listen<AppThemeName>(
      EVENT_KEY,
      (v) => {
        if (v) {
          setAppThemeName(v);
        }
      }
    );
  }, []);

  return { appThemeName, appTheme: APP_THEME[appThemeName] };
};

const setAppThemeName = (appThemeName: AppThemeName) => {
  kvAppThemeName(appThemeName);

  notify<AppThemeName>(EVENT_KEY, appThemeName);

  setAppBarStyle(appThemeName);
};

const loadAppTheme = async (hasGold: boolean) => {
  const appThemeName = hasGold ? await kvAppThemeName() : 'light';

  notify<AppThemeName>(EVENT_KEY, appThemeName);

  setAppBarStyle(appThemeName);
};

const useAppThemeLoader = () => {
  const [signedInUser] = useSignedInUser();

  useEffect(() => {
    loadAppTheme(signedInUser?.hasGold ?? false);
  }, [signedInUser?.hasGold]);

};


export {
  AppTheme,
  AppThemeName,
  AppThemes,
  useAppThemeLoader,
  setAppThemeName,
  useAppTheme,
};
