import { CHAT_URL } from '../env/env';
import { listen, notify } from '../events/events';
import { delay, jsonParseSilently } from '../util/util';
import { AppState, AppStateStatus } from 'react-native';

type Pong = {
  preferredInterval: number
  preferredTimeout: number
};

const EV_CHAT_WS_CLOSE = 'chat-ws-close';
const EV_CHAT_WS_ERROR = 'chat-ws-error';
const EV_CHAT_WS_OPEN = 'chat-ws-open';
const EV_CHAT_WS_RECEIVE = 'chat-ws-receive';
const EV_CHAT_WS_SEND = 'chat-ws-send';
const EV_CHAT_WS_SEND_CLOSE = 'chat-ws-send-close';

const initialReconnectDelay = 1000;
const maxReconnectDelay = 30000;
let reconnectDelay = initialReconnectDelay;
const pong: Pong = {
  preferredInterval: 10000,
  preferredTimeout: 5000,
};
let ws: WebSocket | null = null;

listen<string>(EV_CHAT_WS_SEND, (data) => {
  if (typeof data !== 'string') {
    return;
  }

  ws?.send(data);
});

listen(EV_CHAT_WS_SEND_CLOSE, () => {
  ws?.close();
});

const connectChatWebSocket = (): void => {
  ws = new WebSocket(CHAT_URL, ['json']);

  ws.onopen = () => {
    reconnectDelay = initialReconnectDelay;
    notify(EV_CHAT_WS_OPEN);
  };

  ws.onmessage = (event: MessageEvent) =>
    notify<string>(EV_CHAT_WS_RECEIVE, event.data);

  ws.onclose = (event: CloseEvent) => {
    notify<CloseEvent>(EV_CHAT_WS_CLOSE, event);
    ws = null;
    setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 2, maxReconnectDelay);
      connectChatWebSocket();
    }, reconnectDelay);
  };

  ws.onerror = (event: Event) => {
    notify<Event>(EV_CHAT_WS_ERROR, event);
    ws?.close();
  };
};

type Send = {
  // When only a responseDetector is provided.
  <T>(params: {
    data: object;
    responseDetector: (input: any) => T | null;
    sentinelDetector?: never;
    timeoutMs?: number;
  }): Promise<T | 'timeout'>;

  // When both responseDetector and sentinelDetector are provided.
  <T>(params: {
    data: object;
    responseDetector: (input: any) => T | null;
    sentinelDetector: (input: any) => boolean;
    timeoutMs?: number;
  }): Promise<T[] | 'timeout'>;

  // When neither detector is provided.
  (params: {
    data: object;
    responseDetector?: undefined;
    sentinelDetector?: undefined;
    timeoutMs?: number;
  }): Promise<'timeout' | void>;
}

const send: Send = async <T,>({
  data,
  responseDetector,
  sentinelDetector,
  timeoutMs = 5000,
}: {
  data: object,
  responseDetector?: (input: any) => T | null,
  sentinelDetector?: (input: any) => boolean,
  timeoutMs?: number
}) => {
  if (ws?.readyState !== WebSocket.OPEN) {
    return 'timeout';
  }

  return new Promise<T[] | T | 'timeout' | void>((resolve) => {
    const responses: T[] = [];

    const resolveAndCleanup = (
      value:
        | void
        | T[]
        | T
        | "timeout"
    ): void => {
      removeListener();
      resolve(value);
    };

    const responseHandler = (input: string): void => {
      if (!responseDetector) {
        return;
      }

      const parsed = jsonParseSilently(input);

      const maybeResponse = responseDetector(parsed);

      if (maybeResponse !== null && sentinelDetector) {
        responses.push(maybeResponse);
      }

      if (maybeResponse !== null && !sentinelDetector) {
        resolveAndCleanup(maybeResponse);
      }
    };

    const sentinelHandler = (input: string): void => {
      if (!sentinelDetector) {
        return;
      }

      const parsed = jsonParseSilently(input);

      const maybeSentinel = sentinelDetector(parsed);

      if (maybeSentinel) {
        resolveAndCleanup(responses);
      };
    };

    const removeListener = listen<string>(
      EV_CHAT_WS_RECEIVE,
      (data) => {
        if (data === undefined) {
          return;
        }

        responseHandler(data);
        sentinelHandler(data);
      }
    );

    if (timeoutMs) {
      setTimeout(() => {
        resolveAndCleanup('timeout');
      }, timeoutMs);
    }

    notify<string>(EV_CHAT_WS_SEND, JSON.stringify(data));

    if (!responseDetector && !sentinelDetector) {
      resolveAndCleanup();
    }
  });
};

const pingServer = async (timeoutMs?: number) => {
  const data = { duo_ping: null };

  const responseDetector = (doc: any): Pong | null => {
    try {
      const {
        duo_pong: {
          '@preferred_interval': preferredInterval,
          '@preferred_timeout': preferredTimeout,
        }
      } = doc;

      return { preferredInterval, preferredTimeout };
    } catch {
      return null;
    }
  };

  const response = await send({
    data,
    responseDetector,
    timeoutMs: timeoutMs ?? pong.preferredTimeout,
  });

  if (response !== 'timeout') {
    Object.assign(pong, response);
  } else if (ws?.readyState === WebSocket.OPEN) {
    ws?.close();
  }
};

const pingServerForever = async () => {
  while (true) {
    await delay(pong.preferredInterval);
    await pingServer();
  };
};

const onChangeAppState = (state: AppStateStatus) => {
  if (state === 'active') {
    pingServer(3000);
  }
};

// In effect, updates the inbox when resuming from an inactive state by
// detecting if the app went offline
AppState.addEventListener('change', onChangeAppState);

connectChatWebSocket();

pingServerForever();

export {
  EV_CHAT_WS_CLOSE,
  EV_CHAT_WS_ERROR,
  EV_CHAT_WS_OPEN,
  EV_CHAT_WS_RECEIVE,
  EV_CHAT_WS_SEND,
  EV_CHAT_WS_SEND_CLOSE,
  send,
};
