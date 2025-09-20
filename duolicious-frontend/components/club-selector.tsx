import {
  ActivityIndicator,
  Animated,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { DefaultText } from './default-text';
import { TopNavBar } from './top-nav-bar';
import { Title } from './title';
import Ionicons from '@expo/vector-icons/Ionicons';
import { DefaultTextInput } from './default-text-input';
import { api } from '../api/api';
import * as _ from "lodash";
import { Basic } from './basic';
import { listen, lastEvent  } from '../events/events';
import { ClubItem, joinClub, leaveClub, clubQuota } from '../club/club';
import { useShake } from '../animation/animation';
import { useSignedInUser } from '../events/signed-in-user';
import { showPointOfSale } from './modal/point-of-sale-modal';
import { useAppTheme } from '../app-theme/app-theme';

const SelectedClub = ({
  clubItem,
  onPress,
}: {
  clubItem: ClubItem
  onPress?: (clubItem: ClubItem) => any
}) => {
  const { appThemeName } = useAppTheme();

  return (
    <Pressable
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 1,
      }}
      disabled={!onPress}
      onPress={onPress && (() => onPress(clubItem))}
    >
      <Basic
        style={{
          backgroundColor: appThemeName === 'dark'
            ? 'rgba(119, 0, 255, 1.0)'
            : 'rgba(119, 0, 255, 0.1)',
          flexShrink: 1,
          borderBottomWidth: 3,
        }}
        textStyle={{
          color: appThemeName === 'dark'
            ? '#ffffff'
            : '#7700ff',
        }}
      >
        {clubItem.name}
      </Basic>
    </Pressable>
  );
};

const UnselectedClub = ({
  clubItem,
  onPress,
  isAtQuota,
}: {
  clubItem: ClubItem
  onPress: (clubItem: ClubItem) => any
  isAtQuota: boolean
}) => {
  const [shakeAnimation, startShake] = useShake();
  const [signedInUser] = useSignedInUser();

  const opacityAnimation = useRef(new Animated.Value(1)).current;

  const animateOpacity = useCallback(() => {
    // Animate opacity to 0.3 if at quota, otherwise animate back to 1
    Animated.timing(opacityAnimation, {
      toValue: isAtQuota ? 0.3 : 1,
      duration: 300, // Duration can be adjusted as needed
      useNativeDriver: true
    }).start();
  }, [isAtQuota]);

  useEffect(() => {
    animateOpacity();
  }, [animateOpacity]);

  const _onPress = useCallback(() => {
    if (isAtQuota) {
      startShake();
      if (!signedInUser?.hasGold) {
        showPointOfSale('blocked');
      }
    } else {
      onPress(clubItem)
    }
  }, [isAtQuota, onPress, clubItem, startShake, signedInUser?.hasGold]);

  return (
    <Animated.View
      style={{
        opacity: opacityAnimation,
        transform: [{ translateX: shakeAnimation }]
      }}
    >
      <Pressable
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
        }}
        onPress={_onPress}
      >
        <Basic
          style={{
            marginTop: 5,
            marginBottom: 5,
            flexWrap: 'wrap',
            flexShrink: 1,
            borderBottomWidth: 3,
          }}
        >
          {clubItem.name}
        </Basic>
        <DefaultText style={{fontWeight: '700'}}>
          {clubItem.count_members}
          {' '}
          {clubItem.count_members === 1 ? 'person' : 'people'}
        </DefaultText>
      </Pressable>
    </Animated.View>
  );
};

const fetchClubItems = async (q: string): Promise<ClubItem[]> => {
  const cleanQ = q
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\u2018/g, `'`)
    .replace(/\u2019/g, `'`)
    .replace(/\u201C/g, `"`)
    .replace(/\u201D/g, `"`);

  const response = await api(
    'get',
    `/search-clubs?q=${encodeURIComponent(cleanQ)}`
  );

  return response.ok ? response.json : [];
};

