import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleProp,
  StyleSheet,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBarSpacer } from './status-bar-spacer';
import { DefaultText } from './default-text';
import { DonutChart } from './donut-chart';
import { Title } from './title';
import { InDepthScreen } from './in-depth-screen';
import { ButtonWithCenteredText } from './button/centered-text';
import { api } from '../api/api';
import { cmToFeetInchesStr } from '../units/units';
import { signedInUser } from '../App';
import { setSkipped } from '../hide-and-block/hide-and-block';
import { ImageOrSkeleton } from './profile-card';
import { Pinchy } from './pinchy';
import { Basic, Basics } from './basic';
import { Club, Clubs } from './club';
import { Stat, Stats } from './stat';
import { listen, notify } from '../events/events';
import { ReportModalInitialData } from './modal/report-modal';
import {
  VerificationBadge,
  DetailedVerificationBadges,
} from './verification-badge';
import Ionicons from '@expo/vector-icons/Ionicons';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons/faArrowLeft'
import { faRulerVertical } from '@fortawesome/free-solid-svg-icons/faRulerVertical'
import { faHandsPraying } from '@fortawesome/free-solid-svg-icons/faHandsPraying'
import { faPills } from '@fortawesome/free-solid-svg-icons/faPills'
import { faSmoking } from '@fortawesome/free-solid-svg-icons/faSmoking'
import { faVenusMars } from '@fortawesome/free-solid-svg-icons/faVenusMars'
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons/faPaperPlane'
import { faLocationDot } from '@fortawesome/free-solid-svg-icons/faLocationDot'
import { RotateCcw, Flag, X } from "react-native-feather";
import Reanimated, {
  Easing,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { ClubItem, joinClub, leaveClub } from '../club/club';
import * as _ from 'lodash';
import { friendlyTimeAgo, possessive, secToMinSec } from '../util/util';
import { Audio, AVPlaybackStatus } from 'expo-av';
import {
  AUDIO_URL,
} from '../env/env';

const Stack = createNativeStackNavigator();

const ProspectProfileScreen = () => {
  const navigationRef = useRef(undefined);

  const ProspectProfileScreen_ = useMemo(() => {
    return Content(navigationRef);
  }, [navigationRef]);

  const InDepthScreen_ = useMemo(() => {
    return InDepthScreen(navigationRef);
  }, [navigationRef]);

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        presentation: 'card',
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Prospect Profile" component={ProspectProfileScreen_} />
      <Stack.Screen name="In-Depth" component={InDepthScreen_} />
      <Stack.Screen name="Gallery Screen" component={GalleryScreen} />
    </Stack.Navigator>
  );
};

const GalleryScreen = ({navigation, route}) => {
  const { imageUuid } = route.params;

  return (
    <>
      <Pinchy uuid={imageUuid}/>
      <StatusBarSpacer/>
      <FloatingBackButton onPress={() => navigation.goBack()}/>
    </>
  );
};

const goToGallery = (navigation, imageUuid) => () =>
  navigation.navigate('Gallery Screen', { imageUuid } );

const EnlargeableImage = ({
  imageUuid,
  imageExtraExts,
  imageBlurhash,
  onChangeEmbiggened,
  style,
  innerStyle,
  isPrimary,
  isVerified = false,
}: {
  imageUuid: string | undefined | null,
  imageExtraExts?: string[] | undefined | null,
  imageBlurhash: string | undefined | null,
  onChangeEmbiggened: (uuid: string) => void,
  style?: any,
  innerStyle?: any,
  isPrimary: boolean,
  isVerified?: boolean,
}) => {
  if (imageUuid === undefined && !isPrimary) {
    return <></>;
  }

  return (
    <Pressable
      disabled={!!imageExtraExts?.length || !imageUuid}
      onPress={() => imageUuid && onChangeEmbiggened(imageUuid)}
      style={[
        {
          width: '100%',
          aspectRatio: 1,
        },
        style,
      ]}
    >
      <ImageOrSkeleton
        resolution={900}
        imageExtraExts={imageExtraExts}
        imageUuid={imageUuid}
        imageBlurhash={imageBlurhash}
        showGradient={false}
        style={innerStyle}
      />
      {isVerified &&
        <VerificationBadge
          style={{
            position: 'absolute',
            top: 18,
            right: 18,
          }}
          size={28}
        />
      }
    </Pressable>
  );
};

const FloatingBackButton = (props) => {
  const {
    onPress,
    navigationRef,
    navigation,
    safeAreaView = true,
  } = props;

  const RootElement = useCallback(({children}) => {
    if (safeAreaView) {
      return (
        <SafeAreaView style={{zIndex: 999}}>
          {children}
        </SafeAreaView>
      )
    } else {
      return children;
    }
  }, [safeAreaView]);

  return (
    <RootElement>
      <Pressable
        style={{
          zIndex: 999,
          borderRadius: 999,
          marginLeft: 10,
          marginTop: 0,
          width: 45,
          height: 45,
          backgroundColor: 'white',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: 'black',
        }}
        onPress={onPress ?? (navigationRef?.current || navigation).goBack}
      >
        <FontAwesomeIcon
          icon={faArrowLeft}
          size={24}
          style={{
            outline: 'none',
          }}
        />
      </Pressable>
    </RootElement>
  );
};

