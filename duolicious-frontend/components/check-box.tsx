import {
  Pressable,
  View,
} from 'react-native';
import Checkbox from 'expo-checkbox';
import { useCallback, useState } from 'react';
import { DefaultText } from './default-text';

const hitSlop = 10;

const CheckBox = ({children, ...rest}) => {
  const {
    initialValue,
    value,
    labelPosition = 'right',
    containerStyle,
    onValueChange,
  } = rest;

  const [isChecked, setChecked] = useState(initialValue ?? value ?? false);

  if (value!== undefined && isChecked !== value)
    setChecked(value);

  const onValueChange_ = () => {
    setChecked(v => {
      const newV = !v;
      onValueChange && onValueChange(newV);
      return newV;
    });
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        margin: 5,
        marginTop: 15,
        marginBottom: 15,
        ...containerStyle,
      }}
    >
      {labelPosition !== 'right' &&
        <Pressable onPress={onValueChange_} hitSlop={hitSlop}>
          <DefaultText>{children}</DefaultText>
        </Pressable>
      }
      <Checkbox
        value={isChecked}
        onValueChange={onValueChange_}
        style={
          labelPosition === 'right' ?
          {marginRight: 8} :
          {marginLeft: 8}
        }
        color="#70f"
      />
      {labelPosition === 'right' &&
        <Pressable onPress={onValueChange_} hitSlop={hitSlop}>
          <DefaultText>{children}</DefaultText>
        </Pressable>
      }
    </View>
  );
};

const StatelessCheckBox = ({children, ...rest}) => {
  const {
    value,
    labelPosition = 'right',
    containerStyle,
    onValueChange,
  } = rest;

  const onValueChange_ = useCallback(() => {
    onValueChange(!value);
  }, [onValueChange, value]);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        margin: 5,
        marginTop: 15,
        marginBottom: 15,
        ...containerStyle,
      }}
    >
      {labelPosition !== 'right' &&
        <Pressable onPress={onValueChange_} hitSlop={hitSlop}>
          <DefaultText>{children}</DefaultText>
        </Pressable>
      }
      <Checkbox
        value={value}
        onValueChange={onValueChange_}
        style={
          labelPosition === 'right' ?
          {marginRight: 8} :
          {marginLeft: 8}
        }
        color="#70f"
      />
      {labelPosition === 'right' &&
        <Pressable onPress={onValueChange_} hitSlop={hitSlop}>
          <DefaultText>{children}</DefaultText>
        </Pressable>
      }
    </View>
  );
};

export default CheckBox;
export { StatelessCheckBox };