const ClubSelector = ({navigation}) => {
  const { appTheme } = useAppTheme();
  const [selectedClubs, setSelectedClubs] = useState(
    lastEvent<ClubItem[]>('updated-clubs') ?? []
  );

  const [searchResults, setSearchResults] = useState<ClubItem[]>([]);

  const [searchText, setSearchText] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [signedInUser] = useSignedInUser();

  const clearSearchText = useCallback(() => setSearchText(""), []);

  const _fetchClubItems = useCallback(_.debounce(async (q: string) => {
    const results = await fetchClubItems(q);

    setSearchResults(results);
    setIsLoading(false);
  }, 500), []);

  const onChangeTextDebounced = useCallback(async (q: string) => {
    setSearchText(q);
    setSearchResults([]);
    setIsLoading(true);
    await _fetchClubItems(q);
  }, [_fetchClubItems]);

  const onSelectClub = useCallback((club: ClubItem) => {
    joinClub(club.name, club.count_members, club.search_preference);
  }, []);

  const onUnselectClub = useCallback((club: ClubItem) => {
    leaveClub(club.name);
  }, []);

  useEffect(
    () => listen<ClubItem[]>(
      'updated-clubs',
      (cs) => setSelectedClubs(cs ?? [])
    ),
    [],
  );

  const clubsToFilter = new Set(selectedClubs.map(club => club.name));

  const filteredSearchResults = searchResults
    .filter(club => !clubsToFilter.has(club.name));

  return (
    <SafeAreaView style={styles.safeAreaView}>
      <TopNavBar
        style={{
          alignItems: 'stretch',
        }}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={{
            zIndex: 999,
            position: 'absolute',
            bottom: 0,
            left: 0,
            height: '100%',
            aspectRatio: 1,
            justifyContent: 'center',
            alignItems: 'center',
            marginLeft: 10,
          }}
        >
          <Ionicons
            style={{
              fontSize: 20,
              color: appTheme.secondaryColor,
            }}
            name="arrow-back"
          />
        </Pressable>
        <DefaultTextInput
          placeholder="Search clubs..."
          style={{
            marginLeft: 50,
            marginRight: 50,
            borderWidth: 0,
            height: '100%',
          }}
          value={searchText}
          onChangeText={onChangeTextDebounced}
          autoFocus={true}
        />
        {searchText !== "" &&
          <Pressable
            onPress={clearSearchText}
            style={{
              zIndex: 999,
              position: 'absolute',
              bottom: 0,
              right: 0,
              height: '100%',
              aspectRatio: 1,
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 10,
            }}
          >
            <Ionicons
              style={{
                fontSize: 20,
                color: appTheme.secondaryColor,
              }}
              name="close"
            />
          </Pressable>
        }
      </TopNavBar>
      <ScrollView
        contentContainerStyle={{
          paddingTop: 0,
          paddingLeft: 10,
          paddingRight: 10,
          maxWidth: 600,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        {!_.isEmpty(selectedClubs) &&
          <>
            <Title>Clubs you’re in ({selectedClubs.length}/{clubQuota()})</Title>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 5,
              }}
            >
              {selectedClubs.map((a, i) =>
                <SelectedClub
                  key={String(i)}
                  clubItem={a}
                  onPress={onUnselectClub}
                />
              )}
            </View>
          </>
        }
        {!isLoading && searchText === "" && _.isEmpty(selectedClubs) &&
          <DefaultText
            style={{
              fontFamily: 'Trueno',
              margin: '20%',
              textAlign: 'center'
            }}
          >
            Start typing to find clubs to join...
          </DefaultText>
        }

        {searchText !== "" &&
          <Title>Search Results</Title>
        }
        {searchText !== "" && isLoading &&
          <View
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              flexGrow: 1,
            }}
          >
            <ActivityIndicator size="large" color={appTheme.brandColor}/>
          </View>
        }
        {!isLoading && searchText !== "" && _.isEmpty(filteredSearchResults) &&
          <DefaultText
            style={{
              fontFamily: 'Trueno',
              margin: '20%',
              textAlign: 'center'
            }}
          >
            Your search didn’t match any clubs
          </DefaultText>
        }
        {!isLoading && searchText !== "" && !_.isEmpty(filteredSearchResults) &&
          <>
            {filteredSearchResults.map((a, i) =>
              <UnselectedClub
                key={String(i)}
                clubItem={a}
                onPress={onSelectClub}
                isAtQuota={
                  selectedClubs.length >= clubQuota() && !!signedInUser?.hasGold
                }
              />
            )}
            <DefaultText style={{
              fontFamily: 'TruenoBold',
              color: appTheme.secondaryColor,
              fontSize: 16,
              textAlign: 'center',
              alignSelf: 'center',
              marginTop: 30,
              marginBottom: 80,
              marginLeft: '15%',
              marginRight: '15%',
            }}>
              No more clubs to show
            </DefaultText>
          </>
        }
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeAreaView: {
    flex: 1
  }
});

export {
  ClubSelector,
  SelectedClub,
};
