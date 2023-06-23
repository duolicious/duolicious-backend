import {
  Pressable,
  View,
  StyleProp,
  TextStyle,
} from 'react-native';
import {
  useCallback,
  useState,
} from 'react';
import { DefaultText } from './default-text';

const CheckChip = ({label, ...props}) => {
  const {
    onChange = () => {}
  } = props;

  const [checked, setChecked] = useState(props.initialCheckedState ?? false);

  const checkedContainerStyle = {
    backgroundColor: 'rgb(228, 204, 255)', // = #70f, 0.2 opacity
  };

  const checkedTextStyle: StyleProp<TextStyle> = {
    color: '#70f',
  };

  const uncheckedContainerStyle: StyleProp<TextStyle> = {
    textDecorationLine: 'line-through',
  };

  const onPress_ = useCallback(() => {
    setChecked(checked => {
      onChange(!checked);
      return !checked;
    });
  }, []);

  return (
    <Pressable
      style={{
        borderRadius: 999,
        borderWidth: 3,
        borderColor: 'white',
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 12,
        paddingBottom: 12,
        margin: 5,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'white',
          ...(checked ? checkedContainerStyle : {})
      }}
      onPress={onPress_}
    >
      <DefaultText
        style={{
          color: '#666',
          ...(checked ? checkedTextStyle : uncheckedContainerStyle)
        }}
      >
        {label}
      </DefaultText>
    </Pressable>
  );
};

const CheckChips = ({children, ...props}) => {
  return (
    <View
      style={{
        justifyContent: 'center',
        flexDirection: 'row',
        flexWrap: 'wrap',
        ...props.style,
      }}
    >
      {children}
    </View>
  );
};

export {
  CheckChip,
  CheckChips,
};
