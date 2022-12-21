import {
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';


const VerificationBadge = (props) => {
  return (
        <View
          style={{
            marginLeft: 7,
            paddingBottom: 4,
            flexDirection: 'column',
            justifyContent: 'flex-end',
          }}
        >
          <Ionicons
            style={{
              zIndex: 999,
              fontSize: 22,
              color: 'rgb(0, 195, 255)',
            }}
            name="checkmark-circle"
          />
          <View
            style={{
              zIndex: 998,
              position: 'absolute',
              bottom: 8,
              right: 4,
              backgroundColor: 'white',
              height: 15,
              width: 15,
              borderRadius: 999,
            }}
          />
        </View>
  );
};

export {
  VerificationBadge
};
