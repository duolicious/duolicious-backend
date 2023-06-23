import * as _ from "lodash";
import { mapi, japi } from '../api/api';
import { setAppState } from '../App';

type OptionGroupButtons = {
  buttons: string[],
  submit: (input: string) => Promise<boolean>
  initialSelectedIndex?: number,
};

type OptionGroupVerification = 'verification';

type OptionGroupDeletion = 'deletion';

type OptionGroupLocationSelector = {
  locationSelector: {
    submit: (input: string) => Promise<boolean>
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
  }
};

type OptionGroupTextLong = {
  textLong: {
    submit: (input: string) => Promise<boolean>
    invalidMsg?: string
  }
};

type OptionGroupTextShort = 'text-short';

type OptionGroupOtp = {
  otp: {
    submit: (input: string) => Promise<boolean>
  }
};

type OptionGroupCheckChips = {
  checkChips: {
    label: string
    checked: boolean
  }[],
  submit: (input: string[]) => Promise<boolean>
};

type OptionGroupNone = {
  none: {
    submit: () => Promise<boolean>
  }
};

type OptionGroupSlider = {
  slider: {
    sliderMin: number,
    sliderMax: number,
    sliderInitial: number,
    step: number,
    unitsLabel: string,
    addPlusAtMax?: boolean
  }
};

type OptionGroupRangeSlider = {
  rangeSlider: {
    sliderMin: number,
    sliderMax: number,
    unitsLabel: string,
  }
};

type OptionGroupInputs
  = OptionGroupButtons
  | OptionGroupVerification
  | OptionGroupDeletion
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

type OptionGroup = {
  title: string,
  description: string,
  input?: OptionGroupInputs,
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
  return (x as OptionGroupButtons)?.buttons !== undefined;
}

const isOptionGroupVerification = (x: any): x is OptionGroupVerification => {
  return x === 'verification';
}

const isOptionGroupDeletion = (x: any): x is OptionGroupDeletion => {
  return x === 'deletion';
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
  return x === 'text-short';
}

const isOptionGroupOtp = (x: any): x is OptionGroupOtp => {
  return hasExactKeys(x, ['otp']);
}

const isOptionGroupNone = (x: any): x is OptionGroupNone => {
  return hasExactKeys(x, ['none']);
}

const isOptionGroupCheckChips = (x: any): x is OptionGroupCheckChips => {
  return hasExactKeys(x, ['checkChips', 'submit']);
}

const genders = [
  'Man',
  'Woman',
  'Intersex',
  'Non-binary',
  'Transgender',
  'Trans woman',
  'Trans man',
  'Other',
];

const genderOptionGroup: OptionGroup = {
  title: 'Gender',
  description: "What's your gender?",
  input: {
    buttons: genders,
    submit: async (input) => true
  }
};

const otherPeoplesGendersOptionGroup: OptionGroup = {
  title: "Other People's Genders",
  description: "What are the genders of the people you'd like to meet?",
  input: {
    checkChips: genders.map((g) => ({checked: true, label: g})),
    submit: async (inputs: string[]) => true
  }
};

const locationOptionGroup: OptionGroup = {
  title: 'Location',
  description: "What city do you live in?",
  input: {
    locationSelector: {
      submit: async (input: string) => true
    }
  },
  scrollView: false,
};

const orientationOptionGroup: OptionGroup = {
  title: 'Orientation',
  description: "What's your sexual orientation?",
  input: {
    buttons: [
      'Straight',
      'Gay',
      'Bisexual',
      'Asexual',
      'Demisexual',
      'Pansexual',
      'Other',
    ],
    submit: async (input: string) => true
  },
};

const lookingForOptionGroup: OptionGroup = {
  title: 'Looking for',
  description: 'What are you mainly looking for on Duolicious?',
  input: {
    buttons: [
      'Long-term dating',
      'Short-term dating',
      'Friends',
    ],
    submit: async (input: string) => true
  }
};

// TODO: These should come from a DB or something
const verificationOptionGroups: OptionGroup[] = [
  {
    title: 'Verification',
    description: 'Get verified',
    input: 'verification',
  },
];

