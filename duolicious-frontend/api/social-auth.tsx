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

// If we're loaded inside the Apple sign-in popup, forward the OAuth
// result back to the opener via postMessage and close immediately —
// before React even tries to render the SPA. The parent's
// `signInWithAppleWeb()` listens for this message and resolves its
// pending Promise from it.
//
// Identified by `window.name === 'apple-signin'` (the value we pass to
// `window.open`, which is preserved across the navigation from Apple →
// backend → SPA). `window.opener` confirms we have a parent to talk to.
(() => {
  if (typeof window === 'undefined') return;
  if (!window.opener || window.name !== 'apple-signin') return;

  const params = new URLSearchParams(window.location.search);
  const idToken = params.get('apple_id_token');
  const error = params.get('apple_error');
  const state = params.get('apple_state');
  if (!idToken && !error) return;

  try {
    window.opener.postMessage(
      { type: 'apple-signin-result', idToken, error, state },
      window.location.origin,
    );
  } finally {
    window.close();
  }
})();

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
 * - Android and web use Apple's OAuth web flow against a Services ID.
 *   Apple POSTs the result to the backend's `/auth/apple/callback`,
 *   which 302s back to the originating client with the id_token in a
 *   query parameter. On Android the in-app browser captures that
 *   redirect; on web it's a full-page navigation.
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

// Open Apple's sign-in in a popup and wait for the popup to postMessage
// the result back. Mirrors the popup-based UX of
// `expo-auth-session/providers/google` on web: parent never navigates,
// popup handles the OAuth dance and closes itself when done. The CSRF
// nonce stays in this closure — no kv-storage round-trip needed since
// neither end leaves its window.
const signInWithAppleWeb = async (): Promise<AppleSignInResult> => {
  // See `signInWithAppleAndroid` — same nonce binds the redirect-time
  // CSRF check and the server-side JWT.nonce verification.
  const nonce = await _generateNonce();
  const state = `${nonce}.web`;

  const authUrl = _buildAppleAuthorizeUrl({
    clientId: APPLE_WEB_CLIENT_ID,
    redirectUri: APPLE_REDIRECT_URI,
    state,
    nonce,
  });

  const w = 600;
  const h = 700;
  const top = Math.max(0, Math.floor((window.innerHeight - h) / 2 + (window.screenY ?? 0)));
  const left = Math.max(0, Math.floor((window.innerWidth - w) / 2 + (window.screenX ?? 0)));
  const popup = window.open(
    authUrl,
    'apple-signin',
    `width=${w},height=${h},top=${top},left=${left},resizable,scrollbars`,
  );

  if (!popup) {
    return { ok: false, cancelled: false, reason: 'Apple sign-in popup was blocked' };
  }

  return new Promise<AppleSignInResult>((resolve) => {
    let settled = false;
    const settle = (r: AppleSignInResult) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('message', onMessage);
      clearInterval(poller);
      if (!popup.closed) popup.close();
      resolve(r);
    };

    const onMessage = (event: MessageEvent) => {
      // Only trust messages from our own origin (the popup loads the
      // SPA after the backend's 302, so its origin matches ours).
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.type !== 'apple-signin-result') return;

      if (data.error) {
        settle({ ok: false, cancelled: false, reason: `Apple: ${data.error}` });
        return;
      }
      const returnedState = typeof data.state === 'string' ? data.state : '';
      if (!returnedState.startsWith(`${nonce}.`)) {
        settle({ ok: false, cancelled: false, reason: 'Apple sign-in: invalid state' });
        return;
      }
      const idToken = data.idToken;
      if (typeof idToken !== 'string' || !idToken) {
        settle({ ok: false, cancelled: false, reason: 'Apple sign-in: no id_token in callback' });
        return;
      }
      settle({ ok: true, identityToken: idToken, nonce });
    };
    window.addEventListener('message', onMessage);

    // Detect the user dismissing the popup before posting a message.
    const poller = setInterval(() => {
      if (popup.closed) settle({ ok: false, cancelled: true });
    }, 500);
  });
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
