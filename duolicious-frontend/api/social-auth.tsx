import { Platform } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { useEffect, useRef } from 'react';
import {
  APPLE_ANDROID_RETURN_URL,
  APPLE_REDIRECT_URI,
  APPLE_WEB_CLIENT_ID,
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
} from '../env/env';

// Required so that the OAuth redirect dismisses the in-app browser
// session on iOS / Android. Calling this once at module load is the
// pattern documented by Expo.
WebBrowser.maybeCompleteAuthSession();

// Apple's official Sign in with Apple JS SDK. We use it on web so the
// iOS-native bottom-sheet flow (which iOS WebKit injects on
// appleid.apple.com) can deliver the credential back to us — that
// flow uses Apple's internal postMessage protocol and doesn't fire the
// `response_mode=form_post` redirect, so the raw OAuth + window.open
// approach silently fails in iOS Chrome.
const _APPLE_JS_SDK_URL =
  'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';

declare global {
  interface Window {
    AppleID?: {
      auth: {
        init: (config: {
          clientId: string;
          scope: string;
          redirectURI: string;
          state: string;
          nonce: string;
          usePopup: boolean;
        }) => void;
        signIn: () => Promise<{
          authorization: { id_token: string; code: string; state: string };
        }>;
      };
    };
  }
}

let _appleScriptPromise: Promise<void> | null = null;

const _loadAppleScript = (): Promise<void> => {
  if (typeof document === 'undefined') {
    return Promise.reject(new Error('Apple JS SDK can only be loaded on web'));
  }
  if (window.AppleID) return Promise.resolve();
  if (_appleScriptPromise) return _appleScriptPromise;

  _appleScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = _APPLE_JS_SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      _appleScriptPromise = null;
      reject(new Error('Failed to load Apple JS SDK'));
    };
    document.head.appendChild(script);
  });
  return _appleScriptPromise;
};

// Eagerly preload on web so the SDK is ready by the time the user
// taps "Continue with Apple" — keeps the AppleID.auth.signIn() call
// close enough to the user gesture that the popup isn't blocked.
if (Platform.OS === 'web') {
  _loadAppleScript().catch(() => { /* will retry on first use */ });
}

export type SocialSignInResult =
  | { ok: true; idToken: string }
  | { ok: false; cancelled: boolean; reason?: string };

/**
 * Wraps `expo-auth-session/providers/google` so callers get a single
 * async `promptForIdToken()` instead of the request/response/promptAsync
 * tuple. Configures the request to return an `id_token` directly, which
 * is what the backend's `/sign-in-with-google` endpoint expects.
 */
export const useGoogleSignIn = (): {
  ready: boolean;
  promptForIdToken: () => Promise<SocialSignInResult>;
} => {
  // The returned `request` is null until the discovery doc loads.
  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    webClientId: GOOGLE_WEB_CLIENT_ID,
    // `id_token` flow returns a JWT directly from Google; the backend
    // verifies its signature against Google's JWKS. We don't need an
    // access token (we never call Google APIs on behalf of the user).
    responseType: 'id_token',
    scopes: ['openid', 'email'],
  });

  // `useAuthRequest` resolves `promptAsync()` with a result object that
  // describes how the prompt was dismissed; for a successful sign-in the
  // id_token only lands on the separate `response` state. We bridge the
  // two with a deferred resolver and dedup so whichever signal arrives
  // first (the response effect for success, the promptAsync return for
  // cancel/error) settles the promise.
  //
  // Each `promptForIdToken()` call gets its own monotonically-increasing
  // id; settle() refuses to resolve unless the caller's id matches the
  // current pending id. That protects against a cross-talk hazard where
  // a stale `response` (or one re-emitted with the same data) could
  // settle a *later* prompt with a *prior* prompt's token.
  const pendingResolveRef = useRef<
    ((r: SocialSignInResult) => void) | null
  >(null);
  const pendingPromptIdRef = useRef<number | null>(null);
  const promptCounterRef = useRef(0);

  const settle = (id: number, r: SocialSignInResult) => {
    if (pendingPromptIdRef.current !== id) return;
    const resolve = pendingResolveRef.current;
    pendingPromptIdRef.current = null;
    pendingResolveRef.current = null;
    if (resolve) resolve(r);
  };

  useEffect(() => {
    if (!response) return;
    // Only handle success here; cancel/error are settled by the
    // promptAsync return below so we don't double-resolve.
    if (response.type !== 'success') return;
    const id = pendingPromptIdRef.current;
    if (id === null) return;

    const idToken = (response.params as Record<string, string>).id_token;
    if (idToken) {
      settle(id, { ok: true, idToken });
    } else {
      settle(id, { ok: false, cancelled: false, reason: 'No id_token in response' });
    }
  }, [response]);

  const promptForIdToken = (): Promise<SocialSignInResult> => {
    if (!request) {
      return Promise.resolve({
        ok: false,
        cancelled: false,
        reason: 'Google sign-in not ready',
      });
    }
    return new Promise<SocialSignInResult>((resolve) => {
      const id = ++promptCounterRef.current;
      pendingPromptIdRef.current = id;
      pendingResolveRef.current = resolve;
      promptAsync()
        .then((result) => {
          if (result?.type === 'cancel' || result?.type === 'dismiss') {
            settle(id, { ok: false, cancelled: true });
          } else if (result?.type === 'error') {
            settle(id, {
              ok: false,
              cancelled: false,
              reason: result.error?.message ?? 'Google sign-in error',
            });
          }
          // `success` is intentionally left to the response effect so we
          // wait for the id_token to land on `response.params`.
        })
        .catch((err) => {
          settle(id, {
            ok: false,
            cancelled: false,
            reason: (err as Error).message ?? 'Google sign-in failed',
          });
        });
    });
  };

  return {
    ready: !!request,
    promptForIdToken,
  };
};

