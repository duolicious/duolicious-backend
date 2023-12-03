import {
  View,
} from 'react-native';
import { DefaultText } from './default-text';
import Ionicons from '@expo/vector-icons/Ionicons';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';

const isIconDefinition = (x: any): x is IconDefinition => {
  return x.iconName !== undefined;
};

const Basic = ({children, ...rest}) => {
  const {
    icon,
    style = {},
    textStyle = {},
  } = rest;

  const Icon = ({icon}) => {
    if (isIconDefinition(icon)) {
      return <FontAwesomeIcon
        icon={icon}
        size={16}
        style={{
          marginRight: 5,
        }}
      />
    } else {
      return <Ionicons
        style={{
          fontSize: 16,
          marginRight: 5,
        }}
        name={icon}
      />
    }
  };

  return (
    <View
      style={[
        {
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
        },
        style
      ]}
    >
      {icon && <Icon icon={icon}/>}
      <View>
        <DefaultText style={textStyle}>{children}</DefaultText>
      </View>
    </View>
  );
};

export {
  Basic,
};
