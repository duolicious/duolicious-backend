import {
  Platform,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

const QAndADevice = ({
  color,
  fontSize = 20,
  isBold = false,
  spacing = -6,
}) => {
  const noIcon = isBold ? 'close-circle' : 'close-circle-outline';
  const yesIcon = isBold ? 'checkmark-circle' : 'checkmark-circle-outline';

  return (
    <View
      style={{
        flexDirection: 'row',
        marginHorizontal: spacing / 2,
      }}
    >
      <View
        style={{
          backgroundColor: 'white',
          borderRadius: 999,
          overflow: 'hidden',
          aspectRatio: Platform.OS === 'web' ? 1 : undefined,
          justifyContent: 'center',
          alignItems: 'center',
          right: spacing / 2,
        }}
      >
        <Ionicons style={{color: color, fontSize: fontSize}} name={noIcon} />
      </View>
      <View
        style={{
          backgroundColor: 'white',
          borderRadius: 999,
          overflow: 'hidden',
          aspectRatio: Platform.OS === 'web' ? 1 : undefined,
          justifyContent: 'center',
          alignItems: 'center',
          left: spacing / 2,
        }}
      >
        <Ionicons style={{ color: color, fontSize: fontSize }} name={yesIcon} />
      </View>
    </View>
  );
};

export {
  QAndADevice,
};
