import {
  Animated,
  Image,
  Pressable,
  View,
} from 'react-native';
import {
  useRef,
} from 'react';
import { DefaultText } from './default-text';
import { Avatar } from './avatar';

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

const InboxItem = (props) => {
  const {style, unread, ...rest} = props;

  const animated = useRef(new Animated.Value(1)).current;

  const backgroundColor = animated.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(222,222,222, 1)', 'rgba(255,255,255, 0)'],
    extrapolate: 'clamp',
  });

  const fadeIn = () => {
    Animated.timing(animated, {
      toValue: 0,
      duration: 50,
      useNativeDriver: false,
    }).start();
  };

  const fadeOut = () => {
    Animated.timing(animated, {
      toValue: 1,
      duration: 100,
      useNativeDriver: false,
    }).start();
  };

  return (
    <Pressable
      onPressIn={fadeIn}
      onPressOut={fadeOut}
      {...rest}
    >
      <Animated.View
        style={{
          backgroundColor: backgroundColor,
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: 5,
          paddingBottom: 5,
          paddingLeft: 10,
          ...style,
        }}
      >
        <Avatar percentage={99}/>
        <View
          style={{
            paddingLeft: 10,
            paddingRight: 20,
            flexDirection: 'column',
            flex: 1,
            flexGrow: 1,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
            }}
          >
            <DefaultText
              style={{
                fontSize: 16,
                fontWeight: '700',
                paddingBottom: 5,
                overflow: 'hidden',
              }}
            >
              Rahim
            </DefaultText>
            <DefaultText
              style={{
                color: 'grey',
              }}
            >
              19:48
            </DefaultText>
          </View>
          <DefaultText
            numberOfLines={1}
            style={{
              fontWeight: unread ? '600' : '400',
              color: unread ? 'black' : 'grey',
            }}
          >
            hey bb, do u want fuk? 😊
            hey bb, do u want fuk? 😊
            hey bb, do u want fuk? 😊
            hey bb, do u want fuk? 😊
            hey bb, do u want fuk? 😊
            hey bb, do u want fuk? 😊
            hey bb, do u want fuk? 😊
            hey bb, do u want fuk? 😊
            hey bb, do u want fuk? 😊
            hey bb, do u want fuk? 😊
            hey bb, do u want fuk? 😊
            hey bb, do u want fuk? 😊
          </DefaultText>
        </View>
      </Animated.View>
    </Pressable>
  );
};

export {
  InboxItem,
}
