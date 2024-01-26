type EventHandler<T = any> = (data?: T) => void;

type EventKeyToHandlers = {
  [key: string]: Set<EventHandler>;
};

const listeners: EventKeyToHandlers = {};

const listen = <T = any>(key: string, eventHandler: EventHandler<T>) => {
  listeners[key] = listeners[key] ?? new Set<EventKeyToHandlers>();
  listeners[key].add(eventHandler);

  return () => unlisten(key, eventHandler);
};

const unlisten = (key: string, eventHandler: EventHandler) => {
  listeners[key] = listeners[key] ?? new Set<EventKeyToHandlers>();
  listeners[key].delete(eventHandler);
};

const notify = <T = any>(key: string, data?: T) => {
  listeners[key] = listeners[key] ?? new Set<EventKeyToHandlers>();
  listeners[key].forEach((eventHandler: EventHandler) => eventHandler(data));
};

export {
  listen,
  notify,
  unlisten,
};
