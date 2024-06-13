import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  View,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ButtonForOption } from './button/option';
import { DuoliciousTopNavBar } from './top-nav-bar';
import { OptionScreen } from './option-screen';
import { Title } from './title';
import { DefaultLongTextInput } from './default-long-text-input';
import { Notice } from './notice';
import {
  OptionGroup,
  OptionGroupInputs,
  OptionGroupPhotos,
  basicsOptionGroups,
  deactivationOptionGroups,
  deletionOptionGroups,
  generalSettingsOptionGroups,
  getCurrentValue,
  isOptionGroupButtons,
  isOptionGroupLocationSelector,
  isOptionGroupSlider,
  isOptionGroupTextShort,
  notificationSettingsOptionGroups,
  privacySettingsOptionGroups,
  verificationOptionGroups,
} from '../data/option-groups';
import { Images } from './images';
import { DefaultText } from './default-text';
import { sessionToken } from '../kv-storage/session-token';
import { api, japi } from '../api/api';
import { signedInUser, setSignedInUser } from '../App';
import { cmToFeetInchesStr } from '../units/units';
import {
  IMAGES_URL,
} from '../env/env';
import * as _ from "lodash";
import debounce from 'lodash/debounce';
import { aboutQueue } from '../api/queue';
import { ClubItem, ClubSelector } from './club-selector';
import { listen } from '../events/events';
import { ButtonWithCenteredText } from './button/centered-text';
import Ionicons from '@expo/vector-icons/Ionicons';
import { logout } from '../xmpp/xmpp';
import { DetailedVerificationBadges } from './verification-badge';
import {
  VerificationEvent,
} from '../verification/verification';


const formatHeight = (og: OptionGroup<OptionGroupInputs>): string | undefined => {
  if (!isOptionGroupSlider(og.input)) return '';

  const currentValue = getCurrentValue(og.input);

  if (_.isNumber(currentValue)) {
    return signedInUser?.units === 'Imperial' ?
      cmToFeetInchesStr(currentValue) :
      `${currentValue} cm`;
  }
};

const Stack = createNativeStackNavigator();

const ProfileTab = ({navigation}) => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Profile Tab" component={ProfileTab_} />
      <Stack.Screen name="Profile Option Screen" component={OptionScreen} />
      <Stack.Screen name="Club Selector" component={ClubSelector} />
    </Stack.Navigator>
  );
};

const Images_ = ({data}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isInvalid, setIsInvalid] = useState(false);
  const input: OptionGroupPhotos = useMemo(() => {
    return {
      photos: {
        submit: async (position, cropperOutput) => (await japi(
          'patch',
          '/profile-info',
          {
            base64_file: {
              position,
              base64: cropperOutput.originalBase64,
              top: cropperOutput.top,
              left: cropperOutput.left,
            },
          },
          2 * 60 * 1000 // 2 minutes
        )).ok,
        delete: async (filename) => (await japi(
          'delete',
          '/profile-info',
          { files: [filename] }
        )).ok,
        getUri: (position: string, resolution: string) => {
          const imageUuid = (data?.photo ?? {})[position] ?? null;
          if (imageUuid) {
            return `${IMAGES_URL}/${resolution}-${imageUuid}.jpg`
          } else {
            return null;
          }
        },
        getBlurhash: (position: string) => {
          const imageBlurhash = (data?.photo_blurhash ?? {})[position] ?? null;
          if (imageBlurhash) {
            return imageBlurhash;
          } else {
            return null;
          }
        },
      }
    };
  }, [data]);

  return <Images
    input={input}
    setIsLoading={setIsLoading}
    setIsInvalid={setIsInvalid} />
};

const ProfileTab_ = ({navigation}) => {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const response = await api('get', '/profile-info');
      if (response.json) {
        setData(response.json);
      }
    })();
  }, []);

  return (
    <SafeAreaView style={styles.safeAreaView}>
      <DuoliciousTopNavBar/>
      {data &&
        <ScrollView
          contentContainerStyle={{
            paddingLeft: 10,
            paddingRight: 10,
            paddingBottom: 20,
            maxWidth: 600,
            width: '100%',
            alignSelf: 'center',
          }}
        >
          <Title>Profile Pictures</Title>
          <Images_ data={data}/>
          <AboutPerson navigation={navigation} data={data}/>
          <Options navigation={navigation} data={data}/>
          <AboutDuolicious/>
        </ScrollView>
      }
      {!data &&
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
    </SafeAreaView>
  );
};

