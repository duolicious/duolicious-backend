import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const StatusBarSpacer = (props) => {
  const insets = useSafeAreaInsets();
  const extraHeight = props.extraHeight ?? (Platform.OS === 'ios' ? 0 : 10);

  return (
    <View
      style={{
        height: extraHeight + (Platform.OS === 'web' ? 0 : insets.top),
        backgroundColor: 'transparent',
        ...props.style,
      }}
    />
  );
};

export {
  StatusBarSpacer,
}