const FloatingProfileInteractionButton = ({
  children,
  onPress,
  backgroundColor,
}) => {
  const opacity = useRef(new Animated.Value(1)).current;

  const fadeOut = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 0.4,
      duration: 0,
      useNativeDriver: false,
    }).start();
  }, []);

  const fadeIn = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 50,
      useNativeDriver: false,
    }).start();
  }, []);

  return (
    <Pressable
      style={{
        borderRadius: 999,
        zIndex: 999,
        marginLeft: 20,
        marginRight: 20,
        marginBottom: 14,
        marginTop: 14,
      }}
      onPressIn={fadeOut}
      onPressOut={fadeIn}
      onPress={onPress}
    >
      <Animated.View
        style={{
          borderRadius: 999,
          paddingLeft: 15,
          paddingRight: 15,
          paddingTop: 12,
          paddingBottom: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: backgroundColor,
          opacity: opacity,
          flexDirection: 'row',
          borderWidth: 1,
          borderColor: 'black',
          height: 60,
          width: 60,
        }}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
};

const FloatingSkipButton = ({personUuid, isSkipped}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSkippedState, setIsSkippedState] = useState<
    boolean | undefined
  >(isSkipped);

  useEffect(() => {
    setIsSkippedState(isSkipped);
  }, [isSkipped]);

  useEffect(() => {
    return listen(`unskip-profile-${personUuid}`, () => setIsSkippedState(false));
  }, [personUuid]);

  useEffect(() => {
    return listen(`skip-profile-${personUuid}`, () => setIsSkippedState(true));
  }, [personUuid]);

  const onPress = useCallback(async () => {
    if (personUuid === undefined) return;

    const nextIsSkippedState = !isSkippedState;

    setIsLoading(true);
    if (await setSkipped(personUuid, nextIsSkippedState)) {
      setIsLoading(false);
    }
  }, [isLoading, isSkippedState, personUuid]);

  return (
    <FloatingProfileInteractionButton
      onPress={onPress}
      backgroundColor="white"
    >
      {isLoading &&
        <ActivityIndicator size="large" color="#70f"/>
      }
      {!isLoading && isSkippedState === true && <RotateCcw
          stroke="#70f"
          strokeWidth={3}
          height={24}
          width={24}
        />
      }
      {!isLoading && isSkippedState === false && <X
          stroke="#70f"
          strokeWidth={3}
          height={24}
          width={24}
        />
      }
    </FloatingProfileInteractionButton>
  );
};

const FloatingSendIntroButton = ({
  navigation,
  personId,
  personUuid,
  name,
  imageUuid,
  imageBlurhash,
}) => {
  const onPress = useCallback(() => {
    if (personId === undefined) return;
    if (name === undefined) return;

    navigation.navigate(
      'Conversation Screen',
      { personId, personUuid, name, imageUuid, imageBlurhash }
    );
  }, [navigation, personId, name, imageUuid]);

  return (
    <FloatingProfileInteractionButton
      onPress={onPress}
      backgroundColor="#70f"
    >
      {personId !== undefined && name !== undefined &&
        <FontAwesomeIcon
          icon={faPaperPlane}
          size={24}
          style={{
            color: 'white',
            outline: 'none',
          }}
        />
      }
    </FloatingProfileInteractionButton>
  );
};

const SeeQAndAButton = ({navigation, personId, name}) => {
  const containerStyle = useRef({
    marginTop: 40,
    marginLeft: 10,
    marginRight: 10,
  }).current;
  const textStyle = useRef({
    marginLeft: 35,
    marginRight: 35,
  }).current;
  const iconContainerStyle = useRef<StyleProp<ViewStyle>>({
    position: 'absolute',
    top: 0,
    right: 15,
    height: '100%',
    justifyContent: 'center',
  }).current;
  const iconStyle = useRef<StyleProp<TextStyle>>({
    fontSize: 20,
    color: 'white',
  }).current;
  const extraChildren = useRef(
    <View style={iconContainerStyle}>
      <Ionicons style={iconStyle} name="chevron-forward"/>
    </View>
  ).current;

  const onPress = useCallback(() => {
    navigation.navigate('In-Depth', { personId, name });
  }, [personId, name]);

  return (
    <ButtonWithCenteredText
      containerStyle={containerStyle}
      textStyle={textStyle}
      onPress={onPress}
      extraChildren={extraChildren}
      loading={name === undefined}
      borderColor="rgba(255, 255, 255, 0.2)"
      borderWidth={1}
    >
      {possessive(String(name))} Q&A Answers
    </ButtonWithCenteredText>
  );
};