const basicsOptionGroups: OptionGroup[] = [
  genderOptionGroup,
  orientationOptionGroup,
  locationOptionGroup,
  {
    title: 'Occupation',
    description: "What's your profession?",
    input: 'text-short',
  },
  {
    title: 'Height',
    description: "How tall are you?",
    input: {
      slider: {
        sliderMin: 50,
        sliderMax: 220,
        step: 1,
        sliderInitial: 170,
        unitsLabel: 'cm',
      },
    },
  },
  lookingForOptionGroup,
  {
    title: 'Smoking',
    description: 'Do you smoke?',
    input: {
      buttons: ['Yes', 'No'],
      submit: async (input: string) => true
    },
  },
  {
    title: 'Drinking',
    description: 'How often do you drink?',
    input: {
      buttons: ['Often', 'Sometimes', 'Never'],
      submit: async (input: string) => true
    },
  },
  {
    title: 'Drugs',
    description: 'Do you do drugs?',
    input: {
      buttons: ['Yes', 'No'],
      submit: async (input: string) => true
    },
  },
  {
    title: 'Long Distance',
    description: 'Are you willing to enter a long-distance relationship?',
    input: {
      buttons: ['Yes', 'No'],
      submit: async (input: string) => true
    },
  },
  {
    title: 'Relationship Status',
    description: "What's your relationship status?",
    input: {
      buttons: [
        'Single',
        'Seeing someone',
        'Engaged',
        'Married',
        'Divorced',
        'Widowed',
        'Other',
      ],
      submit: async (input: string) => true
    }
  },
  {
    title: 'Has Kids',
    description: 'Do you have kids?',
    input: {
      buttons: ['Yes', 'No'],
      submit: async (input: string) => true
    },
  },
  {
    title: 'Wants Kids',
    description: 'Do you want kids?',
    input: {
      buttons: ['Yes', 'No'],
      submit: async (input: string) => true
    },
  },
  {
    title: 'Exercise',
    description: 'How often do you exercise?',
    input: {
      buttons: [
        'Often',
        'Sometimes',
        'Never',
      ],
      submit: async (input: string) => true
    },
  },
  {
    title: 'Religion',
    description: "What's your religion?",
    input: {
      buttons: [
        'Agnostic',
        'Atheist',
        'Buddhist',
        'Christian',
        'Hindu',
        'Jewish',
        'Muslim',
        'Other',
      ],
      submit: async (input: string) => true
    },
  },
  {
    title: 'Star Sign',
    description: "What's your star sign?",
    input: {
      buttons: [
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
      ],
      submit: async (input: string) => true
    },
  },
];

const generalSettingsOptionGroups: OptionGroup[] = [
  {
    title: 'Units',
    description: "Do you use the metric system, or the imperial system?",
    input: {
      buttons: ['Metric', 'Imperial'],
      submit: async (input: string) => true
    }
  },
];

const notificationSettingsOptionGroups: OptionGroup[] = [
  {
    title: 'Chats',
    description: "When do you want to be notified if anyone you're chatting with sends a new message? (\"Daily\" still sends the first notification of the day immediately, but snoozes later notifications so that you get at-most one notification per 24 hours.)",
    input: {
      buttons: [
        'Immediately',
        'Daily',
        'Every 3 Days',
        'Weekly',
        'Never'
      ],
      submit: async (input: string) => true
    }
  },
  {
    title: 'Intros',
    description: "When do you want to be notified if someone you haven't chatted with sends you an intro? (\"Daily\" still sends the first notification of the day immediately, but snoozes later notifications so that you get at-most one notification per 24 hours.)",
    input: {
      buttons: [
        'Immediately',
        'Daily',
        'Every 3 Days',
        'Weekly',
        'Never'
      ],
      submit: async (input: string) => true
    }
  },
  {
    title: 'Visitors',
    description: "When do you want to be notified if someone visits your profile? (\"Daily\" still sends the first notification of the day immediately, but snoozes later notifications so that you get at-most one notification per 24 hours.)",
    input: {
      buttons: [
        'Immediately',
        'Daily',
        'Every 3 Days',
        'Weekly',
        'Never'
      ],
      submit: async (input: string) => true
    }
  },
];

const deletionOptionGroups: OptionGroup[] = [
  {
    title: 'Delete Your Account',
    description: 'Are you sure you want to delete your account? Type "delete" to confirm.',
    input: 'text-short',
  },
];

