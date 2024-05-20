import {
  Platform,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/*
 * Many users have been complaining that upgrading Duolicious on Android causes
 * it to get stuck on the splash screen. Clearing the app's data fixes the
 * issue.
 *
 * I looked at the errors in Google Play and I'm not sure why this is happening,
 * but I'm guessing it has something to do with issues like these:
 *
 *   * https://github.com/expo/expo/issues/22312
 *   * https://github.com/expo/expo/issues/19018
 *
 * To summarize the issues, the stored data ceases to be readable after
 * upgrading because it can't be decrypted.
 *
 */

const storeKvWeb = async (
  key: string,
  token?: string | null
): Promise<string | null | void> => {
  if (token === undefined) {
    return await AsyncStorage.getItem(key);
  }

  if (token === null) {
    return await AsyncStorage.removeItem(key);
  }

  return await AsyncStorage.setItem(key, token)
};

const storeKvMobile = async (
  key: string,
  token?: string | null
): Promise<string | null | void> => {
  if (token === undefined) {
    return await SecureStore.getItemAsync(key);
  }

  if (token === null) {
    return await SecureStore.deleteItemAsync(key);
  }

  return await SecureStore.setItemAsync(key, token);
};

const storeKvUnsafe = async (
  key: string,
  value?: string | null
): Promise<string | null | void> => {
  if (Platform.OS === "web") {
    return await storeKvWeb(key, value);
  } else {
    return await storeKvMobile(key, value);
  }
};

const storeKv = async (
  key: string,
  value?: string | null
): Promise<string | null | void> => {
  try {
    return await storeKvUnsafe(key, value);
  } catch (e) {
    return await storeKvUnsafe(key, null);
  }
}

export {
  storeKv,
}
