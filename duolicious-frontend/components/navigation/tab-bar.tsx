import {
  Pressable,
  Animated,
  View,
} from 'react-native';
import {
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { DefaultText } from '../default-text';
import { Inbox, inboxStats } from '../../chat/application-layer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listen } from '../../events/events';
import {
  LabelToIcon,
} from './util';

const Tab = ({ navigation, state, route, descriptors, index, unreadIndicatorOpacity }) => {
  const animated = useRef(new Animated.Value(1)).current;

  const backgroundColor = animated.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0, 0, 0, 0.1)', 'transparent'],
    extrapolate: 'clamp',
  });

  const fadeIn = () => {
    Animated.timing(animated, {
      toValue: 1,
      duration: 500,
      useNativeDriver: false,
    }).start();
  };

  const fadeOut = () => {
    animated.setValue(0);
  };

  const { options } = descriptors[route.key];
  const label =
    options.tabBarLabel !== undefined
      ? options.tabBarLabel
      : options.title !== undefined
      ? options.title
      : route.name;

  const isFocused = state.index === index;

  const onPress = () => {
    // TODO: Do I even need this?
    // navigation.dispatch(StackActions.popToTop());

    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });

    if (!isFocused && !event.defaultPrevented) {
      // The `merge: true` option makes sure that the params inside the tab screen are preserved
      navigation.navigate({ name: route.name, merge: true });
    }
  };

  return (
    <Pressable
      key={route.key}
      onPress={onPress}
      onPressIn={fadeOut}
      onPressOut={fadeIn}
      style={{
        flex: 1,
        flexGrow: 1,
        height: '100%',
      }}
    >
      <Animated.View
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}
        accessibilityLabel={options.tabBarAccessibilityLabel}
        testID={options.tabBarTestID}
        style={{
          paddingTop: 6,
          paddingBottom: 6,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: backgroundColor,
          flexDirection: 'column',
          overflow: 'visible',
        }}
      >
        <LabelToIcon
          label={label}
          isFocused={isFocused}
          unreadIndicatorOpacity={unreadIndicatorOpacity}
        />
        <DefaultText
          style={{
            textAlign: 'center',
            fontFamily: isFocused ? 'MontserratBold' : 'MontserratRegular',
          }}
        >
          {label}
        </DefaultText>
      </Animated.View>
    </Pressable>
  );
};

const TabBar = ({state, descriptors, navigation}) => {
  const insets = useSafeAreaInsets();

  const prevNumUnread = useRef(0);
  const numUnread = useRef(0);

  const unreadIndicatorOpacity = useRef(new Animated.Value(0)).current;

  const hideIndicator = useCallback(() => {
    unreadIndicatorOpacity.setValue(0);
  }, []);

  const showIndicator = useCallback(() => {
    unreadIndicatorOpacity.setValue(1);
  }, []);

  const onChangeInbox = useCallback((inbox: Inbox | null) => {
    if (inbox) {
      prevNumUnread.current = numUnread.current;

      const stats = inboxStats(inbox);
      numUnread.current = stats.numChats ?
        stats.numUnreadChats :
        stats.numUnreadIntros;

    } else {
      prevNumUnread.current = numUnread.current;
      numUnread.current = 0;
    }

    if (numUnread.current === 0) {
      hideIndicator();
    } else if (numUnread.current > prevNumUnread.current) {
      showIndicator();
    }
  }, []);

  useEffect(() => {
    return listen<Inbox | null>('inbox', onChangeInbox, true);
  }, []);

  return (
    <View
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        height: 50 + insets.bottom,
        width: '100%',
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          height: '100%',
          width: '100%',
          maxWidth: 600,
        }}
      >
        {state.routes.map((route, index) =>
          <Tab
            key={index}
            navigation={navigation}
            state={state}
            route={route}
            descriptors={descriptors}
            index={index}
            unreadIndicatorOpacity={unreadIndicatorOpacity}
          />
        )}
      </View>
    </View>
  );
};

export {
  TabBar,
};