export type AppleSignInResult =
  | { ok: true; identityToken: string; nonce: string }
  | { ok: false; cancelled: boolean; reason?: string };

const _APPLE_AUTHORIZE_URL = 'https://appleid.apple.com/auth/authorize';

const _generateNonce = async (): Promise<string> => {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

const _buildAppleAuthorizeUrl = (params: {
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
}): string => {
  const u = new URL(_APPLE_AUTHORIZE_URL);
  u.searchParams.set('client_id', params.clientId);
  u.searchParams.set('redirect_uri', params.redirectUri);
  // `code id_token` is the only response type Apple supports alongside
  // the email scope. We discard the code — the id_token alone is what
  // /sign-in-with-apple verifies.
  u.searchParams.set('response_type', 'code id_token');
  u.searchParams.set('response_mode', 'form_post');
  u.searchParams.set('scope', 'email');
  u.searchParams.set('state', params.state);
  // Echoed verbatim into the issued JWT's `nonce` claim. The backend
  // compares this against the value the client passes alongside the
  // token to bind the JWT to this specific sign-in session.
  u.searchParams.set('nonce', params.nonce);
  return u.toString();
};

/**
 * Sign In with Apple across iOS, Android, and web.
 *
 * - iOS uses the native ASAuthorizationAppleIDProvider via
 *   `expo-apple-authentication`. The token's `aud` is the iOS bundle ID.
 * - Android uses Apple's OAuth web flow against a Services ID inside
 *   `WebBrowser.openAuthSessionAsync`. Apple POSTs the result to the
 *   backend's `/auth/apple/callback`, which 302s back to the app's
 *   universal-link return URL with the id_token in a query parameter.
 * - Web uses Apple's official JS SDK with `usePopup: true`. The SDK
 *   opens and owns the popup and receives the credential via its own
 *   internal postMessage protocol — this is the path that works on
 *   iOS WebKit's native Sign-in-with-Apple bottom sheet.
 *
 * We deliberately don't request the FULL_NAME scope: the user picks
 * their display name in the onboarding wizard, so asking Apple for it
 * is just an extra data ask we don't need.
 */
export const signInWithApple = async (): Promise<AppleSignInResult> => {
  if (Platform.OS === 'ios') return signInWithAppleNative();
  if (Platform.OS === 'android') return signInWithAppleAndroid();
  return signInWithAppleWeb();
};

const signInWithAppleNative = async (): Promise<AppleSignInResult> => {
  // Apple echoes this nonce verbatim into the JWT's `nonce` claim. The
  // backend compares it to the value we send alongside the token to bind
  // the token to this client session.
  const nonce = await _generateNonce();
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce,
    });

    return {
      ok: true,
      identityToken: credential.identityToken ?? '',
      nonce,
    };
  } catch (e: any) {
    // ERR_REQUEST_CANCELED is the documented code for the user dismissing
    // the system sheet; don't surface that as an error.
    if (e?.code === 'ERR_REQUEST_CANCELED') {
      return { ok: false, cancelled: true };
    }
    return { ok: false, cancelled: false, reason: e?.message ?? 'Apple sign-in failed' };
  }
};

