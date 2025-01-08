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
import { ClubItem, sortClubs } from '../club/club';
import { listen, lastEvent } from '../events/events';
import { searchQueue } from '../api/queue';
import { useScrollbar } from './navigation/scroll-bar-hooks';

const styles = StyleSheet.create({
  safeAreaView: {
    flex: 1,
  },
  listContainerStyle: {
    paddingTop: 0,
    rowGap: 5,
  },
  listColumnWraperStyle: {
    gap: 5,
    paddingHorizontal: 5,
  },
  clubsScrollViewContainer: {
    alignItems: 'center',
  },
  clubsContentContainer: {
    width: '100%',
    alignItems: 'stretch',
    alignSelf: 'center',
    paddingTop: 10,
    paddingBottom: 5,
    paddingHorizontal: 5,
    overflow: 'hidden',
    zIndex: 9999,
    opacity: 0.9,
    backgroundColor: 'white',
  },
  clubsContentContainerContainer: {
    borderRadius: 5,
    overflow: 'hidden',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 600,
  },
  clubTitle: {
    fontSize: 18,
    fontWeight: '900',
    paddingLeft: 5,
    paddingRight: 10,
    paddingVertical: 5,
  },
  clubContainerEveryone: {
    marginHorizontal: 30,
    borderRadius: 5,
    overflow: 'hidden',
  },
  clubContainer: {
    borderRadius: 5,
    overflow: 'hidden',
  },
  selectedClubText: {
    fontSize: 16,
    fontFamily: 'Trueno',
    paddingHorizontal: 10,
    paddingVertical: 5,
    color: 'white',
    backgroundColor: 'black',
  },
  unselectedClubText: {
    fontSize: 16,
    fontFamily: 'Trueno',
    paddingHorizontal: 10,
    paddingVertical: 5,
    color: 'black',
  },
});

const scrollIndicatorInsets = {
  top: 50,
};

const getStateFromClubItems = (cs: ClubItem[] | undefined) => {
  const clubs = cs ?? [];

  const hasClubs = clubs
    .length > 0;
  const selectedClub = clubs
    .find((c) => c.search_preference === true)
    ?.name;

  return { hasClubs, selectedClub };
};

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
  verification_required_to_view: string | null
};

