import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

const QAndADevice = ({
  color,
  height = 20,
  isBold = false,
  backgroundColor = 'white',
}: {
  color: string
  height?: number
  isBold?: boolean
  backgroundColor?: string
}) => {
  const noIcon = isBold ? 'close-circle' : 'close-circle-outline';
  const yesIcon = isBold ? 'checkmark-circle' : 'checkmark-circle-outline';

  const width = 2 * height;

  const spacing = 6 * (height / 20);

  return (
    <View
      style={{
        flexDirection: 'row',
        height,
        width: width - spacing,
      }}
    >
      <View
        style={{
          backgroundColor: backgroundColor,
          borderRadius: 999,
          overflow: 'hidden',
          justifyContent: 'center',
          alignItems: 'center',
          height,
          aspectRatio: 1,
          position: 'absolute',
          left: 0,
        }}
      >
        <Ionicons style={{color: color, fontSize: height }} name={noIcon} />
      </View>
      <View
        style={{
          backgroundColor: backgroundColor,
          borderRadius: 999,
          overflow: 'hidden',
          justifyContent: 'center',
          alignItems: 'center',
          height,
          aspectRatio: 1,
          position: 'absolute',
          right: 0,
        }}
      >
        <Ionicons style={{ color: color, fontSize: height }} name={yesIcon} />
      </View>
    </View>
  );
};

export {
  QAndADevice,
};
