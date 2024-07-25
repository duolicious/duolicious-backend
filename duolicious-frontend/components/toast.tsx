import React, { useEffect, useState, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { listen } from '../events/events';
import { RenderedHoc } from './rendered-hoc';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const Toast: React.FC = () => {
  const initialPosition = -500;
  const insets = useSafeAreaInsets();
  const animation = useRef(new Animated.Value(initialPosition)).current;

  const [toastQueue, setToastQueue] = useState<React.FC[]>([]);
  const [currentToast, setCurrentToast] = useState<React.FC | null>(null);

  useEffect(() => {
    const head = toastQueue[0];
    const tail = toastQueue.slice(1);

    if (currentToast === null && head) {
      setCurrentToast(head);
      setToastQueue(tail);
    }
  }, [toastQueue.length, currentToast]);

  useEffect(() => {
    if (!currentToast) {
      return;
    }

    animation.setValue(initialPosition);

    const slideIn = Animated.timing(animation, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    });

    const holdPosition = Animated.timing(animation, {
      toValue: 0,
      duration: 2000,
      useNativeDriver: true,
    });

    const slideOut = Animated.timing(animation, {
      toValue: initialPosition,
      duration: 300,
      useNativeDriver: true,
    });

    Animated.sequence([slideIn, holdPosition, slideOut]).start(
      () => setCurrentToast(null)
    );
  }, [currentToast === null]);

  useEffect(() => {
    const appendToast = (content: React.FC) => {
      setToastQueue(prevQueue => [...prevQueue, content]);
    };

    return listen<React.FC>('toast', appendToast);
  }, []);

  if (currentToast) {
    return (
      <Animated.View
        style={{
          position: 'absolute',
          top: insets.top,
          left: 0,
          right: 0,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ translateY: animation }],
        }}
      >
        <RenderedHoc Hoc={currentToast}/>
      </Animated.View>
    );
  } else {
    return null;
  }
};

export {
  Toast,
};
