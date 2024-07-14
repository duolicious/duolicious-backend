import { ExpoConfig } from 'expo/config';

// In SDK 46 and lower, use the following import instead:
// import { ExpoConfig } from '@expo/config-types';

const config: ExpoConfig = {
  name: 'Duolicious',
  slug: 'duolicious',
  icon: './assets/icon.png',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#7700ff',
  },
  androidNavigationBar: {
    barStyle: "dark-content",
    backgroundColor: '#ffffff'
  },
  web: {
    favicon: "./assets/favicon.png"
  },
  extra: {
    eas: {
      projectId: "a756e088-c07a-4034-b9c5-51f50139ac21"
    },
    apiUrl: process.env.DUO_API_URL,
    chatUrl: process.env.DUO_CHAT_URL,
    imagesUrl: process.env.DUO_IMAGES_URL,
    statusUrl: process.env.DUO_STATUS_URL,
  },
  ios: {
    bundleIdentifier: "app.duolicious"
  },
  plugins: [
    "expo-secure-store",
    [
      "expo-notifications",
      {
        "icon": "./assets/notification.png",
        "color": "#7700ff",
        "sounds": [
          "./assets/audio/notification.mp3"
        ]
      }
    ]
  ],
  android: {
    googleServicesFile: "./google-services.json",
    package: "app.duolicious",
    versionCode: 14,
  }
};

export default config;
