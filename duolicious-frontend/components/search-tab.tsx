import {
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
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
import { ProfileCard }  from './profile-card';
import { DuoliciousTopNavBar } from './top-nav-bar';
import { SearchFilterScreen } from './search-filter-screen';
import { DefaultText } from './default-text';
import { QAndADevice } from './q-and-a-device';
import { Notice } from './notice';
import { DefaultFlatList } from './default-flat-list';
import { japi } from '../api/api';
import { TopNavBarButton } from './top-nav-bar-button';
import { LinearGradient } from 'expo-linear-gradient';
import { isMobile } from '../util/util';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ClubItem } from './club-selector';
import { listen } from '../events/events';

// TODO: Fix bug where Continuation shows when changing selecting different clubs

// TODO: don't scan clubs when deciding if 'Everyone' should be selected
//  to fix this, you'll need to ensure that `selectedClub` contains a club
//  not present in the list.

const styles = StyleSheet.create({
  listContainerStyle: {
    paddingRight: 5,
  },
  clubsScrollViewContainer: {
    alignItems: 'center',
  },
  clubsContentContainer: {
    alignItems: 'stretch',
    width: '100%',
    maxWidth: 600,
    marginTop: 10,
    marginBottom: 5,
    paddingLeft: isMobile() ? 5 : 0,
    paddingRight: isMobile() ? 5 : 15,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  clubsContentContainerContainer: {
    borderRadius: 5,
    overflow: 'hidden',
  },
  clubTitle: {
    fontSize: 18,
    fontWeight: '900',
    paddingLeft: isMobile() ? 5 : 0,
    paddingRight: 10,
    paddingVertical: 5,
  },
  clubEveryone: {
    marginHorizontal: 30,
  },
  selectedClubText: {
    fontSize: 16,
    fontFamily: 'Trueno',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    color: 'white',
    backgroundColor: 'black',
  },
  unselectedClubText: {
    fontSize: 16,
    fontFamily: 'Trueno',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    color: 'black',
    backgroundColor: 'white',
  },
});

const Stack = createNativeStackNavigator();

const SearchScreen = ({navigation}) => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        presentation: 'card'
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
  prospect_uuid: string
  profile_photo_uuid: string
  profile_photo_blurhash: string
  name: string
  age: number
  match_percentage: number
  person_messaged_prospect: boolean
  prospect_messaged_person: boolean
  verified: boolean
};

const fetchPage = (club: string | null) => async (pageNumber: number): Promise<PageItem[] | null> => {
  const resultsPerPage = 10;
  const offset = resultsPerPage * (pageNumber - 1);
  const response = await japi(
    'get',
    `/search` +
    `?n=${resultsPerPage}` +
    `&o=${offset}` +
    `&club=${encodeURIComponent(club === null ? '\0' : club)}`
  );

  return response.ok ? response.json : null;
};

type ClubSelectorProps = {
  selectedClub: string | null;
  onChangeSelectedClub: (s: string | null) => any;
};

