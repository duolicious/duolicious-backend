import {
  Animated,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { TopNavBar } from './top-nav-bar';
import { InboxItem } from './inbox-item';
import { DefaultText } from './default-text';
import { ButtonGroup } from './button-group';
import { Notice } from './notice';
import { OptionScreen } from './option-screen';
import { hideMeFromStrangersOptionGroup } from '../data/option-groups';
import { DefaultFlatList } from './default-flat-list';

const Stack = createNativeStackNavigator();

const InboxItemMemo = memo(InboxItem);

const InboxTab = ({navigation}) => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Inbox Tab" component={InboxTab_} />
      <Stack.Screen name="Inbox Option Screen" component={OptionScreen} />
    </Stack.Navigator>
  );
};

const InboxTab_ = ({navigation}) => {
  const [typeIndex, setTypeIndex] = useState(0);
  const [sortByIndex, setSortByIndex] = useState(0);
  const [isTooManyTapped, setIsTooManyTapped] = useState(false);

  const buttonOpacity = useRef(new Animated.Value(0)).current;

  const fadeOut = useCallback(() => {
    Animated.timing(buttonOpacity, {
      toValue: 0.0,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, []);

  const fadeIn = useCallback(() => {
    Animated.timing(buttonOpacity, {
      toValue: 1.0,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, []);

  const setTypeIndex_ = useCallback((value) => {
    setTypeIndex(value);

    if (value === 1) {
      fadeIn();
    } else {
      fadeOut();
    }
  }, []);

  const setSortByIndex_ = useCallback((value) => {
    setSortByIndex(value);
  }, []);

  const onPressTooMany = useCallback(() => {
    navigation.navigate(
      'Inbox Option Screen',
      {
        optionGroups: [hideMeFromStrangersOptionGroup],
      }
    );
    setIsTooManyTapped(true);
  }, []);

  const onPressInboxItem = useCallback(
    () => navigation.navigate('Conversation Screen'),
    []
  );

  const renderItem = useCallback((x) => (
    <InboxItemMemo
      onPress={onPressInboxItem}
      unread={x.index < 2}
    />
  ), []);

  return (
    <>
      <TopNavBar>
        <DefaultText
          style={{
            fontWeight: '700',
            fontSize: 20,
          }}
        >
          Inbox
        </DefaultText>
      </TopNavBar>
      <DefaultFlatList
        emptyText="You haven't received any messages yet"
        endText="No more messages to show"
        fetchPage={async (): Promise<any[]> => await Array(1)}
        ListHeaderComponent={
          <>
            <ButtonGroup
              buttons={['Chats\n(2)', 'Intros\n(2)']}
              selectedIndex={typeIndex}
              onPress={setTypeIndex_}
              containerStyle={{
                marginTop: 5,
                marginLeft: 20,
                marginRight: 20,
              }}
            />
            <Animated.View
              style={{
                opacity: buttonOpacity,
              }}
              pointerEvents={typeIndex === 1 ? 'auto' : 'none'}
            >
              <ButtonGroup
                buttons={['Latest First', 'Best Matches First']}
                selectedIndex={sortByIndex}
                onPress={setSortByIndex_}
                secondary={true}
                containerStyle={{
                  flexGrow: 1,
                  marginLeft: 20,
                  marginRight: 20,
                }}
              />
            </Animated.View>
            {!isTooManyTapped &&
              <Notice
                onPress={onPressTooMany}
                style={{
                  marginBottom: 5,
                }}
              >
                <DefaultText style={{color: '#70f', textAlign: 'center'}} >
                  Getting too many intros? You can keep your profile hidden and
                  make the first move instead 🕵️. Press here to change your privacy
                  settings.
                </DefaultText>
              </Notice>
            }
          </>
        }
        renderItem={renderItem}
      />
    </>
  );
};

export default InboxTab;
