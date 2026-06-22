import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
} from 'react';
import {
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import {
  HuePicker,
  HuePickerRef,
} from './hue-picker';
import {
  SaturationValuePicker,
  SaturationValuePickerRef,
} from './saturation-value-picker';
import {
  hexToHsv,
  hsvToHex,
} from './util';

type HsvColorPickerProps = {
  containerStyle?: ViewStyle;
  huePickerContainerStyle?: ViewStyle;
  huePickerBorderRadius?: number;
  huePickerBarWidth?: number;
  huePickerBarHeight?: number;
  huePickerSliderSize?: number;
  satValPickerContainerStyle?: ViewStyle;
  satValPickerBorderRadius?: number;
  satValPickerSize?: number;
  satValPickerSliderSize?: number;
  hue?: number,
  saturation?: number,
  value?: number,
  onDragMove?: () => void;
}

type HsvColorPickerRef = {
  getColor: () => string;
  setColor: (c: string) => void;
};

const HsvColorPicker = forwardRef<
  HsvColorPickerRef,
  HsvColorPickerProps
>((props: HsvColorPickerProps, ref) => {
  const saturationValuePickerRef = useRef<SaturationValuePickerRef>(null);
  const huePickerRef = useRef<HuePickerRef>(null);

  const transportHue = useCallback(() => {
    const hue = huePickerRef.current?.getHue() ?? 0;
    saturationValuePickerRef.current?.setHue(hue);
  }, []);

  const onSatValPickerDragMove = useCallback(() => {
    props.onDragMove && props.onDragMove();
  }, []);

  const onHuePickerDragMove = useCallback(() => {
    transportHue();

    props.onDragMove && props.onDragMove();
  }, [props.onDragMove]);

  const getColor = useCallback(() => {
    return hsvToHex(
      huePickerRef.current?.getHue() ?? 0,
      saturationValuePickerRef.current?.getSaturation() ?? 0,
      saturationValuePickerRef.current?.getValue() ?? 0,
    );
  }, [huePickerRef.current, saturationValuePickerRef.current]);

  const setColor = useCallback((c: string) => {
    const [h, s, v] = hexToHsv(c);

    huePickerRef.current?.setHue(h);
    saturationValuePickerRef.current?.setHue(h);
    saturationValuePickerRef.current?.setSaturation(s);
    saturationValuePickerRef.current?.setValue(v);
  }, [huePickerRef.current, saturationValuePickerRef.current]);

  useImperativeHandle(
    ref,
    () => ({ getColor, setColor }),
    [getColor, setColor],
  );

  return (
    <View style={[styles.container, props.containerStyle]}>
      <SaturationValuePicker
        containerStyle={props.satValPickerContainerStyle}
        borderRadius={props.satValPickerBorderRadius ?? 0}
        size={props.satValPickerSize ?? 200}
        sliderSize={props.satValPickerSliderSize ?? 24}
        hue={props.hue ?? 0}
        saturation={props.saturation ?? 0}
        value={props.value ?? 0}
        onDragMove={onSatValPickerDragMove}
        ref={saturationValuePickerRef}
      />
      <HuePicker
        containerStyle={props.huePickerContainerStyle}
        borderRadius={props.huePickerBorderRadius ?? 0}
        hue={props.hue ?? 0}
        barWidth={props.huePickerBarWidth ?? 12}
        barHeight={props.huePickerBarHeight ?? 200}
        sliderSize={props.huePickerSliderSize ?? 24}
        onDragMove={onHuePickerDragMove}
        ref={huePickerRef}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export {
  HsvColorPicker,
  HsvColorPickerRef,
};
