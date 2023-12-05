import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  View,
  StyleProp,
  TextStyle,
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
import { Shadow } from './shadow';
import { InDepthScreen } from './in-depth-screen';
import { ButtonWithCenteredText } from './button/centered-text';
import { api } from '../api/api';
import { cmToFeetInchesStr } from '../units/units';
import { signedInUser } from '../App';
import { IMAGES_URL } from '../env/env';
import { randomGagLocation } from '../data/gag-locations';
import { setHidden, setBlocked } from '../hide-and-block/hide-and-block';
import { ImageCarousel } from './image-carousel';
import { Pinchy } from './pinchy';
import { Basic } from './basic';
import { Club, Clubs } from './club';

import Ionicons from '@expo/vector-icons/Ionicons';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons/faArrowLeft'
import { faRulerVertical } from '@fortawesome/free-solid-svg-icons/faRulerVertical'
import { faHandsPraying } from '@fortawesome/free-solid-svg-icons/faHandsPraying'
import { faPills } from '@fortawesome/free-solid-svg-icons/faPills'
import { faSmoking } from '@fortawesome/free-solid-svg-icons/faSmoking'
import { faPersonHalfDress } from '@fortawesome/free-solid-svg-icons/faPersonHalfDress'
import { faVenusMars } from '@fortawesome/free-solid-svg-icons/faVenusMars'
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons/faPaperPlane'
import { faLocationDot } from '@fortawesome/free-solid-svg-icons/faLocationDot'
import { RotateCcw, X } from "react-native-feather";

const Stack = createNativeStackNavigator();

const goToGallery = (navigation, imageUuids) => () => {
  if ((imageUuids ?? []).length > 0) {
    navigation.navigate('Gallery Screen', { imageUuids } );
  }
};

