import {
  Animated,
  Pressable,
  View,
} from 'react-native';
import {
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { DefaultText } from './default-text';
import { Avatar } from './avatar';
import { useNavigation } from '@react-navigation/native';
import { friendlyTimestamp } from '../util/util';
import { listen } from '../events/events';
import { setConversationArchived } from '../chat/application-layer';
import { VerificationBadge } from './verification-badge';

const IntrosItem = ({
  wasRead,
  name,
  personUuid,
  imageUuid,
  imageBlurhash,
  matchPercentage,
  isVerified,
}: {
  wasRead: boolean
  name: string
  personUuid: string
  imageUuid: string | null
  imageBlurhash: string | null
  matchPercentage: number
  lastMessage: string
  lastMessageTimestamp: Date
  isAvailableUser: boolean
  isVerified: boolean
}) => {
  const navigation = useNavigation<any>();

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

  const onPress = useCallback(() => navigation.navigate(
    'Prospect Profile Screen',
    {
      screen: 'Prospect Profile',
      params: { personUuid, imageBlurhash },
    }
  ), [personUuid]);

  // TODO: If the conversation is archived but there's no mounted component,
  // this won't trigger
  useEffect(() => {
    return listen(`unskip-profile-${personUuid}`, () => setConversationArchived(personUuid, false));
  }, [personUuid]);

  useEffect(() => {
    return listen(`skip-profile-${personUuid}`, () => setConversationArchived(personUuid, true));
  }, [personUuid]);

  return (
    <Pressable
      onPressIn={fadeIn}
      onPressOut={fadeOut}
      onPress={onPress}
    >
      <Animated.View
        style={{
          backgroundColor: backgroundColor,
          borderRadius: 15,
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: 5,
          paddingBottom: 5,
          paddingLeft: 10,
          marginLeft: 5,
          marginRight: 5,
        }}
      >
        <Avatar
          percentage={matchPercentage}
          imageUuid={imageUuid}
          imageBlurhash={imageBlurhash}
        />
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
              flexShrink: 1,
              gap: 5,
              alignItems: 'center',
              paddingBottom: 5,
            }}
          >
            <DefaultText
              style={{
                fontSize: 16,
                fontWeight: '700',
                overflow: 'hidden',
                flexWrap: 'wrap',
                flexShrink: 1,
              }}
            >
              {name}
            </DefaultText>
            {isVerified &&
              <VerificationBadge size={18} />
            }
          </View>
          <DefaultText
            numberOfLines={1}
            style={{
              fontWeight: wasRead ? '400' : '600',
              color: wasRead ? 'grey' : 'black',
            }}
          >
            Wants to chat
          </DefaultText>
        </View>
      </Animated.View>
    </Pressable>
  );
};

const ChatsItem = ({
  wasRead,
  name,
  personUuid,
  imageUuid,
  imageBlurhash,
  matchPercentage,
  lastMessage,
  lastMessageTimestamp,
  isAvailableUser,
  isVerified,
}: {
  wasRead: boolean
  name: string
  personUuid: string
  imageUuid: string | null
  imageBlurhash: string | null
  matchPercentage: number
  lastMessage: string
  lastMessageTimestamp: Date
  isAvailableUser: boolean
  isVerified: boolean
}) => {
  const navigation = useNavigation<any>();

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

  const onPress = useCallback(() => navigation.navigate(
    'Conversation Screen',
    { personUuid, name, imageUuid, imageBlurhash, isAvailableUser }
  ), [personUuid, name, imageUuid, imageBlurhash, isAvailableUser]);

  return (
    <Pressable
      onPressIn={fadeIn}
      onPressOut={fadeOut}
      onPress={onPress}
    >
      <Animated.View
        style={{
          backgroundColor: backgroundColor,
          borderRadius: 15,
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: 5,
          paddingBottom: 5,
          paddingLeft: 10,
          marginLeft: 5,
          marginRight: 5,
        }}
      >
        <Avatar
          percentage={matchPercentage}
          imageUuid={imageUuid}
          imageBlurhash={imageBlurhash}
        />
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
              gap: 5,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                flexShrink: 1,
                gap: 5,
                alignItems: 'center',
                paddingBottom: 5,
              }}
            >
              <DefaultText
                style={{
                  fontSize: 16,
                  fontWeight: '700',
                  overflow: 'hidden',
                  flexWrap: 'wrap',
                  flexShrink: 1,
                }}
              >
                {name}
              </DefaultText>
              {isVerified &&
                <VerificationBadge size={18} />
              }
            </View>
            <DefaultText
              style={{
                color: 'grey',
              }}
            >
              {friendlyTimestamp(lastMessageTimestamp)}
            </DefaultText>
          </View>
          <DefaultText
            numberOfLines={1}
            style={{
              fontWeight: wasRead ? '400' : '600',
              color: wasRead ? 'grey' : 'black',
            }}
          >
            {lastMessage}
          </DefaultText>
        </View>
      </Animated.View>
    </Pressable>
  );
};

export {
  ChatsItem,
  IntrosItem,
}
