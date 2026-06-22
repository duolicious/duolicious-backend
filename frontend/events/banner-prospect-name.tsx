import { useLayoutEffect, useState } from 'react';
import { listen, notify, lastEvent } from './events';

type Entry = { handle: string, name: string | null };

const EVENT_KEY = 'banner-prospect-name';

const setBannerProspectName = (handle: string, name: string | null | undefined) => {
  notify<Entry>(EVENT_KEY, { handle, name: name ?? null });
};

const useBannerProspectName = (focusedHandle: string | undefined): string | null => {
  const [entry, setEntry] = useState<Entry | undefined>(
    () => lastEvent<Entry>(EVENT_KEY),
  );

  useLayoutEffect(() => {
    return listen<Entry>(EVENT_KEY, setEntry, true);
  }, []);

  return entry && entry.handle === focusedHandle ? entry.name : null;
};

export {
  setBannerProspectName,
  useBannerProspectName,
};
