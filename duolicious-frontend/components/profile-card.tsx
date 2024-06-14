import {
  Animated,
  Pressable,
  View,
} from 'react-native';
import {
  useEffect,
  useCallback,
  useRef,
  useState,
  memo,
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
import { listen } from '../events/events';
import { X } from "react-native-feather";
import { PageItem } from './search-tab';
import { ImageBackground } from 'expo-image';

const ImageOrSkeleton_ = ({resolution, imageUuid, imageBlurhash, ...rest}) => {
  const {
    showGradient = true,
  } = rest;

  return (
    <View style={rest.style}>
      {imageUuid !== undefined && !imageBlurhash &&
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
        key={String(imageUuid) + ' ' + String(imageBlurhash)}
        source={imageUuid && {
          uri: `${IMAGES_URL}/${resolution}-${imageUuid}.jpg`
        }}
        placeholder={imageBlurhash && { blurhash: imageBlurhash }}
        transition={150}
        style={{
          width: '100%',
          backgroundColor: imageUuid ? undefined : '#ccc',
          height: undefined,
          aspectRatio: 1,
        }}
      >
        <LinearGradient
          colors={showGradient ? [
            'rgba(0, 0, 0, 0.1)',
            'transparent',
            'transparent',
            'transparent',
            'transparent',
            'rgba(0, 0, 0, 0.1)',
            'rgba(0, 0, 0, 0.3)',
            'rgba(0, 0, 0, 0.4)',
          ] : [
            'transparent',
            'transparent',
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
    </View>
  );
};

const ImageOrSkeleton = memo(ImageOrSkeleton_);

const ProfileCard = ({
  item,
}: {
  item: PageItem,
}) => {
  const {
    name: name,
    age: age,
    match_percentage: matchPercentage,
    profile_photo_uuid: imageUuid,
    profile_photo_blurhash: imageBlurhash,
    prospect_person_id: personId,
    prospect_uuid: personUuid,
    person_messaged_prospect: personMessagedProspect,
    prospect_messaged_person: prospectMessagedPerson,
  } = item;

  const [isSkipped, setIsSkipped] = useState(false);

  const [
    personMessagedProspectState,
    setPersonMessagedProspectState,
  ] = useState(personMessagedProspect);
  const [
    prospectMessagedPersonState,
    setProspectMessagedPersonState,
  ] = useState(prospectMessagedPerson);

  const navigation = useNavigation<any>();

  const itemOnPress = useCallback(() => {
    return navigation.navigate(
      'Prospect Profile Screen',
      {
        screen: 'Prospect Profile',
        params: { personId, personUuid, imageBlurhash },
      }
    );
  }, [navigation, personUuid]);

  const onHide = useCallback(() => setIsSkipped(true), [setIsSkipped]);
  const onUnhide = useCallback(() => setIsSkipped(false), [setIsSkipped]);

  const onMessageFrom = useCallback(
    () => {
      setProspectMessagedPersonState(true);
      item.prospect_messaged_person = true;
    },
    [setProspectMessagedPersonState, item]
  );

  const onMessageTo = useCallback(
    () => {
      setPersonMessagedProspectState(true);
      item.person_messaged_prospect = true;
    },
    [setPersonMessagedProspectState, item]
  );

  useEffect(
    () => listen(`skip-profile-${personId}`, onHide),
    [personId, onHide]
  );

  useEffect(
    () => listen(`unskip-profile-${personId}`, onUnhide),
    [personId, onUnhide]
  );

  useEffect(
    () => listen(`message-from-${personId}`, onMessageFrom),
    [personId, onMessageFrom]
  );

  useEffect(
    () => listen(`message-to-${personId}`, onMessageTo),
    [personId, onMessageTo]
  );

  return (
    <View
      style={{
        paddingTop: 5,
        paddingLeft: 5,
        width: '50%',
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
          }}
        >
          <ImageOrSkeleton
            resolution={450}
            imageUuid={imageUuid}
            imageBlurhash={imageBlurhash}
          />
          <UserDetails
            name={name}
            age={age}
            matchPercentage={matchPercentage}
          />
          {prospectMessagedPersonState &&
            <Ionicons
              style={{
                fontSize: 18,
                color: 'white',
                position: 'absolute',
                bottom: 0,
                right: 18,
                padding: 5,
              }}
              name="chatbubble"
            />
          }
          {personMessagedProspectState &&
            <Ionicons
              style={{
                transform: [ { scaleX: -1 } ],
                fontSize: 18,
                color: 'white',
                position: 'absolute',
                bottom: 0,
                right: 0,
                padding: 5,
              }}
              name="chatbubble"
            />
          }
        </View>
        {isSkipped &&
          <View
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: 'white',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <X
              stroke="#70f"
              strokeWidth={3}
              height={48}
              width={48}
            />
          </View>
        }
      </Pressable>
    </View>
  );
};

const UserDetails = ({name, age, matchPercentage, ...rest}) => {
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
          {name}{age && `, ${age}`}
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
  ImageOrSkeleton,
  ProfileCard,
  VerticalProfileCard,
};
