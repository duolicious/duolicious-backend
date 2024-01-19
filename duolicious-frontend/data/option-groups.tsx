import * as _ from "lodash";
import { mapi, japi } from '../api/api';
import { setSignedInUser } from '../App';
import { sessionToken } from '../kv-storage/session-token';
import { X } from "react-native-feather";
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { faRulerVertical } from '@fortawesome/free-solid-svg-icons/faRulerVertical'
import { faRuler } from '@fortawesome/free-solid-svg-icons/faRuler'
import { faHandsPraying } from '@fortawesome/free-solid-svg-icons/faHandsPraying'
import { faPills } from '@fortawesome/free-solid-svg-icons/faPills'
import { faSmoking } from '@fortawesome/free-solid-svg-icons/faSmoking'
import { faVenusMars } from '@fortawesome/free-solid-svg-icons/faVenusMars'
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons/faPaperPlane'
import { faLocationDot } from '@fortawesome/free-solid-svg-icons/faLocationDot'
import { faImage } from '@fortawesome/free-solid-svg-icons/faImage'
import { faCalendar } from '@fortawesome/free-solid-svg-icons/faCalendar'
import { faPeopleGroup } from '@fortawesome/free-solid-svg-icons/faPeopleGroup'
import Ionicons from '@expo/vector-icons/Ionicons';

type OptionGroupButtons = {
  buttons: {
    values: string[],
    submit: (input: string) => Promise<boolean>
    currentValue?: string,
  }
};


type OptionGroupLocationSelector = {
  locationSelector: {
    submit: (input: string) => Promise<boolean>
    currentValue?: string,
  }
};

type OptionGroupGivenName = {
  givenName: {
    submit: (input: string) => Promise<boolean>
  }
};

type OptionGroupDate = {
  date: {
    submit: (input: string) => Promise<boolean>
  }
};

type OptionGroupPhotos = {
  photos: {
    submit: (filename: string, pathOrBase64: string) => Promise<boolean>
    delete: (filename: string) => Promise<boolean>
    fetch?: (position: string, resolution: string) => Promise<string | null>
  }
};

type OptionGroupTextLong = {
  textLong: {
    submit: (input: string) => Promise<boolean>
    invalidMsg?: string
  }
};

type OptionGroupTextShort = {
  textShort: {
    submit: (input: string) => Promise<boolean>
    currentValue?: string,
    invalidMsg?: string
  }
};

type OptionGroupOtp = {
  otp: {
    submit: (input: string) => Promise<boolean>
  }
};

type OptionGroupCheckChips = {
  checkChips: {
    values: {
      label: string
      checked: boolean
    }[]
    submit: (input: string[]) => Promise<boolean>
  }
};

type OptionGroupNone = {
  none: {
    description?: string,
    submit: () => Promise<boolean>
  }
};

type OptionGroupSlider = {
  slider: {
    sliderMin: number,
    sliderMax: number,
    step: number,
    unitsLabel: string,
    submit: (input: number | null) => Promise<boolean>,
    addPlusAtMax?: boolean,
    defaultValue: number,
    valueRewriter?: (v: number) => string,
    currentValue?: number,
  }
};

type OptionGroupRangeSlider = {
  rangeSlider: {
    sliderMin: number,
    sliderMax: number,
    unitsLabel: string,
    submit: (sliderMin: number | null, sliderMax: number | null) => Promise<boolean>,
    valueRewriter?: (v: number) => string,
    currentMin?: number,
    currentMax?: number,
  }
};

type OptionGroupInputs
  = OptionGroupButtons
  | OptionGroupLocationSelector
  | OptionGroupSlider
  | OptionGroupRangeSlider
  | OptionGroupGivenName
  | OptionGroupDate
  | OptionGroupPhotos
  | OptionGroupTextLong
  | OptionGroupTextShort
  | OptionGroupOtp
  | OptionGroupCheckChips
  | OptionGroupNone;

type OptionGroup<T extends OptionGroupInputs> = {
  title: string,
  Icon?: any,
  description: string,
  input: T,
  scrollView?: boolean,
};

const hasExactKeys = (obj, keys) => {
    // If the number of keys in the object and the keys array don't match, return false
    if (Object.keys(obj).length !== keys.length) return false;

    // Check whether each key in the keys array exists in the object
    for (let i = 0; i < keys.length; i++) {
        if (!obj.hasOwnProperty(keys[i])) return false;
    }

    // If all keys are found, return true
    return true;
}

const isOptionGroupButtons = (x: any): x is OptionGroupButtons => {
  return hasExactKeys(x, ['buttons']);
}

const isOptionGroupLocationSelector = (x: any): x is OptionGroupLocationSelector => {
  return hasExactKeys(x, ['locationSelector']);
}

const isOptionGroupSlider = (x: any): x is OptionGroupSlider => {
  return hasExactKeys(x, ['slider']);
};

const isOptionGroupRangeSlider = (x: any): x is OptionGroupRangeSlider => {
  return hasExactKeys(x, ['rangeSlider']);
}

