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
import {
  DefaultText,
} from './default-text'
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { faUserPlus } from '@fortawesome/free-solid-svg-icons/faUserPlus'
import { TopNavBar } from './top-nav-bar';
import { TopNavBarButton } from './top-nav-bar-button';
import { listen, lastEvent } from '../events/events';
import { ClubItem, SelectedClub } from './club-selector';
import { ButtonWithCenteredText } from './button/centered-text';
import { notify } from '../events/events';
import { faLink } from '@fortawesome/free-solid-svg-icons/faLink'
import * as Clipboard from 'expo-clipboard';

const LinkCopiedToast = () => {
  return (
    <View
      style={{
        marginTop: 70,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'white',
        borderRadius: 999,
        paddingVertical: 10,
        paddingHorizontal: 20,
        flexDirection: 'row',
        shadowOffset: {
          width: 0,
          height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
        gap: 10,
      }}
    >
      <FontAwesomeIcon
        icon={faLink}
        color="black"
        size={24}
      />
      <DefaultText
        style={{
          color: 'black',
          fontWeight: '700',
        }}
      >
        Invite Link Copied!
      </DefaultText>
    </View>
  );
};

const InvitePicker = ({navigation}) => {
  const [clubs, setClubs] = useState(lastEvent<ClubItem[]>('updated-clubs'));

  useEffect(() => {
    return listen<ClubItem[]>('updated-clubs', setClubs);
  }, []);

  const goBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const onPressInvite = (clubName: string) => async () => {
    const url = (
      `https://get.duolicious.app/invite/${encodeURIComponent(clubName)}`);

    await Clipboard.setStringAsync(url);

    notify<React.FC>('toast', LinkCopiedToast)
  };

  return (
    <SafeAreaView style={styles.safeAreaView}>
      <TopNavBar
        style={{
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <TopNavBarButton
          onPress={goBack}
          iconName="arrow-back"
          position="left"
          secondary={true}
        />
        <DefaultText
          style={{
            fontWeight: '700',
            fontSize: 20,
          }}
        >
          Invite to Your Clubs
        </DefaultText>
      </TopNavBar>

      <ScrollView
        contentContainerStyle={{
          maxWidth: 600,
          width: '100%',
          alignSelf: 'center',
          alignItems: 'stretch',
          padding: 10,
          paddingBottom: 50,
          gap: 10,
        }}
      >
        {clubs === undefined &&
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
        {clubs !== undefined && clubs.length === 0 &&
          <DefaultText
            style={{
              fontFamily: 'Trueno',
              margin: '20%',
              textAlign: 'center'
            }}
          >
            Join a club to invite people
          </DefaultText>
        }
        {clubs && clubs.map((club, i) =>
          <View
            key={i}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
              overflow: 'hidden',
            }}
          >
            <SelectedClub clubItem={club} />
            <ButtonWithCenteredText
              containerStyle={{
                height: 34,
                width: 100,
                paddingHorizontal: 10,
                marginTop: 0,
                marginBottom: 0,
              }}
              secondary={true}
              onPress={onPressInvite(club.name)}
            >
              Invite
            </ButtonWithCenteredText>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const InviteEntrypoint = ({navigation}) => {
  const opacityLo = 0.2;
  const opacityHi = 1.0;

  const opacity = useRef(new Animated.Value(1)).current;

  const fade = () => {
    opacity.stopAnimation();
    opacity.setValue(opacityLo);
  };

  const unfade = () => {
    opacity.stopAnimation();
    Animated.timing(opacity, {
      toValue: opacityHi,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  };

  const onPress = () => {
    navigation.navigate('Invite Picker');
  };

  return (
    <Pressable
      onPressIn={fade}
      onPressOut={unfade}
      onPress={onPress}
      style={{
        marginTop: 10,
        alignSelf: 'flex-end',
      }}
    >
      <Animated.View
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'row',
          paddingHorizontal: 10,
          gap: 10,
          opacity,
        }}
      >
        <DefaultText>
          Invite To Clubs
        </DefaultText>
        <FontAwesomeIcon
          icon={faUserPlus}
          color="black"
          size={24}
        />
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  safeAreaView: {
    flex: 1
  }
});

export {
  InviteEntrypoint,
  InvitePicker,
};
