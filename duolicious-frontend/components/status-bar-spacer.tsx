import {
  Platform,
  StatusBar,
  View,
} from 'react-native';

const StatusBarSpacer = (props) => {
  const defaultExtraHeight = Platform.OS === 'ios' ? 0 : 10;

  return (
    <View
      style={{
        height: (props.extraHeight ?? defaultExtraHeight) + (Platform.OS === 'web' ? 0 : StatusBar.currentHeight),
        backgroundColor: 'transparent',
        ...props.style,
      }}
    />
  );
};

export {
  StatusBarSpacer,
}