const BlockButton = ({name, personUuid, isSkipped}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSkippedState, setIsSkippedState] = useState(false);

  useEffect(() => {
    setIsSkippedState(isSkipped);
  }, [isSkipped]);

  useEffect(() => {
    return listen(`unskip-profile-${personUuid}`, () => setIsSkippedState(false));
  }, [personUuid]);

  const onPress = useCallback(async () => {
    if (isSkippedState) {
      setIsLoading(true);
      if (await setSkipped(personUuid, false)) {
        setIsLoading(false);
      }
    } else {
      const data: ReportModalInitialData = {
        name,
        personUuid,
        context: 'Prospect Profile Screen',
      };
      notify('open-report-modal', data);
    }
  }, [notify, name, personUuid, isSkippedState]);

  const text = isSkippedState ?
    `You have skipped ${name}. Press to unskip.` :
    `Report ${name}`;

  const iconStroke = isLoading ? "transparent" : 'rgba(0, 0, 0, 0.5)';

  return (
    <Pressable
      onPress={onPress}
      style={{
        marginTop: 100,
        marginBottom: 100,
        alignSelf: 'center',
        flexDirection: 'row',
        gap: 7,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        padding: 8,
        borderRadius: 5,
      }}
    >
      {isLoading &&
        <ActivityIndicator size="small" color="#70f"/>
      }
      {!isLoading && isSkippedState &&
        <RotateCcw
          stroke={iconStroke}
          strokeWidth={2}
          height={18}
          width={18}
        />
      }
      {!isLoading && !isSkippedState &&
        <Flag
          stroke={iconStroke}
          strokeWidth={2}
          height={18}
          width={18}
        />
      }
      {!isLoading &&
        <DefaultText
          style={{
            overflow: 'hidden',
            textAlign: 'center',
            color: 'rgba(0, 0, 0, 0.5)',
          }}
        >
          {name === undefined ? '...' : text}
        </DefaultText>
      }
    </Pressable>
  );
};

const AllClubsItem = ({kind, kids, props}) => {
  const propsWithoutKey = { ...props };
  delete propsWithoutKey['key'];

  if (kind === 'Title') {
    return <Title {...propsWithoutKey}>{kids}</Title>;
  }

  if (kind === 'Club') {
    return <Club {...propsWithoutKey}>{kids}</Club>;
  }

  throw Error('Unexpected club kind');
};

const AllClubs = ({
  mutualClubs,
  otherClubs,
  mutualClubsTheme,
  clubsTheme,
  titleColor,
}: {
  mutualClubs: string[],
  otherClubs: string[],
  mutualClubsTheme: any,
  clubsTheme: any,
  titleColor: any,
}) => {
  const [state, setState] = useState({
    mutualClubs: mutualClubs,
    otherClubs: otherClubs,
  });

  useEffect(() => {
    setState({ mutualClubs, otherClubs })
  }, [mutualClubs, otherClubs]);

  useEffect(() =>
    listen<ClubItem[]>(
      'updated-clubs',
      (cs) => {
        if (!cs) {
          return;
        }

        setState(s => {
          const clubs = [...new Set(cs.map(c => c.name))];
          const prospectClubs = [...new Set([...s.otherClubs, ...s.mutualClubs])];

          return {
            mutualClubs: [..._.intersection(clubs, prospectClubs)],
            otherClubs: [..._.difference(prospectClubs, clubs)],
          }
        });
      }
    )
  , []);

  if (state.mutualClubs.length === 0 && state.otherClubs.length === 0) {
    return null;
  }

  const childData = [
    state.mutualClubs.length > 0 ? {
      kind: 'Title',
      props: { style: {color: titleColor, width: '100%'}},
      kids: 'Mutual clubs' } : null,

    ...state.mutualClubs.map((clubName) => ({
        kind: 'Club',
        props: {
          onPress: () => leaveClub(clubName),
          key: clubName,
          name: clubName,
          isMutual: true,
          ...mutualClubsTheme,
        },
        kids: null,
      })),

      (state.otherClubs.length > 0 && state.mutualClubs.length > 0) ? {
        kind: 'Title',
        props: { style: {color: titleColor, width: '100%'}},
        kids: 'Other clubs' } : null,

      (state.otherClubs.length > 0 && state.mutualClubs.length === 0) ? {
        kind: 'Title',
        props: { style: {color: titleColor, width: '100%'}},
        kids: 'Clubs' } : null,

      ...state.otherClubs.map((clubName) => ({
        kind: 'Club',
        props: {
          onPress: () => joinClub(clubName, -1, false),
          key: clubName,
          name: clubName,
          isMutual: false,
          ...clubsTheme,
        },
        kids: null,
      })),
  ].filter(Boolean);

  return (
    <Clubs>
      {childData.map((d) =>
        <Reanimated.View
          key={
            JSON.stringify({
              kind: d?.kind,
              kids: d?.kids,
              clubName: d?.props.name,
            })
          }
          style={d?.kind === 'Title' ? styles.wFull : null}
          layout={LinearTransition.easing(Easing.out(Easing.poly(4)))}
          exiting={FadeOut}
        >
          <AllClubsItem
            kind={d?.kind}
            kids={d?.kids}
            props={d?.props}
          />
        </Reanimated.View>
      )}
    </Clubs>
  );
};

