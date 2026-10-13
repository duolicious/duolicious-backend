import { useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

const useIsScrolled = <T,>(resetKey?: T) => {
  const [scrolled, setScrolled] = useState<{ key?: T } | null>(null);

  const onScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) =>
    setScrolled(nativeEvent.contentOffset.y > 0 ? { key: resetKey } : null);

  return { isScrolled: scrolled !== null && scrolled.key === resetKey, onScroll };
};

export {
  useIsScrolled,
};
