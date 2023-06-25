import {
  API_URL,
} from '../env/env';
import * as _ from "lodash";
import { sessionToken } from '../session-token/session-token';
import { Buffer } from "buffer";

type ApiResponse = {
  ok: boolean
  json: any
};

const api = async (
  method: string,
  endpoint: string,
  init?: RequestInit
): Promise<ApiResponse> => {
  let response, json;

  while (true) {
    [response, json] = [undefined, undefined];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const existingSessionToken = await sessionToken();

    const url = `${API_URL}${endpoint}`;

    const init_ = _.merge(
      { method: method.toUpperCase() },
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
      // TODO: There should be a message in the UI saying "you're offline" or something
      console.log(`Waiting 3 seconds and trying again; Caught error while fetching ${url}`, error);

      // wait for 3 seconds before the next retry
      await new Promise(resolve => setTimeout(resolve, 3000));
    } finally {
      // cancel the timeout whether there was an error or not
      clearTimeout(timeoutId);
    }
  }

  try { json = await response.json(); } catch {}

  return {
    ok: response?.ok ?? false,
    json: json,
  }
};


const japi = async (
  method: string,
  endpoint: string,
  body?: any
): Promise<ApiResponse> => {
  const init = body === undefined ? {} : {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body)
  }

  return await api(method, endpoint, init);
};

const mapi = async (
  method: string,
  endpoint: string,
  filename: string,
  pathOrBase64: string
): Promise<ApiResponse> => {

  const formData = (() => {
    const formData = new FormData();

    if (pathOrBase64.startsWith('file://')) {
      // If we're on a mobile device, Expo will provide a path to a file.
      formData.append(
        filename,
        {
          uri: pathOrBase64,
          name: filename,
          type: 'image/jpg',
        } as any
      );
    } else {
      // If we're on a web browser device, Expo will provide a base64-encoded
      // string.
      const base64Data = pathOrBase64.split(',')[1];
      const binary = atob(base64Data);
      const array = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) {
          array[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([array], { type: 'application/octet-stream' });
      formData.append(filename, blob);
    }

    return formData;
  })();

  const init = {
    body: formData,
  };

  return await api(method, endpoint, init);
};

export {
  api,
  japi,
  mapi,
};
