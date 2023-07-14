import {
  Pressable,
  Animated,
  View,
} from 'react-native';
import {
  useRef,
  useCallback,
} from 'react';
import { DefaultText } from './default-text';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StackActions } from '@react-navigation/native';
import { QAndADevice } from './q-and-a-device';

const displayedTabs: Set<string> = new Set([
  "Q&A",
  "Search",
  "Inbox",
  "Traits",
  "Profile",
]);

const TabBar = ({state, descriptors, navigation}) => {
  return (
    <View
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        height: 50,
        width: '100%',
        backgroundColor: 'white',
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
                  width: '100%',
                  height: '100%',
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
                    <View
                      style={{
                        position: 'absolute',
                        top: 3,
                        right: -13,
                        height: 10,
                        width: 10,
                        backgroundColor: '#70f',
                        borderRadius: 999,
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
