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
          ...textStyle,
        }}
      />
    } else {
      return <Ionicons
        style={{
          fontSize: 16,
          marginRight: 5,
          ...textStyle,
        }}
        name={icon}
      />
    }
  };

  return (
    <View
      style={[
        {
          borderColor: 'rgba(0, 0, 0, 0.1)',
          borderWidth: 1,
          borderRadius: 999,
          paddingTop: 5,
          paddingBottom: 5,
          paddingLeft: 10,
          paddingRight: 10,
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'row',
          backgroundColor: 'rgba(255, 255, 255, 0.3)',
        },
        style
      ]}
    >
      {icon && <Icon icon={icon}/>}
      <DefaultText style={textStyle}>{children}</DefaultText>
    </View>
  );
};

const Basics = ({children}) => {
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 5,
      }}
    >
      {children}
    </View>
  );
};

export {
  Basic,
  Basics,
};
