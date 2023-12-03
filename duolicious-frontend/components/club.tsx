import {
  Text,
  View,
} from 'react-native';
import { DefaultText } from './default-text';
import Ionicons from '@expo/vector-icons/Ionicons';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';

const Club = ({name, isMutual}) => {
  return (
    <View
      style={{
        borderColor: '#ddd',
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
        backgroundColor: isMutual ? 'rgba(119, 0, 255, 0.1)' : 'white',
      }}
    >
      <View>
        <Text
          style={{
            fontFamily: 'Trueno',
            color: isMutual ? '#70f' : 'black',
          }}
        >
          {name}
        </Text>
      </View>
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
