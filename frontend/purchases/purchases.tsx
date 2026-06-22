import 'react-native-get-random-values';
import { Platform } from 'react-native';
import Purchases, { PurchasesOffering } from 'react-native-purchases';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { getSignedInUser } from '../events/signed-in-user';
import { memoizeWithTtl } from '../util/util';

/* ─────────────────────────────────────────────────────────────────────────────
   PURE UTILITIES (easy to unit test)
   ─────────────────────────────────────────────────────────────────────────────
*/

type ApiKeys = {
  apple: string;
  google: string;
  web: string;
};

const API_KEYS: ApiKeys = {
  apple: 'appl_kZWpuQifTvzoMWXaHawKZLSyEIf',
  google: 'goog_QNjAZZCsYwDXpCKuefskbAPUyje',
  web: 'rcb_MXlKZzQKIINGfBiYlObkCLZXxzrH',
};

// 5 minutes
const FIVE_MINUTES_MS = 5 * 60 * 1000;

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const selectApiKey = (os: string, expoGo: boolean, keys: ApiKeys): string => {
  if (expoGo) return keys.web;
  if (os === 'android') return keys.google;
  if (os === 'ios') return keys.apple;
  return keys.web;
};

/* ─────────────────────────────────────────────────────────────────────────────
   IMPURE BOUNDARY (side effects / SDK calls kept here)
   ─────────────────────────────────────────────────────────────────────────────
*/

let configuredForAppUserId: string | undefined;
let configureInFlight: Promise<void> | null = null;

const configureForUser = async (personUuid: string, apiKey: string) => {
  Purchases.configure({ appUserID: personUuid, apiKey });
  configuredForAppUserId = personUuid;
};

const logInForUser = async (personUuid: string) => {
  await Purchases.logIn(personUuid);
  configuredForAppUserId = personUuid;
};

const startConfigure = (task: () => Promise<void>): Promise<void> => {
  if (configureInFlight) {
    return configureInFlight;
  }

  configureInFlight = (async () => {
    try {
      await task();
    } finally {
      configureInFlight = null;
    }
  })();

  return configureInFlight;
};

const ensurePurchasesConfigured = async (): Promise<void> => {
  const personUuid = getSignedInUser()?.personUuid;

  if (!personUuid) {
    return;
  }

  if (configuredForAppUserId === personUuid) {
    return;
  }

  const isSwitchingUser = Boolean(
    configuredForAppUserId &&
    configuredForAppUserId !== personUuid
  );

  if (isSwitchingUser) {
    await startConfigure(() => logInForUser(personUuid));
    return;
  }

  Purchases.setDebugLogsEnabled(isExpoGo);
  const apiKey = selectApiKey(Platform.OS, isExpoGo, API_KEYS);
  await startConfigure(() => configureForUser(personUuid, apiKey));
};

/* ─────────────────────────────────────────────────────────────────────────────
   OFFERINGS (5-minute TTL)
   ─────────────────────────────────────────────────────────────────────────────
*/

const fetchCurrentOfferingForUser = async (
  _: string
): Promise<PurchasesOffering | null> => {
  // Note: personUuid is only used for cache keying; Purchases SDK is already
  // configured for the active user when this is called.
  const offerings = await Purchases.getOfferings();
  return offerings?.current ?? null;
};

// Memoized per-user by keyFn = personUuid
const getCurrentOfferingForUserMemoized = memoizeWithTtl<
  PurchasesOffering | null, [string]
>(
  fetchCurrentOfferingForUser,
  FIVE_MINUTES_MS,
  (personUuid) => personUuid
);

const getCurrentOfferingCached = async (): Promise<
  PurchasesOffering | null
> => {
  const personUuid = getSignedInUser()?.personUuid;
  if (!personUuid) return null;

  await ensurePurchasesConfigured();
  const offering = await getCurrentOfferingForUserMemoized(personUuid);
  return offering ?? null;
};

/* ─────────────────────────────────────────────────────────────────────────────
   EXPORTS
   ─────────────────────────────────────────────────────────────────────────────
*/

export {
  ensurePurchasesConfigured,
  getCurrentOfferingCached,
};
