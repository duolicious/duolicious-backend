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
      projectId: "73076e4e-4594-49a9-9ed1-eac9c3ee05c8"
    },
    apiUrl: process.env.DUO_API_URL,
  },
  ios: {
    bundleIdentifier: "app.duolicious"
  }
};

export default config;
