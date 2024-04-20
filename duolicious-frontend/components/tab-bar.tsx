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
import { DefaultText } from './default-text';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StackActions } from '@react-navigation/native';
import { QAndADevice } from './q-and-a-device';
import { Inbox, inboxStats, observeInbox } from '../xmpp/xmpp';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const displayedTabs: Set<string> = new Set([
  "Q&A",
  "Search",
  "Inbox",
  "Traits",
  "Profile",
]);

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
    return observeInbox(onChangeInbox);
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
        {state.routes.flatMap((route, index) => {
          if (!displayedTabs.has(route.name)) {
            return [];
          }

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
            // TODO: While this line works, it produces an error. I don't know why
            navigation.dispatch(StackActions.popToTop());

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

          const inputRange = state.routes.map((_, i) => i);

          const searchIcon =
            isFocused ? 'search' : 'search-outline';
          const inboxIcon =
            isFocused ? 'chatbubbles' : 'chatbubbles-outline';
          const profileIcon =
            isFocused ? 'person' : 'person-outline';

          const iconStyle = {
            fontSize: 20,
          };

          return [
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
                {label === 'Q&A' &&
                  <QAndADevice
                    color="black"
                    fontSize={iconStyle.fontSize}
                    isBold={isFocused}
                  />
                }
                <View>
                  {label === 'Search' &&
                    <Ionicons style={{...iconStyle}} name={searchIcon}/>
                  }
                  {label === 'Inbox' &&
                    <Ionicons style={{...iconStyle}} name={inboxIcon}/>
                  }
                  {label === 'Inbox' &&
                    <Animated.View
                      style={{
                        position: 'absolute',
                        top: 0,
                        right: -13,
                        height: 12,
                        width: 12,
                        backgroundColor: '#70f',
                        borderRadius: 999,
                        shadowOffset: {
                          width: 0,
                          height: 2,
                        },
                        shadowOpacity: 0.4,
                        shadowRadius: 4,
                        elevation: 4,
                        opacity: unreadIndicatorOpacity,
                      }}
                    />
                  }
                  {label === 'Traits' &&
                    <View
                      style={{
                        height: 20,
                        overflow: 'visible',
                      }}
                    >
                      <DefaultText
                        style={{
                          fontSize: 22,
                          marginTop: -6,
                          fontWeight: isFocused ? '700' : undefined,
                        }}
                      >
                        Ψ
                      </DefaultText>
                    </View>
                  }
                  {label === 'Profile' &&
                    <Ionicons style={{...iconStyle}} name={profileIcon}/>
                  }
                </View>
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
          ];
        })}
      </View>
    </View>
  );
};

export {
  TabBar,
};
