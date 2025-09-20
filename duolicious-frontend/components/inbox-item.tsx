import {
  Animated,
  Pressable,
  View,
} from 'react-native';
import {
  useCallback,
} from 'react';
import { DefaultText } from './default-text';
import { Avatar } from './avatar';
import { useNavigation } from '@react-navigation/native';
import { friendlyTimestamp } from '../util/util';
import { VerificationBadge } from './verification-badge';
import { usePressableAnimation } from '../animation/animation';

const IntrosItem = ({
  wasRead,
  name,
  personUuid,
  photoUuid,
  photoBlurhash,
  matchPercentage,
  isVerified,
}: {
  wasRead: boolean
  name: string
  personUuid: string
  photoUuid: string | null
  photoBlurhash: string | null
  matchPercentage: number
  lastMessage: string
  lastMessageTimestamp: Date
  isAvailableUser: boolean
  isVerified: boolean
}) => {
  const navigation = useNavigation<any>();

  const { backgroundColor, onPressIn, onPressOut } = usePressableAnimation();

  const onPress = useCallback(() => navigation.navigate(
    'Prospect Profile Screen',
    {
      screen: 'Prospect Profile',
      params: { personUuid, photoBlurhash },
    }
  ), [personUuid]);

  return (
    <Pressable
      onPressIn={onPressIn}
      onPressOut={onPressOut}
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
          photoUuid={photoUuid}
          photoBlurhash={photoBlurhash}
          personUuid={personUuid}
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
              color: wasRead ? 'grey' : undefined,
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
  photoUuid,
  photoBlurhash,
  matchPercentage,
  lastMessage,
  lastMessageTimestamp,
  isAvailableUser,
  isVerified,
}: {
  wasRead: boolean
  name: string
  personUuid: string
  photoUuid: string | null
  photoBlurhash: string | null
  matchPercentage: number
  lastMessage: string
  lastMessageTimestamp: Date
  isAvailableUser: boolean
  isVerified: boolean
}) => {
  const navigation = useNavigation<any>();

  const { backgroundColor, onPressIn, onPressOut } = usePressableAnimation();

  const onPress = useCallback(() => navigation.navigate(
    'Conversation Screen',
    { personUuid, name, photoUuid, photoBlurhash, isAvailableUser }
  ), [personUuid, name, photoUuid, photoBlurhash, isAvailableUser]);

  return (
    <Pressable
      onPressIn={onPressIn}
      onPressOut={onPressOut}
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
          photoUuid={photoUuid}
          photoBlurhash={photoBlurhash}
          personUuid={personUuid}
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
              color: wasRead ? 'grey' : undefined,
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
