import {
  API_SCHEME,
  API_HOST,
  API_PORT,
} from '../env/env';
import * as _ from "lodash";
import { sessionToken } from '../lib/session-token';

const api = async (endpoint: string, init?: RequestInit): Promise<Response> => {
  const existingSessionToken = await sessionToken();

  const sessionInit = existingSessionToken === null ? {} : {
    headers: {
      'Authorization': `Bearer ${existingSessionToken}`
    }
  };

  const url = `${API_SCHEME}://${API_HOST}:${API_PORT}${endpoint}`;

  console.log(JSON.stringify(url)); // TODO

  const init_ = _.merge(
    sessionInit,
    init,
  );

  const response = await fetch(url, init_);

  console.log(JSON.stringify(response)); // TODO

  return response;
};

const japi = async (method: string, endpoint: string, body: any): Promise<Response> => {
  return await api(
    endpoint,
    {
      method: method.toUpperCase(),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    }
  );
};

export {
  api,
  japi,
};
