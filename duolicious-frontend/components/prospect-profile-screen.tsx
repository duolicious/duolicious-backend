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
import { SendIntroButtonSpacer } from './send-intro-button-spacer';
import { ButtonWithCenteredText } from './button/centered-text';

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
import { LinearGradient } from 'expo-linear-gradient';
import { RotateCcw, X } from "react-native-feather";

const Stack = createNativeStackNavigator();

const isIconDefinition = (x: any): x is IconDefinition => {
  return x.iconName !== undefined;
};

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

const reasonablePerson1 = () => {
  return `I'm a reasonable person. A very reasonable person. My existence is characterized by suffering and if I wanted to sick my internet trolls on Channel 4 then there'd be nothing but broken windows and riots. Wouldn't that be fun?

Look the fuck out.

`;
};

const reasonablePersonN = (n: number) => {
  return [...Array(n).keys()].map(reasonablePerson1).join('').trim();
};

const goToGallery = (navigation) => () => {
  navigation.navigate('Gallery Screen');
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

const FloatingHideButton = ({navigation}) => {
  const [isHidden, setIsHidden] = useState(false);

  const onPress = useCallback(() => {
    setIsHidden(isHidden => !isHidden);
    navigation.goBack();
  }, []);

  return (
    <FloatingProfileInteractionButton
      navigation={navigation}
      onPress={onPress}
      backgroundColor="white"
    >
      {isHidden && <RotateCcw
          stroke="#70f"
          strokeWidth={3}
          height={24}
          width={24}
        />
      }
      {!isHidden && <X
          stroke="#70f"
          strokeWidth={3}
          height={24}
          width={24}
        />
      }
    </FloatingProfileInteractionButton>
  );
};

const FloatingSendIntroButton = ({navigation}) => {
  const onPress = useCallback(() => {
    navigation.navigate('Conversation Screen')
  }, [navigation]);

  return (
    <FloatingProfileInteractionButton
      navigation={navigation}
      onPress={onPress}
      backgroundColor="#70f"
    >
      <FontAwesomeIcon
        icon={faPaperPlane}
        size={24}
        style={{color: 'white'}}
      />
    </FloatingProfileInteractionButton>
  );
};

const SeeQAndAButton = ({navigation, name}) => {
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
    navigation.navigate('In-Depth');
  }, []);

  const determiner = name.endsWith('s') ? "'" : "'s";

  return (
    <ButtonWithCenteredText
      containerStyle={containerStyle}
      textStyle={textStyle}
      onPress={onPress}
      extraChildren={extraChildren}
    >
      {name}{determiner} Q&A Answers (342)
    </ButtonWithCenteredText>
  );
};

const BlockButton = () => {
  const [blocked, setBlocked] = useState(false);

  const toggleBlocked = () => {
    setBlocked(blocked => !blocked);
  };

  const text = blocked
    ? 'You have blocked and reported Rahim. Press to unblock Rahim.' :
    'Block and report Rahim';

  return (
    <Pressable
      onPress={toggleBlocked}
      style={{
        marginTop: 20,
        marginBottom: 20,
      }}
    >
      <DefaultText
        style={{
          padding: 20,
          color: '#777',
          textAlign: 'center',
          overflow: 'hidden',
        }}
      >
        {text}
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

const ProspectProfileScreen = ({navigation}) => {
  const navigationRef = useRef(undefined);

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

const Content = (navigationRef) => ({navigation, ...props}) => {
  navigationRef.current = navigation;

  return (
    <>
      <ScrollView
        contentContainerStyle={{
          maxWidth: 600,
          alignSelf: 'center',
        }}
      >
        <ProspectProfileCard
          onPress={goToGallery(navigation)}
        />
        <ProspectUserDetails navigation={navigation}/>
        <Shadow/>
        <Body navigation={navigation}/>
        <SendIntroButtonSpacer/>
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
        <FloatingHideButton navigation={navigation} />
        <FloatingSendIntroButton navigation={navigation} />
      </View>
    </>
  );
};

const ProspectUserDetails = ({navigation}) => {
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
          Rahim, 19
        </DefaultText>
        <DefaultText>Paris, France</DefaultText>
      </View>
      <DonutChart
        percentage={50}
        onPress={() => navigation.navigate('In-Depth')}
      >
        <DefaultText
          style={{
            paddingBottom: 5,
            fontWeight: '500',
            fontSize: 10,
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



const Body = ({navigation}) => {
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
          <Basic icon={faVenusMars}>Man</Basic>
          <Basic icon="person">Gay</Basic>
          <Basic icon="heart">Single</Basic>
          <Basic icon="people">Doesn't have kids</Basic>
          <Basic icon="people">Doesn't want kids</Basic>
          <Basic icon="eye">Looking for friends</Basic>
          <Basic icon={faSmoking}>Doesn't smoke</Basic>
          <Basic icon="wine">Doesn't drink</Basic>
          <Basic icon={faPills}>Doesn't do drugs</Basic>
          <Basic icon="school">MIT</Basic>
          <Basic icon={faHandsPraying}>Christian</Basic>
          <Basic icon={faRulerVertical}>179 cm</Basic>
          <Basic icon="briefcase">Professional Walnut Milker</Basic>
        </Basics>
        <Title>About Rahim</Title>
        <DefaultText>
          {reasonablePersonN(2)}
        </DefaultText>
        <SeeQAndAButton navigation={navigation} name="Rahim"/>
        <BlockButton/>
      </View>
    </>
  );
};

const GalleryScreen = ({navigation}) => {
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
          imageUrls={[
            {
              url: `https://randomuser.me/api/portraits/men/${getRandomInt(99)}.jpg`,
            },
            {
              url: `https://randomuser.me/api/portraits/men/${getRandomInt(99)}.jpg`,
            },
          ]}
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
