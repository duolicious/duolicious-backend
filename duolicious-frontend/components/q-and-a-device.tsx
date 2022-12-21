import {
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

const QAndADevice = ({color, fontSize = 20, isBold = false}) => {
  const noIcon = isBold ? 'close-circle' : 'close-circle-outline';
  const yesIcon = isBold ? 'checkmark-circle' : 'checkmark-circle-outline';

  return (
    <View style={{flexDirection: 'row'}}>
      <Ionicons
        style={{color: color, fontSize: fontSize}}
        name={noIcon}
      />
      <Ionicons
        style={{color: color, fontSize: fontSize, marginLeft: -3}}
        name={yesIcon}
      />
    </View>
  );
};

export {
  QAndADevice,
};