const isOptionGroupGivenName = (x: any): x is OptionGroupGivenName => {
  return hasExactKeys(x, ['givenName']);
}

const isOptionGroupDate = (x: any): x is OptionGroupDate => {
  return hasExactKeys(x, ['date']);
}

const isOptionGroupPhotos = (x: any): x is OptionGroupPhotos => {
  return hasExactKeys(x, ['photos']);
}

const isOptionGroupTextLong = (x: any): x is OptionGroupTextLong => {
  return hasExactKeys(x, ['textLong']);
}

const isOptionGroupTextShort = (x: any): x is OptionGroupTextShort => {
  return hasExactKeys(x, ['textShort']);
}

const isOptionGroupOtp = (x: any): x is OptionGroupOtp => {
  return hasExactKeys(x, ['otp']);
}

const isOptionGroupNone = (x: any): x is OptionGroupNone => {
  return hasExactKeys(x, ['none']);
}

const isOptionGroupCheckChips = (x: any): x is OptionGroupCheckChips => {
  return hasExactKeys(x, ['checkChips']);
}

const getCurrentValue = (x: OptionGroupInputs | undefined) => {
  if (isOptionGroupButtons(x))
    return x.buttons.currentValue;

  if (isOptionGroupLocationSelector(x))
    return x.locationSelector.currentValue;

  if (isOptionGroupTextShort(x))
    return x.textShort.currentValue;

  if (isOptionGroupSlider(x))
    return x.slider.currentValue;

  if (isOptionGroupRangeSlider(x))
    return {
      sliderMin: x.rangeSlider.sliderMin,
      sliderMax: x.rangeSlider.sliderMax,
    };

  if (isOptionGroupCheckChips(x))
    return x.checkChips.values.flatMap((v) => v.checked ? [v.label] : []);
}

const newCheckChipValues = (
  currentValues: { label: string, checked: boolean }[],
  newValues: string[],
) => {
  return currentValues.map((v) => ({
    ...v,
    checked: newValues.includes(v.label),
  }));
};

const genders = [
  'Man',
  'Woman',
  'Agender',
  'Intersex',
  'Non-binary',
  'Transgender',
  'Trans woman',
  'Trans man',
  'Other',
];

const orientations = [
  'Straight',
  'Gay',
  'Lesbian',
  'Bisexual',
  'Asexual',
  'Demisexual',
  'Pansexual',
  'Queer',
  'Other',
];

const religions = [
  'Agnostic',
  'Atheist',
  'Buddhist',
  'Christian',
  'Hindu',
  'Jewish',
  'Muslim',
  'Zoroastrian',
  'Other',
];

const starSigns = [
  'Aquarius',
  'Aries',
  'Cancer',
  'Capricorn',
  'Gemini',
  'Leo',
  'Libra',
  'Pisces',
  'Sagittarius',
  'Scorpio',
  'Taurus',
  'Virgo',
];

const lookingFor = [
  'Friends',
  'Short-term dating',
  'Long-term dating',
  'Marriage',
];

const relationshipStatus = [
  'Single',
  'Seeing someone',
  'Engaged',
  'Married',
  'Divorced',
  'Widowed',
  'Other',
];

const yesNo = [
  'Yes',
  'No',
];

const frequency = [
  'Often',
  'Sometimes',
  'Never',
];

const immediacy = [
  'Immediately',
  'Daily',
  'Every 3 days',
  'Weekly',
  'Never'
];

const genderOptionGroup: OptionGroup<OptionGroupButtons> = {
  title: 'Gender',
  Icon: () => (
    <FontAwesomeIcon
      icon={faVenusMars}
      size={14}
      style={{color: 'black'}}
    />
  ),
  description: "What’s your gender?",
  input: {
    buttons: {
      values: genders,
      submit: async function(gender: string) {
        const ok = (await japi('patch', '/profile-info', { gender })).ok;
        if (ok) this.currentValue = gender;
        return ok;
      },
    }
  }
};

const yourPartnersGenderOptionGroup: OptionGroup<OptionGroupCheckChips> = {
  title: "Your Partner’s Gender",
  description: "Which gender do you want to date? You can select more than one option",
  input: {
    checkChips: {
      values: genders.map((x) => ({checked: false, label: x})),
      submit: async (inputs: string[]) => true
    }
  }
};

const locationOptionGroup: OptionGroup<OptionGroupLocationSelector> = {
  title: 'Location',
  Icon: () => (
    <FontAwesomeIcon
      icon={faLocationDot}
      size={14}
      style={{color: 'black'}}
    />
  ),
  description: "What city do you live in?",
  input: {
    locationSelector: {
      submit: async function(location: string) {
        const ok = (await japi('patch', '/profile-info', { location })).ok;
        if (ok) this.currentValue = location;
        return ok;
      },
    }
  },
  scrollView: false,
};

