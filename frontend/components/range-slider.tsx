import {
  View,
  ViewStyle,
} from 'react-native';
import {
  forwardRef,
  useImperativeHandle,
  useRef,
} from 'react';

import { LabelledSlider } from './labelled-slider';
import { Scale } from '../scales/scales';

type LabelledSliderHandle = {
  setValue: (value: number) => void,
  getValue: () => number,
};

type RangeSliderProps = {
  minimumValue: number,
  maximumValue: number,
  containerStyle?: ViewStyle,
  unitsLabel?: string,
  onLowerValueChange: (value: number) => void,
  onUpperValueChange: (value: number) => void,
  initialLowerValue: number | null,
  initialUpperValue: number | null,
  valueRewriter?: (x: number) => number | string,
  scale?: Scale,
};

const RangeSlider = forwardRef((props: RangeSliderProps, ref) => {
  const {
    minimumValue,
    maximumValue,
    containerStyle,
    unitsLabel,
    onLowerValueChange,
    onUpperValueChange,
    initialLowerValue,
    initialUpperValue,
    valueRewriter,
    scale,
  } = props;

  const upperRef = useRef<LabelledSliderHandle | null>(null);
  const lowerRef = useRef<LabelledSliderHandle | null>(null);

  const _onLowerValueChange = (value: number) => {
    onLowerValueChange(value);

    if (upperRef.current && value > upperRef.current.getValue()) {
      upperRef.current.setValue(value);
    }
  };

  const _onUpperValueChange = (value: number) => {
    onUpperValueChange(value);

    if (lowerRef.current && value < lowerRef.current.getValue()) {
      lowerRef.current.setValue(value);
    }
  };

  const setValues = (values: {lowerValue: number | null, upperValue: number | null}) => {
    if (upperRef.current && values.upperValue != null) {
      upperRef.current.setValue(values.upperValue);
    }

    if (lowerRef.current && values.lowerValue != null) {
      lowerRef.current.setValue(values.lowerValue);
    }
  };

  useImperativeHandle(ref, () => ({ setValues }), []);

  return (
    <View
      style={{
        gap: 30,
        ...containerStyle,
      }}
    >
      <LabelledSlider
        ref={lowerRef}
        initialValue={initialLowerValue}
        onValueChange={_onLowerValueChange}
        label={"Min" + (unitsLabel ? ` (${unitsLabel})` : '')}
        minimumValue={minimumValue}
        maximumValue={maximumValue}
        step={1}
        valueRewriter={valueRewriter}
        scale={scale}
        addPlusAtMax={false}
      />
      <LabelledSlider
        ref={upperRef}
        initialValue={initialUpperValue}
        onValueChange={_onUpperValueChange}
        label={"Max" + (unitsLabel ? ` (${unitsLabel})` : '')}
        minimumValue={minimumValue}
        maximumValue={maximumValue}
        step={1}
        valueRewriter={valueRewriter}
        scale={scale}
        addPlusAtMax={false}
      />
    </View>
  );
});

export {
  RangeSlider,
};