const enqueueAbout = async (about: string, cb: (ok: boolean) => void) => {
  aboutQueue.addTask(
    async () => {
      const response = await japi('patch', '/profile-info', { about });
      cb(response.ok);
    }
  );
};

const AboutPerson = ({navigation, data}) => {
  const [aboutState, setAboutState] = useState<
    'unchanged' | 'saving...' | 'saved' | 'error'
  >('unchanged');

  const debouncedOnChangeAboutText = useCallback(
    debounce(enqueueAbout, 1000),
    []
  );

  const onChangeAboutText = useCallback(async (about: string) => {
    setAboutState('saving...');
    await debouncedOnChangeAboutText(
      about,
      (ok) => setAboutState(ok ? 'saved' : 'error'),
    );
  }, []);

  const style = Platform.OS === 'ios' ? {style: {height: 200}} : null;

  return (
    <View>
      <Title>
        About {data.name} {}
        {aboutState !== 'unchanged' &&
          <DefaultText
            style={{
              fontSize: 14,
              fontWeight: '400',
              color: '#777',
            }}
          >
            ({aboutState})
          </DefaultText>
        }
      </Title>
      <DefaultLongTextInput
        defaultValue={data?.about ?? ''}
        onChangeText={onChangeAboutText}
        numberOfLines={8}
        {...style}
      />
    </View>
  );
};