type UserData = {
  name: string,
  about: string,
  mutual_clubs: string[],
  other_clubs: string[],
  gender: string,
  match_percentage: number,
  photo_uuids: string[],
  photo_extra_exts: string[][],
  photo_blurhashes: string[],
  photo_verifications: boolean[],
  audio_bio_uuid: string | null,
  age: number | null,
  location: string | null
  drinking: string | null,
  drugs: string | null,
  ethnicity: string | null,
  exercise: string | null,
  has_kids: string | null,
  height_cm: number | null,
  long_distance: string | null,
  looking_for: string | null,
  occupation: string | null,
  education: string | null,
  orientation: string | null,
  relationship_status: string | null,
  religion: string | null,
  smoking: string | null,
  star_sign: string | null,
  wants_kids: string | null,
  is_skipped: boolean,
  person_id: number,

  verified_age: boolean,
  verified_gender: boolean,
  verified_ethnicity: boolean,

  theme: {
    title_color: string,
    body_color: string,
    background_color: string,
  }

  // Stats
  count_answers: number | null,
  seconds_since_last_online: number | null,
  seconds_since_sign_up: number | null,
  gets_reply_percentage: number | null,
  gives_reply_percentage: number | null,
};

const verificationLevelId = (data: UserData | null | undefined): 1 | 2 | 3 => {
  // This should be provided by the backend instead

  if (!data) {
    return 1;
  }

  const hasVerifiedBasics = data.verified_gender && data.verified_age;
  const hasVerififiedPhotos = data.photo_verifications.some(Boolean);

  if (hasVerifiedBasics && hasVerififiedPhotos) {
    return 3;
  }

  if (hasVerifiedBasics) {
    return 2;
  }

  return 1;
};

const verifiedAnything = (data: UserData | null | undefined): boolean => {
  if (!data) {
    return false;
  }

  return Boolean(
    data.photo_verifications.some(Boolean) ||
    data.verified_gender ||
    data.verified_age ||
    data.verified_ethnicity
  );
};

const hasAnyStats = (data: UserData | null | undefined): boolean => {
  if (data === undefined) {
    return true;
  }

  if (data === null) {
    return true;
  }

  return (
    data.count_answers !== null ||
    data.seconds_since_last_online !== null ||
    data.seconds_since_sign_up !== null ||
    data.gets_reply_percentage !== null ||
    data.gives_reply_percentage !== null
  );
};

const Content = (navigationRef) =>  {
  return (props) => <CurriedContent
    navigationRef={navigationRef}
    {...props}
  />;
};

