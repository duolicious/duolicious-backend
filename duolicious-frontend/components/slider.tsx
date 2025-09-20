import {
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  View,
  StyleSheet,
  PanResponder,
  Animated,
  LayoutChangeEvent,
} from 'react-native';
import { useAppTheme } from '../app-theme/app-theme';

const thumbRadius = 16;

interface SliderProps {
  initialValue: number;
  minimumValue: number;
  maximumValue: number;
  onValueChange: (value: number) => void;
}

export interface SliderHandle {
  setValue: (value: number) => void;
}

const Slider = forwardRef<SliderHandle, SliderProps>((props, ref) => {
  const { appTheme } = useAppTheme();
  const { initialValue, minimumValue, maximumValue, onValueChange } = props;

  const panX = useRef(new Animated.Value(0)).current;
  const panXValue = useRef(0); // Keep track of the current value
  const sliderWidth = useRef(0);
  const gestureStartX = useRef(0); // Store gesture start position

  const valueRange = maximumValue - minimumValue;

  // Listen to panX changes
  useEffect(() => {
    const listenerId = panX.addListener(({ value }) => {
      panXValue.current = value;
      // Call onValueChange continuously as the value changes
      const newValue = calculateValue(value);
      onValueChange(newValue);
    });
    return () => {
      panX.removeListener(listenerId);
    };
  }, [panX, onValueChange]);

  const calculateValue = (position: number) => {
    const ratio = position / sliderWidth.current || 0;
    const value = ratio * valueRange + minimumValue;
    return Math.max(minimumValue, Math.min(value, maximumValue));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        // Store the starting position of the gesture
        gestureStartX.current = panXValue.current;
      },
      onPanResponderMove: (evt, gestureState) => {
        let newPanX = gestureStartX.current + gestureState.dx;
        // Clamp the newPanX value within the slider range
        newPanX = Math.max(0, Math.min(newPanX, sliderWidth.current));
        panX.setValue(newPanX);
      },
      onPanResponderRelease: () => {
        // No need to update panXValue.current here since it's updated via listener
      },
    })
  ).current;

  useImperativeHandle(ref, () => ({
    setValue: (value: number) => {
      const clampedValue = Math.max(
        minimumValue,
        Math.min(value, maximumValue)
      );
      const newPosition =
        ((clampedValue - minimumValue) / valueRange) * sliderWidth.current;
      panX.setValue(newPosition);
      panXValue.current = newPosition;
      // Update parent about the new value
      onValueChange(clampedValue);
    },
  }));

  useEffect(() => {
    const initialPosition =
      ((initialValue - minimumValue) / valueRange) * sliderWidth.current;
    panX.setValue(initialPosition);
    panXValue.current = initialPosition;
  }, [initialValue, minimumValue, maximumValue]);

  const onLayout = (event: LayoutChangeEvent) => {
    sliderWidth.current = Math.max(
      0,
      event.nativeEvent.layout.width - thumbRadius * 2
    );
    const initialPosition =
      ((initialValue - minimumValue) / valueRange) * sliderWidth.current;
    panX.setValue(initialPosition);
    panXValue.current = initialPosition;
  };

  const translateX = panX.interpolate({
    inputRange: [0, sliderWidth.current],
    outputRange: [0, sliderWidth.current],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container} onLayout={onLayout}>
      <View
        style={{
          height: 4,
          borderRadius: 2,
          marginHorizontal: thumbRadius,
          backgroundColor: appTheme.interactiveBorderColor,
        }}
      />
      <Animated.View
        style={[
          styles.thumb,
          {
            transform: [{ translateX }],
          },
        ]}
        {...panResponder.panHandlers}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    height: 40,
    justifyContent: 'center',
  },
  thumb: {
    position: 'absolute',
    width: thumbRadius * 2,
    height: thumbRadius * 2,
    backgroundColor: '#70f',
    borderRadius: thumbRadius,
  },
});

export { Slider };
