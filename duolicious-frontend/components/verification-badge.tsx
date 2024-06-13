import {
  View,
} from 'react-native';
import { DefaultText } from './default-text';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { faCircleCheck } from '@fortawesome/free-solid-svg-icons/faCircleCheck'
import { faCheck } from '@fortawesome/free-solid-svg-icons/faCheck'
import { faXmark } from '@fortawesome/free-solid-svg-icons/faXmark'

const VerificationBadge = (props) => {
  const {
    size = 20,
    style = {},
    color = '#1d9bf0',
  } = props;

  return <FontAwesomeIcon
    icon={faCircleCheck}
    size={size}
    color={color}
    style={style}
  />
}

const DetailedVerificationBadge = ({verified, name}) => {
  return (
    <View
      style={{
          backgroundColor: '#1d9bf0',
          borderRadius: 5,
          paddingTop: 8,
          paddingBottom: 8,
          paddingLeft: 12,
          paddingRight: 12,
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'row',
          opacity: verified ? 1 : 0.4,
      }}
    >
      {verified &&
        <FontAwesomeIcon
          icon={faCheck}
          size={14}
          color="white"
        />
      }
      {!verified &&
        <FontAwesomeIcon
          icon={faXmark}
          size={14}
          color="white"
        />
      }
      <DefaultText
        style={{
          color: 'white',
          fontWeight: 700,
          marginLeft: 5,
        }}
      >
        {name}
      </DefaultText>
    </View>
  );
};

const DetailedVerificationBadges = ({
  photos,
  gender,
  age,
  ethnicity,
  style = {}
}: {
  photos: boolean
  gender: boolean
  age: boolean
  ethnicity: boolean
  style: any
}) => {
  const verifications = [
    { name: 'Photos',    verified: photos },
    { name: 'Gender',    verified: gender },
    { name: 'Age',       verified: age },
    { name: 'Ethnicity', verified: ethnicity },
  ].sort((a, b) => {
    if (a.verified > b.verified) return -1;
    if (a.verified < b.verified) return +1;
    if (a.name > b.name) return +1;
    if (a.name < b.name) return -1;
    return 0;
  });

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
          paddingTop: 5,
          paddingBottom: 5,
        },
        style
      ]}
    >
      {
        verifications.map(({name, verified}, i) =>
          <DetailedVerificationBadge key={i} verified={verified} name={name} />
        )
      }
    </View>
  );
};

export {
  VerificationBadge,
  DetailedVerificationBadges,
};
