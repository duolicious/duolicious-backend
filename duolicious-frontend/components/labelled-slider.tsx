import {
  View,
} from 'react-native';
import {
  useState,
} from 'react';
import Slider from '@react-native-community/slider';
import { DefaultText } from './default-text';
import { LINEAR_SCALE } from '../scales/scales';

const LabelledSlider = ({label, minimumValue, maximumValue, ...rest}) => {
  const {
    value,
    initialValue,
    onValueChange,
    style,
    addPlusAtMax,
    valueRewriter = (x) => x,
    scale: {scaleValue, descaleValue} = LINEAR_SCALE,
    ...rest_
  } = rest;

  const [valueState, setValueState] = useState(initialValue);
  const roundedValue = Math.round(valueState);

  if (value !== undefined && valueState !== value) {
    setValueState(value);
  }

  const onValueChange_ = (value_: number) => {
    const scaledValue = scaleValue(value_, minimumValue, maximumValue);
    setValueState(scaledValue);
    if (onValueChange !== undefined) {
      onValueChange(Math.round(scaledValue));
    }
  }

  return (
    <View
      style={{
        margin: 5,
        marginLeft: 10,
        marginRight: 10,
        ...style
      }}
    >
      <View>
        <Slider
          minimumTrackTintColor="#ddd"
          maximumTrackTintColor="#ddd"
          minimumValue={descaleValue(minimumValue, minimumValue, maximumValue)}
          maximumValue={descaleValue(maximumValue, minimumValue, maximumValue)}
          thumbTintColor="#70f"
          value={descaleValue(valueState, minimumValue, maximumValue)}
          onValueChange={onValueChange_}
          {...rest_}
        />
      </View>
      <View style={{marginTop: 10}} pointerEvents="none">
        <DefaultText>
          {label}: {valueRewriter(roundedValue)}
          {addPlusAtMax && roundedValue === maximumValue ? '+' : ''}
        </DefaultText>
      </View>
    </View>
  );
};

export {
  LabelledSlider,
};
