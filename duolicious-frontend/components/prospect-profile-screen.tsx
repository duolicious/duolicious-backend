import {
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
  useRef,
  useState,
} from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProspectProfileCard } from './profile-card';
import { StatusBarSpacer } from './status-bar-spacer';
import ImageViewer from 'react-native-image-zoom-viewer';
import { DefaultText } from './default-text';
import { DonutChart } from './donut-chart';
import { Title } from './title';
import { Shadow } from './shadow';
import { InDepthScreen } from './in-depth-screen';
import { ButtonWithCenteredText } from './button/centered-text';
import { api } from '../api/api';
import { cmToFeetInchesStr } from '../units/units';
import { signedInUser } from '../App';

import Ionicons from '@expo/vector-icons/Ionicons';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons/faArrowLeft'
import { faRulerVertical } from '@fortawesome/free-solid-svg-icons/faRulerVertical'
import { faHandsPraying } from '@fortawesome/free-solid-svg-icons/faHandsPraying'
import { faPills } from '@fortawesome/free-solid-svg-icons/faPills'
import { faSmoking } from '@fortawesome/free-solid-svg-icons/faSmoking'
import { faPersonHalfDress } from '@fortawesome/free-solid-svg-icons/faPersonHalfDress'
import { faVenusMars } from '@fortawesome/free-solid-svg-icons/faVenusMars'
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons/faPaperPlane'
import { RotateCcw, X } from "react-native-feather";
import { IMAGES_URL } from '../env/env';

const Stack = createNativeStackNavigator();

const isIconDefinition = (x: any): x is IconDefinition => {
  return x.iconName !== undefined;
};

const goToGallery = (navigation, imageUuids) => () => {
  if ((imageUuids ?? []).length > 0) {
    navigation.navigate('Gallery Screen', { imageUuids } );
  }
};

const FloatingBackButton = (props) => {
  const {
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
      onPress={(navigationRef?.current || navigation).goBack}
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
  const [isHiddenState, setIsHiddenState] = useState<
    boolean | undefined
  >(isHidden);

  useEffect(() => {
    setIsHiddenState(isHidden);
  }, [isHidden]);

  const onPress = useCallback(() => {
    if (personId === undefined) return;

    setIsHiddenState(!isHiddenState);

    if (isHiddenState === true ) api('post', `/unhide/${personId}`);
    if (isHiddenState === false) api('post', `/hide/${personId}`);

    if (isHiddenState === false) navigation.goBack();
  }, [isHiddenState, personId]);

  return (
    <FloatingProfileInteractionButton
      navigation={navigation}
      onPress={onPress}
      backgroundColor="white"
    >
      {isHiddenState === true && <RotateCcw
          stroke="#70f"
          strokeWidth={3}
          height={24}
          width={24}
        />
      }
      {isHiddenState === false && <X
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

    navigation.navigate('Conversation Screen', { personId, name, imageUuid });
  }, [navigation, personId, name, imageUuid]);

  return (
    <FloatingProfileInteractionButton
      navigation={navigation}
      onPress={onPress}
      backgroundColor="#70f"
    >
      {personId !== undefined &&
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

const BlockButton = ({name, personId, isBlocked}) => {
  const [isBlockedState, setIsBlockedState] = useState(false);

  useEffect(() => {
    setIsBlockedState(isBlocked);
  }, [isBlocked]);

  const onPress = useCallback(() => {
    setIsBlockedState(!isBlockedState);

    if (isBlockedState === true ) api('post', `/unblock/${personId}`);
    if (isBlockedState === false) api('post', `/block/${personId}`);
  }, [isBlockedState]);

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
      <DefaultText
        style={{
          color: '#777',
          overflow: 'hidden',
        }}
      >
        {name === undefined ? '...' : text}
      </DefaultText>
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
    <>
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

type UserData = {
  name: string,
  about: string,
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

  const [data, setData] = useState<UserData | undefined>(undefined);

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
        <ProspectProfileCard
          onPress={goToGallery(navigation, imageUuids)}
          imageUuid={imageUuid}
          numMorePics={numMorePics}
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
        <DefaultText>{userLocation ?? ''}</DefaultText>
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

const Basic = ({children, ...rest}) => {
  const {icon} = rest;

  const Icon = ({icon}) => {
    if (isIconDefinition(icon)) {
      return <FontAwesomeIcon
        icon={icon}
        size={16}
        style={{
          marginRight: 5,
        }}
      />
    } else {
      return <Ionicons
        style={{
          fontSize: 16,
          marginRight: 5,
        }}
        name={icon}
      />
    }
  };

  return (
    <View
      style={{
        borderColor: '#ddd',
        borderWidth: 1,
        borderRadius: 999,
        paddingTop: 5,
        paddingBottom: 5,
        paddingLeft: 10,
        paddingRight: 10,
        marginRight: 5,
        marginBottom: 5,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
      }}
    >
      {icon && <Icon icon={icon}/>}
      <View>
        <DefaultText>{children}</DefaultText>
      </View>
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
        <Title>About {data?.name ?? '...'}</Title>
        <DefaultText>
          {data?.about ?? '...'}
        </DefaultText>
        <SeeQAndAButton
          navigation={navigation}
          personId={personId}
          name={data?.name}
          countAnswers={data?.count_answers}
        />
        <BlockButton name={data?.name} personId={personId} isBlocked={data?.is_blocked} />
      </View>
    </>
  );
};

const GalleryScreen = ({navigation, route}) => {
  const imageUuids = route.params.imageUuids;

  return (
    <>
      <View
        style={{
          position: 'absolute',
          zIndex: 99,
          width: '100%',
          height: '100%',
        }}
      >
        <ImageViewer
          imageUrls={
            imageUuids.map(imageUuid => ({
              url: `${IMAGES_URL}/original-${imageUuid}.jpg`
            })
          )}
          saveToLocalByLongPress={false}
        />
      </View>
      <StatusBarSpacer/>
      <FloatingBackButton navigation={navigation}/>
    </>
  );
};


export {
  GalleryScreen,
  InDepthScreen,
  ProspectProfileScreen,
};
