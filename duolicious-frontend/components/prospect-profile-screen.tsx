import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  TextStyle,
  View,
  ViewStyle,
  SafeAreaView,
} from 'react-native';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBarSpacer } from './status-bar-spacer';
import { DefaultText } from './default-text';
import { DonutChart } from './donut-chart';
import { Title } from './title';
import { Shadow } from './shadow';
import { InDepthScreen } from './in-depth-screen';
import { ButtonWithCenteredText } from './button/centered-text';
import { api } from '../api/api';
import { cmToFeetInchesStr } from '../units/units';
import { signedInUser } from '../App';
import { setSkipped } from '../hide-and-block/hide-and-block';
import { ImageOrSkeleton } from './profile-card';
import { Pinchy } from './pinchy';
import { Basic } from './basic';
import { Club, Clubs } from './club';
import { listen, notify } from '../events/events';
import { ReportModalInitialData } from './report-modal';

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

const Stack = createNativeStackNavigator();

const ProspectProfileScreen = ({navigation, route}) => {
  const navigationRef = useRef(undefined);
  const personId = route.params.personId;

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        presentation: 'card',
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Prospect Profile" component={Content(navigationRef)} />
      <Stack.Screen name="In-Depth" component={InDepthScreen(navigationRef)} />
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
  imageBlurhash,
  onChangeEmbiggened,
  style,
  isPrimary,
}: {
  imageUuid: string | undefined | null,
  imageBlurhash: string | undefined | null,
  onChangeEmbiggened: (uuid: string) => void,
  style?: any,
  isPrimary: boolean,
}) => {
  if (imageUuid === undefined && !isPrimary) {
    return <></>;
  }

  return (
    <Pressable
      onPress={() => imageUuid && onChangeEmbiggened(imageUuid)}
    >
      <ImageOrSkeleton
        resolution={900}
        imageUuid={imageUuid}
        imageBlurhash={imageBlurhash}
        style={style}
        showGradient={false}
      />
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
          shadowOffset: {
            width: 0,
            height: 4,
          },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
        onPress={onPress ?? (navigationRef?.current || navigation).goBack}
      >
        <FontAwesomeIcon
          icon={faArrowLeft}
          size={24}
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
          shadowOffset: {
            width: 0,
            height: 4,
          },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 6,
          height: 60,
          width: 60,
        }}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
};

const FloatingSkipButton = ({navigation, personId, personUuid, isSkipped}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSkippedState, setIsSkippedState] = useState<
    boolean | undefined
  >(isSkipped);

  useEffect(() => {
    setIsSkippedState(isSkipped);
  }, [isSkipped]);

  useEffect(() => {
    return listen(`unskip-profile-${personId}`, () => setIsSkippedState(false));
  }, [personId]);

  useEffect(() => {
    return listen(`skip-profile-${personId}`, () => setIsSkippedState(true));
  }, [personId]);

  const onPress = useCallback(async () => {
    if (personId === undefined) return;

    const nextIsSkippedState = !isSkippedState;

    setIsLoading(true);
    if (await setSkipped(personId, personUuid, nextIsSkippedState)) {
      setIsLoading(false);
    }
  }, [isLoading, isSkippedState, personId, personUuid]);

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
          style={{color: 'white'}}
        />
      }
    </FloatingProfileInteractionButton>
  );
};

const SeeQAndAButton = ({navigation, personId, name, countAnswers}) => {
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

  const determiner = String(name).endsWith('s') ? "'" : "'s";

  if (!countAnswers) {
    return <></>;
  }

  return (
    <ButtonWithCenteredText
      containerStyle={containerStyle}
      textStyle={textStyle}
      onPress={onPress}
      extraChildren={extraChildren}
      loading={name === undefined}
    >
      {name}{determiner} Q&A Answers ({countAnswers})
    </ButtonWithCenteredText>
  );
};

