import { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useAppTheme } from '../app-theme/app-theme';

type SkeletonProps = {
  width?: string | number
  height?: string | number
  borderRadius?: number
  style?: StyleProp<ViewStyle>
};

const Skeleton: React.FC<SkeletonProps> = ({
  style,
}: {
  style?: StyleProp<ViewStyle>
}) => {
  const { appThemeName, appTheme } = useAppTheme();

  const containerOpacity = useSharedValue(0);
  const throbberProgress = useSharedValue(0);

  useEffect(() => {
    containerOpacity.value = withTiming(1);

    throbberProgress.value = withRepeat(
      withTiming(1, {
        duration: 1000,
      }),
      -1,
      true
    );
  }, [])

  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
    backgroundColor: interpolateColor(
      throbberProgress.value,
      [0, 1],
      appThemeName === 'dark'
        ? [appTheme.quizCardBackgroundColor, appTheme.quizCardBackgroundColor]
        : ['#fafafa', '#e4e4eb'],
    ),
  }));

  return (
    <Animated.View
      style={[
        {
          width: '100%',
          height: '100%',
          backgroundColor: 'white',
        },
        style,
        animatedContainerStyle,
      ]}
    />
  );
};

export { Skeleton };
