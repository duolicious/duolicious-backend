import {
  API_URL,
} from '../env/env';
import * as _ from "lodash";
import { sessionToken } from '../kv-storage/session-token';
import { delay } from '../util/util';
import { notify } from '../events/events';
import { ValidationErrorToast, SOMETHING_WENT_WRONG } from '../components/toast';

const SUPPORTED_API_VERSIONS = [5, 500_000];

type ApiResponse = {
  ok: boolean
  clientError: boolean
  json: any,
  status: number
  validationErrors: string[] | null
};

const parseErrors = (errors: any): string[] => {
  try {
    return errors.map(
      (e) => (e?.msg ?? SOMETHING_WENT_WRONG).split(",").slice(1).join(",").trim()
    );
  } catch {
    return [SOMETHING_WENT_WRONG];
  }
};

const api = async (
  method: string,
  endpoint: string,
  init?: RequestInit,
  timeout?: number,
  maxRetries?: number,
  showValidationToast?: boolean,
): Promise<ApiResponse> => {
  let response, json;
  let numRetries = 0;

  while (maxRetries === undefined || numRetries <= maxRetries) {
    [response, json] = [undefined, undefined];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout ?? 30000);

    const existingSessionToken = await sessionToken();

    const startsWithHttp = (
      endpoint.startsWith('http://') || endpoint.startsWith('https://'));
    const url = startsWithHttp ?
      endpoint :
      `${API_URL}${endpoint}`;

    const init_ = _.merge(
      {
        method: method.toUpperCase(),
        cache: 'no-store',
      },
      (
        existingSessionToken ? {
          headers: {
            'Authorization': `Bearer ${existingSessionToken}`
          }
        } :
          {}
      ),
      { signal: controller.signal },
      init,
    );

    try {
      response = await fetch(url, init_);
      break;
    } catch (error) {
      const timeoutSeconds =
        Math.round(4 * Math.min(32, Math.pow(1.7, numRetries++))) +
        Math.round(4 * Math.random());

      // TODO: There should be a message in the UI saying "you're offline" or something
      console.log(`Waiting ${timeoutSeconds} seconds and trying again; Caught error while fetching ${url}`, error);

      await delay(timeoutSeconds * 1000);
    } finally {
      // cancel the timeout whether there was an error or not
      clearTimeout(timeoutId);
    }
  }

  try { json = await response.json(); } catch {}

  const clientError = response && response.status >= 400 && response.status < 500;

  const validationErrors = clientError ? parseErrors(json) : null;

  if (validationErrors && showValidationToast) {
    for (const error of validationErrors) {
      notify<React.FC>('toast', () => <ValidationErrorToast error={error} />);
    }
  }

  return {
    ok: response?.ok ?? false,
    clientError: clientError,
    json: json,
    status: response?.status ?? 0,
    validationErrors: validationErrors,
  }
};


const japi = async (
  method: string,
  endpoint: string,
  body?: any,
  timeout?: number,
  maxRetries?: number,
  showValidationToast?: boolean,
): Promise<ApiResponse> => {
  const init = body === undefined ? {} : {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body)
  }

  return await api(
    method,
    endpoint,
    init,
    timeout,
    maxRetries,
    showValidationToast
  );
};

const uriToBase64 = async (uri: string): Promise<string> => {
  const response = await fetch(uri);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        // Safely access the base64 content
        const base64String = reader.result.split(',')[1];
        resolve(base64String);
      } else {
        // Handle the case where reader.result is not a string
        reject(new Error("Failed to read file as base64, result is not a string."));
      }
    };

    reader.onerror = () => {
      reject(new Error("Error reading file as base64."));
    };

    reader.readAsDataURL(blob);
  });
}

export {
  SUPPORTED_API_VERSIONS,
  ApiResponse,
  api,
  japi,
  uriToBase64,
};