const orientationOptionGroup: OptionGroup<OptionGroupButtons> = {
  title: 'Orientation',
  Icon: () => <Ionicons style={{fontSize: 16 }} name="person" />,
  description: "What’s your sexual orientation?",
  input: {
    buttons: {
      values: orientations,
      submit: async function(orientation: string) {
        const ok = (await japi('patch', '/profile-info', { orientation })).ok;
        if (ok) this.currentValue = orientation;
        return ok;
      },
    }
  },
};

const lookingForOptionGroup: OptionGroup<OptionGroupButtons> = {
  title: 'Looking For',
  Icon: () => <Ionicons style={{fontSize: 16 }} name="eye" />,
  description: 'What are you mainly looking for on Duolicious?',
  input: {
    buttons: {
      values: lookingFor,
      submit: async function(lookingFor: string) {
        const ok = (await japi('patch', '/profile-info', { looking_for: lookingFor })).ok;
        if (ok) this.currentValue = lookingFor;
        return ok;
      },
    }
  }
};

const basicsOptionGroups: OptionGroup<OptionGroupInputs>[] = [
  genderOptionGroup,
  locationOptionGroup,
  orientationOptionGroup,
  {
    title: 'Occupation',
    Icon: () => <Ionicons style={{fontSize: 16 }} name="briefcase" />,
    description: "What’s your profession?",
    input: {
      textShort: {
        submit: async function(occupation: string) {
          const ok = (await japi('patch', '/profile-info', { occupation })).ok;
          if (ok) this.currentValue = occupation;
          return ok;
        },
        invalidMsg: 'Try again',
      }
    }
  },
  {
    title: 'Education',
    Icon: () => <Ionicons style={{fontSize: 16 }} name="school" />,
    description: "Where did you study?",
    input: {
      textShort: {
        submit: async function(education: string) {
          const ok = (await japi('patch', '/profile-info', { education })).ok;
          if (ok) this.currentValue = education;
          return ok;
        },
        invalidMsg: 'Try again',
      }
    }
  },
  {
    title: 'Height',
    Icon: () => (
      <FontAwesomeIcon
        icon={faRulerVertical}
        size={14}
        style={{color: 'black'}}
      />
    ),
    description: "How tall are you?",
    input: {
      slider: {
        sliderMin: 100,
        sliderMax: 220,
        defaultValue: 170,
        step: 1,
        unitsLabel: 'cm',
        submit: async function(height: number) {
          const ok = (await japi('patch', '/profile-info', { height: String(height) })).ok;
          if (ok) this.currentValue = height;
          return ok;
        },
      },
    },
  },
  lookingForOptionGroup,
  {
    title: 'Smoking',
    Icon: () => (
      <FontAwesomeIcon
        icon={faSmoking}
        size={14}
        style={{color: 'black'}}
      />
    ),
    description: 'Do you smoke?',
    input: {
      buttons: {
        values: yesNo,
        submit: async function(smoking: string) {
          const ok = (await japi('patch', '/profile-info', { smoking })).ok;
          if (ok) this.currentValue = smoking;
          return ok;
        },
      }
    },
  },
  {
    title: 'Drinking',
    Icon: () => <Ionicons style={{fontSize: 16 }} name="wine" />,
    description: 'How often do you drink?',
    input: {
      buttons: {
        values: frequency,
        submit: async function(drinking: string) {
          const ok = (await japi('patch', '/profile-info', { drinking })).ok;
          if (ok) this.currentValue = drinking;
          return ok;
        },
      }
    },
  },
  {
    title: 'Drugs',
    Icon: () => (
      <FontAwesomeIcon
        icon={faPills}
        size={14}
        style={{color: 'black'}}
      />
    ),
    description: 'Do you do drugs?',
    input: {
      buttons: {
        values: yesNo,
        submit: async function(drugs: string) {
          const ok = (await japi('patch', '/profile-info', { drugs })).ok;
          if (ok) this.currentValue = drugs;
          return ok;
        },
      }
    },
  },
  {
    title: 'Long Distance',
    Icon: () => <Ionicons style={{fontSize: 16 }} name="globe" />,
    description: 'Are you willing to enter a long-distance relationship?',
    input: {
      buttons: {
        values: yesNo,
        submit: async function(longDistance: string) {
          const ok = (await japi('patch', '/profile-info', { long_distance: longDistance })).ok;
          if (ok) this.currentValue = longDistance;
          return ok;
        },
      }
    },
  },
  {
    title: 'Relationship Status',
    Icon: () => <Ionicons style={{fontSize: 16 }} name="heart" />,
    description: "What’s your relationship status?",
    input: {
      buttons: {
        values: relationshipStatus,
        submit: async function(relationshipStatus: string) {
          const ok = (
            await japi('patch', '/profile-info', { relationship_status: relationshipStatus })
          ).ok;
          if (ok) this.currentValue = relationshipStatus;
          return ok;
        },
      }
    }
  },
  {
    title: 'Has Kids',
    Icon: () => <Ionicons style={{fontSize: 16 }} name="people" />,
    description: 'Do you have kids?',
    input: {
      buttons: {
        values: yesNo,
        submit: async function(hasKids: string) {
          const ok = (await japi('patch', '/profile-info', { has_kids: hasKids })).ok;
          if (ok) this.currentValue = hasKids;
          return ok;
        },
      }
    },
  },
  {
    title: 'Wants Kids',
    Icon: () => <Ionicons style={{fontSize: 16 }} name="people" />,
    description: 'Do you want kids?',
    input: {
      buttons: {
        values: yesNo,
        submit: async function(wantsKids: string) {
          const ok = (await japi('patch', '/profile-info', { wants_kids: wantsKids })).ok;
          if (ok) this.currentValue = wantsKids;
          return ok;
        },
      }
    },
  },
  {
    title: 'Exercise',
    Icon: () => <Ionicons style={{fontSize: 16 }} name="barbell" />,
    description: 'How often do you exercise?',
    input: {
      buttons: {
        values: frequency,
        submit: async function(exercise: string) {
          const ok = (await japi('patch', '/profile-info', { exercise })).ok;
          if (ok) this.currentValue = exercise;
          return ok;
        },
      }
    },
  },
  {
    title: 'Religion',
    Icon: () => (
      <FontAwesomeIcon
        icon={faHandsPraying}
        size={14}
        style={{color: 'black'}}
      />
    ),
    description: "What’s your religion?",
    input: {
      buttons: {
        values: religions,
        submit: async function(religion: string) {
          const ok = (await japi('patch', '/profile-info', { religion })).ok;
          if (ok) this.currentValue = religion;
          return ok;
        },
      }
    },
  },
  {
    title: 'Star Sign',
    Icon: () => <Ionicons style={{fontSize: 16 }} name="star" />,
    description: "What’s your star sign?",
    input: {
      buttons: {
        values: starSigns,
        submit: async function(starSign: string) {
          const ok = (await japi('patch', '/profile-info', { star_sign: starSign })).ok;
          if (ok) this.currentValue = starSign;
          return ok;
        },
      }
    },
  },
];

