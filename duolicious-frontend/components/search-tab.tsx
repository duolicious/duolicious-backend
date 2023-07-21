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
import { japi } from '../api/api';

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

type PageItem = {
  prospect_person_id: number
  profile_photo_uuid: string
  name: string
  age: number
  match_percentage: number
};

const fetchPage = async (pageNumber: number): Promise<PageItem[]> => {
  const resultsPerPage = 10;
  const offset = resultsPerPage * (pageNumber - 1);
  const response = await japi('get', `/search?n=${resultsPerPage}&o=${offset}`);

  return response.ok ? response.json : [];
};

const SearchScreen_ = ({navigation}) => {
  const listRef = useRef(undefined);

  const TopNavBarButton = ({onPress, iconName, style}) => {
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

    return (
      <Pressable
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={onPress}
        style={{
          position: 'absolute',
          top: 0,
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          ...style,
        }}
      >
        <Animated.View style={{opacity: opacity}}>
          <Ionicons
            style={{
              color: '#333',
              fontSize: 30,
            }}
            name={iconName}
          />
        </Animated.View>
      </Pressable>
    );
  };

  const onPressRefresh = useCallback(() => {
    const refresh = listRef?.current?.refresh;
    refresh && refresh();
  }, []);

  const onPressOptions = useCallback(() => {
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

  const itemContainerStyle = useRef({width: '50%'}).current;

  const renderItem = useCallback((x: any) => {
    const item: PageItem = x.item;
    return (
      <ProfileCardMemo
        name={item.name}
        age={item.age}
        imageUuid={item.profile_photo_uuid}
        userId={item.prospect_person_id}
        matchPercentage={item.match_percentage}
        containerStyle={itemContainerStyle}
      />
    );
  }, []);

  return (
    <>
      <DuoliciousTopNavBar>
        {Platform.OS === 'web' &&
          <TopNavBarButton
            onPress={onPressRefresh}
            iconName="refresh"
            style={{left: 15}}
          />
        }
          <TopNavBarButton
            onPress={onPressOptions}
            iconName="options"
            style={{right: 15}}
          />
      </DuoliciousTopNavBar>
      <DefaultFlatList
        ref={listRef}
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
