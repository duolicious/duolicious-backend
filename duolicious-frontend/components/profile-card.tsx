import {
  Animated,
  ImageBackground,
  Pressable,
  View,
} from 'react-native';
import {
  useCallback,
  useRef,
} from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Skeleton } from '@rneui/themed';
import { VerificationBadge } from './verification-badge';
import { DefaultText } from './default-text';
import { Avatar } from './avatar';

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

const ProfileCard = (props) => {
  return (
    <View
      style={{
        paddingTop: 5,
        paddingLeft: 5,
        ...props.containerStyle,
      }}
    >
      <Pressable
        onPress={props.onPress}
        style={{
          aspectRatio: 1,
        }}
      >
        <View
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 5,
            overflow: 'hidden',
            ...props.innerStyle,
          }}
        >
          <Skeleton
            style={{
              position: 'absolute',
              zIndex: -999,
              width: '100%',
              height: '100%',
              borderRadius: 0,
            }}
          />
          <ImageBackground
            source={{uri: `https://randomuser.me/api/portraits/men/${getRandomInt(99)}.jpg`}}
            style={{
              width: '100%',
              height: undefined,
              aspectRatio: 1,
            }}
          >
            <LinearGradient
              colors={[
                'rgba(0, 0, 0, 0.2)',
                'transparent',
                'transparent',
                'rgba(0, 0, 0, 0.2)',
                'rgba(0, 0, 0, 0.4)',
              ]}
              style={{
                height: '100%',
              }}
            />
          </ImageBackground>
          <UserDetails containerStyle={props.userDetailsContainerStyle}/>
        </View>
      </Pressable>
    </View>
  );
};

const ProspectProfileCard = (props) => {
  return (
    <Pressable
      onPress={props.onPress}
      style={{
        width: '100%',
        ...props.containerStyle,
      }}
    >
      <ImageBackground
        source={{uri: `https://randomuser.me/api/portraits/men/${getRandomInt(99)}.jpg`}}
        style={{
          width: '100%',
          height: undefined,
          aspectRatio: 1,
        }}
      >
        <LinearGradient
          colors={[
            'rgba(0, 0, 0, 0.2)',
            'transparent',
            'transparent',
            'rgba(0, 0, 0, 0.2)',
            'rgba(0, 0, 0, 0.4)',
          ]}
          style={{
            height: '100%',
          }}
        />
      </ImageBackground>
      <DefaultText
        style={{
          position: 'absolute',
          bottom: 15,
          right: 15,
          paddingLeft: 7,
          paddingRight: 7,
          borderRadius: 999,
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          fontWeight: '500',
        }}
      >
        +3 More Pics
      </DefaultText>
    </Pressable>
  );
};

const UserDetails = (props) => {
  const {
    containerStyle,
  } = props;

  return (
    <View
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: '100%',
        padding: 5,
        ...containerStyle,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
        }}
      >
        <DefaultText style={{
          fontSize: 18,
          fontWeight: '600',
          color: 'white',
          overflow: 'hidden',
        }}>
          Rahim, 19
        </DefaultText>
        <VerificationBadge/>
      </View>
      <DefaultText
        style={{
          marginTop: -5,
          fontWeight: '500',
          color: 'white',
          alignSelf: 'flex-start',
        }}
      >
        99% Match
      </DefaultText>
    </View>
  );
};

const VerticalProfileCard = ({name, age, location, ...props}) => {
  const {
    style,
    unread = false,
    timeVisited,
    ...rest
  } = props;

  const animated = useRef(new Animated.Value(1)).current;

  const backgroundColor = animated.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0, 0, 0, 0.2)', 'rgba(0, 0, 0, 0.05)'],
    extrapolate: 'clamp',
  });

  const fadeIn = useCallback(() => {
    Animated.timing(animated, {
      toValue: 0,
      duration: 50,
      useNativeDriver: false,
    }).start();
  }, []);

  const fadeOut = useCallback(() => {
    Animated.timing(animated, {
      toValue: 1,
      duration: 100,
      useNativeDriver: false,
    }).start();
  }, []);

  return (
    <Pressable
      onPressIn={fadeIn}
      onPressOut={fadeOut}
      style={{
        width: '100%',
        maxWidth: 600,
        alignSelf: 'center',
      }}
      {...rest}
    >
      <Animated.View
        style={{
          backgroundColor: backgroundColor,
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: 5,
          marginTop: 5,
          marginBottom: 5,
          marginLeft: 10,
          marginRight: 10,
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
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                paddingBottom: 5,
                  flexShrink: 1,
              }}
            >
              <DefaultText
                style={{
                  fontSize: 16,
                  fontWeight: '700',
                  flexWrap: 'wrap',
                  flexShrink: 1,
                  overflow: 'hidden',
                }}
              >
                {name}, {age}
              </DefaultText>
              {unread &&
                <View
                  style={{
                    marginLeft: 5,
                    marginRight: 5,
                    height: 10,
                    width: 10,
                    borderRadius: 999,
                    backgroundColor: '#70f',
                  }}
                />
              }
            </View>
            {timeVisited &&
              <DefaultText
                style={{
                  color: 'grey',
                }}
              >
                {timeVisited}
              </DefaultText>
            }
          </View>
          <DefaultText
            numberOfLines={1}
            style={{
              fontWeight: '400',
              color: 'grey',
            }}
          >
            {location}
          </DefaultText>
        </View>
      </Animated.View>
    </Pressable>
  );
};

export {
  ProfileCard,
  ProspectProfileCard,
  VerticalProfileCard,
};
