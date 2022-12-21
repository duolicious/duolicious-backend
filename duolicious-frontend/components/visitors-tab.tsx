import {
  Animated,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {
  memo,
  useCallback,
  useRef,
  useState,
} from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { TopNavBar } from './top-nav-bar';
import { DefaultText } from './default-text';
import { VerticalProfileCard } from './profile-card';
import { DefaultFlatList } from './default-flat-list';

const Stack = createNativeStackNavigator();

const VerticalProfileCardMemo = memo(VerticalProfileCard);

const VisitorsTab = ({navigation}) => {
  const onPress = useCallback(() => navigation.navigate(
    'Prospect Profile Screen'
  ), []);

  const renderItem = useCallback((x) => (
    <VerticalProfileCardMemo
      onPress={onPress}
      name="Rahim"
      age="19"
      location="Paris, France"
      timeVisited="19:48"
      unread={x.index < 3}
    />
  ), []);

  return (
    <>
      <TopNavBar
        style={{
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <DefaultText
          style={{
            fontWeight: '700',
            fontSize: 20,
          }}
        >
          Visitors
        </DefaultText>
      </TopNavBar>
      <DefaultFlatList
        emptyText="Nobody's visited your profile yet."
        endText="No more visitors to show."
        fetchPage={async (): Promise<any[]> => await Array(10)}
        renderItem={renderItem}
      />
    </>
  );
};

export {
  VisitorsTab,
};
