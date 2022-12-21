import Constants from 'expo-constants';

export const API_SCHEME = Constants.expoConfig.extra.apiScheme ?? 'http';
export const API_HOST = Constants.expoConfig.extra.apiHost ?? 'localhost';
export const API_PORT = Constants.expoConfig.extra.apiPort ?? '5000';
