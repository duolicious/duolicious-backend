import Constants from 'expo-constants';

export const API_URL = Constants.expoConfig?.extra?.apiUrl ?? 'http://localhost:5000';
export const CHAT_URL = Constants.expoConfig?.extra?.chatUrl ?? 'ws://localhost:5443';
export const IMAGES_URL = Constants.expoConfig?.extra?.imagesUrl ?? 'http://localhost:9090/s3-mock-bucket';
export const AUDIO_URL = Constants.expoConfig?.extra?.audioUrl ?? 'http://localhost:9090/s3-mock-audio-bucket';
export const STATUS_URL = Constants.expoConfig?.extra?.statusUrl ?? 'http://localhost:8080';
export const WEB_BASE_URL = Constants.expoConfig?.extra?.webUrl ?? 'http://localhost:8081';
export const WEB_VERSION = Constants.expoConfig?.extra?.webVersion ?? '000000';
export const TENOR_API_KEY = Constants.expoConfig?.extra?.tenorApiKey ?? 'LIVDSRZULELA';
