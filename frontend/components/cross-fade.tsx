import { ReactNode, useEffect, useRef, useState } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import Animated, {
  SharedValue,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

type FadeLayersProps = {
  progress: SharedValue<number>
  front: ReactNode
  back: ReactNode
  style?: StyleProp<ViewStyle>
};

const FadeLayers = ({ progress, front, back, style }: FadeLayersProps) => {
  const frontStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const backStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));

  return (
    <View style={style}>
      <Animated.View style={frontStyle}>
        {front}
      </Animated.View>
      {back !== null &&
        <Animated.View
          style={[
            { position: 'absolute', width: '100%', height: '100%', justifyContent: 'center' },
            backStyle,
          ]}
          pointerEvents="none"
        >
          {back}
        </Animated.View>
      }
    </View>
  );
};

type CrossFadeProps = {
  showFront: boolean
  front: ReactNode
  back: ReactNode
  minBackMs?: number
  duration?: number
  style?: StyleProp<ViewStyle>
};

const CrossFade = ({
  showFront,
  front,
  back,
  minBackMs = 0,
  duration = 500,
  style,
}: CrossFadeProps) => {
  const progress = useSharedValue(0);
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    if (!showFront) {
      return;
    }

    const remaining = Math.max(0, minBackMs - (Date.now() - mountedAt.current));

    progress.value = withDelay(remaining, withTiming(1, { duration }));
  }, [showFront]);

  return (
    <FadeLayers progress={progress} front={front} back={back} style={style} />
  );
};

type CrossFadeTextProps = {
  triggerKey: string
  children: ReactNode
  duration?: number
  style?: StyleProp<ViewStyle>
};

const CrossFadeText = ({
  triggerKey,
  children,
  duration = 300,
  style,
}: CrossFadeTextProps) => {
  const progress = useSharedValue(1);
  const [tx, setTx] = useState<{ key: string, outgoing: ReactNode }>({
    key: triggerKey,
    outgoing: null,
  });
  const lastChildren = useRef(children);

  if (tx.key !== triggerKey) {
    setTx({ key: triggerKey, outgoing: lastChildren.current });
    progress.value = 0;
  }

  useEffect(() => {
    lastChildren.current = children;
  });

  useEffect(() => {
    if (tx.outgoing === null) return;
    progress.value = withTiming(1, { duration }, (finished) => {
      if (finished) runOnJS(setTx)((t) => ({ ...t, outgoing: null }));
    });
  }, [tx.key]);

  return (
    <FadeLayers
      progress={progress}
      front={children}
      back={tx.outgoing}
      style={style}
    />
  );
};

export {
  CrossFade,
  CrossFadeText,
};
