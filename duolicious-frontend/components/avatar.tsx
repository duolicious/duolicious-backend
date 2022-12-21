import {
  ImageBackground,
  Pressable,
  View,
} from 'react-native';
import { DefaultText } from './default-text';

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

const Avatar = ({percentage, ...props}) => {
  const {
    userId = getRandomInt(99),
    navigation,
    size,
    shadow = false,
  } = props;

  const shadowStyle = shadow ? {
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  } : {};

  const Element = navigation ? Pressable : View;

  return (
    <Element
      onPress={() => navigation && navigation.navigate('Prospect Profile Screen')}
      style={{
        height: 90,
        width: 90,
        ...props.style,
      }}
    >
      <ImageBackground
        source={{
          uri: `https://randomuser.me/api/portraits/men/${userId}.jpg`
        }}
        style={{
          aspectRatio: 1,
          margin: 2,
          borderRadius: 999,
          borderColor: 'white',
          borderWidth: 2,
          overflow: 'hidden',
          ...shadowStyle,
        }}
      />
      <View
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          height: 30,
          width: 30,
          borderRadius: 999,
          borderColor: 'white',
          borderWidth: 2,
          backgroundColor: '#70f',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <DefaultText
          style={{
            color: 'white',
            textAlign: 'center',
            fontWeight: '700',
            fontSize: 10,
          }}
        >
          {percentage}%
        </DefaultText>
      </View>
    </Element>
  )
};

export {
  Avatar,
};
