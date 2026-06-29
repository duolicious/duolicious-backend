import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { listen, notify } from '../events/events';
import { RenderedHoc } from './rendered-hoc';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DefaultText } from './default-text';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faLink } from '@fortawesome/free-solid-svg-icons/faLink';

const SOMETHING_WENT_WRONG = "Something went wrong";

const HIDDEN_POSITION = -500;
const SLIDE_DURATION = 300;
const HOLD_DURATION = 3000;
const SWIPE_DISMISS_THRESHOLD = 20;

const Toast: React.FC = () => {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(HIDDEN_POSITION);

  const [toastQueue, setToastQueue] = useState<React.FC[]>([]);
  const [currentToast, setCurrentToast] = useState<React.FC | null>(null);

  const dismiss = () => setCurrentToast(null);

  const slideOut = (duration: number = SLIDE_DURATION) => {
    'worklet';
    return withTiming(HIDDEN_POSITION, { duration }, (finished) => {
      if (finished) {
        runOnJS(dismiss)();
      }
    });
  };

  const slideInAndHold = () => {
    'worklet';
    translateY.value = withSequence(
      withTiming(0, { duration: SLIDE_DURATION }),
      withDelay(HOLD_DURATION, slideOut()),
    );
  };

  const swipeUp = useMemo(
    () => Gesture.Pan()
      .onUpdate((e) => {
        'worklet';
        if (e.translationY < 0) {
          translateY.value = e.translationY;
        }
      })
      .onEnd((e) => {
        'worklet';
        if (e.translationY < -SWIPE_DISMISS_THRESHOLD) {
          translateY.value = slideOut(SLIDE_DURATION / 2);
        } else {
          slideInAndHold();
        }
      }),
    [],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

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

    translateY.value = HIDDEN_POSITION;
    slideInAndHold();
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
        pointerEvents="box-none"
        style={[
          {
            position: 'absolute',
            top: insets.top,
            left: 0,
            right: 0,
            alignItems: 'center',
            justifyContent: 'center',
          },
          animatedStyle,
        ]}
      >
        <GestureDetector gesture={swipeUp}>
          <View>
            <RenderedHoc Hoc={currentToast}/>
          </View>
        </GestureDetector>
      </Animated.View>
    );
  } else {
    return null;
  }
};

const ToastContainer = ({children}: {children?: React.ReactNode}) => {
  return (
    <View
      style={{
        marginTop: 10,
        marginHorizontal: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'white',
        borderRadius: 999,
        paddingVertical: 10,
        paddingHorizontal: 20,
        flexDirection: 'row',
        shadowOffset: {
          width: 0,
          height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
        gap: 10,
      }}
    >
      {children}
    </View>
  );
};

const SomethingWentWrongToast = () => {
  return (
    <ToastContainer>
      <DefaultText
        style={{
          color: 'black',
          fontWeight: '700',
          textAlign: 'center',
        }}
      >
        {SOMETHING_WENT_WRONG}
      </DefaultText>
    </ToastContainer>
  );
};

const ValidationErrorToast = ({error}: {error: string}) => {
  return (
    <ToastContainer>
      <DefaultText
        style={{
          color: 'red',
          fontWeight: '700',
          textAlign: 'center',
        }}
      >
        {error}
      </DefaultText>
    </ToastContainer>
  );
};

const notifyLinkCopiedToast = (label: string) => {
  const Toast: React.FC = () => (
    <ToastContainer>
      <FontAwesomeIcon icon={faLink} color="black" size={24} />
      <DefaultText style={{ color: 'black', fontWeight: '700' }}>
        {label}
      </DefaultText>
    </ToastContainer>
  );
  notify<React.FC>('toast', Toast);
};

export {
  SOMETHING_WENT_WRONG,
  SomethingWentWrongToast,
  Toast,
  ToastContainer,
  ValidationErrorToast,
  notifyLinkCopiedToast,
};
