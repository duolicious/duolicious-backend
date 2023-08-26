import {
  Animated,
  Image,
  Pressable,
  View,
} from 'react-native';
import {
  useCallback,
  useRef,
} from 'react';
import { DefaultText } from './default-text';
import { Avatar } from './avatar';
import { useNavigation } from '@react-navigation/native';
import { format, isToday, isThisYear, isThisWeek } from 'date-fns'

const formatChatTimestamp = (date: Date): string => {
  if (isToday(date)) {
    // Format as 'HH:mm'
    return format(date, 'HH:mm')
  } else if (isThisWeek(date)) {
    // Format as 'eeee' (day of the week)
    return format(date, 'eeee')
  } else if (isThisYear(date)) {
    // Format as 'd MMMM' (date and month)
    return format(date, 'd MMMM')
  } else {
    // Format as 'd MMMM yyyy' (date, month and year)
    return format(date, 'd MMMM yyyy')
  }
}

const InboxItem = ({
  wasRead,
  name,
  personId,
  imageUuid,
  matchPercentage,
  lastMessage,
  lastMessageTimestamp,
  isDeletedUser,
}: {
  wasRead: boolean
  name: string
  personId: number
  imageUuid: string | null
  matchPercentage: number
  lastMessage: string
  lastMessageTimestamp: Date
  isDeletedUser: boolean
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
    { personId, name, imageUuid, isDeletedUser }
  ), [personId, name, imageUuid, isDeletedUser]);

  return (
    <Pressable
      onPressIn={fadeIn}
      onPressOut={fadeOut}
      onPress={onPress}
    >
      <Animated.View
        style={{
          backgroundColor: backgroundColor,
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: 5,
          paddingBottom: 5,
          paddingLeft: 10,
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
              }}
            >
              {name}
            </DefaultText>
            <DefaultText
              style={{
                color: 'grey',
              }}
            >
              {formatChatTimestamp(lastMessageTimestamp)}
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
  InboxItem,
}
