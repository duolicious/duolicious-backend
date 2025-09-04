import 'react-native-get-random-values';
import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import Constants, { ExecutionEnvironment } from "expo-constants";
import { notify, lastEvent } from '../events/events';
import { getSignedInUser } from '../events/signed-in-user';

// TODO: I think this should only be initialized once
// TODO: Call these:
//Purchases.logIn
//Purchases.logOut
// TODO: Configure purchases immediately before displaying the paywall, not at
//       app start

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
    await Purchases.configure({ apiKey: API_KEYS.web });
  } else if (Platform.OS === 'android') {
    await Purchases.configure({ apiKey: API_KEYS.google });
  } else if (Platform.OS ==='ios')  {
    await Purchases.configure({ apiKey: API_KEYS.apple });
  } else if (Platform.OS === 'web' && process.env.NODE_ENV === 'development') {
    await Purchases.configure({ apiKey: API_KEYS.web });
  }

  await Purchases.logIn(personUuid);

  notify('purchases-configured', true);
};

export {
  ensurePurchasesConfigured,
};
