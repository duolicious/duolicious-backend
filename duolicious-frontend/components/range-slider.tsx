import {
  View,
} from 'react-native';
import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import Slider from '@react-native-community/slider';

import { LabelledSlider } from './labelled-slider';

const RangeSlider = forwardRef((props: any, ref) => {
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
  } = props;

  const args = {
    minimumValue: minimumValue,
    maximumValue: maximumValue,
    step: 1,
    valueRewriter: valueRewriter,
  };

  const topSliderStyle = useRef({
    marginBottom: 30
  }).current;

  const [lowerValue, setLowerValue] = useState(initialLowerValue ?? args.minimumValue);
  const [upperValue, setUpperValue] = useState(initialUpperValue ?? args.maximumValue);

  const _onLowerValueChange = (value: number) => {
    setLowerValue(value);
    onLowerValueChange(value);

    if (value > upperValue) {
      setUpperValue(value);
      onUpperValueChange(value);
    }
  };

  const _onUpperValueChange = (value: number) => {
    setUpperValue(value);
    onUpperValueChange(value);

    if (value < lowerValue) {
      setLowerValue(value)
      onLowerValueChange(value);
    }
  };

  const setValues = (values: {lowerValue: any, upperValue: any}) => {
    const lowerValue_ = values.lowerValue;
    const upperValue_ = values.upperValue;

    if (lowerValue_ !== undefined) setLowerValue(lowerValue_);
    if (upperValue_ !== undefined) setUpperValue(upperValue_);
  };

  useImperativeHandle(ref, () => ({ setValues }), []);

  return (
    <View
      style={{
        ...containerStyle,
      }}
    >
      <LabelledSlider
        value={lowerValue}
        onValueChange={_onLowerValueChange}
        label={"Min" + (unitsLabel ? ` (${unitsLabel})` : '')}
        minimumValue={minimumValue}
        maximumValue={maximumValue}
        step={1}
        valueRewriter={valueRewriter}
        style={topSliderStyle}
      />
      <LabelledSlider
        value={upperValue}
        onValueChange={_onUpperValueChange}
        label={"Max" + (unitsLabel ? ` (${unitsLabel})` : '')}
        minimumValue={minimumValue}
        maximumValue={maximumValue}
        step={1}
        valueRewriter={valueRewriter}
      />
    </View>
  );
});

export {
  RangeSlider,
};
