import {
  View,
} from 'react-native';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Slider, SliderHandle } from './slider';
import { DefaultText } from './default-text';
import { LINEAR_SCALE } from '../scales/scales';

// TODO: Range slider doesn't adjust thumb

const Label = forwardRef(({}, ref) => {
  const [label, setLabel] = useState('');

  useImperativeHandle(ref, () => ({ setLabel }), []);

  return (
    <View style={{marginTop: 10}} pointerEvents="none">
      <DefaultText>
        {label}
      </DefaultText>
    </View>
  );
});

type Props = {
  label: string
  minimumValue: number
  maximumValue: number
  initialValue: number | null
  onValueChange: (n: number) => void
  style?: any,
  addPlusAtMax: boolean | undefined
  valueRewriter?: (x: any) => any
  onSlidingComplete?: any
  scale: any
  step: number
};

const LabelledSlider = forwardRef(({label, minimumValue, maximumValue, ...rest}: Props, ref) => {
  const {
    initialValue,
    onValueChange,
    style,
    addPlusAtMax,
    valueRewriter = (x) => x,
    scale: {scaleValue, descaleValue} = LINEAR_SCALE,
  } = rest;

  const descaledInitialValue = descaleValue(initialValue, minimumValue, maximumValue);

  const sliderRef = useRef<SliderHandle>(null);
  const labelRef = useRef<any>(null);
  const valueRef = useRef<number>(descaledInitialValue);

  const _onValueChange = (value: number) => {
    if (!labelRef.current) {
      return;
    }

    const scaledValue = scaleValue(value, minimumValue, maximumValue);

    const roundedValue = Math.round(scaledValue);

    const _label = (
     `${label}: ` +
     `${valueRewriter(roundedValue)}` +
     `${addPlusAtMax && roundedValue === maximumValue ? '+' : ''}`
    );

    labelRef.current.setLabel(_label);
    valueRef.current = scaledValue;

    onValueChange(roundedValue);
  };

  const setValue = (value: number) => {
    if (!sliderRef.current) {
      return;
    }
    sliderRef.current.setValue(value);
  };

  const getValue = () => {
    return valueRef.current;
  }

  useEffect(() => {
    _onValueChange(descaledInitialValue);
  }, []);


  useImperativeHandle(
    ref,
    () => ({
      setValue,
      getValue,
    }),
    []
  );

  return (
    <View
      style={{
        margin: 5,
        marginLeft: 10,
        marginRight: 10,
        ...style
      }}
    >
      <Slider
        ref={sliderRef}
        minimumValue={descaleValue(minimumValue, minimumValue, maximumValue)}
        maximumValue={descaleValue(maximumValue, minimumValue, maximumValue)}
        initialValue={descaledInitialValue}
        onValueChange={_onValueChange}
      />
      <Label ref={labelRef} />
    </View>
  );
});

export {
  LabelledSlider,
};
