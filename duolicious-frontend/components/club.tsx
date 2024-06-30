import {
  Text,
  View,
} from 'react-native';
import { DefaultText } from './default-text';
import Ionicons from '@expo/vector-icons/Ionicons';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';

const Club = ({
  name,
  isMutual,
  style,
}: {
  name: string,
  isMutual: boolean,
  style?: any
}) => {
  return (
    <View
      style={[
        {
          borderColor: (
            isMutual ? 'rgba(119, 0, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'),
          borderWidth: 1,
          borderRadius: 999,
          paddingTop: 5,
          paddingBottom: 5,
          paddingLeft: 10,
          paddingRight: 10,
          marginRight: 5,
          marginBottom: 5,
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'row',
          backgroundColor: (
            isMutual ? 'rgba(235, 217, 255, 0.7)' : 'rgba(255, 255, 255, 0.7)'),
        },
        style,
      ]}
    >
      <Text
        style={{
          fontFamily: 'Trueno',
          color: isMutual ? '#70f' : 'black',
          fontWeight: isMutual ? '900' : '400',
        }}
      >
        {name}
      </Text>
    </View>
  );
};

const Clubs = ({children}) => {
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
      }}
    >
      {children}
    </View>
  );
};

export {
  Club,
  Clubs,
};
