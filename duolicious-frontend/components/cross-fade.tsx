import { ReactNode, useEffect, useRef } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

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

  const frontStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const backStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));

  return (
    <View style={style}>
      <Animated.View style={frontStyle}>
        {front}
      </Animated.View>
      <Animated.View
        style={[
          { position: 'absolute', width: '100%', height: '100%', justifyContent: 'center' },
          backStyle,
        ]}
        pointerEvents="none"
      >
        {back}
      </Animated.View>
    </View>
  );
};

export {
  CrossFade,
};
