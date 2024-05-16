import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  View,
} from 'react-native';
import {
  useCallback,
  useEffect,
  useState,
  useRef,
} from 'react';
import { DefaultText } from './default-text';
import { Avatar } from './avatar';
import { useNavigation } from '@react-navigation/native';
import { friendlyTimestamp } from '../util/util';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons/faPaperPlane'
import { Flag, X } from "react-native-feather";
import { listen } from '../events/events';
import { signedInUser } from '../App';
import { setConversationArchived } from '../xmpp/xmpp';

const introVerb = (msg: string) => {
  return (
    msg.includes('?') ||
    msg.toLowerCase().startsWith('who ') ||
    msg.toLowerCase().startsWith('where ') ||
    msg.toLowerCase().startsWith('when ') ||
    msg.toLowerCase().startsWith('why ') ||
    msg.toLowerCase().startsWith('what ') ||
    msg.toLowerCase().startsWith('how ')
  )
  ? 'asks'
  : 'says';
};

const IntrosItem = ({
  wasRead,
  name,
  personId,
  personUuid,
  imageUuid,
  matchPercentage,
  lastMessage,
  lastMessageTimestamp,
  isAvailableUser,
}: {
  wasRead: boolean
  name: string
  personId: number
  personUuid: string
  imageUuid: string | null
  matchPercentage: number
  lastMessage: string
  lastMessageTimestamp: Date
  isAvailableUser: boolean
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
      params: { personId, personUuid },
    }
  ), [personId, personUuid]);

  // TODO: If the conversation is archived but there's no mounted component,
  // this won't trigger
  useEffect(() => {
    return listen(`unskip-profile-${personId}`, () => setConversationArchived(personUuid, false));
  }, [personId]);

  useEffect(() => {
    return listen(`skip-profile-${personId}`, () => setConversationArchived(personUuid, true));
  }, [personId]);

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
        <Avatar percentage={matchPercentage} imageUuid={imageUuid}/>
        <View
          style={{
            paddingLeft: 10,
            paddingRight: 20,
            flexDirection: 'column',
            flex: 1,
            flexGrow: 1,
          }}
        >
          <DefaultText
            style={{
              fontSize: 16,
              fontWeight: '700',
              paddingBottom: 5,
              overflow: 'hidden',
              flexWrap: 'wrap',
              flexShrink: 1,
            }}
          >
            {name}
          </DefaultText>
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
  personId,
  personUuid,
  imageUuid,
  matchPercentage,
  lastMessage,
  lastMessageTimestamp,
  isAvailableUser,
}: {
  wasRead: boolean
  name: string
  personId: number
  personUuid: string
  imageUuid: string | null
  matchPercentage: number
  lastMessage: string
  lastMessageTimestamp: Date
  isAvailableUser: boolean
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
    { personId, personUuid, name, imageUuid, isAvailableUser }
  ), [personId, personUuid, name, imageUuid, isAvailableUser]);

  // TODO: If the conversation is archived but there's no mounted component,
  // this won't trigger
  useEffect(() => {
    return listen(`unskip-profile-${personId}`, () => setConversationArchived(personUuid, false));
  }, [personId]);

  useEffect(() => {
    return listen(`skip-profile-${personId}`, () => setConversationArchived(personUuid, true));
  }, [personId]);

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
        <Avatar percentage={matchPercentage} imageUuid={imageUuid}/>
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
                flexWrap: 'wrap',
                flexShrink: 1,
              }}
            >
              {name}
            </DefaultText>
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
