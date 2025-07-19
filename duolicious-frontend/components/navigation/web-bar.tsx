import {
  useCallback,
  useEffect,
  useRef,
} from 'react';
import {
  Animated,
  Pressable,
  Text,
  View,
  ScrollView,
} from 'react-native';
import {
  DefaultText,
} from '../default-text';
import {
  CommonActions,
} from '@react-navigation/native';
import {
  Logo16
} from '../logo';
import {
  LabelToIcon
} from './util';
import { useInboxStats } from '../../chat/application-layer/hooks/inbox-stats';
import { WebBarFooter } from './web-bar-footer/web-bar-footer';

const Logo = () => {
  return (
    <View
      style={{
        flexDirection: 'row',
        padding: 16,
        gap: 6,
      }}
    >
      <View
        style={{
          width: 60,
          alignItems: 'center',
        }}
      >
        <Logo16/>
      </View>
      <Text
        style={{
          color: 'white',
          alignSelf: 'center',
          fontFamily: 'TruenoBold',
          fontSize: 22,
          textAlign: 'center',
        }}
        selectable={false}
      >
        Duolicious
      </Text>
    </View>
  );
};

const NavigationItems = ({state, navigation, descriptors}) => {
  const unreadIndicatorOpacity = useRef(new Animated.Value(0)).current;

  const hideIndicator = useCallback(() => {
    unreadIndicatorOpacity.setValue(0);
  }, [unreadIndicatorOpacity]);

  const showIndicator = useCallback(() => {
    unreadIndicatorOpacity.setValue(1);
  }, [unreadIndicatorOpacity]);

  const stats = useInboxStats();
  const numUnread = stats ?
    (stats.numChats ? stats.numUnreadChats : stats.numUnreadIntros) :
    0;

  const prevNumUnread = useRef<number>(-1);

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
        flex: 1,
      }}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;

        const isFocused = state.index === index;

        return (
          <Pressable
            key={route.key}
            onPress={() => {
              const isFocused = state.index === index;
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
                data: {
                  isAlreadyFocused: isFocused,
                },
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.dispatch({
                  ...CommonActions.navigate(route),
                  target: state.key,
                });
              }
            }}
            style={{
              padding: 12,
              margin: 4,
              flexDirection: 'row',
              gap: 6,
              borderRadius: 999,
              backgroundColor: isFocused ? 'white' : 'transparent',
            }}
          >
            <View
              style={{
                width: 60,
                alignItems: 'center',
              }}
            >
              <LabelToIcon
                label={label}
                isFocused={isFocused}
                unreadIndicatorOpacity={unreadIndicatorOpacity}
                color={isFocused ? "black" : "white"}
                backgroundColor={isFocused ? "white" : "#70f"}
                unreadIndicatorColor={isFocused ? '#70f' : 'white'}
                fontSize={26}
              />
            </View>
            <DefaultText
              style={{
                color: isFocused ? 'black' : 'white',
                fontWeight: isFocused ? 900 : 700,
                fontSize: 20,
              }}
            >
              {descriptors[route.key].options.title || route.name}
            </DefaultText>
          </Pressable>
        );
      })}
    </View>
  );
};

const WebBar = ({state, navigation, tabBarStyle, descriptors}) => {
  return (
    <ScrollView
      style={{
        height: '100%',
        backgroundColor: '#70f',
        borderRightWidth: 5,
        borderColor: 'black',
      }}
      contentContainerStyle={[
        {
          width: '100%',
          flex: 1,
          alignItems: 'flex-end',
          paddingHorizontal: 12,
        },
        tabBarStyle,
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={{
          flex: 1,
          justifyContent: 'space-between',
          width: 260,
        }}
      >
        <View
          style={{
            width: '100%',
            gap: 20,
          }}
        >
          <Logo/>
          <NavigationItems
            state={state}
            navigation={navigation}
            descriptors={descriptors}
          />
        </View>
        <View
          style={{
            width: '100%',
            paddingTop: 40,
            paddingBottom: 10,
            alignItems: 'center',
          }}
        >
          <WebBarFooter/>
        </View>
      </View>
    </ScrollView>
  );
};

export {
  WebBar,
}
