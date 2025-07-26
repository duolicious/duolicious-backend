import { ExpoConfig } from 'expo/config';

// In SDK 46 and lower, use the following import instead:
// import { ExpoConfig } from '@expo/config-types';

const config: ExpoConfig = {
  name: 'Duolicious',
  slug: 'duolicious',
  version: "30.5.0",
  orientation: "portrait",
  icon: './assets/icon.png',
  newArchEnabled: true,
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
    audioUrl: process.env.DUO_AUDIO_URL,
    statusUrl: process.env.DUO_STATUS_URL,
    inviteUrl: process.env.DUO_INVITE_URL,
    webVersion: process.env.DUO_WEB_VERSION,
    tenorApiKey: process.env.DUO_TENOR_API_KEY,
    notificationIconUrl: process.env.NOTIFICATION_ICON_URL,
    notificationSoundUrl: process.env.NOTIFICATION_SOUND_URL,
  },
  web: {
    favicon: "./assets/favicon.png"
  },
  ios: {
    bundleIdentifier: "app.duolicious",
    supportsTablet: false,
    associatedDomains: ["applinks:get.duolicious.app"],
    appStoreUrl: "https://apps.apple.com/us/app/duolicious-dating-app/id6499066647",
    infoPlist: {
      NSMicrophoneUsageDescription: "This app uses the microphone to capture audio for updating and sharing on your profile.",
      NSCameraUsageDescription: "This app uses the camera to capture images for verifying your profile.",
      ITSAppUsesNonExemptEncryption: false
    },
  },
  android: {
    googleServicesFile: "./google-services.json",
    package: "app.duolicious",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#7700ff"
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
    blockedPermissions: [
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
    ],
  },
  plugins: [
    "expo-image-picker",
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
    ],
    [
      "expo-splash-screen",
      {
        backgroundColor: "#7700ff",
        image: "./assets/splash.png",
        imageWidth: 300,
      }
    ]
  ],
};

export default config;
