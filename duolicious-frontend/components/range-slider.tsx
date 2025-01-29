import {
  View,
} from 'react-native';
import {
  forwardRef,
  useImperativeHandle,
  useRef,
} from 'react';

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
    scale,
  } = props;

  const upperRef = useRef<any>(null);
  const lowerRef = useRef<any>(null);

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

  const setValues = (values: {lowerValue: any, upperValue: any}) => {
    if (upperRef.current && values.upperValue !== undefined) {
      upperRef.current.setValue(values.upperValue);
    }

    if (lowerRef.current && values.lowerValue !== undefined) {
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