const CurriedContent = ({navigationRef, navigation, route}) => {
  navigationRef.current = navigation;

  const personId = route.params.personId;
  const personUuid = route.params.personUuid;
  const showBottomButtons = route.params.showBottomButtons ?? true;
  const imageBlurhashParam = route.params.imageBlurhash;

  const [data, setData] = useState<UserData | undefined>(undefined);

  useEffect(() => {
    setData(undefined);
    (async () => {
      const response = await api('get', `/prospect-profile/${personUuid}`);
      setData(response?.json);
      route.params.personId = response?.json?.person_id;
    })();
  }, [personUuid]);

  useEffect(() =>
    listen(`skip-profile-${personUuid}`, () => navigation.popToTop()),
    [personUuid, navigation]
  );

  const imageUuid = data === undefined ?
    undefined :
    data.photo_uuids.length === 0 ?
    null :
    data.photo_uuids[0];

  const imageUuids = data?.photo_uuids;

  const imageExtraExts = data?.photo_extra_exts;

  const imageBlurhashes = data?.photo_blurhashes;

  const imageVerifications = data?.photo_verifications;

  const imageUuid0 = (() => {
    if (imageUuids === undefined) {
      return undefined;
    }
    if (imageUuids.length === 0) {
      return null;
    }
    return imageUuids[0];
  })();

  const imageExtraExts0 = (() => {
    if (imageExtraExts === undefined) {
      return undefined;
    }
    if (imageExtraExts.length === 0) {
      return null;
    }
    return imageExtraExts[0];
  })();

  const imageBlurhash0 = (() => {
    if (imageBlurhashParam) {
      return imageBlurhashParam;
    }
    if (imageBlurhashes === undefined) {
      return undefined;
    }
    if (imageBlurhashes.length === 0) {
      return null;
    }
    return imageBlurhashes[0];
  })();

  const imageVerification0 = imageVerifications && imageVerifications[0];

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: withTiming(data?.theme?.background_color ?? '#ffffff'),
  }));

  return (
    <>
      <ScrollView style={{ backgroundColor: data?.theme?.background_color }}>
        <Reanimated.View style={animatedStyle}>
          <View
            style={{
              width: '100%',
              maxWidth: 600,
              alignSelf: 'center',
              paddingBottom: 100,
            }}
          >
            <EnlargeableImage
              imageUuid={imageUuid0}
              imageExtraExts={imageExtraExts0}
              imageBlurhash={imageBlurhash0}
              onChangeEmbiggened={goToGallery(navigation, imageUuid0)}
              isPrimary={true}
              isVerified={imageVerification0}
            />
            <ProspectUserDetails
              navigation={navigation}
              personId={personId}
              name={data?.name}
              age={data?.age}
              verified={verificationLevelId(data) > 1}
              matchPercentage={data?.match_percentage}
              userLocation={data?.location}
              textColor={data?.theme?.title_color}
            />
            <Body
              navigation={navigation}
              personId={personId}
              personUuid={personUuid}
              data={data}
            />
          </View>
        </Reanimated.View>
      </ScrollView>
      {showBottomButtons &&
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            width: '100%',
            maxWidth: 600,
            alignSelf: 'center',
            zIndex: 999,
            overflow: 'visible',
            justifyContent: 'center',
            flexDirection: 'row',
          }}
          pointerEvents="box-none"
        >
          <View
            style={{
              flexDirection: 'row',
            }}
          >
            <FloatingSkipButton
              personUuid={personUuid}
              isSkipped={data?.is_skipped}
            />
            <FloatingSendIntroButton
              navigation={navigation}
              personId={data?.person_id}
              personUuid={personUuid}
              name={data?.name}
              imageUuid={imageUuid}
              imageBlurhash={imageBlurhash0}
            />
          </View>
        </View>
      }
      <View
        style={{
          position: 'absolute',
          height: 0,
          width: '100%',
          maxWidth: 600,
          alignSelf: 'center',
          zIndex: 999,
        }}
      >
        <StatusBarSpacer/>
        <FloatingBackButton navigationRef={navigationRef}/>
      </View>
    </>
  );
};

const ProspectUserDetails = ({
  navigation,
  personId,
  name,
  age,
  verified,
  matchPercentage,
  userLocation,
  textColor,
}) => {
  const onPressDonutChart = useCallback(() => {
    if (personId === undefined) return;
    if (name === undefined) return;

    navigation.navigate('In-Depth', { personId, name });
  }, [personId, name]);

  const displayedLocation = (
    userLocation === undefined ? '' : (userLocation ?? 'Private location'));

  const isViewingSelf = personId === signedInUser?.personId;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        margin: 10,
        gap: 10,
      }}
    >
      <View
        style={{
          flexShrink: 1,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            flexShrink: 1,
            alignItems: 'center',
            gap: 8,
          }}
        >
          <DefaultText
            style={{
              fontWeight: '700',
              fontSize: 24,
              flexShrink: 1,
              color: textColor,
            }}
          >
            {[
              name,
              age,
            ].filter(Boolean).join(', ')}
          </DefaultText>
          {verified &&
            <VerificationBadge/>
          }
        </View>
        <DefaultText
          style={{
            textAlign: 'left',
            color: textColor,
          }}
        >
          <FontAwesomeIcon
            icon={faLocationDot}
            style={{
              transform: [ { translateY: 2 } ]
            }}
            color={textColor}
          />
          {'\u2002'}
          {displayedLocation}
        </DefaultText>
      </View>
      <DonutChart
        percentage={matchPercentage}
        onPress={!isViewingSelf ? onPressDonutChart : undefined}
        textStyle={{
          color: textColor,
        }}
        style={{
          opacity: isViewingSelf ? 0 : 1,
        }}
      >
        <DefaultText
          style={{
            paddingBottom: 5,
            fontWeight: '500',
            fontSize: 10,
            opacity: matchPercentage === undefined ? 0 : 1,
            color: textColor,
          }}
        >
          See Why ›
        </DefaultText>
      </DonutChart>
    </View>
  );
};

