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
import { DefaultText } from './default-text';
import { Avatar } from './avatar';
import {
  IMAGES_URL,
} from '../env/env';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

const ImageOrSkeleton = ({resolution, imageUuid}) => {
  return (
    <>
      {imageUuid !== undefined &&
        <Skeleton
          style={{
            position: 'absolute',
            zIndex: -999,
            width: '100%',
            height: '100%',
            borderRadius: 0,
          }}
        />
      }
      <ImageBackground
        source={imageUuid && {
          uri: `${IMAGES_URL}/${resolution}-${imageUuid}.jpg`
        }}
        style={{
          width: '100%',
          backgroundColor: imageUuid ? undefined : '#ccc',
          height: undefined,
          aspectRatio: 1,
        }}
      >
        <LinearGradient
          colors={[
            imageUuid ? 'rgba(0, 0, 0, 0.2)' : 'transparent',
            'transparent',
            'transparent',
            'transparent',
            'transparent',
            'rgba(0, 0, 0, 0.2)',
            'rgba(0, 0, 0, 0.4)',
          ]}
          style={{
            height: '100%',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          >
          {imageUuid === null &&
            <Ionicons
              style={{fontSize: 100, color: '#eee'}}
              name={'person'}
            />
          }
        </LinearGradient>
      </ImageBackground>
    </>
  );
};

const ProfileCard = ({userName, userAge, matchPercentage, imageUuid, userId, ...rest}) => {
  const navigation = useNavigation<any>();

  const itemOnPress = useCallback(() => {
    return navigation.navigate('Prospect Profile Screen', { userId })
  }, [navigation, userId]);

  return (
    <View
      style={{
        paddingTop: 5,
        paddingLeft: 5,
        ...rest.containerStyle,
      }}
    >
      <Pressable
        onPress={itemOnPress}
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
            ...rest.innerStyle,
          }}
        >
          <ImageOrSkeleton resolution={450} imageUuid={imageUuid}/>
          <UserDetails
            userName={userName}
            userAge={userAge}
            matchPercentage={matchPercentage}
            containerStyle={rest.userDetailsContainerStyle}
          />
        </View>
      </Pressable>
    </View>
  );
};

const ProspectProfileCard = ({onPress, imageUuid, numMorePics = 0}) => {
  return (
    <Pressable
      onPress={onPress}
      style={{ width: '100%' }}
    >
      <ImageOrSkeleton resolution={900} imageUuid={imageUuid}/>
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
          opacity: numMorePics === 0 ? 0 : 1,
        }}
      >
        +{numMorePics} More Pic{numMorePics === 1 ? '' : 's'}
      </DefaultText>
    </Pressable>
  );
};

const UserDetails = ({userName, userAge, matchPercentage, ...rest}) => {
  const {
    containerStyle,
  } = rest;

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
          {userName}{userAge && `, ${userAge}`}
        </DefaultText>
      </View>
      <DefaultText
        style={{
          fontWeight: '500',
          color: 'white',
          alignSelf: 'flex-start',
        }}
      >
        {matchPercentage}% Match
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
