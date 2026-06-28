import { useEffect, useState } from 'react';
import { listen, lastEvent } from './events';

const useRetained = <T,>(key: string | undefined): T | null => {
  const [value, setValue] = useState<T | null>(
    key ? (lastEvent<T>(key) ?? null) : null
  );

  useEffect(() => {
    if (!key) {
      setValue(null);
      return;
    }

    setValue(lastEvent<T>(key) ?? null);

    return listen<T>(key, (v) => setValue(v ?? null), true);
  }, [key]);

  return value;
};

export {
  useRetained,
};