const generalSettingsOptionGroups: OptionGroup<OptionGroupButtons>[] = [
  {
    title: 'Units',
    Icon: () => (
      <FontAwesomeIcon
        icon={faRuler}
        size={14}
        style={{color: 'black'}}
      />
    ),
    description: "Do you use the metric system, or the imperial system?",
    input: {
      buttons: {
        values: ['Metric', 'Imperial'],
        submit: async function(units: 'Imperial' | 'Metric') {
          const ok = (await japi('patch', '/profile-info', { units })).ok;
          if (ok) {
            this.currentValue = units;
            setSignedInUser((signedInUser) => {
              if (signedInUser) {
                return {
                  ...signedInUser,
                  units,
                }
              } else {
                return signedInUser;
              }
            });
          }
          return ok;
        },
      }
    }
  },
];

const notificationSettingsOptionGroups: OptionGroup<OptionGroupButtons>[] = [
  {
    title: 'Chats',
    Icon: () => <Ionicons style={{fontSize: 16 }} name="chatbubbles" />,
    description: "When do you want to be notified if anyone you’re chatting with sends a new message? (“Daily” still sends the first notification of the day immediately, but snoozes later notifications so that you get at-most one notification per 24 hours.)",
    input: {
      buttons: {
        values: immediacy,
        submit: async function(chats: string) {
          const ok = (await japi('patch', '/profile-info', { chats })).ok;
          if (ok) this.currentValue = chats;
          return ok;
        },
      }
    }
  },
  {
    title: 'Intros',
    Icon: () => <Ionicons style={{fontSize: 16 }} name="chatbubble" />,
    description: "When do you want to be notified if someone you haven’t chatted with sends you an intro? (“Daily” still sends the first notification of the day immediately, but snoozes later notifications so that you get at-most one notification per 24 hours.)",
    input: {
      buttons: {
        values: immediacy,
        submit: async function(intros: string) {
          const ok = (await japi('patch', '/profile-info', { intros })).ok;
          if (ok) this.currentValue = intros;
          return ok;
        },
      }
    }
  },
];

const deletionOptionGroups: OptionGroup<OptionGroupTextShort>[] = [
  {
    title: 'Delete My Account',
    description: `Are you sure you want to delete your account? This will immediately log you out and permanently delete your account data. If you’re sure, type “delete” to confirm.`,
    input: {
      textShort: {
        submit: async (input: string) => {
          if ((input ?? '').trim() !== 'delete') return false;

          const response = await japi('delete', '/account');

          if (!response.ok) return false;

          setSignedInUser(undefined);

          return true;
        },
        invalidMsg: 'Try again',
      }
    }
  },
];

const deactivationOptionGroups: OptionGroup<OptionGroupNone>[] = [
  {
    title: 'Deactivate My Account',
    description: 'Are you sure you want to deactivate your account? This will hide you from other users and log you out. The next time you sign in, your account will be reactivated. Press “continue” to deactivate your account.',
    input: {
      none: {
        submit: async () => {
          const ok = (await japi('post', '/deactivate')).ok
          if (ok) {
            setSignedInUser(undefined);
          }
          return ok;
        }
      }
    }
  },
];