const signInWithAppleAndroid = async (): Promise<AppleSignInResult> => {
  // The same random nonce serves two purposes:
  //   1. Bound CSRF check on the redirect (prefix of `state`).
  //   2. Bound JWT check on the server (`nonce` URL param → JWT.nonce claim).
  const nonce = await _generateNonce();
  const state = `${nonce}.android`;

  const authUrl = _buildAppleAuthorizeUrl({
    clientId: APPLE_WEB_CLIENT_ID,
    redirectUri: APPLE_REDIRECT_URI,
    state,
    nonce,
  });

  let result: WebBrowser.WebBrowserAuthSessionResult;
  try {
    result = await WebBrowser.openAuthSessionAsync(authUrl, APPLE_ANDROID_RETURN_URL);
  } catch (e: any) {
    return { ok: false, cancelled: false, reason: e?.message ?? 'Apple sign-in failed' };
  }

  if (result.type === 'cancel' || result.type === 'dismiss') {
    return { ok: false, cancelled: true };
  }
  if (result.type !== 'success') {
    return { ok: false, cancelled: false, reason: 'Apple sign-in failed' };
  }

  const params = _parseQueryParams(result.url);
  const error = params.get('apple_error');
  if (error) {
    return { ok: false, cancelled: false, reason: `Apple: ${error}` };
  }
  const idToken = params.get('apple_id_token');
  const returnedState = params.get('apple_state') ?? '';
  if (!idToken) {
    return { ok: false, cancelled: false, reason: 'Apple sign-in: no id_token in callback' };
  }
  if (!returnedState.startsWith(`${nonce}.`)) {
    return { ok: false, cancelled: false, reason: 'Apple sign-in: invalid state' };
  }

  return { ok: true, identityToken: idToken, nonce };
};

// Web sign-in delegates the popup dance to Apple's JS SDK. With
// `usePopup: true`, the SDK opens a popup it controls and receives the
// credential via its own internal postMessage protocol — `redirectURI`
// is still required (and still must be registered against the Services
// ID) but Apple never actually POSTs to it in the popup path. The
// backend's `/auth/apple/callback` endpoint therefore only handles the
// Android flow.
const signInWithAppleWeb = async (): Promise<AppleSignInResult> => {
  // See `signInWithAppleAndroid` — same nonce binds CSRF (state prefix)
  // and the server-side JWT.nonce verification.
  const nonce = await _generateNonce();
  const state = `${nonce}.web`;

  try {
    await _loadAppleScript();
  } catch (e: any) {
    return { ok: false, cancelled: false, reason: e?.message ?? 'Apple sign-in failed' };
  }

  const AppleID = window.AppleID;
  if (!AppleID) {
    return { ok: false, cancelled: false, reason: 'Apple JS SDK not available' };
  }

  AppleID.auth.init({
    clientId: APPLE_WEB_CLIENT_ID,
    scope: 'email',
    redirectURI: APPLE_REDIRECT_URI,
    state,
    nonce,
    usePopup: true,
  });

  try {
    const data = await AppleID.auth.signIn();
    const returnedState = data?.authorization?.state ?? '';
    if (!returnedState.startsWith(`${nonce}.`)) {
      return { ok: false, cancelled: false, reason: 'Apple sign-in: invalid state' };
    }
    const idToken = data?.authorization?.id_token;
    if (!idToken) {
      return { ok: false, cancelled: false, reason: 'Apple sign-in: no id_token in response' };
    }
    return { ok: true, identityToken: idToken, nonce };
  } catch (e: any) {
    // Apple's SDK rejects with a plain object like `{ error: '...' }`
    // for user-initiated dismissal and other failures.
    const code = e?.error ?? e?.code;
    if (code === 'popup_closed_by_user' || code === 'user_cancelled_authorize') {
      return { ok: false, cancelled: true };
    }
    return {
      ok: false,
      cancelled: false,
      reason: code ?? e?.message ?? 'Apple sign-in failed',
    };
  }
};

const _parseQueryParams = (url: string): URLSearchParams => {
  // Some browsers/env may not populate URL.searchParams from a relative-ish
  // string; parse the query manually as a fallback.
  try {
    return new URL(url).searchParams;
  } catch {
    const q = url.split('?')[1] ?? '';
    return new URLSearchParams(q.split('#')[0]);
  }
};
