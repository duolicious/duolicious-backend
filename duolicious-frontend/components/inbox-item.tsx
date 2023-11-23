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
import { setHidden } from '../hide-and-block/hide-and-block';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons/faPaperPlane'
import { RotateCcw, X } from "react-native-feather";



const introVerb = (msg: string) => {
  return (
    msg.endsWith('?') ||
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
  imageUuid,
  matchPercentage,
  lastMessage,
  lastMessageTimestamp,
  isAvailableUser,
}: {
  wasRead: boolean
  name: string
  personId: number
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
    outputRange: [
      'rgba(222,222,222, 1)',
      wasRead ? 'white' : 'rgba(241, 229, 255, 1)',
    ],
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
      params: { personId },
    }
  ), [personId]);

  return (
    <>
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
          paddingTop: 15,
          paddingBottom: 10,
          paddingLeft: 10,
          marginLeft: 5,
          marginRight: 5,
        }}
      >
        <Avatar percentage={matchPercentage} imageUuid={imageUuid}/>
        <View
          style={{
            paddingLeft: 18,
            paddingRight: 20,
            flexDirection: 'column',
            flex: 1,
            flexGrow: 1,
            marginBottom: 30,
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
                fontSize: 20,
                fontWeight: '700',
                paddingBottom: 5,
                overflow: 'hidden',
                color: wasRead ? 'black' : '#70f',
                flexWrap: 'wrap',
                flexShrink: 1,
              }}
            >
              {name} {introVerb(lastMessage)}...
            </DefaultText>
            <DefaultText
              style={{
                color: wasRead ? 'grey' : '#70f',
              }}
            >
              {friendlyTimestamp(lastMessageTimestamp)}
            </DefaultText>
          </View>
          <DefaultText
            numberOfLines={5}
            style={{
              fontWeight: '400',
              color: wasRead ? 'grey' : '#70f',
            }}
          >
            {lastMessage}
          </DefaultText>
        </View>
      </Animated.View>
    </Pressable>
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Buttons
        navigation={navigation}
        personId={personId}
        name={name}
        imageUuid={imageUuid}
      />
    </View>
    </>
  );
};

const FloatingProfileInteractionButton = ({
  children,
  navigation,
  onPress,
  backgroundColor,
}) => {
  const opacity = useRef(new Animated.Value(1)).current;

  const fadeOut = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 0.4,
      duration: 0,
      useNativeDriver: false,
    }).start();
  }, []);

  const fadeIn = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 50,
      useNativeDriver: false,
    }).start();
  }, []);

  return (
    <Pressable
      style={{
        borderRadius: 999,
        zIndex: 999,
        marginLeft: 15,
        marginRight: 15,
        marginBottom: 14,
        marginTop: 14,
      }}
      onPressIn={fadeOut}
      onPressOut={fadeIn}
      onPress={onPress}
    >
      <Animated.View
        style={{
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: backgroundColor,
          opacity: opacity,
          flexDirection: 'row',
          shadowOffset: {
            width: 0,
            height: 4,
          },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 6,
          height: 60,
          width: 60,
        }}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
};

const FloatingHideButton = ({navigation, personId}) => {
  const [isLoading, setIsLoading] = useState(false);

  const onPress = useCallback(async () => {
    if (personId === undefined) return;

    setIsLoading(true);
    if (await setHidden(personId, true)) {
      setIsLoading(false);
    }
  }, [isLoading, personId]);

  return (
    <FloatingProfileInteractionButton
      navigation={navigation}
      onPress={onPress}
      backgroundColor="white"
    >
      {isLoading &&
        <ActivityIndicator size="large" color="#70f"/>
      }
      {!isLoading && <X
          stroke="#70f"
          strokeWidth={3}
          height={26}
          width={26}
        />
      }
    </FloatingProfileInteractionButton>
  );
};

const FloatingSendIntroButton = ({navigation, personId, name, imageUuid}) => {
  const onPress = useCallback(() => {
    if (personId === undefined) return;
    if (name === undefined) return;

    navigation.navigate('Conversation Screen', { personId, name, imageUuid });
  }, [navigation, personId, name, imageUuid]);

  return (
    <FloatingProfileInteractionButton
      navigation={navigation}
      onPress={onPress}
      backgroundColor="#70f"
    >
      {personId !== undefined && name !== undefined &&
        <FontAwesomeIcon
          icon={faPaperPlane}
          size={26}
          style={{color: 'white'}}
        />
      }
    </FloatingProfileInteractionButton>
  );
};

const Buttons = ({navigation, personId, name, imageUuid}) => {
  return (
    <View
      style={{
        flexDirection: 'row',
        marginTop: -45,
      }}
    >
      <FloatingHideButton
        navigation={navigation}
        personId={personId}
      />
      <FloatingSendIntroButton
        navigation={navigation}
        personId={personId}
        name={name}
        imageUuid={imageUuid}
      />
    </View>
  );
};

const ChatsItem = ({
  wasRead,
  name,
  personId,
  imageUuid,
  matchPercentage,
  lastMessage,
  lastMessageTimestamp,
  isAvailableUser,
}: {
  wasRead: boolean
  name: string
  personId: number
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
    { personId, name, imageUuid, isAvailableUser }
  ), [personId, name, imageUuid, isAvailableUser]);

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
