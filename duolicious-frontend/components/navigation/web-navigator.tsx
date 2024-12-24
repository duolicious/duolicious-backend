import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  createNavigatorFactory,
  type DefaultNavigatorOptions,
  type NavigatorTypeBagBase,
  type ParamListBase,
  type StaticConfig,
  type TabActionHelpers,
  type TabNavigationState,
  TabRouter,
  type TabRouterOptions,
  type TypedNavigator,
  useNavigationBuilder,
} from '@react-navigation/native';
import { WebBar } from './web-bar';
import { Scrollbar } from './scroll-bar';

// Props accepted by the view
type TabNavigationConfig = {
  tabBarStyle: StyleProp<ViewStyle>;
  contentStyle: StyleProp<ViewStyle>;
};

// Supported screen options
type TabNavigationOptions = {
  title?: string;
};

// Map of event name and the type of data (in event.data)
//
// canPreventDefault: true adds the defaultPrevented property to the
// emitted events.
type TabNavigationEventMap = {
  tabPress: {
    data: { isAlreadyFocused: boolean };
    canPreventDefault: true;
  };
};

// The props accepted by the component is a combination of 3 things
type Props<Navigation> = DefaultNavigatorOptions<
  ParamListBase,
  string | undefined,
  TabNavigationState<ParamListBase>,
  TabNavigationOptions,
  TabNavigationEventMap,
  Navigation
> &
  TabRouterOptions &
  TabNavigationConfig;

function WebNavigator<Navigation>({
  id,
  initialRouteName,
  children,
  layout,
  screenListeners,
  screenOptions,
  screenLayout,
  backBehavior,
  tabBarStyle,
  contentStyle,
}: Props<Navigation>) {
  const { state, navigation, descriptors, NavigationContent } =
    useNavigationBuilder<
      TabNavigationState<ParamListBase>,
      TabRouterOptions,
      TabActionHelpers<ParamListBase>,
      TabNavigationOptions,
      TabNavigationEventMap
    >(TabRouter, {
      id,
      initialRouteName,
      children,
      layout,
      screenListeners,
      screenOptions,
      screenLayout,
      backBehavior,
    });

  return (
    <NavigationContent>
      <View
        style={{
          flexDirection: 'row',
          flex: 1,
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            flex: 5,
            minWidth: 280,
            backgroundColor: '#70f',
            alignItems: 'flex-end',
            borderRightWidth: 5,
            borderColor: 'black',
            paddingRight: 12,
          }}
        >
          <WebBar
            state={state}
            navigation={navigation}
            tabBarStyle={tabBarStyle}
            descriptors={descriptors}
          />
        </View>
        <View
          style={{
            flex: 13,
          }}
        >
          <View style={[{
            width: '100%',
            maxWidth: 600,
            height: '100%',
          }, contentStyle]}>
            {state.routes.map((route, i) => {
              return (
                <View
                  key={route.key}
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      paddingHorizontal: 20,
                      display: i === state.index ? 'flex' : 'none',
                      borderRightWidth: 1,
                      borderColor: 'black',
                    },
                  ]}
                >
                  {descriptors[route.key].render()}
                </View>
              );
            })}
          </View>
        </View>
        <Scrollbar/>
      </View>
    </NavigationContent>
  );
};

function createWebNavigator(config?: any) {
  return createNavigatorFactory(WebNavigator)(config);
}

export {
  createWebNavigator,
};