const ClubSelector = (props: ClubSelectorProps) => {
  const scrollJumpSize = 150;

  const scrollViewRef = useRef<ScrollView>(null);
  const scrollXRef = useRef(0);

  const [isTop, setIsTop] = useState(true);
  const [isBottom, setIsBottom] = useState(true);
  const [contentWidth, setContentWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [clubs, setClubs] = useState<ClubItem[]>([]);

  const checkIsTop = useCallback((nativeEvent) => {
    const isCloseToTop = nativeEvent.contentOffset.x <= 10;

    setIsTop(isCloseToTop);
  }, [setIsTop]);

  const checkIsBottom = useCallback((nativeEvent) => {
    const isCloseToBottom = (
      nativeEvent.layoutMeasurement.width +
      nativeEvent.contentOffset.x) >= nativeEvent.contentSize.width - 10;

    setIsBottom(isCloseToBottom);
  }, [setIsBottom]);

  const handleScroll = useCallback(({ nativeEvent }) => {
    scrollXRef.current = nativeEvent.contentOffset.x;

    checkIsTop(nativeEvent);
    checkIsBottom(nativeEvent);
  }, [checkIsTop, checkIsBottom]);

  const onContentSizeChange = useCallback((width, height) =>
    setContentWidth(width), []);

  const onLayout = useCallback(({ nativeEvent }) =>
    setContainerWidth(nativeEvent.layout.width), []);

  useEffect(() => {
    if (containerWidth > 0 && contentWidth > 0) {
      setIsBottom(containerWidth >= contentWidth);
    }
  }, [containerWidth, contentWidth]);

  const scrollLeft = useCallback(() => {
    if (!scrollViewRef.current) {
      return;
    }
    scrollViewRef.current.scrollTo({
      x: scrollXRef.current - scrollJumpSize,
      animated: true,
    });
  }, []);

  const scrollRight = useCallback(() => {
    if (!scrollViewRef.current) {
      return;
    }
    scrollViewRef.current.scrollTo({
      x: scrollXRef.current + scrollJumpSize,
      animated: true,
    });
  }, []);

  useEffect(() => {
    return listen(
      'updated-clubs',
      (maybeCs: ClubItem[] | undefined) => {
        const unsortedCs = maybeCs ?? [];
        const sortedCs = unsortedCs.sort((a, b) => {
          if (a.name > b.name) return +1;
          if (a.name < b.name) return -1;
          return 0;
        });

        setClubs(sortedCs);
      },
      true
    );
  }, []);

  useEffect(() => {
    if (clubs.every((club) => club.name !== props.selectedClub)) {
      props.onChangeSelectedClub(null);
    }
  }, [props.selectedClub, JSON.stringify(clubs)]);

  const LeftContinuation = useCallback(() => {
    if (isMobile()) {
      return (
        <LinearGradient
          start={{x: 0, y: 0 }}
          end={{x: 1, y: 0 }}
          colors={['#00000033', '#00000000']}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,

            height: '100%',
            width: 10,

            zIndex: 999,
          }}
        />
      );
    } else {
      return (
        <Pressable
          onPress={scrollLeft}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,

            height: '100%',
            width: 40,

            zIndex: 999,
          }}
        >
          <LinearGradient
            start={{x: 0, y: 0 }}
            end={{x: 1, y: 0 }}
            locations={[0.0, 0.8, 1.0]}
            colors={[
              'rgba(255, 255, 255, 1.0)',
              'rgba(255, 255, 255, 0.9)',
              'rgba(255, 255, 255, 0.0)',
            ]}
            style={{
              height: '100%',
              width: '100%',
              justifyContent: 'center',
              alignItems: 'flex-start',
            }}
          >
            <Ionicons
              style={{
                fontSize: 26,
              }}
              name="chevron-back"
            />
          </LinearGradient>
        </Pressable>
      );
    }
  }, [scrollViewRef, scrollRight]);

  const RightContinuation = useCallback(() => {
    if (isMobile()) {
      return (
        <LinearGradient
          start={{x: 0, y: 0 }}
          end={{x: 1, y: 0 }}
          colors={['#00000000', '#00000033']}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,

            height: '100%',
            width: 10,

            zIndex: 999,
          }}
        />
      );
    } else {
      return (
        <Pressable
          onPress={scrollRight}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,

            height: '100%',
            width: 40,

            zIndex: 999,
          }}
        >
          <LinearGradient
            start={{x: 0, y: 0 }}
            end={{x: 1, y: 0 }}
            locations={[0.0, 0.2, 1.0]}
            colors={[
              'rgba(255, 255, 255, 0.0)',
              'rgba(255, 255, 255, 0.9)',
              'rgba(255, 255, 255, 1.0)',
            ]}
            style={{
              height: '100%',
              width: '100%',
              justifyContent: 'center',
              alignItems: 'flex-end',
            }}
          >
            <Ionicons
              style={{
                fontSize: 26,
              }}
              name="chevron-forward"
            />
          </LinearGradient>
        </Pressable>
      );
    }
  }, [scrollViewRef, scrollRight]);

  if (!clubs.length) {
    return null;
  }

  return (
    <View style={styles.clubsContentContainer}>
      <View style={styles.clubsContentContainerContainer}>
        <ScrollView
          ref={scrollViewRef}
          horizontal={true}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.clubsScrollViewContainer}
          onScroll={handleScroll}
          onContentSizeChange={onContentSizeChange}
          onLayout={onLayout}
        >
          <DefaultText style={styles.clubTitle} >
            CLUBS
          </DefaultText>

          <Pressable
            style={styles.clubEveryone}
            onPress={() => props.onChangeSelectedClub(null)}
          >
            <DefaultText
              style={
                props.selectedClub === null ?
                  styles.selectedClubText :
                  styles.unselectedClubText
              }
            >
              Everyone
            </DefaultText>
          </Pressable>

          {clubs.map((club) =>
            <Pressable
              key={club.name}
              onPress={() => props.onChangeSelectedClub(club.name)}
            >
              <DefaultText
                style={
                  props.selectedClub === club.name ?
                    styles.selectedClubText :
                    styles.unselectedClubText
                }
              >
                {club.name}
              </DefaultText>
            </Pressable>
          )}
        </ScrollView>

        {!isTop && <LeftContinuation/>}
        {!isBottom && <RightContinuation/>}
      </View>
    </View>
  );
};

const SearchScreen_ = ({navigation}) => {
  const listRef = useRef<any>(undefined);

  const [hasClubs, setHasClubs] = useState<boolean>(false);
  const [selectedClub, setSelectedClub] = useState<string | null>(null);

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

  const ListHeaderComponent = useCallback(() => {
    if (hasClubs) {
      return null;
    }

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
  }, [hasClubs]);

  const fetchPageHavingClub = useCallback(
    fetchPage(selectedClub), [selectedClub]);

  useEffect(() => {
    const refresh = listRef?.current?.refresh;
    refresh && refresh();
  }, [selectedClub]);

  const renderItem = useCallback((x: any) => {
    const item: PageItem = x.item;
    return <ProfileCardMemo item={item} />
  }, []);

  useEffect(() => {
    return listen(
      'updated-clubs',
      (cs: ClubItem[] | undefined) => setHasClubs((cs ?? []).length > 0),
      true
    );
  }, []);

  return (
    <SafeAreaView style={{flex: 1}}>
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
      <ClubSelector
        selectedClub={selectedClub}
        onChangeSelectedClub={setSelectedClub}
      />
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
        fetchPage={fetchPageHavingClub}
        hideListHeaderComponentWhenEmpty={true}
        numColumns={2}
        contentContainerStyle={[
          styles.listContainerStyle,
          [hasClubs ? { paddingTop: 0 } : {}],
        ]}
        ListHeaderComponent={ListHeaderComponent}
        renderItem={renderItem}
      />
    </SafeAreaView>
  );
};

export default SearchScreen;
export {
  PageItem,
};
