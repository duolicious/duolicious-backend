import {
  Animated,
  Pressable,
  View,
} from 'react-native';
import {
  useEffect,
  useCallback,
  useRef,
  useState,
  memo,
} from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { DefaultText } from './default-text';
import { Avatar } from './avatar';
import {
  IMAGES_URL,
} from '../env/env';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { listen } from '../events/events';
import { X } from "react-native-feather";
import { PageItem } from './search-tab';
import { ImageBackground } from 'expo-image';
import { VerificationBadge } from './verification-badge';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { faLock } from '@fortawesome/free-solid-svg-icons/faLock'
import { verificationOptionGroups } from '../data/option-groups';

const ImageOrSkeleton_ = ({resolution, imageUuid, imageBlurhash, ...rest}) => {
  const {
    showGradient = true,
  } = rest;

  return (
    <ImageBackground
      key={String(imageUuid) + ' ' + String(imageBlurhash)}
      source={imageUuid && {
        uri: `${IMAGES_URL}/${resolution}-${imageUuid}.jpg`
      }}
      placeholder={imageBlurhash && { blurhash: imageBlurhash }}
      transition={150}
      style={[
        {
          width: '100%',
          aspectRatio: 1,
          backgroundColor: imageUuid ? undefined : '#ccc',
        },
        rest.style,
      ]}
    >
      <LinearGradient
        colors={showGradient ? [
          'rgba(0, 0, 0, 0.1)',
          'transparent',
          'transparent',
          'transparent',
          'transparent',
          'rgba(0, 0, 0, 0.1)',
          'rgba(0, 0, 0, 0.3)',
          'rgba(0, 0, 0, 0.4)',
        ] : [
          'transparent',
          'transparent',
        ]}
        style={{
          height: '100%',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {imageUuid === null && imageBlurhash === null &&
          <Ionicons
            style={{fontSize: 100, color: '#eee'}}
            name={'person'}
          />
        }
      </LinearGradient>
    </ImageBackground>
  );
};

const ImageOrSkeleton = memo(ImageOrSkeleton_);

const ProfileCard = ({
  item,
}: {
  item: PageItem,
}) => {
  const {
    name: name,
    age: age,
    match_percentage: matchPercentage,
    profile_photo_uuid: imageUuid,
    profile_photo_blurhash: imageBlurhash,
    prospect_person_id: personId,
    prospect_uuid: personUuid,
    person_messaged_prospect: personMessagedProspect,
    prospect_messaged_person: prospectMessagedPerson,
    verified: verified,
    verification_required_to_view: verificationRequired,
  } = item;

  const [isSkipped, setIsSkipped] = useState(false);

  const [
    personMessagedProspectState,
    setPersonMessagedProspectState,
  ] = useState(personMessagedProspect);
  const [
    prospectMessagedPersonState,
    setProspectMessagedPersonState,
  ] = useState(prospectMessagedPerson);

  const navigation = useNavigation<any>();

  const itemOnPress = useCallback(() => {
    if (!navigation) {
      return;
    }

    if (verificationRequired) {
      return navigation.navigate('Profile');
    } else if (personUuid) {
      return navigation.navigate(
        'Prospect Profile Screen',
        {
          screen: 'Prospect Profile',
          params: { personId, personUuid, imageBlurhash },
        }
      );
    }
  }, [navigation, personUuid, verificationRequired]);

  const onHide = useCallback(() => setIsSkipped(true), [setIsSkipped]);
  const onUnhide = useCallback(() => setIsSkipped(false), [setIsSkipped]);

  const onMessageFrom = useCallback(
    () => {
      setProspectMessagedPersonState(true);
      item.prospect_messaged_person = true;
    },
    [setProspectMessagedPersonState, item]
  );

  const onMessageTo = useCallback(
    () => {
      setPersonMessagedProspectState(true);
      item.person_messaged_prospect = true;
    },
    [setPersonMessagedProspectState, item]
  );

  useEffect(
    () => listen(`skip-profile-${personId}`, onHide),
    [personId, onHide]
  );

  useEffect(
    () => listen(`unskip-profile-${personId}`, onUnhide),
    [personId, onUnhide]
  );

  useEffect(
    () => listen(`message-from-${personId}`, onMessageFrom),
    [personId, onMessageFrom]
  );

  useEffect(
    () => listen(`message-to-${personId}`, onMessageTo),
    [personId, onMessageTo]
  );

  return (
    <Pressable
      onPress={itemOnPress}
      style={{ flex: 0.5, aspectRatio: 1, overflow: 'hidden', borderRadius: 5 }}
    >
      <View
        style={{
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <ImageOrSkeleton
          resolution={450}
          imageUuid={imageUuid}
          imageBlurhash={imageBlurhash}
        />
        <UserDetails
          name={name}
          age={age}
          matchPercentage={matchPercentage}
          verified={verified}
        />
        {prospectMessagedPersonState &&
          <Ionicons
            style={{
              fontSize: 18,
              color: 'white',
              position: 'absolute',
              bottom: 0,
              right: 18,
              padding: 5,
            }}
            name="chatbubble"
          />
        }
        {personMessagedProspectState &&
          <Ionicons
            style={{
              transform: [ { scaleX: -1 } ],
              fontSize: 18,
              color: 'white',
              position: 'absolute',
              bottom: 0,
              right: 0,
              padding: 5,
            }}
            name="chatbubble"
          />
        }
      </View>
      {isSkipped &&
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'white',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <X
            stroke="#70f"
            strokeWidth={3}
            height={48}
            width={48}
          />
        </View>
      }
      {verificationRequired &&
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <FontAwesomeIcon
            icon={faLock}
            size={30}
            style={{color: 'white'}}
          />
          <DefaultText
            style={{
              color: 'white',
              fontWeight: '900',
              fontSize: 22,
              textAlign: 'center',
              padding: 10,
            }}
          >
            Verification Required
          </DefaultText>
          <DefaultText
            style={{
              fontSize: 12,
              color: '#ccc',
              textAlign: 'center',
              paddingHorizontal: 10,
            }}
          >
            This person only lets people with
            verified {verificationRequired} see them
          </DefaultText>
        </View>
      }
    </Pressable>
  );
};

const UserDetails = ({name, age, matchPercentage, verified, ...rest}) => {
  const {
    containerStyle,
  } = rest;

  return (
    <View
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: '100%',
        padding: 5,
        ...containerStyle,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          gap: 7,
          alignItems: 'flex-end',
        }}
      >
        <DefaultText style={{
          fontSize: 18,
          fontWeight: '600',
          color: 'white',
          overflow: 'hidden',
          flexShrink: 1,
        }}>
          {name}{age && `, ${age}`}
        </DefaultText>
        {verified &&
          <VerificationBadge size={20}/>
        }
      </View>
      <DefaultText
        style={{
          fontWeight: '500',
          color: 'white',
          alignSelf: 'flex-start',
        }}
      >
        {matchPercentage}% Match
      </DefaultText>
    </View>
  );
};

export {
  ImageOrSkeleton,
  ProfileCard,
};
