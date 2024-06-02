type Listener<T = any> = (data?: T) => void;

type ListenersWithLastEvent<T = any> = {
  listeners: Set<Listener<T>>
  lastEvent: T | undefined
};

type eventKeyToListenerWithLastEvent = {
  [key: string]: ListenersWithLastEvent
};

const listeners: eventKeyToListenerWithLastEvent = {};

const listen = <T = any>(
  key: string,
  listener: Listener<T>,
  notifyOnBind: boolean = false,
) => {
  // Ensure `listeners[key]` is set
  listeners[key] = listeners[key] ?? {
    listeners: new Set<Listener<T>>,
    lastEvent: undefined,
  };

  listeners[key].listeners.add(listener);

  // Notify new listener of last event
  const lastEvent = listeners[key].lastEvent;
  if (notifyOnBind && lastEvent !== undefined) {
    notify<T>(key, lastEvent);
  }

  return () => unlisten(key, listener);
};

const unlisten = (key: string, listener: Listener) => {
  listeners[key].listeners.delete(listener);
};

const notify = <T = any>(key: string, data?: T) => {
  // Ensure `listeners[key]` is set
  listeners[key] = listeners[key] ?? {
    listeners: new Set<Listener<T>>,
    lastEvent: undefined,
  };

  listeners[key].lastEvent = data;

  listeners[key].listeners.forEach(
    (listener: Listener) => listener(data)
  );
};

export {
  listen,
  notify,
  unlisten,
};