const FloatingBackButton = (props) => {
  const {
    onPress,
    navigationRef,
    navigation,
  } = props;

  return (
    <Pressable
      style={{
        borderRadius: 999,
        zIndex: 999,
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
  );
};

const FloatingProfileInteractionButton = ({
  children,
  navigation,
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

const FloatingHideButton = ({navigation, personId, isHidden}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isHiddenState, setIsHiddenState] = useState<
    boolean | undefined
  >(isHidden);

  useEffect(() => {
    setIsHiddenState(isHidden);
  }, [isHidden]);

  const onPress = useCallback(async () => {
    if (personId === undefined) return;

    const nextIsHiddenState = !isHiddenState;

    setIsLoading(true);
    if (await setHidden(personId, nextIsHiddenState)) {
      if (nextIsHiddenState) navigation.goBack();
      setIsHiddenState(nextIsHiddenState);
      setIsLoading(false);
    }
  }, [isLoading, isHiddenState, personId]);

  return (
    <FloatingProfileInteractionButton
      navigation={navigation}
      onPress={onPress}
      backgroundColor="white"
    >
      {isLoading &&
        <ActivityIndicator size="large" color="#70f"/>
      }
      {!isLoading && isHiddenState === true && <RotateCcw
          stroke="#70f"
          strokeWidth={3}
          height={24}
          width={24}
        />
      }
      {!isLoading && isHiddenState === false && <X
          stroke="#70f"
          strokeWidth={3}
          height={24}
          width={24}
        />
      }
    </FloatingProfileInteractionButton>
  );
};

const FloatingSendIntroButton = ({navigation, personId, name, imageUuid}) => {
  const onPress = useCallback(() => {
    if (personId === undefined) return;
    if (name === undefined) return;

    navigation.navigate('Conversation Screen', { personId, name, imageUuid });
  }, [navigation, personId, name, imageUuid]);

  return (
    <FloatingProfileInteractionButton
      navigation={navigation}
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

const BlockButton = ({navigation, name, personId, isBlocked}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isBlockedState, setIsBlockedState] = useState(false);

  useEffect(() => {
    setIsBlockedState(isBlocked);
  }, [isBlocked]);

  const onPress = useCallback(async () => {
    if (isLoading) return;

    setIsLoading(true);

    const nextIsBlockedState = !isBlockedState;

    setIsLoading(true);
    if (await setBlocked(personId, nextIsBlockedState)) {
      setIsBlockedState(nextIsBlockedState);
      setIsLoading(false);
      if (nextIsBlockedState) {
        navigation.popToTop();
      }
    }
  }, [isLoading, isBlockedState, personId]);

  const text = isBlockedState
    ? `You have blocked and reported ${name}. Press to unblock ${name}.` :
    `Block and report ${name}`;

  return (
    <Pressable
      onPress={onPress}
      style={{
        marginTop: 100,
        marginBottom: 100,
        alignSelf: 'center',
      }}
    >
      {isLoading &&
        <ActivityIndicator size="small" color="#70f"/>
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

const ProspectProfileScreen = ({navigation, route}) => {
  const navigationRef = useRef(undefined);
  const personId = route.params.personId;

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        presentation: 'modal',
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Prospect Profile" component={Content(navigationRef)} />
      <Stack.Screen name="In-Depth" component={InDepthScreen(navigationRef)} />
    </Stack.Navigator>
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
  age: number | null,
  location: string | null
  drinking: string | null,
  drugs: string | null,
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
  is_hidden: boolean,
  is_blocked: boolean,
};

const Content = (navigationRef) => ({navigation, route, ...props}) => {
  navigationRef.current = navigation;

  const personId = route.params.personId;
  const showBottomButtons = route.params.showBottomButtons ?? true;

  const [data, setData] = useState<UserData | undefined>(undefined);

  const [activeIndex, setActiveIndex] = useState(0);
  const [embiggenedUuid, setEmbiggenedUuid] = useState<string | null>(null);

  useEffect(() => {
    setData(undefined);
    (async () => {
      const response = await api('get', `/prospect-profile/${personId}`);
      setData(response?.json);
    })();
  }, [personId]);

  const imageUuid = data === undefined ?
    undefined :
    data.photo_uuids.length === 0 ?
    null :
    data.photo_uuids[0];

  const imageUuids = data?.photo_uuids === undefined ?
    undefined :
    data.photo_uuids;

  const numMorePics = Math.max(0, (imageUuids ?? []).length - 1);

  if (embiggenedUuid) {
    return (
      <>
        <Pinchy uuid={embiggenedUuid}/>
        <StatusBarSpacer/>
        <FloatingBackButton onPress={() => setEmbiggenedUuid(null)}/>
      </>
    );
  }

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
        <ImageCarousel
          uuids={imageUuids}
          activeIndex={activeIndex}
          onChangeActiveIndex={setActiveIndex}
          onChangeEmbiggened={setEmbiggenedUuid}
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
          data={data}
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
            <FloatingHideButton
              navigation={navigation}
              personId={personId}
              isHidden={data?.is_hidden}
            />
            <FloatingSendIntroButton
              navigation={navigation}
              personId={personId}
              name={data?.name}
              imageUuid={imageUuid}
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

  const gagLocation = useMemo(randomGagLocation, []);

  const displayedLocation = (
    userLocation === undefined ? '' : (userLocation ?? gagLocation));

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
        onPress={onPressDonutChart}
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
  data,
}: {
  navigation: any,
  personId: number,
  data: UserData | undefined,
}) => {
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
        {!data?.name &&
          <Title>About ...</Title>
        }
        {data?.name && data?.about && data.about.trim() &&
          <>
            <Title>About {data.name}</Title>
            <DefaultText selectable={true}>
              {data.about}
            </DefaultText>
          </>
        }
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
          isBlocked={data?.is_blocked}
        />
      </View>
    </>
  );
};

export {
  FloatingBackButton,
  InDepthScreen,
  ProspectProfileScreen,
};
