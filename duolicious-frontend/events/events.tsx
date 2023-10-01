type EventHandler = (data: any) => void;

type EventKeyToHandlers = {
  [key: string]: Set<EventHandler>;
};

const listeners: EventKeyToHandlers = {};

const listen = (key: string, eventHandler: EventHandler) => {
  listeners[key] = listeners[key] ?? new Set<EventKeyToHandlers>();
  listeners[key].add(eventHandler);
};

const unlisten = (key: string, eventHandler: EventHandler) => {
  listeners[key] = listeners[key] ?? new Set<EventKeyToHandlers>();
  listeners[key].delete(eventHandler);
};

const notify = (key: string, data: any) => {
  listeners[key] = listeners[key] ?? new Set<EventKeyToHandlers>();
  listeners[key].forEach((eventHandler: EventHandler) => eventHandler(data));
};

export {
  listen,
  notify,
  unlisten,
};
