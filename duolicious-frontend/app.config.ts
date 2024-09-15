import { ExpoConfig } from 'expo/config';

// In SDK 46 and lower, use the following import instead:
// import { ExpoConfig } from '@expo/config-types';

const config: ExpoConfig = {
  name: 'Duolicious',
  slug: 'duolicious',
  version: "20.0.0",
  orientation: "portrait",
  icon: './assets/icon.png',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#7700ff',
  },
  updates: {
    fallbackToCacheTimeout: 0
  },
  assetBundlePatterns: [
    "**/*"
  ],
  androidNavigationBar: {
    barStyle: "dark-content",
    backgroundColor: '#ffffff'
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
  web: {
    favicon: "./assets/favicon.png"
  },
  ios: {
    bundleIdentifier: "app.duolicious",
    supportsTablet: false,
    associatedDomains: ["applinks:get.duolicious.app"],
    appStoreUrl: "https://apps.apple.com/us/app/duolicious-dating-app/id6499066647",
  },
  android: {
    googleServicesFile: "./google-services.json",
    package: "app.duolicious",
    versionCode: 20,
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff"
    },
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: "https",
            host: "get.duolicious.app"
          }
        ],
        category: ["BROWSABLE", "DEFAULT"]
      }
    ],
    playStoreUrl: "https://play.google.com/store/apps/details?id=app.duolicious",
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
};

export default config;
