import {
  Platform,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

const storeKv = async (
  key: string,
  value?: string | null
): Promise<string | null | void> => {
  if (Platform.OS === "web") {
    return await storeKvWeb(key, value);
  } else {
    return await storeKvMobile(key, value);
  }
};

export {
  storeKv,
}