const AudioPlayer = ({
  name,
  uuid,
}: {
  name: string | undefined
  uuid: string
}) => {
  const sound = useRef<Audio.Sound>();

  const [isPlaying, setIsPlaying] = useState(false);

  const [secondsElapsed, setSecondsElapsed] = useState(0);

  const [minutes, seconds] = secToMinSec(secondsElapsed);

  const playIcon = isPlaying ? 'pause-circle' : 'play-circle';

  const play = async () => {
    if (!sound.current) {
      return;
    }

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
      });

      const response = await sound.current.playAsync();

      setIsPlaying(response.isLoaded);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const pause = async () => {
    if (!sound.current) {
      return;
    }

    setIsPlaying(false);

    await sound.current.pauseAsync();
  };

  const togglePlayPlause = () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  useEffect(() => {
    const onPlaybackStatusUpdate = async (status: AVPlaybackStatus) => {
      if (!status.isLoaded) {
        return;
      }

      setSecondsElapsed(Math.floor(status.positionMillis / 1000));

      if (status.didJustFinish) {
        setIsPlaying(false);
        if (sound.current) {
          await sound.current.pauseAsync();
          await sound.current.setPositionAsync(0);
        }
      }
    };

    const go = async () => {
      if (!uuid) {
        return;
      }

      sound.current = (await Audio.Sound.createAsync(
        { uri: `${AUDIO_URL}/${uuid}.aac` },
        {},
        onPlaybackStatusUpdate,
        false,
      )).sound;
    };

    go();

    return () => {
      if (sound.current) {
        sound.current.unloadAsync();
      }
    };
  }, [uuid]);

  return (
    <View
      style={{
        width: '100%',
        marginTop: 20,
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderColor: 'rgba(0, 0, 0, 0.1)',
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 10,
        gap: 20,
      }}
    >
      <Ionicons
        onPress={togglePlayPlause}
        style={{ fontSize: 42, flex: 1 }}
        name={playIcon}
      />

      <DefaultText style={styles.audioPlayerMiddleText}>
        {name ? `${possessive(name)} ` : ''}voice bio
      </DefaultText>


      <DefaultText style={{ flex: 1, textAlign: 'right', paddingRight: 5 }}>
        {minutes}:{seconds}
      </DefaultText>
    </View>
  );
};