const createAccountOptionGroups: OptionGroup<OptionGroupInputs>[] = [
  {
    title: "Password",
    description: "Enter the one-time password you just received to create an account or sign in",
    input: {
      otp: {
        submit: async (input) => {
          const existingSessionToken = await sessionToken();
          const response = await japi('post', '/check-otp', { otp: input });

          if (
            response.ok &&
            Boolean(response?.json?.onboarded) &&
            typeof existingSessionToken === 'string'
          ) {
            setSignedInUser((signedInUser) => ({
              personId: response?.json?.person_id,
              units: response?.json?.units === 'Imperial' ? 'Imperial' : 'Metric',
              sessionToken: existingSessionToken,
            }));
          }

          return response.ok;
        }
      }
    },
  },
  _.merge(
    {},
    yourPartnersGenderOptionGroup,
    {
      title: 'Step 1 of 7: ' + yourPartnersGenderOptionGroup.title,
      input: {
        checkChips: {
          submit: async (input: string[]) => (await japi(
            'patch',
            '/onboardee-info',
            { other_peoples_genders: input }
          )).ok
        }
      }
    },
  ),
  _.merge(
    {},
    genderOptionGroup,
    {
      title: 'Step 2 of 7: Your Gender',
      input: {
        buttons: {
          submit: async (input) => (await japi(
            'patch',
            '/onboardee-info',
            { gender: input }
          )).ok,
          currentValue: 'Man',
        }
      }
    },
  ),
  {
    title: "Step 3 of 7: First Name",
    description: "What’s your first name? You can’t change this later",
    input: {
      givenName: {
        submit: async (input) => (await japi(
          'patch',
          '/onboardee-info',
          { name: input }
        )).ok
      }
    },
  },
  {
    title: 'Step 4 of 7: Birth Date',
    description: "When were you born? We use your age to pick your matches",
    input: {
      date: {
        submit: async (input) => (await japi(
          'patch',
          '/onboardee-info',
          { date_of_birth: input }
        )).ok
      }
    },
    scrollView: false,
  },
  _.merge(
    {},
    locationOptionGroup,
    {
      title: 'Step 5 of 7: ' + locationOptionGroup.title,
      input: {
        locationSelector: {
          submit: async (input) => (await japi(
            'patch',
            '/onboardee-info',
            { location: input }
          )).ok
        }
      }
    },
  ),
  {
    title: 'Step 6 of 7: Photos',
    description: 'Profiles with photos are promoted in search results, but you can add these later',
    input: {
      photos: {
        submit: async (filename, pathOrBase64) => (await mapi(
          'patch',
          '/onboardee-info',
          filename,
          pathOrBase64
        )).ok,
        delete: async (filename) => (await japi(
          'delete',
          '/onboardee-info',
          { files: [filename] }
        )).ok
      }
    }
  },
  {
    title: 'Step 7 of 7: About',
    description: 'Tell us about yourself...',
    input: {
      textLong: {
        submit: async (input) => (await japi(
          'patch',
          '/onboardee-info',
          { about: input }
        )).ok,
        invalidMsg: "Gotta write something",
      }
    }
  },
  {
    title: "You’re Looking Like A Snack 😋",
    description: "",
    input: {
      none: {
        description: "You’re ready to go! You can always sweeten your profile even more once you’re signed in...",
        submit: async () => {
          const _sessionToken = await sessionToken();
          const response = await japi('post', '/finish-onboarding');
          if (response.ok) {
            setSignedInUser((signedInUser) => ({
              sessionToken: _sessionToken ?? '',
              ...signedInUser,
              personId: response?.json?.person_id,
              units: response?.json?.units === 'Imperial' ? 'Imperial' : 'Metric',
            }));
          };
          return response.ok;
        }
      }
    }
  },
];

const searchTwoWayBasicsOptionGroups: OptionGroup<OptionGroupInputs>[] = [
  {
    ...yourPartnersGenderOptionGroup,
    title: "Gender",
    Icon: () => (
      <FontAwesomeIcon
        icon={faVenusMars}
        size={14}
        style={{color: 'black'}}
      />
    ),
    description: "Which genders would you like to see in search results?",
    input: {
      checkChips: {
        values: [
          ...yourPartnersGenderOptionGroup.input.checkChips.values,
        ],
        submit: async function(gender: string[]) {
          const ok = (await japi('post', '/search-filter', { gender })).ok;
          if (ok) {
            this.values = newCheckChipValues(this.values, gender);
          }
          return ok;
        }
      }
    },
  },
  {
    title: "Furthest Distance",
    Icon: () => (
      <FontAwesomeIcon
        icon={faLocationDot}
        size={14}
        style={{color: 'black'}}
      />
    ),
    description: "How far away can people be?",
    input: {
      slider: {
        sliderMin: 5,
        sliderMax: 10000,
        defaultValue: 10000,
        step: 1,
        unitsLabel: 'km',
        addPlusAtMax: true,
        submit: async function(furthestDistance: number | null) {
          const ok = (
            await japi(
              'post',
              '/search-filter',
              { furthest_distance: furthestDistance }
            )
          ).ok;
          if (ok) this.currentValue = furthestDistance;
          return ok;
        },
      },
    },
  },
  {
    title: "Age",
    Icon: () => (
      <FontAwesomeIcon
        icon={faCalendar}
        size={14}
        style={{color: 'black'}}
      />
    ),
    description: "What ages would you like to see in search results?",
    input: {
      rangeSlider: {
        sliderMin: 18,
        sliderMax: 99,
        unitsLabel: 'years',
        submit: async function(sliderMin: number | null, sliderMax: number | null) {
          const ok = (
            await japi(
              'post',
              '/search-filter',
              {
                age: {
                  min_age: sliderMin,
                  max_age: sliderMax,
                }
              }
            )
          ).ok;
          if (ok) {
            this.currentMin = sliderMin;
            this.currentMax = sliderMax;
          }
          return ok;
        },
      }
    },
  },
];

