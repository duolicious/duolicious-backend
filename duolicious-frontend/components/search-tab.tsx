import {
  Animated,
  Platform,
  Pressable,
  StatusBar,
  View,
} from 'react-native';
import {
  memo,
  useCallback,
  useRef,
  useState,
} from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfileCard }  from './profile-card';
import { DuoliciousTopNavBar } from './top-nav-bar';
import { SearchFilterScreen } from './search-filter-screen';
import { DefaultText } from './default-text';
import Ionicons from '@expo/vector-icons/Ionicons';
import { QAndADevice } from './q-and-a-device';
import { Notice } from './notice';
import { DefaultFlatList } from './default-flat-list';

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

const delay = async (ms: number) => {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const listContainerStyle = {
  paddingRight: 5,
};

const Stack = createNativeStackNavigator();

const SearchScreen = ({navigation}) => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        presentation: 'modal'
      }}
    >
      <Stack.Screen name="Search Screen" component={SearchScreen_} />
      <Stack.Screen name="Search Filter Screen" component={SearchFilterScreen} />
    </Stack.Navigator>
  );
};

const ProfileCardMemo = memo(ProfileCard);

// TODO
const fetchPage = async (n: number): Promise<number[]> => {
  // await delay(500 + getRandomInt(1000))
  await delay(2000);

  if (n > 10 || n <= 0) {
    return [];
  }

  const a = [...Array(10)];
  return a.map((_, i) => (i + 1) + a.length * n - a.length);
};

const SearchScreen_ = ({navigation}) => {
  const opacity = useRef(new Animated.Value(1)).current;

  const onPressIn = useCallback(() => {
    opacity.setValue(0.2);
  }, []);

  const onPressOut = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, []);

  const onPress = useCallback(() => {
    navigation.navigate('Search Filter Screen');
  }, []);

  const ListHeaderComponent = useCallback(() => {
    return (
      <Notice
        onPress={() => navigation.navigate('Q&A')}
        style={{
          marginRight: 0,
        }}
      >
        <DefaultText style={{color: '#70f'}} >
          Get better matches by playing Q&A{' '}
        </DefaultText>
        <QAndADevice color="#70f"/>
      </Notice>
    );
  }, []);

  const [itemContainerStyle, _] = useState({width: '50%'});
  const itemOnPress = useCallback(() => {
    return navigation.navigate('Prospect Profile Screen')
  }, []);

  const renderItem = useCallback((x: any) => {
    return (
      <ProfileCardMemo
        containerStyle={itemContainerStyle}
        onPress={itemOnPress}
      />
    );
  }, []);

  return (
    <>
      <DuoliciousTopNavBar>
        <Pressable
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          onPress={onPress}
          style={{
            position: 'absolute',
            right: 15,
            top: 0,
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Animated.View style={{opacity: opacity}}>
            <Ionicons
              style={{
                color: '#333',
                fontSize: 30,
              }}
              name="options"
            />
          </Animated.View>
        </Pressable>
      </DuoliciousTopNavBar>
      <DefaultFlatList
        emptyText={
          "No matches found. Try adjusting your search filters to include " +
          "more people."
        }
        endText={
          "No more matches to show"
        }
        fetchPage={fetchPage}
        hideListHeaderComponentWhenEmpty={true}
        numColumns={2}
        contentContainerStyle={listContainerStyle}
        ListHeaderComponent={ListHeaderComponent}
        renderItem={renderItem}
      />
    </>
  );
};

export default SearchScreen;