const Body = ({
  navigation,
  personId,
  personUuid,
  data,
}: {
  navigation: any,
  personId: number,
  personUuid: string,
  data: UserData | undefined,
}) => {
  const imageUuid1 = data?.photo_uuids && data?.photo_uuids[1];
  const imageUuid2 = data?.photo_uuids && data?.photo_uuids[2];
  const imageUuid3 = data?.photo_uuids && data?.photo_uuids[3];
  const imageUuid4 = data?.photo_uuids && data?.photo_uuids[4];
  const imageUuid5 = data?.photo_uuids && data?.photo_uuids[5];
  const imageUuid6 = data?.photo_uuids && data?.photo_uuids[6];

  const imageExtraExts1 = data?.photo_extra_exts && data?.photo_extra_exts[1];
  const imageExtraExts2 = data?.photo_extra_exts && data?.photo_extra_exts[2];
  const imageExtraExts3 = data?.photo_extra_exts && data?.photo_extra_exts[3];
  const imageExtraExts4 = data?.photo_extra_exts && data?.photo_extra_exts[4];
  const imageExtraExts5 = data?.photo_extra_exts && data?.photo_extra_exts[5];
  const imageExtraExts6 = data?.photo_extra_exts && data?.photo_extra_exts[6];

  const imageBlurhash1 = data?.photo_blurhashes && data?.photo_blurhashes[1];
  const imageBlurhash2 = data?.photo_blurhashes && data?.photo_blurhashes[2];
  const imageBlurhash3 = data?.photo_blurhashes && data?.photo_blurhashes[3];
  const imageBlurhash4 = data?.photo_blurhashes && data?.photo_blurhashes[4];
  const imageBlurhash5 = data?.photo_blurhashes && data?.photo_blurhashes[5];
  const imageBlurhash6 = data?.photo_blurhashes && data?.photo_blurhashes[6];

  const imageVerification1 = data?.photo_verifications && data?.photo_verifications[1] || false;
  const imageVerification2 = data?.photo_verifications && data?.photo_verifications[2] || false;
  const imageVerification3 = data?.photo_verifications && data?.photo_verifications[3] || false;
  const imageVerification4 = data?.photo_verifications && data?.photo_verifications[4] || false;
  const imageVerification5 = data?.photo_verifications && data?.photo_verifications[5] || false;
  const imageVerification6 = data?.photo_verifications && data?.photo_verifications[6] || false;

  const isViewingSelf = personId === signedInUser?.personId;

  const basicsTheme = {
    textStyle: {
      color: data?.theme?.body_color,
    },
  };

  const clubsTheme = {
    textStyle: {
      color: data?.theme?.body_color,
    },
  };

  const mutualClubsTheme = {
    ...basicsTheme,
    style: {
      borderColor: clubsTheme.textStyle.color,
    },
  };

  const statsTheme = {
    textStyle: {
      color: data?.theme?.body_color,
    },
  };

  return (
    <>
      <View
        style={{
          paddingLeft: 10,
          paddingRight: 10,
          marginBottom: 20,
        }}
      >
        {data?.audio_bio_uuid &&
          <AudioPlayer name={data?.name} uuid={data?.audio_bio_uuid} />
        }
        <Title style={{color: data?.theme?.title_color}}>Basics</Title>
        <Basics>
          {data?.gender &&
            <Basic {...basicsTheme} icon={faVenusMars}>{data.gender}</Basic>}

          {data?.orientation &&
            <Basic {...basicsTheme} icon="person">{data.orientation}</Basic>}

          {data?.ethnicity &&
            <Basic {...basicsTheme} icon="globe-outline">{data.ethnicity}</Basic>}

          {data?.relationship_status &&
            <Basic {...basicsTheme} icon="heart">{data.relationship_status}</Basic>}

          {data?.occupation &&
            <Basic {...basicsTheme} icon="briefcase">{data.occupation}</Basic>}

          {data?.education &&
            <Basic {...basicsTheme} icon="school">{data.education}</Basic>}

          {data?.has_kids === 'Yes' &&
            <Basic {...basicsTheme} icon="people">Has kids</Basic>}
          {data?.has_kids === 'No' &&
            <Basic {...basicsTheme} icon="people">Doesn't have kids</Basic>}

          {data?.wants_kids === 'Yes' &&
            <Basic {...basicsTheme} icon="people">Wants kids</Basic>}
          {data?.wants_kids === 'No' &&
            <Basic {...basicsTheme} icon="people">Doesn't want kids</Basic>}
          {data?.wants_kids === 'Maybe' &&
            <Basic {...basicsTheme} icon="people">Maybe wants kids</Basic>}

          {data?.looking_for &&
            <Basic {...basicsTheme} icon="eye">Looking for {data.looking_for.toLowerCase()}</Basic>}

          {data?.smoking === 'Yes' &&
            <Basic {...basicsTheme} icon={faSmoking}>Smokes</Basic>}
          {data?.smoking === 'No' &&
            <Basic {...basicsTheme} icon={faSmoking}>Doesn't smoke</Basic>}

          {data?.drinking &&
            <Basic {...basicsTheme} icon="wine">{data.drinking} drinks</Basic>}

          {data?.drugs === 'Yes' &&
            <Basic {...basicsTheme} icon={faPills}>Does drugs</Basic>}
          {data?.drugs === 'No' &&
            <Basic {...basicsTheme} icon={faPills}>Doesn't do drugs</Basic>}

          {data?.religion &&
            <Basic {...basicsTheme} icon={faHandsPraying}>{data.religion}</Basic>}

          {data?.long_distance === 'Yes' &&
            <Basic {...basicsTheme} icon="globe">Open to long distance</Basic>}
          {data?.long_distance === 'No' &&
            <Basic {...basicsTheme} icon="globe">Not open to long distance</Basic>}

          {data?.star_sign &&
            <Basic {...basicsTheme} icon="star">{data.star_sign}</Basic>}

          {data?.exercise &&
            <Basic {...basicsTheme} icon="barbell">{data.exercise} exercises</Basic>}

          {data?.height_cm && signedInUser?.units === 'Metric' &&
            <Basic {...basicsTheme} icon={faRulerVertical}>{data.height_cm} cm</Basic>}
          {data?.height_cm && signedInUser?.units === 'Imperial' &&
            <Basic {...basicsTheme} icon={faRulerVertical}>{cmToFeetInchesStr(data.height_cm)}</Basic>}
        </Basics>

        {verifiedAnything(data) && <>
          <Title style={{color: data?.theme?.title_color}}>Verification</Title>
          <DetailedVerificationBadges
            photos={(data?.photo_verifications ?? []).some(Boolean)}
            gender={data?.verified_gender ?? false}
            age={data?.verified_age ?? false}
            ethnicity={data?.verified_ethnicity ?? false}
            style={{
              marginBottom: 5,
            }}
          />
          <View
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.3)',
              borderRadius: 3,
              overflow: 'hidden',
              marginBottom: 10,
            }}
          >
            <DefaultText
              style={{
                color: 'rgba(0, 0, 0, 0.5)',
                padding: 2,
              }}
            >
              Verification is based on selfies analyzed by our AI. Verified
              photos are most accurate.
            </DefaultText>
          </View>
          </>
        }

        <EnlargeableImage
          imageUuid={imageUuid1}
          imageExtraExts={imageExtraExts1}
          imageBlurhash={imageBlurhash1}
          onChangeEmbiggened={goToGallery(navigation, imageUuid1)}
          style={styles.secondaryEnlargeableImage}
          innerStyle={styles.secondaryEnlargeableImageInner}
          isPrimary={false}
          isVerified={imageVerification1}
        />

        {!data?.name &&
          <Title style={{color: data?.theme?.title_color}}>About ...</Title>
        }
        {!!data?.name && !!data?.about && data.about.trim() &&
          <>
            <Title style={{color: data?.theme?.title_color}}>About {data.name}</Title>
            <DefaultText style={{color: data?.theme?.body_color}} selectable={true}>
              {data.about}
            </DefaultText>
          </>
        }

        <EnlargeableImage
          imageUuid={imageUuid2}
          imageExtraExts={imageExtraExts2}
          imageBlurhash={imageBlurhash2}
          onChangeEmbiggened={goToGallery(navigation, imageUuid2)}
          style={styles.secondaryEnlargeableImage}
          innerStyle={styles.secondaryEnlargeableImageInner}
          isPrimary={false}
          isVerified={imageVerification2}
        />

        <EnlargeableImage
          imageUuid={imageUuid3}
          imageExtraExts={imageExtraExts3}
          imageBlurhash={imageBlurhash3}
          onChangeEmbiggened={goToGallery(navigation, imageUuid3)}
          style={styles.secondaryEnlargeableImage}
          innerStyle={styles.secondaryEnlargeableImageInner}
          isPrimary={false}
          isVerified={imageVerification3}
        />

        <AllClubs
          mutualClubs={data?.mutual_clubs ?? []}
          otherClubs={data?.other_clubs ?? []}
          mutualClubsTheme={mutualClubsTheme}
          clubsTheme={clubsTheme}
          titleColor={data?.theme?.title_color}
        />

        <EnlargeableImage
          imageUuid={imageUuid4}
          imageExtraExts={imageExtraExts4}
          imageBlurhash={imageBlurhash4}
          onChangeEmbiggened={goToGallery(navigation, imageUuid4)}
          style={styles.secondaryEnlargeableImage}
          innerStyle={styles.secondaryEnlargeableImageInner}
          isPrimary={false}
          isVerified={imageVerification4}
        />

        <EnlargeableImage
          imageUuid={imageUuid5}
          imageExtraExts={imageExtraExts5}
          imageBlurhash={imageBlurhash5}
          onChangeEmbiggened={goToGallery(navigation, imageUuid5)}
          style={styles.secondaryEnlargeableImage}
          innerStyle={styles.secondaryEnlargeableImageInner}
          isPrimary={false}
          isVerified={imageVerification5}
        />

        <EnlargeableImage
          imageUuid={imageUuid6}
          imageExtraExts={imageExtraExts6}
          imageBlurhash={imageBlurhash6}
          onChangeEmbiggened={goToGallery(navigation, imageUuid6)}
          style={styles.secondaryEnlargeableImage}
          innerStyle={styles.secondaryEnlargeableImageInner}
          isPrimary={false}
          isVerified={imageVerification6}
        />

        {hasAnyStats(data) && <>
          <Title style={{color: data?.theme?.title_color}}>Stats</Title>
          <Stats>
            {data?.seconds_since_last_online !== null &&
              <Stat {...statsTheme}>
                <DefaultText
                  style={{ fontWeight: '700' }}
                >
                  Last Online: {}
                </DefaultText>
                {
                  data === undefined ?
                  'Loading...' :
                  data.seconds_since_last_online < 300 ?
                  'Now' :
                  `${friendlyTimeAgo(data.seconds_since_last_online)} ago`
                }
              </Stat>
            }
            {data?.count_answers !== null &&
              <Stat {...statsTheme}>
                <DefaultText
                  style={{ fontWeight: '700' }}
                >
                  Q&A Answers: {}
                </DefaultText>
                {data?.count_answers ?? 'Loading...'}
              </Stat>
            }
            {data && !_.isNil(data.gives_reply_percentage) &&
              <Stat {...statsTheme}>
                <DefaultText
                  style={{ fontWeight: '700' }}
                >
                  Gives Replies To: {}
                </DefaultText>
                {Math.round(data.gives_reply_percentage)}% of intros
              </Stat>
            }
            {data && !_.isNil(data.gets_reply_percentage) &&
              <Stat {...statsTheme}>
                <DefaultText
                  style={{ fontWeight: '700' }}
                >
                  Gets Replies To: {}
                </DefaultText>
                {Math.round(data.gets_reply_percentage)}% of intros
              </Stat>
            }
            {data?.seconds_since_sign_up !== null &&
              <Stat {...statsTheme}>
                <DefaultText
                  style={{ fontWeight: '700' }}
                >
                  Account Age: {}
                </DefaultText>
                {
                  data === undefined ?
                  'Loading...' :
                  friendlyTimeAgo(data.seconds_since_sign_up)
                }
              </Stat>
            }
          </Stats>
        </>}

        {!isViewingSelf && !!data?.count_answers &&
          <SeeQAndAButton
            navigation={navigation}
            personId={personId}
            name={data?.name}
          />}
        {!isViewingSelf &&
          <BlockButton
            name={data?.name}
            personUuid={personUuid}
            isSkipped={data?.is_skipped}
          />}
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  secondaryEnlargeableImage: {
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 10,
  },
  secondaryEnlargeableImageInner: {
  },
  wFull: {
    width: '100%',
  },
  audioPlayerMiddleText: {
    fontWeight: 700,
    flex: 3,
    ...(Platform.OS === 'web' ? {
      wordBreak: 'break-all',
    } : {}),
    textAlign: 'center',
  },
});

export {
  FloatingBackButton,
  GalleryScreen,
  InDepthScreen,
  ProspectProfileScreen,
};
