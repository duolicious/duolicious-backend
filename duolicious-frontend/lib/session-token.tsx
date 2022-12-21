import {
  Platform,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'session_token';

const sessionTokenWeb = async (
  token?: string | null
): Promise<string | null | void> => {
  if (token === undefined) {
    return await AsyncStorage.getItem(KEY);
  }

  if (token === null) {
    return await AsyncStorage.removeItem(KEY);
  }

  return await AsyncStorage.setItem(KEY, token)
};

const sessionTokenMobile = async (
  token?: string | null
): Promise<string | null | void> => {
  if (token === undefined) {
    return await SecureStore.getItemAsync(KEY);
  }

  if (token === null) {
    return await SecureStore.deleteItemAsync(KEY);
  }

  return await SecureStore.setItemAsync(KEY, token);
};

const sessionToken = async (
  token?: string | null
): Promise<string | null | void> => {
  if (Platform.OS === "web") {
    return await sessionTokenWeb(token);
  } else {
    return await sessionTokenMobile(token);
  }
};

export {
  sessionToken,
}
