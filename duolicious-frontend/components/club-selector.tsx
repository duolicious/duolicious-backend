import {
  ActivityIndicator,
  Animated,
  Easing,
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
import { api, japi } from '../api/api';
import * as _ from "lodash";
import debounce from 'lodash/debounce';
import { Basic } from './basic';
import { notify } from '../events/events';

type ClubItem = {
  name: string,
  count_members: number,
};

const SelectedClub = ({
  clubItem,
  onPress,
}: {
  clubItem: ClubItem
  onPress: (clubItem: ClubItem ) => any
}) => {
  return (
    <Pressable
      style={{
        flexDirection: 'row',
        alignItems: 'center',
      }}
      onPress={() => onPress(clubItem)}
    >
      <Basic
        style={{
          backgroundColor: 'rgba(119, 0, 255, 0.1)',
        }}
        textStyle={{
          color: '#70f',
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
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const opacityAnimation = useRef(new Animated.Value(1)).current; // Initial opacity set to 1

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

  const startShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnimation, {
        toValue: -25,
        duration: 75,
        useNativeDriver: true,
        easing: Easing.linear
      }),
      Animated.timing(shakeAnimation, {
        toValue: 20,
        duration: 75,
        useNativeDriver: true,
        easing: Easing.linear
      }),
      Animated.timing(shakeAnimation, {
        toValue: -15,
        duration: 75,
        useNativeDriver: true,
        easing: Easing.linear
      }),
      Animated.timing(shakeAnimation, {
        toValue: 0,
        duration: 75,
        useNativeDriver: true,
        easing: Easing.linear
      })
    ]).start();
  }, [shakeAnimation]);

  const _onPress = useCallback(
    () => isAtQuota ? startShake() : onPress(clubItem),
    [isAtQuota, onPress, clubItem, startShake]
  );

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
          }}
        >{clubItem.name}</Basic>
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

const ClubSelector = ({navigation, route}) => {
  const [selectedClubs, setSelectedClubs] = useState<
    ClubItem[]
  >(route?.params?.selectedClubs ?? []);

  const [searchResults, setSearchResults] = useState<ClubItem[]>([]);

  const [searchText, setSearchText] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const clearSearchText = useCallback(() => setSearchText(""), []);

  const clubQuota = 25;

  const _fetchClubItems = useCallback(debounce(async (q: string) => {
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
    japi('post', '/join-club', { name: club.name });

    const newSelectedClubs = [...selectedClubs, club];

    const newUnselectedClubs = searchResults.filter((c) => c !== club);

    setSelectedClubs(newSelectedClubs);
    setSearchResults(newUnselectedClubs);

    notify('updated-clubs', newSelectedClubs);
  }, [selectedClubs, searchResults]);

  const onUnselectClub = useCallback((club: ClubItem) => {
    japi('post', '/leave-club', { name: club.name });

    const newSelectedClubs = selectedClubs.filter((c) => c !== club);
    const newUnselectedClubs = [...searchResults, club].sort((a, b) => {
      if (a.count_members < b.count_members) return +1;
      if (a.count_members > b.count_members) return -1;
      return 0;
    });

    setSelectedClubs(newSelectedClubs);
    setSearchResults(newUnselectedClubs);

    notify('updated-clubs', newSelectedClubs);
  }, [selectedClubs, searchResults]);

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
            }}
            name="arrow-back"
          />
        </Pressable>
        <DefaultTextInput
          placeholder="Search clubs..."
          style={{
            marginLeft: 50,
            marginRight: 50,
            borderRadius: 0,
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
            <Title>Clubs you’re in ({selectedClubs.length}/{clubQuota})</Title>
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
            <ActivityIndicator size={60} color="#70f"/>
          </View>
        }
        {!isLoading && searchText !== "" && _.isEmpty(searchResults) &&
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
        {!isLoading && searchText !== "" && !_.isEmpty(searchResults) &&
          <>
            {(searchResults ?? []).map((a, i) =>
              <UnselectedClub
                key={String(i)}
                clubItem={a}
                onPress={onSelectClub}
                isAtQuota={selectedClubs.length >= clubQuota}
              />
            )}
            <DefaultText style={{
              fontFamily: 'TruenoBold',
              color: '#000',
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
  ClubItem,
  ClubSelector,
};