const BlockButton = ({navigation, name, personId, personUuid, isSkipped}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSkippedState, setIsSkippedState] = useState(false);

  useEffect(() => {
    setIsSkippedState(isSkipped);
  }, [isSkipped]);

  useEffect(() => {
    return listen(`unskip-profile-${personId}`, () => setIsSkippedState(false));
  }, []);

  const onPress = useCallback(async () => {
    if (isSkippedState) {
      setIsLoading(true);
      if (await setSkipped(personId, personUuid, false)) {
        setIsLoading(false);
      }
    } else {
      const data: ReportModalInitialData = {
        name,
        personId,
        personUuid,
        context: 'Prospect Profile Screen',
      };
      notify('open-report-modal', data);
    }
  }, [notify, name, personId, isSkippedState]);

  const text = isSkippedState ?
    `You have skipped ${name}. Press to unskip.` :
    `Report ${name}`;

  const iconStroke = isLoading ? "transparent" : "grey";

  return (
    <Pressable
      onPress={onPress}
      style={{
        marginTop: 100,
        marginBottom: 100,
        alignSelf: 'center',
        flexDirection: 'row',
        gap: 7,
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
            color: '#777',
            overflow: 'hidden',
            textAlign: 'center',
          }}
        >
          {name === undefined ? '...' : text}
        </DefaultText>
      }
    </Pressable>
  );
};

const Columns = ({children, ...rest}) => {
  return (
    <View style={{
      width: '100%',
      maxWidth: 600,
      flexGrow: 1,
      alignSelf: 'center',
      ...rest.style,
    }}
    >
      {children}
    </View>
  );
};

type UserData = {
  name: string,
  about: string,
  mutual_clubs: string[],
  other_clubs: string[],
  gender: string,
  match_percentage: number,
  count_answers: number,
  photo_uuids: string[],
  photo_blurhashes: string[],
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
};

const Content = (navigationRef) => ({navigation, route, ...props}) => {
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
    })();
  }, [personId]);

  useEffect(() =>
    listen(`skip-profile-${personId}`, () => navigation.popToTop()),
    [personId, navigation]
  );

  const imageUuid = data === undefined ?
    undefined :
    data.photo_uuids.length === 0 ?
    null :
    data.photo_uuids[0];

  const imageUuids = data?.photo_uuids === undefined ?
    undefined :
    data.photo_uuids;

  const imageBlurhashes = data?.photo_blurhashes === undefined ?
    undefined :
    data.photo_blurhashes;

  const imageUuid0 = (() => {
    if (imageUuids === undefined) {
      return undefined;
    }
    if (imageUuids.length === 0) {
      return null;
    }
    return imageUuids[0];
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

  const numMorePics = Math.max(0, (imageUuids ?? []).length - 1);

  return (
    <>
      <ScrollView
        contentContainerStyle={{
          width: '100%',
          maxWidth: 600,
          alignSelf: 'center',
          paddingBottom: 100,
        }}
      >
        <EnlargeableImage
          imageUuid={imageUuid0}
          imageBlurhash={imageBlurhash0}
          onChangeEmbiggened={goToGallery(navigation, imageUuid0)}
          isPrimary={true}
        />
        <ProspectUserDetails
          navigation={navigation}
          personId={personId}
          name={data?.name}
          age={data?.age}
          matchPercentage={data?.match_percentage}
          userLocation={data?.location}
        />
        <Shadow/>
        <Body
          navigation={navigation}
          personId={personId}
          personUuid={personUuid}
          data={data}
          imageUuids={imageUuids}
          imageBlurhashes={imageBlurhashes}
          onChangeEmbiggened={() => {}}
        />
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
              navigation={navigation}
              personId={data?.person_id}
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
  matchPercentage,
  userLocation,
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
      }}
    >
      <View
        style={{
          flexShrink: 1,
        }}
      >
        <DefaultText
          style={{
            fontWeight: '700',
            fontSize: 24,
          }}
        >
          {[
            name,
            age,
          ].filter(Boolean).join(', ')}
        </DefaultText>
        <DefaultText style={{textAlign: 'left'}}>
          {displayedLocation}{' '}
          <FontAwesomeIcon
            icon={faLocationDot}
            style={{
              transform: [ { translateY: 2 } ]
            }}
          />
        </DefaultText>
      </View>
     <DonutChart
        percentage={matchPercentage}
        onPress={!isViewingSelf ? onPressDonutChart : undefined}
        style={{opacity: isViewingSelf ? 0 : 1}}
      >
        <DefaultText
          style={{
            paddingBottom: 5,
            fontWeight: '500',
            fontSize: 10,
            opacity: matchPercentage === undefined ? 0 : 1,
          }}
        >
          See Why ›
        </DefaultText>
      </DonutChart>
    </View>
  );
};