const Options = ({ navigation, data }) => {
  const [, triggerRender] = useState({});
  const [isLoadingSignOut, setIsLoadingSignOut] = useState(false);

  const addCurrentValue = (optionGroups: OptionGroup<OptionGroupInputs>[]) =>
    optionGroups.map(
      (
        og: OptionGroup<OptionGroupInputs>,
        i: number
      ): OptionGroup<OptionGroupInputs> =>
        _.merge(
          {},
          og,
          isOptionGroupTextShort(og.input) ? {
            input: {
              textShort: {
                currentValue: (data ?? {})[optionGroups[i].title.toLowerCase()]
              }
            }
          } : {},
          isOptionGroupButtons(og.input) ? {
            input: {
              buttons: {
                currentValue: (data ?? {})[optionGroups[i].title.toLowerCase()]
              }
            }
          } : {},
          isOptionGroupLocationSelector(og.input) ? {
            input: {
              locationSelector: {
                currentValue: (data ?? {})[optionGroups[i].title.toLowerCase()]
              }
            }
          } : {},
          isOptionGroupSlider(og.input) && og.title === 'Height' ? {
            input: {
              slider: {
                currentValue: (data ?? {})[optionGroups[i].title.toLowerCase()]
              }
            }
          } : {},
        )
    );

  const [
    _basicsOptionGroups,
    _generalSettingsOptionGroups,
    _notificationSettingsOptionGroups,
    _privacySettingsOptionGroups,
  ] = useMemo(
    () => [
      addCurrentValue(basicsOptionGroups),
      addCurrentValue(generalSettingsOptionGroups),
      addCurrentValue(notificationSettingsOptionGroups),
      addCurrentValue(privacySettingsOptionGroups),
    ],
    [data]
  );

  useEffect(() => {
    _basicsOptionGroups.forEach((og: OptionGroup<OptionGroupInputs>) => {
      if (isOptionGroupSlider(og.input) && og.title === 'Height') {
        og.input.slider.unitsLabel = (
          signedInUser?.units === 'Imperial' ?
          "ft'in\"" : 'cm');

        og.input.slider.valueRewriter = (
          signedInUser?.units === 'Imperial' ?
          cmToFeetInchesStr : undefined);
      }
    });
  }, [_basicsOptionGroups, signedInUser?.units]);

  useEffect(() => {
    return listen(
      'updated-clubs',
      (newClubs: any) => {
        if (data) {
          data['clubs'] = newClubs;
          triggerRender({});
        }
      },
    );
  }, [data]);

  const onSubmitSuccess = useCallback(() => {
    triggerRender({});
  }, [triggerRender]);

  useEffect(() => {
    return listen<VerificationEvent>(
      'updated-verification',
      (v) => {
        if (!v)
          return;

        if (v.photos !== undefined)
          data.photo_verification = {
            ...data.photo_verification,
            ...v.photos,
          };

        if (v.gender !== undefined)
          data.verified_gender = v.gender;

        if (v.age !== undefined)
          data.verified_age = v.age;

        if (v.ethnicity !== undefined)
          data.verified_ethnicity = v.ethnicity;

        triggerRender({});
      }
    );
  }, [triggerRender, data]);

  const Button_ = useCallback((props) => {
    return <ButtonForOption
      navigation={navigation}
      navigationScreen="Profile Option Screen"
      onSubmitSuccess={onSubmitSuccess}
      {...props}
    />;
  }, [navigation]);

  const signOut = useCallback(async () => {
    setIsLoadingSignOut(true);
    await logout();
    if ((await api('post', '/sign-out')).ok) {
      await sessionToken(null);
      setSignedInUser(undefined);
    }
    setIsLoadingSignOut(false);
  }, []);

  const goToClubSelector = useCallback(() => {
    navigation.navigate(
      "Club Selector",
      { selectedClubs: data["clubs"] },
    );
  }, [navigation]);

  const clubsSetting = (() => {
    if (data?.clubs?.length === undefined) return undefined;
    if (data.clubs.length === 0) return undefined;
    return data.clubs.map((clubItem: ClubItem) => clubItem.name).join(', ')
  })();

  const isCompletelyVerified = (
    Object.values(data?.photo_verification ?? {}).every(Boolean) &&
    (data?.verified_gender ?? false) &&
    (data?.verified_age ?? false) &&
    (data?.verified_ethnicity ?? false)
  );

  return (
    <View>
      <Title>Verification (Beta)</Title>
      <DetailedVerificationBadges
        photos={Object.values(data?.photo_verification ?? {}).some(Boolean)}
        gender={data?.verified_gender ?? false}
        age={data?.verified_age ?? false}
        ethnicity={data?.verified_ethnicity ?? false}
        style={{ marginBottom: 10 }}
      />
      {!isCompletelyVerified &&
        <Button_
          setting=""
          optionGroups={verificationOptionGroups}
          showSkipButton={false}
          theme="light"
        />
      }

      <Title>Basics</Title>
      {
        _basicsOptionGroups.map((og, i) =>
          <Button_
            key={i}
            setting={
              og.title === 'Height' ?
                formatHeight(og) :
                getCurrentValue(_basicsOptionGroups[i].input)
            }
            optionGroups={_basicsOptionGroups.slice(i)}
          />
        )
      }
      <Title>Clubs</Title>
      <ButtonForOption
        onPress={goToClubSelector}
        label="Clubs"
        setting={clubsSetting}
        noSettingText="None"
      />
      <DefaultText
        style={{
          color: '#999',
          textAlign: 'center',
          marginLeft:  10,
          marginRight: 10,
        }}
      >
        When you join a club, mutual members will be shown to you first in
        search results
      </DefaultText>

      <ButtonWithCenteredText
        onPress={() => navigation.navigate(
          'Prospect Profile Screen',
          {
            screen: 'Prospect Profile',
            params: {
              personId:  signedInUser?.personId,
              personUuid:  signedInUser?.personUuid,
              showBottomButtons: false
            },
          }
        )}
        containerStyle={{
          marginTop: 30,
        }}
        extraChildren={
         <View style={{
           position: 'absolute',
           top: 0,
           right: 15,
           height: '100%',
           justifyContent: 'center',
           }}>
          <Ionicons style={{
              fontSize: 20,
              color: 'white',
          }} name="chevron-forward"/>
        </View>
        }
      >
        Preview Your Profile
      </ButtonWithCenteredText>

      <Title style={{ marginTop: 70 }}>Notification Settings</Title>
      {
        _notificationSettingsOptionGroups.map((og, i) =>
          <Button_
            key={i}
            setting={getCurrentValue(og.input)}
            optionGroups={_notificationSettingsOptionGroups.slice(i)}
          />
        )
      }
      <Title>Privacy Settings</Title>
      {
        _privacySettingsOptionGroups.map((og, i) =>
          <Button_
            key={i}
            setting={getCurrentValue(og.input)}
            optionGroups={_privacySettingsOptionGroups.slice(i)}
          />
        )
      }
      <Title>General Settings</Title>
      {
        _generalSettingsOptionGroups.map((og, i) =>
          <Button_
            key={i}
            setting={getCurrentValue(og.input)}
            optionGroups={_generalSettingsOptionGroups.slice(i)}
          />
        )
      }

      <MaybeDonate/>

      <Title style={{ marginTop: 70 }}>Sign Out</Title>
      <ButtonForOption
        onPress={signOut}
        label="Sign Out"
        setting=""
        loading={isLoadingSignOut}
      />

      <Title style={{ marginTop: 70 }}>Deactivate My Account</Title>
      <Button_ optionGroups={deactivationOptionGroups} setting="" showSkipButton={false}/>

      <Title>Delete My Account</Title>
      <Button_ optionGroups={deletionOptionGroups} setting=""/>
    </View>
  );
};