const searchOtherBasicsOptionGroups: OptionGroup<OptionGroupInputs>[] = [
  {
    title: "Orientation",
    Icon: () => <Ionicons style={{fontSize: 16 }} name="person" />,
    description: "Which orientations would you like to see in search results?",
    input: {
      checkChips: {
        values: [
          ...orientations.map((x) => ({checked: true, label: x})),
          {checked: true, label: 'Unanswered'},
        ],
        submit: async function(orientation: string[]) {
          const ok = (await japi('post', '/search-filter', { orientation })).ok;
          if (ok) {
            this.values = newCheckChipValues(this.values, orientation);
          }
          return ok;
        }
      }
    },
  },
  {
    title: "Height",
    Icon: () => (
      <FontAwesomeIcon
        icon={faRulerVertical}
        size={14}
        style={{color: 'black'}}
      />
    ),
    description: "What heights of people would you like to see in search results?",
    input: {
      rangeSlider: {
        sliderMin: 50,
        sliderMax: 220,
        unitsLabel: 'cm',
        submit: async function(sliderMin: number | null, sliderMax: number | null) {
          const ok = (
            await japi(
              'post',
              '/search-filter',
              {
                height: {
                  min_height_cm: sliderMin,
                  max_height_cm: sliderMax,
                }
              }
            )
          ).ok;
          if (ok) {
            this.currentMin = sliderMin;
            this.currentMax = sliderMax;
          }
          return ok;
        },
      },
    },
  },
  {
    title: "Has a Profile Picture",
    Icon: () => (
      <FontAwesomeIcon
        icon={faImage}
        size={14}
        style={{color: 'black'}}
      />
    ),
    description: "Do you want to see people who have a profile picture? Selecting ‘Yes’ and ‘No’ includes everyone, though people who have pictures will be shown first.",
    input: {
      checkChips: {
        values: [
          ...yesNo.map((x) => ({checked: true, label: x})),
        ],
        submit: async function(hasAProfilePicture: string[]) {
          const ok = (await japi(
            'post',
            '/search-filter',
            { has_a_profile_picture: hasAProfilePicture }
          )).ok;
          if (ok) {
            this.values = newCheckChipValues(this.values, hasAProfilePicture);
          }
          return ok;
        }
      }
    },
  },
  {
    title: "Looking For",
    Icon: () => <Ionicons style={{fontSize: 16 }} name="eye" />,
    description: "What kind of relationships would you like people in search results to be seeking?",
    input: {
      checkChips: {
        values: [
          ...lookingFor.map((x) => ({checked: true, label: x})),
          {checked: true, label: 'Unanswered'},
        ],
        submit: async function(lookingFor: string[]) {
          const ok = (await japi(
            'post',
            '/search-filter',
            { looking_for: lookingFor }
          )).ok;
          if (ok) {
            this.values = newCheckChipValues(this.values, lookingFor);
          }
          return ok;
        }
      }
    },
  },
  {
    title: "Smoking",
    Icon: () => (
      <FontAwesomeIcon
        icon={faSmoking}
        size={14}
        style={{color: 'black'}}
      />
    ),
    description: "Do you want to include people who smoke in search results?",
    input: {
      checkChips: {
        values: [
          ...yesNo.map((x) => ({checked: true, label: x})),
          {checked: true, label: 'Unanswered'}
        ],
        submit: async function(smoking: string[]) {
          const ok = (await japi(
            'post',
            '/search-filter',
            { smoking }
          )).ok;
          if (ok) {
            this.values = newCheckChipValues(this.values, smoking);
          }
          return ok;
        }
      }
    },
  },
  {
    title: "Drinking",
    Icon: () => <Ionicons style={{fontSize: 16 }} name="wine" />,
    description: "Do you want to include people who drink alcohol in search results?",
    input: {
      checkChips: {
        values: [
          ...frequency.map((x) => ({checked: true, label: x})),
          {checked: true, label: 'Unanswered'}
        ],
        submit: async function(drinking: string[]) {
          const ok = (await japi(
            'post',
            '/search-filter',
            { drinking }
          )).ok;
          if (ok) {
            this.values = newCheckChipValues(this.values, drinking);
          }
          return ok;
        }
      }
    },
  },
  {
    title: "Drugs",
    Icon: () => (
      <FontAwesomeIcon
        icon={faPills}
        size={14}
        style={{color: 'black'}}
      />
    ),
    description: "Do you want to include people who take drugs in search results?",
    input: {
      checkChips: {
        values: [
          ...yesNo.map((x) => ({checked: true, label: x})),
          {checked: true, label: 'Unanswered'}
        ],
        submit: async function(drugs: string[]) {
          const ok = (await japi(
            'post',
            '/search-filter',
            { drugs }
          )).ok;
          if (ok) {
            this.values = newCheckChipValues(this.values, drugs);
          }
          return ok;
        }
      }
    },
  },
  {
    title: "Long Distance",
    Icon: () => <Ionicons style={{fontSize: 16 }} name="globe" />,
    description: "Do you want search results to include people willing to enter a long-distance relationship?",
    input: {
      checkChips: {
        values: [
          ...yesNo.map((x) => ({checked: true, label: x})),
          {checked: true, label: 'Unanswered'}
        ],
        submit: async function(longDistance: string[]) {
          const ok = (await japi(
            'post',
            '/search-filter',
            { long_distance: longDistance }
          )).ok;
          if (ok) {
            this.values = newCheckChipValues(this.values, longDistance);
          }
          return ok;
        }
      }
    },
  },
  {
    title: "Relationship Status",
    Icon: () => <Ionicons style={{fontSize: 16 }} name="heart" />,
    description: "What relationship statuses are you willing to accept from people in your search results?",
    input: {
      checkChips: {
        values: [
          ...relationshipStatus.map((x) => ({checked: true, label: x})),
          {checked: true, label: 'Unanswered'},
        ],
        submit: async function(relationshipStatus: string[]) {
          const ok = (await japi(
            'post',
            '/search-filter',
            { relationship_status: relationshipStatus }
          )).ok;
          if (ok) {
            this.values = newCheckChipValues(this.values, relationshipStatus);
          }
          return ok;
        }
      }
    },
  },
  {
    title: "Has Kids",
    Icon: () => <Ionicons style={{fontSize: 16 }} name="people" />,
    description: "Do you want search results to include people who had kids?",
    input: {
      checkChips: {
        values: [
          ...yesNo.map((x) => ({checked: true, label: x})),
          {checked: true, label: 'Unanswered'}
        ],
        submit: async function(hasKids: string[]) {
          const ok = (await japi(
            'post',
            '/search-filter',
            { has_kids: hasKids }
          )).ok;
          if (ok) {
            this.values = newCheckChipValues(this.values, hasKids);
          }
          return ok;
        }
      }
    },
  },
  {
    title: "Wants Kids",
    Icon: () => <Ionicons style={{fontSize: 16 }} name="people" />,
    description: "Do you want search results to include people who want kids?",
    input: {
      checkChips: {
        values: [
          ...yesNo.map((x) => ({checked: true, label: x})),
          {checked: true, label: 'Unanswered'}
        ],
        submit: async function(wantsKids: string[]) {
          const ok = (await japi(
            'post',
            '/search-filter',
            { wants_kids: wantsKids }
          )).ok;
          if (ok) {
            this.values = newCheckChipValues(this.values, wantsKids);
          }
          return ok;
        }
      }
    },
  },
  {
    title: "Exercise",
    Icon: () => <Ionicons style={{fontSize: 16 }} name="barbell" />,
    description: "Do you want search results to include people who exercise?",
    input: {
      checkChips: {
        values: [
          ...frequency.map((x) => ({checked: true, label: x})),
          {checked: true, label: 'Unanswered'},
        ],
        submit: async function(exercise: string[]) {
          const ok = (await japi(
            'post',
            '/search-filter',
            { exercise }
          )).ok;
          if (ok) {
            this.values = newCheckChipValues(this.values, exercise);
          }
          return ok;
        }
      }
    },
  },
  {
    title: "Religion",
    Icon: () => (
      <FontAwesomeIcon
        icon={faHandsPraying}
        size={14}
        style={{color: 'black'}}
      />
    ),
    description: "Do you want search results to include people who exercise?",
    input: {
      checkChips: {
      values: [
          ...religions.map((x) => ({checked: true, label: x})),
          {checked: true, label: 'Unanswered'},
        ],
        submit: async function(religion: string[]) {
          const ok = (await japi(
            'post',
            '/search-filter',
            { religion }
          )).ok;
          if (ok) {
            this.values = newCheckChipValues(this.values, religion);
          }
          return ok;
        }
      }
    },
  },
  {
    title: "Star Sign",
    Icon: () => <Ionicons style={{fontSize: 16 }} name="star" />,
    description: "What star signs would you like to see in search results?",
    input: {
      checkChips: {
        values: [
          ...starSigns.map((x) => ({checked: true, label: x})),
          {checked: true, label: 'Unanswered'},
        ],
        submit: async function(starSign: string[]) {
          const ok = (await japi(
            'post',
            '/search-filter',
            { star_sign: starSign }
          )).ok;
          if (ok) {
            this.values = newCheckChipValues(this.values, starSign);
          }
          return ok;
        }
      }
    },
  },
];

