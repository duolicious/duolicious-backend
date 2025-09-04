import 'react-native-get-random-values';
import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import Constants, { ExecutionEnvironment } from "expo-constants";
import { notify, lastEvent } from '../events/events';
import { getSignedInUser } from '../events/signed-in-user';

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const API_KEYS = {
  apple: 'appl_kZWpuQifTvzoMWXaHawKZLSyEIf',
  google: 'goog_QNjAZZCsYwDXpCKuefskbAPUyje',
  web: 'rcb_MXlKZzQKIINGfBiYlObkCLZXxzrH',
};

const ensurePurchasesConfigured = async () => {
  const personUuid = getSignedInUser()?.personUuid;

  if (!personUuid) {
    return;
  }

  if (lastEvent('purchases-configured')) {
    await Purchases.logIn(personUuid);
    return;
  }

  Purchases.setDebugLogsEnabled(isExpoGo);

  if (isExpoGo) {
    await Purchases.configure({ appUserID: personUuid, apiKey: API_KEYS.web });
  } else if (Platform.OS === 'android') {
    await Purchases.configure({ appUserID: personUuid, apiKey: API_KEYS.google });
  } else if (Platform.OS ==='ios')  {
    await Purchases.configure({ appUserID: personUuid, apiKey: API_KEYS.apple });
  } else if (Platform.OS === 'web') {
    await Purchases.configure({ appUserID: personUuid, apiKey: API_KEYS.web });
  }

  notify('purchases-configured', true);
};

export {
  ensurePurchasesConfigured,
};
