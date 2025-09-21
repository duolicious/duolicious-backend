import 'react-native-get-random-values';
import { Platform } from 'react-native';
import Purchases, { PurchasesOffering } from 'react-native-purchases';
import Constants, { ExecutionEnvironment } from "expo-constants";
import { getSignedInUser } from '../events/signed-in-user';

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Apparently it's safe to hardcode these keys
const API_KEYS = {
  apple: 'appl_kZWpuQifTvzoMWXaHawKZLSyEIf',
  google: 'goog_QNjAZZCsYwDXpCKuefskbAPUyje',
  web: 'rcb_MXlKZzQKIINGfBiYlObkCLZXxzrH',
};

// Track which user ID Purchases is configured/logged in for within this session
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

const ensurePurchasesConfigured = async () => {
  const personUuid = getSignedInUser()?.personUuid;

  if (!personUuid) {
    return;
  }

  // Already configured for this user in this session → no-op
  if (configuredForAppUserId === personUuid) {
    return;
  }

  // If Purchases is configured already (for some user), only log in when switching users
  const isSwitchingUser = !!configuredForAppUserId && configuredForAppUserId !== personUuid;
  if (isSwitchingUser && !configureInFlight) {
    configureInFlight = (async () => {
      try {
        await logInForUser(personUuid);
      } finally {
        configureInFlight = null;
      }
    })();
  }
  if (isSwitchingUser) {
    await (configureInFlight ?? Promise.resolve());
    return;
  }

  Purchases.setDebugLogsEnabled(isExpoGo);

  const apiKey = (
    isExpoGo ? API_KEYS.web :
    Platform.OS === 'android' ? API_KEYS.google :
    Platform.OS === 'ios' ? API_KEYS.apple :
    API_KEYS.web
  );

  if (!configureInFlight) {
    configureInFlight = (async () => {
      try {
        await configureForUser(personUuid, apiKey);
      } finally {
        configureInFlight = null;
      }
    })();
  }
  await (configureInFlight ?? Promise.resolve());
};

// Simple per-user, in-memory cache for the current offering (session-scoped)
const offeringsByUser: Map<string, PurchasesOffering | null> = new Map();
const offeringsInFlightByUser: Map<string, Promise<PurchasesOffering | null>> = new Map();

const getCurrentOfferingCached = async (): Promise<PurchasesOffering | null> => {
  const personUuid = getSignedInUser()?.personUuid;

  if (!personUuid) {
    return null;
  }

  await ensurePurchasesConfigured();

  const cached = offeringsByUser.get(personUuid);
  if (cached !== undefined) {
    return cached;
  }

  let inFlight = offeringsInFlightByUser.get(personUuid);
  if (!inFlight) {
    inFlight = (async () => {
      const offerings = await Purchases.getOfferings();
      const current = offerings?.current ?? null;
      offeringsByUser.set(personUuid, current);
      return current;
    })()
      .finally(() => {
        offeringsInFlightByUser.delete(personUuid);
      });

    offeringsInFlightByUser.set(personUuid, inFlight);
  }

  return inFlight;
};

export {
  ensurePurchasesConfigured,
  getCurrentOfferingCached,
};