const MaybeDonate = () => {
  const isWeb = Platform.OS === 'web';

  const goToDonationPage = useCallback(
    () => Linking.openURL('https://ko-fi.com/duolicious'),
    [],
  );

  return (
    <Notice
      onPress={isWeb ? goToDonationPage : undefined}
      style={{
        marginLeft: 0,
        marginRight: 0,
        marginTop: 70,
        flexDirection: 'column',

      }}
    >
      <DefaultText
        style={{
          color: '#70f',
          fontWeight: '700',
          fontSize: 18,
          marginBottom: 10,
        }}
      >
        Support Duolicious{'\u00A0'}🙏
      </DefaultText>
      {isWeb &&
        <>
          <DefaultText
            style={{
              color: '#70f',
              textAlign: 'center',
            }}
          >
            If Duolicious helped you find love, consider donating via our Ko-fi
            page:
            {'\n'}

            <DefaultText
              style={{
                fontWeight: '700',
              }}
            >
              https://ko-fi.com/duolicious
            </DefaultText>
          </DefaultText>
          <DefaultText
            style={{
              color: '#70f',
              textAlign: 'center',
            }}
          >
            {'\n'}
            If you can’t donate but still want to help, tell your friends and
            share on social media!
            Over 90% of our users found Duolicious through friends, not ads.
          </DefaultText>
        </>
      }
      {!isWeb &&
        <>
          <DefaultText
            style={{
              color: '#70f',
              textAlign: 'center',
            }}
          >
            If Duolicious helped you find love, support us by telling your
            friends and sharing on social media!
            {'\n\n'}
            We’re free thanks to members like you. Over 90% of our users found
            us through friends, not ads.
          </DefaultText>
        </>
      }
    </Notice>
  );
};

const AboutDuolicious = () => {
  return (
    <View
      style={{
        marginBottom: 60,
      }}
    >
      <Title style={{
        marginTop: 60,
        textAlign: 'center',
        color: '#999'
      }}>
        About
      </Title>
      <DefaultText
        onPress={() => Linking.openURL('https://github.com/duolicious')}
        style={{
          textAlign: 'center',
          color: '#999',
        }}
      >
        Duolicious is free software licensed under the AGPLv3. The source code
        used to make Duolicious is available {}
        <DefaultText style={{fontWeight: '600', color: '#37f'}}>
          here
        </DefaultText>
        .
      </DefaultText>
      <DefaultText
        onPress={() => Linking.openURL('mailto:support@duolicious.app')}
        style={{
          marginTop: 25,
          textAlign: 'center',
          color: '#999',
        }}
      >
        You can contact us at {}
        <DefaultText style={{fontWeight: '600', color: '#37f'}}>
          support@duolicious.app
        </DefaultText>
        {} to provide feedback, report abuse, or submit any other concerns or
        queries you have.
      </DefaultText>
    </View>
  );
};

const styles = StyleSheet.create({
  safeAreaView: {
    flex: 1,
  }
});

export default ProfileTab;
