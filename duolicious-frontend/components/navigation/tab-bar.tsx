import {
  useCallback,
  useEffect,
  useRef,
} from 'react';
import {
  Pressable,
  Animated,
  View,
} from 'react-native';
import { DefaultText } from '../default-text';
import { useInboxStats } from '../../chat/application-layer/hooks/inbox-stats';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LabelToIcon } from './util';
import { useAppTheme } from '../../app-theme/app-theme';

const Tab = ({ navigation, state, route, descriptors, index, unreadIndicatorOpacity }) => {
  const { appThemeName } = useAppTheme();

  const animated = useRef(new Animated.Value(1)).current;

  const backgroundColor = animated.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0, 0, 0, 1)', 'transparent'],
    extrapolate: 'clamp',
  });

  const fadeOut = () => {
    Animated.timing(animated, {
      toValue: 1,
      duration: 500,
      useNativeDriver: false,
    }).start();
  };

  const fadeIn = () => animated.setValue(appThemeName === 'dark' ? 0 : 0.9);

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
      onPressIn={fadeIn}
      onPressOut={fadeOut}
      style={{
        flex: 1,
        height: '100%',
      }}
    >
      <Animated.View
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}
        accessibilityLabel={options.tabBarAccessibilityLabel}
        testID={options.tabBarTestID}
        style={{
          width: '100%',
          height: '100%',
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

  const stats = useInboxStats();
  const numUnread = stats ?
    (stats.numChats ? stats.numUnreadChats : stats.numUnreadIntros) :
    0;

  const prevNumUnread = useRef<number>(-1);

  const unreadIndicatorOpacity = useRef(new Animated.Value(0)).current;

  const hideIndicator = useCallback(() => {
    unreadIndicatorOpacity.setValue(0);
  }, [unreadIndicatorOpacity]);

  const showIndicator = useCallback(() => {
    unreadIndicatorOpacity.setValue(1);
  }, [unreadIndicatorOpacity]);

  useEffect(() => {
    if (numUnread === 0) {
      hideIndicator();
    } else if (numUnread > prevNumUnread.current) {
      showIndicator();
    }
    prevNumUnread.current = numUnread;
  }, [numUnread, hideIndicator, showIndicator]);

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