const searchInteractionsOptionGroups: OptionGroup<OptionGroupInputs>[] = [
  {
    title: "People You Messaged",
    Icon: () => (
      <FontAwesomeIcon
        icon={faPaperPlane}
        size={14}
        style={{color: 'black'}}
      />
    ),
    description: "Would you like search results to include people you already messaged?",
    input: {
      buttons: {
        values: yesNo,
        submit: async function(peopleMessaged: string) {
          const ok = (await japi(
            'post',
            '/search-filter',
            { people_you_messaged: peopleMessaged }
          )).ok;
          if (ok) this.currentValue = peopleMessaged;
          return ok;
        }
      }
    },
  },
  {
    title: "People You Skipped",
    Icon: () => (
      <X
        stroke="black"
        strokeWidth={4}
        height={14}
        width={14}
      />
    ),
    description: "Would you like search results to include people you skipped?",
    input: {
      buttons: {
        values: yesNo,
        submit: async function(peopleSkipped: string) {
          const ok = (await japi(
            'post',
            '/search-filter',
            { people_you_skipped: peopleSkipped }
          )).ok;
          if (ok) this.currentValue = peopleSkipped;
          return ok;
        }
      }
    },
  },
];

const hideMeFromStrangersOptionGroup: OptionGroup<OptionGroupInputs> = {
  title: 'Hide Me From Strangers',
  Icon: () => (
    <Ionicons
      style={{
        transform: [ { scaleX: -1 } ],
        fontSize: 16,
      }}
      name="chatbubble"
    />
  ),
  description: "With this option set to ‘Yes’, people won’t see you anywhere in Duolicious until you message them first.",
  input: {
    buttons: {
      values: yesNo,
      submit: async function(hideMeFromStrangers: string) {
        const ok = (
          await japi(
            'patch',
            '/profile-info',
            { hide_me_from_strangers: hideMeFromStrangers }
          )
        ).ok;
        if (ok) this.currentValue = hideMeFromStrangers;
        return ok;
      },
    }
  },
};