const deactivationOptionGroups: OptionGroup[] = [
  {
    title: 'Deactivate Your Account',
    description: 'Are you sure you want to deactivate your account? This will hide you from other users and log you out. The next time you sign in, your account will be reactivated. Press "continue" to deactivate your account.',
    input: {
      none: {
        submit: async () => true
      }
    }
  },
];

const createAccountOptionGroups: OptionGroup[] = [
  {
    title: "Password",
    description: "Enter the one-time password you just received to create an account or sign in",
    input: {
      otp: {
        submit: async (input) => {
          const response = await japi('post', '/check-otp', { otp: input });
          if (response?.json?.onboarded) {
            setAppState('signed-in');
          }
          return response.ok;
        }
      }
    },
  },
  {
    title: 'Step 1 of 7: Birth Date',
    description: "When were you born?",
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
      title: 'Step 2 of 7: ' + locationOptionGroup.title,
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
  _.merge(
    {},
    genderOptionGroup,
    {
      title: 'Step 3 of 7: ' + genderOptionGroup.title,
      input: {
        submit: async (input) => (await japi(
          'patch',
          '/onboardee-info',
          { gender: input }
        )).ok
      }
    },
  ),
  _.merge(
    {},
    otherPeoplesGendersOptionGroup,
    {
      title: 'Step 4 of 7: ' + otherPeoplesGendersOptionGroup.title,
      input: {
        submit: async (input) => (await japi(
          'patch',
          '/onboardee-info',
          { other_peoples_genders: input }
        )).ok
      }
    },
  ),
  {
    title: "Step 5 of 7: First Name",
    description: "What's your first name?",
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
    title: 'Step 6 of 7: Photos',
    description: 'Profiles with photos are promoted in search results, but you can add these later.',
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
    title: "Your Profile Looks Delicious! 😋",
    description: "If you want to sweeten it even more, you can always add more info via the \"Profile\" tab, once you've signed in. But for now, you're ready to get started!",
    input: {
      none: {
        submit: async () => {
          const response = await japi('post', '/finish-onboarding');
          if (response.ok) {
            setAppState('signed-in');
          };
          return response.ok;
        }
      }
    }
  },
];

const contactOptionGroups: OptionGroup[] = [
  {
    title: 'Contact Us',
    description: "Our mission at Duolicious is to help its users meet like-minded people. You can help us achieve that by contacting us here to provide feedback, report abuse, or submit any other concerns or queries you have.",
    input: {
      textLong: {
        submit: async () => true
      }
    }
  },
  {
    title: 'Message Sent!',
    description: "Thanks for getting in touch. We'll get back to you as soon as possible.",
    input: {
      none: {
        submit: async () => true
      }
    }
  }
];

const searchBasicsOptionGroups: OptionGroup[] = [
  {
    ...otherPeoplesGendersOptionGroup,
    input: {
      checkChips: [
        ...(
          isOptionGroupCheckChips(otherPeoplesGendersOptionGroup.input) ?
            otherPeoplesGendersOptionGroup.input.checkChips : []),
        {checked: true, label: 'Accept Unanswered'}
      ],
      submit: async (input: string[]) => true
    },
    title: "Gender",
    description: "Which genders would you like to see in search results?",
  },
  {
    title: "Orientation",
    description: "Which orientations would you like to see in search results?",
    input: {
      checkChips: [
        {checked: true, label: 'Straight'},
        {checked: true, label: 'Gay'},
        {checked: true, label: 'Bisexual'},
        {checked: true, label: 'Asexual'},
        {checked: true, label: 'Demisexual'},
        {checked: true, label: 'Pansexual'},
        {checked: true, label: 'Other'},
        {checked: true, label: 'Accept Unanswered'},
      ],
      submit: async (input: string[]) => true
    },
  },
  {
    title: "Age",
    description: "What ages would you like to see in search results?",
    input: {
      rangeSlider: {
        sliderMin: 18,
        sliderMax: 99,
        unitsLabel: 'years',
      }
    },
  },
  {
    title: "Furthest Distance",
    description: "How far away can people be?",
    input: {
      slider: {
        sliderMin: 0,
        sliderMax: 500,
        sliderInitial: 50,
        step: 25,
        unitsLabel: 'km',
        addPlusAtMax: true
      },
    },
  },
  {
    title: "Height",
    description: "What heights of people would you like to see in search results?",
    input: {
      rangeSlider: {
        sliderMin: 50,
        sliderMax: 220,
        unitsLabel: 'cm',
      },
    },
  },
  {
    title: "Verified",
    description: "Do you want people in search results to be verified?",
    input: {
      buttons: ['Yes', 'No'],
      submit: async (input: string) => true
    },
  },
  {
    title: "Has a Profile Picture",
    description: "Do you want people in search results to have a profile picture?",
    input: {
      buttons: ['Yes', 'No'],
      submit: async (input: string) => true
    },
  },
  {
    title: "Looking for",
    description: "What kind of relationships would you like people in search results to be seeking?",
    input: {
      checkChips: [
        {checked: true, label: 'Long-term dating'},
        {checked: true, label: 'Short-term dating'},
        {checked: true, label: 'Friends'},
        {checked: true, label: 'Accept Unanswered'}
      ],
      submit: async (input: string[]) => true
    },
  },
  {
    title: "Smoking",
    description: "Do you want to include people who smoke in search results?",
    input: {
      checkChips: [
        {checked: true, label: 'Yes'},
        {checked: true, label: 'No'},
        {checked: true, label: 'Accept Unanswered'}
      ],
      submit: async (input: string[]) => true
    },
  },
  {
    title: "Drinking",
    description: "Do you want to include people who drink alcohol in search results?",
    input: {
      checkChips: [
        {checked: true, label: 'Often'},
        {checked: true, label: 'Sometimes'},
        {checked: true, label: 'Never'},
        {checked: true, label: 'Accept Unanswered'}
      ],
      submit: async (input: string[]) => true
    },
  },
  {
    title: "Drugs",
    description: "Do you want to include people who take drugs in search results?",
    input: {
      checkChips: [
        {checked: true, label: 'Yes'},
        {checked: true, label: 'No'},
        {checked: true, label: 'Accept Unanswered'}
      ],
      submit: async (input: string[]) => true
    },
  },
  {
    title: "Long Distance",
    description: "Do you want search results to include people willing to enter a long-distance relationship?",
    input: {
      checkChips: [
        {checked: true, label: 'Yes'},
        {checked: true, label: 'No'},
        {checked: true, label: 'Accept Unanswered'}
      ],
      submit: async (input: string[]) => true
    },
  },
  {
    title: "Relationship Status",
    description: "What relationship statuses are you willing to accept from people in your search results?",
    input: {
      checkChips: [
        {checked: true, label: 'Single'},
        {checked: true, label: 'Seeing someone'},
        {checked: true, label: 'Engaged'},
        {checked: true, label: 'Married'},
        {checked: true, label: 'Divorced'},
        {checked: true, label: 'Widowed'},
        {checked: true, label: 'Other'},
        {checked: true, label: 'Accept Unanswered'}
      ],
      submit: async (input: string[]) => true
    },
  },
  {
    title: "Has Kids",
    description: "Do you want search results to include people who had kids?",
    input: {
      checkChips: [
        {checked: true, label: 'Yes'},
        {checked: true, label: 'No'},
        {checked: true, label: 'Accept Unanswered'}
      ],
      submit: async (input: string[]) => true
    },
  },
  {
    title: "Wants Kids",
    description: "Do you want search results to include people who want kids?",
    input: {
      checkChips: [
        {checked: true, label: 'Yes'},
        {checked: true, label: 'No'},
        {checked: true, label: 'Accept Unanswered'}
      ],
      submit: async (input: string[]) => true
    },
  },
  {
    title: "Exercise",
    description: "Do you want search results to include people who exercise?",
    input: {
      checkChips: [
        {checked: true, label: 'Often'},
        {checked: true, label: 'Sometimes'},
        {checked: true, label: 'Never'},
        {checked: true, label: 'Accept Unanswered'},
      ],
      submit: async (input: string[]) => true
    },
  },
  {
    title: "Religion",
    description: "Do you want search results to include people who exercise?",
    input: {
      checkChips: [
        {checked: true, label: 'Agnostic'},
        {checked: true, label: 'Atheist'},
        {checked: true, label: 'Buddhist'},
        {checked: true, label: 'Christian'},
        {checked: true, label: 'Hindu'},
        {checked: true, label: 'Jewish'},
        {checked: true, label: 'Muslim'},
        {checked: true, label: 'Other'},
        {checked: true, label: 'Accept Unanswered'},
      ],
      submit: async (input: string[]) => true
    },
  },
  {
    title: "Star Sign",
    description: "What star signs would you like to see in search results?",
    input: {
      checkChips: [
        {checked: true, label: 'Aquarius'},
        {checked: true, label: 'Aries'},
        {checked: true, label: 'Cancer'},
        {checked: true, label: 'Capricorn'},
        {checked: true, label: 'Gemini'},
        {checked: true, label: 'Leo'},
        {checked: true, label: 'Libra'},
        {checked: true, label: 'Pisces'},
        {checked: true, label: 'Sagittarius'},
        {checked: true, label: 'Scorpio'},
        {checked: true, label: 'Taurus'},
        {checked: true, label: 'Virgo'},
        {checked: true, label: 'Accept Unanswered'},
      ],
      submit: async (input: string[]) => true
    },
  },
];

const searchInteractionsOptionGroups: OptionGroup[] = [
  {
    title: 'Interactions',
    description: "Which profiles would you like to see, based on how you've interacted with them so far?",
    input: {
      checkChips: [
        {checked: true, label: 'Profiles I Already Visited'},
        {checked: false, label: 'Profiles I Hid'},
        {checked: true, label: 'Profiles I Messaged'},
        {checked: true, label: "Profiles I Haven't Interacted With Yet"},
      ],
      submit: async (input: string[]) => true
    },
  },
];

const searchTwoWayFiltersOptionGroups: OptionGroup[] = [
  {
    title: 'Two-Way Filters',
    description: "Would you like your profile to be hidden from others users who are filtered-out by your search settings?",
    input: {
      buttons: ['Yes', 'No'],
      submit: async (input: string) => true
    },
  },
];

const hideMeFromStrangersOptionGroup: OptionGroup = {
  title: 'Hide Me From Strangers',
  description: "If you'd rather be the one who makes the first move, you can show your profile only to people who you've messaged. With this option set to 'Yes', people won't be able to see you anywhere in Duolicious until you message them.",
  input: {
    buttons: ['Yes', 'No'],
    submit: async (input: string) => true
  },
};

const privacySettingsOptionGroups: OptionGroup[] = [
  {
    title: 'Show My Location',
    description: "Would you like your location to appear on your profile? Note that if you set this option to 'No', other people will still be able to filter your profile by distance when searching.",
    input: {
      buttons: ['Yes', 'No'],
      submit: async (input: string) => true
    },
  },
  {
    title: 'Show My Age',
    description: "Would you like your age to appear on your profile? Note that if you set this option to 'No', other people will still be able to filter your profile by age when searching.",
    input: {
      buttons: ['Yes', 'No'],
      submit: async (input: string) => true
    },
  },
  {
    title: 'Private Browsing',
    description: "Would you like others to see when you visit their profile?",
    input: {
      buttons: ['Yes', 'No'],
      submit: async (input: string) => true
    },
  },
  hideMeFromStrangersOptionGroup,
  ...searchTwoWayFiltersOptionGroups,
];

export {
  OptionGroup,
  basicsOptionGroups,
  deactivationOptionGroups,
  deletionOptionGroups,
  isOptionGroupButtons,
  isOptionGroupDate,
  isOptionGroupDeletion,
  isOptionGroupGivenName,
  isOptionGroupLocationSelector,
  isOptionGroupOtp,
  isOptionGroupNone,
  isOptionGroupPhotos,
  isOptionGroupSlider,
  isOptionGroupTextLong,
  isOptionGroupTextShort,
  isOptionGroupVerification,
  isOptionGroupCheckChips,
  isOptionGroupRangeSlider,
  verificationOptionGroups,
  searchBasicsOptionGroups,
  searchInteractionsOptionGroups,
  searchTwoWayFiltersOptionGroups,
  createAccountOptionGroups,
  generalSettingsOptionGroups,
  notificationSettingsOptionGroups,
  privacySettingsOptionGroups,
  contactOptionGroups,
  hideMeFromStrangersOptionGroup,
  OptionGroupOtp,
};
