import {
  View,
} from 'react-native';
import {
  useState,
} from 'react';
import Slider from '@react-native-community/slider';
import { DefaultText } from './default-text';

const LabelledSlider = ({label, minimumValue, maximumValue, ...rest}) => {
  const {
    value,
    initialValue,
    onValueChange,
    style,
    addPlusAtMax,
    valueRewriter = (x) => x,
    ...rest_
  } = rest;

  const [valueState, setValueState] = useState(initialValue);

  if (value !== undefined && valueState !== value) {
    setValueState(value);
  }

  const onValueChange_ = (value_: number) => {
    setValueState(value_);
    if (onValueChange !== undefined) {
      onValueChange(value_);
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
          minimumValue={minimumValue}
          maximumValue={maximumValue}
          thumbTintColor="#70f"
          value={valueState}
          onValueChange={onValueChange_}
          {...rest_}
        />
      </View>
      <View style={{marginTop: 10}} pointerEvents="none">
        <DefaultText>
          {label}: {valueRewriter(valueState)}
          {addPlusAtMax && valueState === maximumValue ? '+' : ''}
        </DefaultText>
      </View>
    </View>
  );
};

export {
  LabelledSlider,
};
