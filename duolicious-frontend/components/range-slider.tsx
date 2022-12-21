import {
  View,
} from 'react-native';
import {
  useState,
} from 'react';
import Slider from '@react-native-community/slider';

import { LabelledSlider } from './labelled-slider';

const RangeSlider = ({minimumValue, maximumValue, ...props}) => {
  const {
    containerStyle,
    unitsLabel,
  } = props;

  const args = {
    minimumValue: minimumValue,
    maximumValue: maximumValue,
    step: 1,
  };

  const [lowerValue, setLowerValue] = useState(args.minimumValue);
  const [upperValue, setUpperValue] = useState(args.maximumValue);

  const onLowerValueChange = (value: number) => {
    setLowerValue(value);

    if (value > upperValue) {
      setUpperValue(value);
    }
  };

  const onUpperValueChange = (value: number) => {
    setUpperValue(value);

    if (value < lowerValue) {
      setLowerValue(value)
    }
  };

  return (
    <View
      style={{
        ...containerStyle,
      }}
    >
      <LabelledSlider
        value={lowerValue}
        onValueChange={onLowerValueChange}
        label={"Min" + (unitsLabel ? ` (${unitsLabel})` : '')}
        style={{
          marginBottom: 30,
        }}
        {...args}
      />
      <LabelledSlider
        value={upperValue}
        onValueChange={onUpperValueChange}
        label={"Max" + (unitsLabel ? ` (${unitsLabel})` : '')}
        {...args}
      />
    </View>
  );
};

export {
  RangeSlider,
};
