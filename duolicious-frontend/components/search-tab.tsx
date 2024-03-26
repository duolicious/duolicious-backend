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
import { TopNavBarButton } from './top-nav-bar-button';

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
  person_messaged_prospect: boolean
  prospect_messaged_person: boolean
};

const fetchPage = async (pageNumber: number): Promise<PageItem[] | null> => {
  const resultsPerPage = 10;
  const offset = resultsPerPage * (pageNumber - 1);
  const response = await japi('get', `/search?n=${resultsPerPage}&o=${offset}`);

  return response.ok ? response.json : null;
};

const SearchScreen_ = ({navigation}) => {
  const listRef = useRef<any>(undefined);

  const onPressRefresh = useCallback(() => {
    const refresh = listRef?.current?.refresh;
    refresh && refresh();
  }, []);

  const onPressOptions = useCallback(() => {
    navigation.navigate('Search Filter Screen', {
      screen: 'Search Filter Tab',
      params: { onPressRefresh },
    });
  }, [onPressRefresh]);

  const showListHeaderComponent = Math.random() < 0.5;

  const ListHeaderComponent = useCallback(() => {
    if (!showListHeaderComponent)
      return <></>;

    return (
      <Notice
        style={{
          marginRight: 0,
          flexDirection: 'column',
        }}
      >
        <DefaultText
          style={{
            color: '#70f',
            fontSize: 16,
            fontWeight: '900',
            textAlign: 'center',
          }}
        >
          Duolicious is growing because of users like you!
          {'\n\n'}
        </DefaultText>
        <DefaultText
          style={{
            color: '#70f',
            textAlign: 'center',
          }}
        >
          Everyone on Duolicious is here because someone told them about it. You
          can help keep Duolicious free and attract users you want to see by
          mentioning Duolicious in your favorite online communities.
        </DefaultText>
      </Notice>
    );
  }, []);

  const renderItem = useCallback((x: any) => {
    const item: PageItem = x.item;
    return <ProfileCardMemo item={item} />
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
        errorText={
          "Something went wrong while fetching search results"
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
export {
  PageItem,
};