const Basics = ({children}) => {
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
      }}
    >
      {children}
    </View>
  );
};



const Body = ({
  navigation,
  personId,
  personUuid,
  data,
  imageUuids,
  imageBlurhashes,
  onChangeEmbiggened,
}: {
  navigation: any,
  personId: number,
  personUuid: string,
  data: UserData | undefined,
  imageUuids: string[] | undefined,
  imageBlurhashes: string[] | undefined,
  onChangeEmbiggened: (uuid: string) => void,
}) => {
  const imageUuid1 = imageUuids && imageUuids[1];
  const imageUuid2 = imageUuids && imageUuids[2];
  const imageUuid3 = imageUuids && imageUuids[3];
  const imageUuid4 = imageUuids && imageUuids[4];
  const imageUuid5 = imageUuids && imageUuids[5];
  const imageUuid6 = imageUuids && imageUuids[6];

  const imageBlurhash1 = imageBlurhashes && imageBlurhashes[1];
  const imageBlurhash2 = imageBlurhashes && imageBlurhashes[2];
  const imageBlurhash3 = imageBlurhashes && imageBlurhashes[3];
  const imageBlurhash4 = imageBlurhashes && imageBlurhashes[4];
  const imageBlurhash5 = imageBlurhashes && imageBlurhashes[5];
  const imageBlurhash6 = imageBlurhashes && imageBlurhashes[6];

  const isViewingSelf = personId === signedInUser?.personId;

  return (
    <>
      <View
        style={{
          paddingLeft: 10,
          paddingRight: 10,
          marginBottom: 20,
        }}
      >
        <Title>Summary</Title>
        <Basics>
          {data?.gender &&
            <Basic icon={faVenusMars}>{data.gender}</Basic>}

          {data?.orientation &&
            <Basic icon="person">{data.orientation}</Basic>}

          {data?.ethnicity &&
            <Basic icon="globe-outline">{data.ethnicity}</Basic>}

          {data?.relationship_status &&
            <Basic icon="heart">{data.relationship_status}</Basic>}

          {data?.occupation &&
            <Basic icon="briefcase">{data.occupation}</Basic>}

          {data?.education &&
            <Basic icon="school">{data.education}</Basic>}

          {data?.has_kids === 'Yes' &&
            <Basic icon="people">Has kids</Basic>}
          {data?.has_kids === 'No' &&
            <Basic icon="people">Doesn't have kids</Basic>}

          {data?.wants_kids === 'Yes' &&
            <Basic icon="people">Wants kids</Basic>}
          {data?.wants_kids === 'No' &&
            <Basic icon="people">Doesn't want kids</Basic>}
          {data?.wants_kids === 'Maybe' &&
            <Basic icon="people">Maybe wants kids</Basic>}

          {data?.looking_for &&
            <Basic icon="eye">Looking for {data.looking_for.toLowerCase()}</Basic>}

          {data?.smoking === 'Yes' &&
            <Basic icon={faSmoking}>Smokes</Basic>}
          {data?.smoking === 'No' &&
            <Basic icon={faSmoking}>Doesn't smoke</Basic>}

          {data?.drinking &&
            <Basic icon="wine">{data.drinking} drinks</Basic>}

          {data?.drugs === 'Yes' &&
            <Basic icon={faPills}>Does drugs</Basic>}
          {data?.drugs === 'No' &&
            <Basic icon={faPills}>Doesn't do drugs</Basic>}

          {data?.religion &&
            <Basic icon={faHandsPraying}>{data.religion}</Basic>}

          {data?.long_distance === 'Yes' &&
            <Basic icon="globe">Open to long distance</Basic>}
          {data?.long_distance === 'No' &&
            <Basic icon="globe">Not open to long distance</Basic>}

          {data?.star_sign &&
            <Basic icon="star">{data.star_sign}</Basic>}

          {data?.exercise &&
            <Basic icon="barbell">{data.exercise} exercises</Basic>}

          {data?.height_cm && signedInUser?.units === 'Metric' &&
            <Basic icon={faRulerVertical}>{data.height_cm} cm</Basic>}
          {data?.height_cm && signedInUser?.units === 'Imperial' &&
            <Basic icon={faRulerVertical}>{cmToFeetInchesStr(data.height_cm)}</Basic>}
        </Basics>

        <EnlargeableImage
          imageUuid={imageUuid1}
          imageBlurhash={imageBlurhash1}
          onChangeEmbiggened={goToGallery(navigation, imageUuid1)}
          style={styles.secondaryEnlargeableImage}
          isPrimary={false}
        />

        {!data?.name &&
          <Title>About ...</Title>
        }
        {!!data?.name && !!data?.about && data.about.trim() &&
          <>
            <Title>About {data.name}</Title>
            <DefaultText selectable={true}>
              {data.about}
            </DefaultText>
          </>
        }

        <EnlargeableImage
          imageUuid={imageUuid2}
          imageBlurhash={imageBlurhash2}
          onChangeEmbiggened={goToGallery(navigation, imageUuid2)}
          style={styles.secondaryEnlargeableImage}
          isPrimary={false}
        />

        {data !== undefined && data.mutual_clubs.length > 0 &&
          <>
            <Title>Mutual clubs</Title>
            <Clubs>
              {data.mutual_clubs.map((clubName, i) =>
                <Club
                  key={i}
                  name={clubName}
                  isMutual={true}
                />
              )}
            </Clubs>
          </>
        }

        <EnlargeableImage
          imageUuid={imageUuid3}
          imageBlurhash={imageBlurhash3}
          onChangeEmbiggened={goToGallery(navigation, imageUuid3)}
          style={styles.secondaryEnlargeableImage}
          isPrimary={false}
        />

        {data !== undefined && data.other_clubs.length > 0 &&
          <>
            <Title>{data.mutual_clubs.length > 0 ? 'Other clubs' : 'Clubs'}</Title>
            <Clubs>
              {data.other_clubs.map((clubName, i) =>
                <Club
                  key={i}
                  name={clubName}
                  isMutual={false}
                />
              )}
            </Clubs>
          </>
        }

        <EnlargeableImage
          imageUuid={imageUuid4}
          imageBlurhash={imageBlurhash4}
          onChangeEmbiggened={goToGallery(navigation, imageUuid4)}
          style={styles.secondaryEnlargeableImage}
          isPrimary={false}
        />

        <EnlargeableImage
          imageUuid={imageUuid5}
          imageBlurhash={imageBlurhash5}
          onChangeEmbiggened={goToGallery(navigation, imageUuid5)}
          style={styles.secondaryEnlargeableImage}
          isPrimary={false}
        />

        <EnlargeableImage
          imageUuid={imageUuid6}
          imageBlurhash={imageBlurhash6}
          onChangeEmbiggened={goToGallery(navigation, imageUuid6)}
          style={styles.secondaryEnlargeableImage}
          isPrimary={false}
        />

        {!isViewingSelf && (<>
        <SeeQAndAButton
          navigation={navigation}
          personId={personId}
          name={data?.name}
          countAnswers={data?.count_answers}
        />
        <BlockButton
          navigation={navigation}
          name={data?.name}
          personId={personId}
          personUuid={personUuid}
          isSkipped={data?.is_skipped}
        />
        </>)}
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
});

export {
  FloatingBackButton,
  GalleryScreen,
  InDepthScreen,
  ProspectProfileScreen,
};
