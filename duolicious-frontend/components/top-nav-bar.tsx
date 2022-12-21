import {
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBarSpacer } from './status-bar-spacer';
import { DefaultText } from './default-text';

const shadow = {
  shadowOffset: {
    width: 0,
    height: 2,
  },
  shadowOpacity: 0.1,
  shadowRadius: 10,
  elevation: 8,
};

const TopNavBar = (props) => {
  return (
    <View
      style={{
        backgroundColor: 'white',
        zIndex: 999,
        width: '100%',
        overflow: 'visible',
        ...(props.shadow === false ? {} : shadow),
      }}
    >
      <StatusBarSpacer/>
      <View
        style={{
          width: '100%',
          maxWidth: 600,
          height: 40,
          alignSelf: 'center',
          alignItems: 'center',
          justifyContent: 'center',
          ...props.style,
        }}
      >
        {props.children}
      </View>
    </View>
  );
};

const DuoliciousTopNavBar = (props) => {
  const {style, backgroundColor, textColor} = props;

  return (
    <TopNavBar
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
      backgroundColor={backgroundColor}
    >
      <DefaultText
        style={{
          fontFamily: 'TruenoBold',
          color: textColor || '#70f',
          fontSize: 24,
        }}
      >
        Duolicious
      </DefaultText>
      {props.children}
    </TopNavBar>
  );
};

export {
  DuoliciousTopNavBar,
  TopNavBar,
};