const fetchPageWithoutQueue = async (
  club: string | null,
  pageNumber: number
): Promise<PageItem[] | null> => {
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

const fetchPage = (
  club: string | null
) => async (
  pageNumber: number
): Promise<PageItem[] | null> => {
  return searchQueue.addTask(
    async () => fetchPageWithoutQueue(club, pageNumber));
};

type ClubSelectorProps = {
  selectedClub: string | null;
  onChangeSelectedClub: (s: string | null) => any;
};

const LeftContinuation = ({scrollLeft}) => {
  if (isMobile()) {
    return (
      <LinearGradient
        start={{x: 0, y: 0 }}
        end={{x: 1, y: 0 }}
        colors={['#00000044', '#00000000']}
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
};

const RightContinuation = ({scrollRight}) => {
  if (isMobile()) {
    return (
      <LinearGradient
        start={{x: 0, y: 0 }}
        end={{x: 1, y: 0 }}
        colors={['#00000000', '#00000044']}
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
};

const ClubSelector = (props: ClubSelectorProps) => {
  const scrollJumpSize = 150;

  const scrollViewRef = useRef<ScrollView>(null);
  const scrollXRef = useRef(0);

  const hasJumpedToClubRef = useRef(false);

  const [isTop, setIsTop] = useState(true);
  const [isBottom, setIsBottom] = useState(true);
  const [contentWidth, setContentWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [clubs, setClubs] = useState<ClubItem[]>(
    sortClubs(lastEvent('updated-clubs')));


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

  const onScroll = useCallback(({ nativeEvent }) => {
    scrollXRef.current = nativeEvent.contentOffset.x;

    checkIsTop(nativeEvent);
    checkIsBottom(nativeEvent);
  }, [checkIsTop, checkIsBottom]);

  const onContentSizeChange = useCallback((width, height) =>
    setContentWidth(width), []);

  const onScrollViewLayout = useCallback(({ nativeEvent }) =>
    setContainerWidth(nativeEvent.layout.width), []);

  const onSelectedClubLayout = useCallback(({ nativeEvent }) => {
    (async () => {
      if (!scrollViewRef.current) {
        return;
      }

      if (hasJumpedToClubRef.current) {
        return;
      }

      scrollViewRef.current.scrollTo({
        x: nativeEvent.layout.x - scrollJumpSize,
        animated: false,
      });

      hasJumpedToClubRef.current = true;
    })();
  }, []);

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
    if (containerWidth > 0 && contentWidth > 0) {
      setIsBottom(containerWidth >= contentWidth);
    }
  }, [containerWidth, contentWidth]);

  useEffect(() => {
    return listen(
      'updated-clubs',
      (maybeCs: ClubItem[] | undefined) => {
        hasJumpedToClubRef.current = false;

        const sortedCs = sortClubs(maybeCs);
        setClubs(sortedCs);
      }
    );
  }, []);

  useEffect(() => {
    if (clubs && clubs.every((club) => club.name !== props.selectedClub)) {
      hasJumpedToClubRef.current = false;

      props.onChangeSelectedClub(null);
    }
  }, [props.selectedClub, JSON.stringify(clubs)]);

  if (!clubs || !clubs.length) {
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
          onScroll={onScroll}
          onContentSizeChange={onContentSizeChange}
          onLayout={onScrollViewLayout}
        >
          <DefaultText style={styles.clubTitle} >
            CLUBS
          </DefaultText>

          <Pressable
            style={styles.clubContainerEveryone}
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
              style={styles.clubContainer}
              key={club.name}
              onPress={() => props.onChangeSelectedClub(club.name)}
              onLayout={
                props.selectedClub === club.name && !hasJumpedToClubRef.current ?
                  onSelectedClubLayout :
                  undefined
              }
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

        {!isTop && <LeftContinuation scrollLeft={scrollLeft} />}
        {!isBottom && <RightContinuation scrollRight={scrollRight} />}
      </View>
    </View>
  );
};

const ListHeaderComponent = ({
  navigation,
  hasClubs,
  selectedClub,
  setSelectedClub,
}) => {
  if (hasClubs) {
    return <ClubSelector
      selectedClub={selectedClub}
      onChangeSelectedClub={setSelectedClub}
    />;
  }

  return (
    <Notice
      onPress={() => navigation.navigate('Q&A')}
      style={{
        marginTop: 10,
      }}
    >
      <DefaultText style={{color: '#70f'}} >
        Get better matches by playing Q&A{' '}
      </DefaultText>
      <QAndADevice
        color="#70f"
        backgroundColor="#f1e5ff"
      />
    </Notice>
  );
};

const SearchScreen_ = ({navigation}) => {
  const {
    hasClubs: initialHasClubs,
    selectedClub: initialSelectedClub,
  } = getStateFromClubItems(lastEvent<ClubItem[]>('updated-clubs'));

  const listRef = useRef<any>(undefined);

  const {
    onLayout,
    onContentSizeChange,
    onScroll,
    showsVerticalScrollIndicator,
    observeListRef,
  } = useScrollbar('search');

  const [
    hasClubs,
    setHasClubs,
  ] = useState<boolean>(initialHasClubs);

  const [
    selectedClub,
    setSelectedClub,
  ] = useState<string | null>(initialSelectedClub ?? null);

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

  useEffect(() => {
    const refresh = listRef?.current?.refresh;
    refresh && refresh();
  }, [selectedClub]);

  useEffect(() => {
    return listen(
      'updated-clubs',
      (cs: ClubItem[] | undefined) => {
        const { hasClubs, selectedClub } = getStateFromClubItems(cs);

        if (hasClubs !== undefined) {
          setHasClubs(hasClubs);
        }

        if (selectedClub !== undefined) {
          setSelectedClub(selectedClub);
        }
      }
    );
  }, []);

  return (
    <SafeAreaView style={styles.safeAreaView}>
      <DuoliciousTopNavBar>
        {Platform.OS === 'web' &&
          <TopNavBarButton
            onPress={onPressRefresh}
            iconName="refresh"
            position="left"
            secondary={true}
            label="Refresh"
          />
        }
        <TopNavBarButton
          onPress={onPressOptions}
          iconName="options-outline"
          position="right"
          secondary={false}
          label="Search Filters"
        />
      </DuoliciousTopNavBar>
      <DefaultFlatList
        key={
          // This is needed to trigger a re-render when the sticky header
          // indicies change. Without this, the header is blank on Android.
          String(hasClubs)
        }
        ref={listRef}
        innerRef={observeListRef}
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
        fetchPage={fetchPage(selectedClub)}
        dataKey={JSON.stringify(selectedClub)}
        hideListHeaderComponentWhenEmpty={!hasClubs}
        hideListHeaderComponentWhenLoading={!hasClubs}
        numColumns={2}
        contentContainerStyle={styles.listContainerStyle}
        ListHeaderComponent={
          <ListHeaderComponent
            navigation={navigation}
            hasClubs={hasClubs}
            selectedClub={selectedClub}
            setSelectedClub={setSelectedClub}
          />
        }
        renderItem={({item}: any) => <ProfileCardMemo item={item} />}
        scrollIndicatorInsets={scrollIndicatorInsets}
        onLayout={onLayout}
        onContentSizeChange={onContentSizeChange}
        onScroll={onScroll}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        stickyHeaderHiddenOnScroll={hasClubs}
        stickyHeaderIndices={hasClubs ? [0] : []}
        columnWrapperStyle={styles.listColumnWraperStyle}
      />
    </SafeAreaView>
  );
};

export default SearchScreen;
export {
  PageItem,
};