const privacySettingsOptionGroups: OptionGroup<OptionGroupInputs>[] = [
  {
    title: 'Show My Location',
    Icon: () => (
      <FontAwesomeIcon
        icon={faLocationDot}
        size={14}
        style={{color: 'black'}}
      />
    ),
    description: "Would you like your location to appear on your profile? Note that if you set this option to ‘No’, other people will still be able to filter your profile by distance when searching.",
    input: {
      buttons: {
        values: yesNo,
        submit: async function(showMyLocation: string) {
          const ok = (
            await japi(
              'patch',
              '/profile-info',
              { show_my_location: showMyLocation }
            )
          ).ok;
          if (ok) this.currentValue = showMyLocation;
          return ok;
        },
      }
    },
  },
  {
    title: 'Show My Age',
    Icon: () => (
      <FontAwesomeIcon
        icon={faCalendar}
        size={14}
        style={{color: 'black'}}
      />
    ),
    description: "Would you like your age to appear on your profile? Note that if you set this option to ‘No’, other people will still be able to filter your profile by age when searching.",
    input: {
      buttons: {
        values: yesNo,
        submit: async function(showMyAge: string) {
          const ok = (
            await japi(
              'patch',
              '/profile-info',
              { show_my_age: showMyAge }
            )
          ).ok;
          if (ok) this.currentValue = showMyAge;
          return ok;
        },
      }
    },
  },
  hideMeFromStrangersOptionGroup,
];

export {
  OptionGroup,
  OptionGroupButtons,
  OptionGroupCheckChips,
  OptionGroupDate,
  OptionGroupGivenName,
  OptionGroupInputs,
  OptionGroupLocationSelector,
  OptionGroupNone,
  OptionGroupOtp,
  OptionGroupPhotos,
  OptionGroupRangeSlider,
  OptionGroupSlider,
  OptionGroupTextLong,
  OptionGroupTextShort,
  basicsOptionGroups,
  createAccountOptionGroups,
  deactivationOptionGroups,
  deletionOptionGroups,
  generalSettingsOptionGroups,
  getCurrentValue,
  hideMeFromStrangersOptionGroup,
  isOptionGroupButtons,
  isOptionGroupCheckChips,
  isOptionGroupDate,
  isOptionGroupGivenName,
  isOptionGroupLocationSelector,
  isOptionGroupNone,
  isOptionGroupOtp,
  isOptionGroupPhotos,
  isOptionGroupRangeSlider,
  isOptionGroupSlider,
  isOptionGroupTextLong,
  isOptionGroupTextShort,
  notificationSettingsOptionGroups,
  privacySettingsOptionGroups,
  searchTwoWayBasicsOptionGroups,
  searchOtherBasicsOptionGroups,
  searchInteractionsOptionGroups,
};
