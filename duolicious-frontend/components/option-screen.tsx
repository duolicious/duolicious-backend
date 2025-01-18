import {
  Animated,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  View,
} from 'react-native';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  Fragment,
} from 'react';
import { ButtonGroup } from '@rneui/themed';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ButtonWithCenteredText } from './button/centered-text';
import { StatusBarSpacer } from './status-bar-spacer';
import { LabelledSlider } from './labelled-slider';
import { RangeSlider as RangeSlider_ } from './range-slider';
import { DefaultText } from './default-text';
import { DefaultTextInput } from './default-text-input';
import { OtpInput } from './otp-input';
import { DatePicker } from './date-picker';
import { LocationSelector as LocationSelector_ } from './location-selector';
import { VerificationBadge } from './verification-badge';
import { VerificationEvent } from '../verification/verification';
import {
  OptionGroup,
  OptionGroupButtons,
  OptionGroupCheckChips,
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
  OptionGroupThemePicker,
  OptionGroupVerificationChecker,
  descriptionStyle,
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
  isOptionGroupThemePicker,
  isOptionGroupVerificationChecker,
  maxDailySelfies,
  noneFontSize,
} from '../data/option-groups';
import {
  MoveableImage,
  SlotMemo,
  useIsImageLoading,
  useUri,
} from './images/images';
import { DefaultLongTextInput } from './default-long-text-input';
import { LinearGradient } from 'expo-linear-gradient';
import { CheckChip as CheckChip_, CheckChips as CheckChips_ } from './check-chip';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons/faArrowLeft'
import { faCaretDown } from '@fortawesome/free-solid-svg-icons/faCaretDown'
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { japi } from '../api/api';
import { delay } from '../util/util';
import { KeyboardDismissingView } from './keyboard-dismissing-view';
import { listen, notify } from '../events/events';
import { Title } from './title';
import { ShowColorPickerEvent } from './color-picker-modal/color-picker-modal';
import { isMobile } from '../util/util';

type InputProps<T extends OptionGroupInputs> = {
  input: T,
  isLoading: boolean
  setIsLoading: any
  onSubmitSuccess: any
  title: string,
  showSkipButton: boolean
  theme?: 'dark' | 'light'
};

const ButtonGroup_ = ({buttons, initialSelectedIndex, ...rest}) => {
  const {onPress} = rest;

  const [selectedIndex, setSelectedIndex] = useState<number>(initialSelectedIndex);

  const onPress_ = (value: number) => {
    setSelectedIndex(value);
    if (onPress !== undefined) {
      onPress(value);
    }
  };

  return <ButtonGroup
    vertical={true}
    buttons={buttons}
    selectedIndex={selectedIndex}
    onPress={onPress_}
    buttonContainerStyle={{
      backgroundColor: 'transparent',
    }}
    selectedButtonStyle={{
      backgroundColor: '#70f',
    }}
    containerStyle={{
      marginTop: 0,
      marginLeft: 20,
      marginRight: 20,
      marginBottom: 0,
      borderWidth: 1,
      borderRadius: 10,
      backgroundColor: 'white',
    }}
    activeOpacity={0}
    innerBorderStyle={{
      width: 1,
      color: '#ddd',
    }}
    textStyle={{
      color: 'black',
      fontFamily: 'MontserratMedium',
    }}
  />;
};

const Buttons = forwardRef((props: InputProps<OptionGroupButtons>, ref) => {
  const inputValueRef = useRef<string>(props.input.buttons.currentValue ?? '');

  const onChangeInputValue = useCallback((index: number) => {
    inputValueRef.current = props.input.buttons.values[index];
  }, []);

  const submit = useCallback(async () => {
    props.setIsLoading(true);

    const ok = await props.input.buttons.submit(inputValueRef?.current);
    ok && props.onSubmitSuccess();

    props.setIsLoading(false);
  }, []);

  useImperativeHandle(ref, () => ({ submit }), []);

  return (
    <>
      <ButtonGroup_
        buttons={props.input.buttons.values}
        initialSelectedIndex={
          props.input.buttons.values.indexOf(inputValueRef.current)
        }
        onPress={onChangeInputValue}
      />
      {props.showSkipButton &&
        <ButtonWithCenteredText
          loading={props.isLoading}
          onPress={submit}
          containerStyle={{
            marginTop: 30,
            marginLeft: 20,
            marginRight: 20,
          }}
        >
          Done
        </ButtonWithCenteredText>
      }
    </>
  );
});

const Slider = forwardRef((props: InputProps<OptionGroupSlider>, ref) => {
  const inputValueRef = useRef<number | null>(
    props.input.slider.currentValue ??
    props.input.slider.defaultValue
  );

  const onChangeInputValue = useCallback((value: number) => {
    inputValueRef.current = value;
  }, []);

  const submit = useCallback(async () => {
    props.setIsLoading(true);

    const value = (
        inputValueRef?.current === props.input.slider.sliderMax &&
        props.input.slider.addPlusAtMax
      ) ?
      null :
      inputValueRef?.current;

    const ok = await props.input.slider.submit(value);
    ok && props.onSubmitSuccess();

    props.setIsLoading(false);
  }, []);

  useImperativeHandle(ref, () => ({ submit }), []);

  return (
    <>
      <LabelledSlider
        label={`${props.title} (${props.input.slider.unitsLabel})`}
        minimumValue={props.input.slider.sliderMin}
        maximumValue={props.input.slider.sliderMax}
        initialValue={inputValueRef.current}
        onValueChange={onChangeInputValue}
        step={props.input.slider.step}
        addPlusAtMax={props.input.slider.addPlusAtMax}
        valueRewriter={props.input.slider.valueRewriter}
        scale={props.input.slider.scale}
        style={{
          marginLeft: 20,
          marginRight: 20,
        }}
      />
      {props.showSkipButton &&
        <ButtonWithCenteredText
          onPress={submit}
          loading={props.isLoading}
          containerStyle={{
            marginTop: 30,
            marginLeft: 20,
            marginRight: 20,
          }}
        >
          Done
        </ButtonWithCenteredText>
      }
    </>
  );
});

const GivenName = forwardRef((props: InputProps<OptionGroupGivenName>, ref) => {
  const [isInvalid, setIsInvalid] = useState(false);
  const inputValueRef = useRef<string>('');

  const onChangeInputValue = useCallback((value: string) => {
    inputValueRef.current = value;
  }, []);

  const submit = useCallback(async () => {
    setIsInvalid(false);
    props.setIsLoading(true);

    const ok = await props.input.givenName.submit(inputValueRef?.current);
    setIsInvalid(!ok);
    ok && props.onSubmitSuccess();

    props.setIsLoading(false);
  }, []);

  useImperativeHandle(ref, () => ({ submit }), []);

  return (
    <>
      <DefaultTextInput
        autoFocus={true}
        placeholder="First name"
        textContentType="givenName"
        autoComplete="name-given"
        onChangeText={onChangeInputValue}
        onSubmitEditing={isMobile() ? undefined : () => submit()}
      />
      <DefaultText
        style={{
          textAlign: 'center',
          color: 'white',
          marginTop: 15,
          opacity: isInvalid ? 1 : 0,
        }}
      >
        That doesn’t look like a real name 🤨
      </DefaultText>
    </>
  );
});

const Otp = forwardRef((props: InputProps<OptionGroupOtp>, ref) => {
  const counterInit = 30;

  const [isLoadingResend, setIsLoadingResend] = useState(false);
  const [isInvalid, setIsInvalid] = useState(false);
  const [counter, setCounter] = useState(counterInit);
  const inputValueRef = useRef<string>('');

  const onChangeInputValue = useCallback((value: string) => {
    inputValueRef.current = value;
  }, []);

  const submit = useCallback(async () => {
    setIsInvalid(false);
    props.setIsLoading(true);

    const ok = await props.input.otp.submit(inputValueRef?.current);
    setIsInvalid(!ok);
    ok && props.onSubmitSuccess();

    props.setIsLoading(false);
  }, []);

  useImperativeHandle(ref, () => ({ submit }), []);

  const resend = useCallback(async () => {
    setIsLoadingResend(true);
    await japi('post', '/resend-otp');
    setCounter(counterInit);
    setIsLoadingResend(false);
  }, []);

  useEffect(() => {
    (async () => {
      if (counter > 0) {
        await delay(1000);
        setCounter(counter - 1);
      }
    })();
  }, [counter]);

  return (
    <>
      <OtpInput codeLength={6} submit={submit}
        onChangeOtp={onChangeInputValue}/>
      <DefaultText
        style={{
          textAlign: 'center',
          color: 'white',
          opacity: isInvalid ? 1 : 0,
        }}
      >
        Incorrect code. Try Again.
      </DefaultText>
      <ButtonWithCenteredText
        containerStyle={{
          marginTop: 10,
          marginLeft: 20,
          marginRight: 20,
        }}
        fontSize={14}
        onPress={(isLoadingResend || counter > 0) ? undefined : resend}
        loading={isLoadingResend}
      >
        {counter >  0 && `${counter}s until you can resend password`}
        {counter <= 0 && `Resend password`}
      </ButtonWithCenteredText>
    </>
  );
});

const LocationSelector = forwardRef((props: InputProps<OptionGroupLocationSelector>, ref) => {
  const [isInvalid, setIsInvalid] = useState(false);
  const inputValueRef = useRef<string>(props.input.locationSelector.currentValue ?? '');

  const onChangeInputValue = useCallback((value: string) => {
    inputValueRef.current = value;
  }, []);

  const submit = useCallback(async () => {
    setIsInvalid(false);
    props.setIsLoading(true);

    const ok = await props.input.locationSelector.submit(inputValueRef?.current);
    setIsInvalid(!ok);
    ok && props.onSubmitSuccess();

    props.setIsLoading(false);
  }, []);

  useImperativeHandle(ref, () => ({ submit }), []);

  return (
    <>
      <LocationSelector_
        onChangeText={onChangeInputValue}
        currentValue={inputValueRef.current}
      />
      <DefaultText
        style={{
          zIndex: -1,
          elevation: -1,
          textAlign: 'center',
          color: 'white',
          marginTop: 5,
          opacity: isInvalid ? 1 : 0,
        }}
      >
        Never heard of it! Try again?
      </DefaultText>
      {props.showSkipButton &&
        <ButtonWithCenteredText
          loading={props.isLoading}
          onPress={submit}
          containerStyle={{
            zIndex: -1,
            elevation: -1,
            marginTop: 30,
            marginLeft: 20,
            marginRight: 20,
          }}
        >
          Done
        </ButtonWithCenteredText>
      }
    </>
  );
});

const Photos = forwardRef((props: InputProps<OptionGroupPhotos>, ref) => {
  const errFileSize = (
    'Something went wrong. Make sure your images are smaller than 10MB and ' +
    '5000x5000 pixels.'
  );
  const errNumber = (
    'We need at least one photo'
  );
  const errRateLimit = (
    'You’re doing that too much'
  );
  const errGeneric = (
    'Something went wrong'
  );

  const showProtip = props.input.photos.showProtip ?? true;
  const validateAtLeastOne = props.input.photos.validateAtLeastOne ?? false;
  const firstFileNumber = props.input.photos.firstFileNumber ?? 1;

  const [isInvalid, setIsInvalid] = useState(false);
  const [lastInvalidReason, setLastInvalidReason] = useState(errFileSize);
  const isLoading = useIsImageLoading(firstFileNumber);
  const uri = useUri(firstFileNumber, null);

  const isNumberInvalid = validateAtLeastOne && uri === null;

  const submit = useCallback(async () => {
    if (props.isLoading) {
      return;
    }

    setIsInvalid(false);
    if (isNumberInvalid) {
      setLastInvalidReason(errNumber);
      setIsInvalid(true);
      return;
    }

    if (!props.input.photos.submitAll) {
      props.onSubmitSuccess();
      return;
    }

    props.setIsLoading(true);

    const { ok, status } = await props.input.photos.submitAll();

    setIsInvalid(!ok);
    if (status === 429) {
      setLastInvalidReason(errRateLimit);
    } else if (!ok) {
      setLastInvalidReason(errGeneric);
    }

    ok && props.onSubmitSuccess();

    props.setIsLoading(false);
  }, [props.isLoading, isNumberInvalid]);

  useImperativeHandle(ref, () => ({ submit }), [submit]);

  const setChildInvalid = useCallback((x: boolean) => {
    setLastInvalidReason(errFileSize);
    setIsInvalid(x);
  }, []);

  useEffect(() => {
    props.setIsLoading(isLoading);
  }, [isLoading]);

  useEffect(() => {
    setIsInvalid(false);
  }, [uri]);

  const errMessage = isNumberInvalid ? errNumber : errFileSize;

  return (
    <View
      style={{
        paddingLeft: 20,
        paddingRight: 20,
        width: '100%',
        alignSelf: 'center',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: '50%',
          aspectRatio: 1,
          alignSelf: 'center',
        }}
      >
        <SlotMemo />
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
          }}
        >
          <MoveableImage
            input={props.input}
            initialFileNumber={firstFileNumber}
            showProtip={showProtip}
            moveable={false}
          />
        </View>
      </View>
      <DefaultText
        style={{
          textAlign: 'center',
          color: props.theme !== 'light' ? 'white' : 'red',
          marginTop: 5,
          opacity: isInvalid ? 1 : 0,
          overflow: 'visible',
          height: 40,
        }}
      >
        {lastInvalidReason}
      </DefaultText>
    </View>
  );
});

const TextLong = forwardRef((props: InputProps<OptionGroupTextLong>, ref) => {
  const [isInvalid, setIsInvalid] = useState(false);

  const inputValueRef = useRef<string>('');

  const onChangeInputValue = useCallback((value: string) => {
    inputValueRef.current = value;
  }, []);

  const submit = useCallback(async () => {
    setIsInvalid(false);
    props.setIsLoading(true);

    const ok = await props.input.textLong.submit(inputValueRef?.current);
    setIsInvalid(!ok);
    ok && props.onSubmitSuccess();

    props.setIsLoading(false);
  }, []);

  useImperativeHandle(ref, () => ({ submit }), []);

  return (
    <>
      <DefaultLongTextInput
        style={{
          marginLeft: 20,
          marginRight: 20,
          ...(Platform.OS === 'ios' ? {height: 200} : {})
        }}
        autoFocus={Platform.OS !== 'ios'}
        onChangeText={onChangeInputValue}
        onSubmitEditing={isMobile() ? undefined : () => submit()}
        numberOfLines={8}
      />
      {props.input?.textLong?.invalidMsg &&
        <DefaultText
          style={{
            marginTop: 5,
            textAlign: 'center',
            color: 'white',
            opacity: isInvalid ? 1 : 0,
          }}
        >
          {props.input?.textLong?.invalidMsg}
        </DefaultText>
      }
    </>
  );
});

const TextShort = forwardRef((props: InputProps<OptionGroupTextShort>, ref) => {
  const [isInvalid, setIsInvalid] = useState(false);

  const inputValueRef = useRef<string>(props.input.textShort.currentValue ?? '');

  const onChangeInputValue = useCallback((value: string) => {
    inputValueRef.current = value;
  }, []);

  const submit = useCallback(async () => {
    setIsInvalid(false);
    props.setIsLoading(true);

    const ok = await props.input.textShort.submit(inputValueRef?.current);
    setIsInvalid(!ok);
    ok && props.onSubmitSuccess();

    props.setIsLoading(false);
  }, []);

  useImperativeHandle(ref, () => ({ submit }), []);

  return (
    <>
      <DefaultTextInput
        style={{
          marginLeft: 20,
          marginRight: 20,
        }}
        defaultValue={inputValueRef.current}
        onChangeText={onChangeInputValue}
        onSubmitEditing={isMobile() ? undefined : () => submit()}
        placeholder="Type here..."
      />
      {props.input?.textShort?.invalidMsg &&
        <DefaultText
          style={{
            marginTop: 5,
            textAlign: 'center',
            color: 'red',
            opacity: isInvalid ? 1 : 0,
          }}
        >
          {props.input?.textShort?.invalidMsg}
        </DefaultText>
      }
      <ButtonWithCenteredText
        loading={props.isLoading}
        onPress={submit}
        containerStyle={{
          marginTop: 15,
          marginLeft: 20,
          marginRight: 20,
        }}
      >
        Done
      </ButtonWithCenteredText>
    </>
  );
});

const CheckChips = forwardRef((props: InputProps<OptionGroupCheckChips>, ref) => {
  const [isInvalid, setIsInvalid] = useState(false);
  const inputValueRef = useRef(new Set<string>(
    props.input.checkChips.values.flatMap(
      (checkChip, i) => checkChip.checked ? [checkChip.label] : []
    )
  ));

  const submit = useCallback(async () => {
    setIsInvalid(false);
    props.setIsLoading(true);

    const ok = await props.input.checkChips.submit([...inputValueRef.current]);
    setIsInvalid(!ok);
    ok && props.onSubmitSuccess();

    props.setIsLoading(false);
  }, []);

  useImperativeHandle(ref, () => ({ submit }), []);

  return (
    <>
      <CheckChips_
        style={{
          marginLeft: 20,
          marginRight: 20,
          alignSelf: 'center',
        }}
      >
        {
          props.input.checkChips.values.map((checkChip, i) =>
            <CheckChip_
              key={i}
              label={checkChip.label}
              initialCheckedState={checkChip.checked}
              onChange={x => {
                if (x) {
                  inputValueRef.current.add(checkChip.label);
                } else {
                  inputValueRef.current.delete(checkChip.label);
                }
              }}
            />
          )
        }
      </CheckChips_>
      <DefaultText
        style={{
          textAlign: 'center',
          color: props.theme === 'light' ? 'red' : 'white',
          opacity: isInvalid ? 1 : 0,
        }}
      >
        You need to select at least one option
      </DefaultText>
      {props.showSkipButton &&
        <ButtonWithCenteredText
          loading={props.isLoading}
          onPress={submit}
          containerStyle={{
            marginTop: 30,
            marginLeft: 20,
            marginRight: 20,
          }}
        >
          Done
        </ButtonWithCenteredText>
      }
    </>
  );
});

const RangeSlider = forwardRef((props: InputProps<OptionGroupRangeSlider>, ref) => {
  const rangeSliderRef = useRef<any>();

  const lowerValueRef = useRef<number | null>(
    props.input.rangeSlider.currentMin ??
    props.input.rangeSlider.sliderMin ??
    null
  );
  const upperValueRef = useRef<number | null>(
    props.input.rangeSlider.currentMax ??
    props.input.rangeSlider.sliderMax ??
    null
  );

  const onLowerValueChange = useCallback((value: number) => {
    lowerValueRef.current = value;
  }, []);
  const onUpperValueChange = useCallback((value: number) => {
    upperValueRef.current = value;
  }, []);

  const submit = useCallback(async () => {
    props.setIsLoading(true);

    const sliderMin = props.input.rangeSlider.sliderMin;
    const sliderMax = props.input.rangeSlider.sliderMax;

    const currentMin = lowerValueRef?.current;
    const currentMax = upperValueRef?.current;

    const minValue = sliderMin === currentMin ? null : currentMin;
    const maxValue = sliderMax === currentMax ? null : currentMax;

    const ok = await props.input.rangeSlider.submit(minValue, maxValue);
    ok && props.onSubmitSuccess();

    props.setIsLoading(false);
  }, []);

  useImperativeHandle(ref, () => ({ submit }), []);

  const onPressReset = useCallback(() => {
    const setValues = rangeSliderRef?.current?.setValues;
    if (setValues) {
      setValues({
        lowerValue: props.input.rangeSlider.sliderMin,
        upperValue: props.input.rangeSlider.sliderMax,
      });
      onLowerValueChange(props.input.rangeSlider.sliderMin);
      onUpperValueChange(props.input.rangeSlider.sliderMax);
    }
  }, []);

  return (
    <>
      <RangeSlider_
        ref={rangeSliderRef}
        initialLowerValue={lowerValueRef.current}
        initialUpperValue={upperValueRef.current}
        unitsLabel={props.input.rangeSlider.unitsLabel}
        minimumValue={props.input.rangeSlider.sliderMin}
        maximumValue={props.input.rangeSlider.sliderMax}
        onLowerValueChange={onLowerValueChange}
        onUpperValueChange={onUpperValueChange}
        valueRewriter={props.input.rangeSlider.valueRewriter}
        scale={props.input.rangeSlider.scale}
        containerStyle={{
          marginLeft: 20,
          marginRight: 20,
        }}
      />
      <ButtonWithCenteredText
        onPress={onPressReset}
        containerStyle={{
          marginTop: 30,
          marginLeft: 20,
          marginRight: 20,
        }}
        secondary={true}
      >
        Reset
      </ButtonWithCenteredText>
    </>
  );
});

const VerificationChecker = forwardRef((props: InputProps<OptionGroupVerificationChecker>, ref) => {
  const [status, setStatus] = useState<
    | 'uploading-photo'
    | 'enqueued'
    | 'running'
    | 'success'
    | 'failure'
  >('uploading-photo');
  const [message, setMessage] = useState('Loading...');
  const [numChecks, setNumChecks] = useState(0);
  const [verifiedThings, setVerifiedThings] = useState<string[]>([]);
  const [unverifiedThings, setUnverifiedThings] = useState<string[]>([]);

  const isDone = status === 'success' || status === 'failure';

  const submit = useCallback(async () => {
    if (isDone) {
      props.onSubmitSuccess();
    }
  }, [isDone]);

  useImperativeHandle(ref, () => ({ submit }), [submit]);

  const onVerificationEvent = useCallback((e?: VerificationEvent) => {
    if (!e) {
      return;
    }

    const status = e.status;
    const message = e.message;

    const gender = e.gender;
    const age = e.age;
    const ethnicity = e.ethnicity;
    const photos = e.photos;

    if (status === undefined) {
      return;
    }
    if (message === undefined) {
      return;
    }

    const hasVerifiedPhotos = Object.values(photos ?? {}).some(Boolean);

    setStatus(status);
    setMessage(message);
    setNumChecks((n) => n + 1);

    const filter = (item): item is string => item !== null;

    setVerifiedThings([
      gender ? 'gender' : null,
      age ? 'age' : null,
      ethnicity ? 'ethnicity' : null,
      hasVerifiedPhotos ? 'photos' : null,
    ].filter(filter));

    setUnverifiedThings([
      !gender ? 'gender' : null,
      !age ? 'age' : null,
      !ethnicity ? 'ethnicity' : null,
      !hasVerifiedPhotos ? 'photos' : null,
    ].filter(filter));
  }, []);

  useEffect(() => {
    notify('watch-verification');

    return listen<VerificationEvent>(
      'updated-verification',
      onVerificationEvent,
    );

  }, []);

  const VerificationText = useCallback(({
    verified,
    unverified
  }: {
    verified: string[],
    unverified: string[],
  }) => {
    return (
      <View style={{ gap: 15, flex: 1, width: '100%' }} >
        {verified.length > 0 &&
          <DefaultText
            style={{
              color: '#333',
              fontSize: 16,
              width: '100%',
            }}
          >
            We were able to verify your {}
            {verified.map((item, index) => (
              <Fragment key={index}>
                {index > 0 && index < verified.length - 1 && ', '}
                {index === verified.length - 1 && ' and '}
                <DefaultText key={index} style={{ fontWeight: '700' }}>
                  {item}
                </DefaultText>
              </Fragment>
            ))}
            .
          </DefaultText>
        }
        {unverified.length > 0 &&
          <DefaultText
            style={{
              color: '#333',
              fontSize: 16,
              width: '100%',
            }}
          >
            You can verify your {}
            {unverified.map((item, index) => (
              <Fragment key={index}>
                {index > 0 && index < verified.length - 1 && ', '}
                {index === verified.length - 1 && ' and '}
                <DefaultText style={{ fontWeight: '700' }}>
                  {item}
                </DefaultText>
              </Fragment>
            ))}
            {} later.
          </DefaultText>
        }
      </View>
    );
  }, []);

  return (
    <>
      {isDone &&
        <View
          style={{
            backgroundColor: '#eee',
            borderRadius: 10,
            flex: 1,
            marginLeft: 10,
            marginRight: 10,
            paddingTop: 10,
            paddingBottom: 10,
            paddingLeft: 20,
            paddingRight: 20,
            justifyContent: 'space-around',
            alignItems: 'center',
          }}
        >
          {status === 'success' && <>
              <View
                style={{
                  alignItems: 'center',
                  gap: 10,
                  flex: 1,
                  justifyContent: 'center',
                }}
              >
                <VerificationBadge size={40}/>
                <DefaultText
                  style={{
                    color: '#333',
                    fontWeight: 700,
                    fontSize: 22,
                  }}
                >
                  You’re Verified!
                </DefaultText>
              </View>
              <VerificationText
                verified={verifiedThings}
                unverified={unverifiedThings}
              />
            </>
          }
          {status === 'failure' && <>
              <View
                style={{
                  alignItems: 'center',
                  gap: 10,
                  flex: 1,
                  justifyContent: 'center',
                }}
              >
                <Ionicons
                  style={{
                    fontSize: 55,
                    color: "#d10909",
                  }}
                  name="close-circle"
                />
                <DefaultText
                  style={{
                    color: '#333',
                    fontWeight: 700,
                    fontSize: 22,
                  }}
                >
                  We Couldn’t Verify You
                </DefaultText>
              </View>
              <View style={{ gap: 15, flex: 1, width: '100%' }}>
                <DefaultText
                  style={{
                    color: '#333',
                    fontSize: 16,
                    width: '100%',
                  }}
                >
                  {message}
                </DefaultText>

                <DefaultText
                  style={{
                    color: '#333',
                    fontSize: 16,
                    width: '100%',
                  }}
                >
                  Not to worry! You can try up to {maxDailySelfies} times per day.
                </DefaultText>
              </View>
            </>
          }
        </View>
      }
      {!isDone &&
        <DefaultText
          style={{
            color: 'black',
            fontSize: 22,
            padding: 20,
            borderColor: 'white',
            borderWidth: 3,
            borderRadius: 10,
            textAlign: 'center',
            width: '100%',
          }}
        >
          {message}
          {'\n'}
          {'.'.repeat(Math.max(0, numChecks + 1))}
        </DefaultText>
      }
    </>
  );
});

const ThemePicker = forwardRef((props: InputProps<OptionGroupThemePicker>, ref) => {
  const [titleColor, setTitleColor] = useState(
    props.input.themePicker.currentTitleColor ?? '#000000');
  const [bodyColor, setBodyColor] = useState(
    props.input.themePicker.currentBodyColor ?? '#000000');
  const [backgroundColor, setBackgroundColor] = useState(
    props.input.themePicker.currentBackgroundColor ?? '#ffffff');

  const lastSetter = useRef(setTitleColor);

  const submit = useCallback(async () => {
    props.setIsLoading(true);

    const ok = await props.input.themePicker.submit(
      titleColor, bodyColor, backgroundColor
    );
    ok && props.onSubmitSuccess();

    props.setIsLoading(false);
  }, [titleColor, bodyColor, backgroundColor]);

  useImperativeHandle(ref, () => ({ submit }), [submit]);

  useEffect(() => {
    return listen('color-picked', (c: string) => lastSetter.current(c));
  }, [lastSetter]);

  const ColorPickerButton = useCallback(({
    currentColor,
    setColor,
    style = {},
  }: {
    currentColor: string
    setColor: (c: string) => void,
    style?: any,
  }) => {
    const opacity = useRef(new Animated.Value(1)).current;

    const fadeIn = useCallback(() => {
      Animated.timing(opacity, {
        toValue: 0.5,
        duration: 0,
        useNativeDriver: false,
      }).start();
    }, []);

    const fadeOut = useCallback(() => {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: false,
      }).start();
    }, []);

    const onPress = useCallback(() => {
      lastSetter.current = setColor;
      notify<ShowColorPickerEvent>('show-color-picker', currentColor);
    }, [setColor, currentColor]);

    return (
      <Pressable
        style={{
          backgroundColor: 'white',
          width: 55,
          height: 30,
          borderRadius: 3,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 5,
          shadowOffset: {
            width: 0,
            height: 2,
          },
          shadowOpacity: 0.4,
          shadowRadius: 4,
          elevation: 4,
          ...style,
        }}
        onPress={onPress}
        onPressIn={fadeIn}
        onPressOut={fadeOut}
      >
        <Animated.View
          style={{
            backgroundColor: currentColor,
            width: 20,
            height: 20,
            borderRadius: 3,
            borderColor: 'black',
            borderWidth: 1,
            opacity: opacity,
          }}
        />
        <FontAwesomeIcon
          style={{ width: 20 }}
          icon={faCaretDown}
          size={20}
          color="black"
        />
      </Pressable>
    );
  }, []);

  return (
    <View
      style={{
        marginLeft: 10,
        marginRight: 10,
        padding: 10,
        backgroundColor: backgroundColor,
        borderRadius: 10,
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.4,
        shadowRadius: 4,
        elevation: 4,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          gap: 10,
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <Title style={{ color: titleColor, marginTop: 0, marginBottom: 0 }} >
          Example Heading
        </Title>
        <ColorPickerButton currentColor={titleColor} setColor={setTitleColor} />
      </View>
      <View
        style={{
          flexDirection: 'row',
          gap: 10,
          alignItems: 'center',
        }}
      >
        <DefaultText
          style={{
            color: bodyColor,
            fontSize: 16,
          }}
        >
          Your profile will look like this.
        </DefaultText>
        <ColorPickerButton currentColor={bodyColor} setColor={setBodyColor} />
      </View>
      <ColorPickerButton
        currentColor={backgroundColor}
        setColor={setBackgroundColor}
        style={{
          marginTop: 10,
          marginLeft: 'auto',
        }}
      />
    </View>
  );
});

const None = forwardRef((props: InputProps<OptionGroupNone>, ref) => {
  const submit = useCallback(async () => {
    props.setIsLoading(true);

    const ok = await props.input.none.submit();
    ok && props.onSubmitSuccess();

    props.setIsLoading(false);
  }, []);

  useImperativeHandle(ref, () => ({ submit }), []);

  const Description = props.input.none.description;

  const style = {
    color: props.theme !== 'light' ? 'white' : 'black',
    textAlign: props.input.none.textAlign ?? 'center',
    paddingHorizontal: 20,
    fontSize: noneFontSize,
  };

  if (!Description) {
    return null;
  } else if (typeof Description === 'string') {
    return (
      <DefaultText style={style}>
        {Description}
      </DefaultText>
    );
  } else {
    return (
      <KeyboardDismissingView style={style}>
        <Description/>
      </KeyboardDismissingView>
    );
  }
});

const InputElement = forwardRef((props: InputProps<OptionGroupInputs>, ref) => {
  if (isOptionGroupButtons(props.input)) {
    return <Buttons {...{ref, ...props, input: props.input}}/>;
  } else if (isOptionGroupSlider(props.input)) {
    return <Slider {...{ref, ...props, input: props.input}}/>;
  } else if (isOptionGroupGivenName(props.input)) {
    return <GivenName {...{ref, ...props, input: props.input}}/>
  } else if (isOptionGroupOtp(props.input)) {
    return <Otp {...{ref, ...props, input: props.input}}/>;
  } else if (isOptionGroupDate(props.input)) {
    return <DatePicker {...{ref, ...props, input: props.input}}/>;
  } else if (isOptionGroupLocationSelector(props.input)) {
    return <LocationSelector {...{ref, ...props, input: props.input}}/>;
  } else if (isOptionGroupPhotos(props.input)) {
    return <Photos {...{ref, ...props, input: props.input}}/>;
  } else if (isOptionGroupTextLong(props.input)) {
    return <TextLong {...{ref, ...props, input: props.input}}/>;
  } else if (isOptionGroupTextShort(props.input)) {
    return <TextShort {...{ref, ...props, input: props.input}}/>;
  } else if (isOptionGroupCheckChips(props.input)) {
    return <CheckChips {...{ref, ...props, input: props.input}}/>;
  } else if (isOptionGroupRangeSlider(props.input)) {
    return <RangeSlider {...{ref, ...props, input: props.input}}/>;
  } else if (isOptionGroupVerificationChecker(props.input)) {
    return <VerificationChecker {...{ref, ...props, input: props.input}}/>;
  } else if (isOptionGroupThemePicker(props.input)) {
    return <ThemePicker {...{ref, ...props, input: props.input}}/>;
  } else if (isOptionGroupNone(props.input)) {
    return <None {...{ref, ...props, input: props.input}}/>;
  } else {
    throw Error('Unhandled input: ' + JSON.stringify(props.input));
  }
});

const OptionScreen = ({navigation, route}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isValid, setIsValid] = useState(true);

  const [isBottom, setIsBottom] = useState(true);
  const [contentHeight, setContentHeight] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  const optionGroups: OptionGroup<OptionGroupInputs>[] = route?.params?.optionGroups ?? [];
  const showSkipButton: boolean = route?.params?.showSkipButton ?? true;
  const showCloseButton: boolean = route?.params?.showCloseButton ?? true;
  const showBackButton: boolean = route?.params?.showBackButton ?? false;
  const backgroundColor: string = route?.params?.backgroundColor ?? 'white';
  const color: string | undefined = route?.params?.color;
  const onSubmitSuccess: any | undefined = route?.params?.onSubmitSuccess;
  const theme: any | undefined = route?.params?.theme;

  const transparentBackgroundColor = backgroundColor === 'white' ? '#ffffff00' : '#7700ff00';

  const thisOptionGroup = optionGroups[0];

  const inputRef = useRef<any>(undefined);

  const {
    title,
    description: Description,
    input,
    scrollView,
    buttonLabel,
  } = thisOptionGroup;

  if (!input) {
    throw Error('Expected input to be defined');
  }

  const _onSubmitSuccess = useCallback(async () => {
    onSubmitSuccess && onSubmitSuccess();

    switch (optionGroups.length) {
      case 0: {
        throw Error('Expected there to be some option groups');
      }
      case 1: {
        navigation.popToTop();
        break;
      }
      default: {
        navigation.push(
          route.name,
          {
            ...route.params,
            optionGroups: optionGroups.slice(1)
          }
        );
      }
    }
  }, [inputRef]);

  const onPressContinue = useCallback(() => {
    const submit = inputRef.current?.submit;
    !isLoading && submit && submit();
  }, [isLoading, inputRef.current]);

  const onPressSkip = useCallback(() => {
    // TODO: Uncomment this once skip works properly
    // const skip = inputRef.current?.skip;
    // !isLoading && skip && skip();
    _onSubmitSuccess();
  }, [isLoading, inputRef.current, _onSubmitSuccess]);

  const checkIsBottom = useCallback((nativeEvent) => {
    const isCloseToBottom = (
      nativeEvent.layoutMeasurement.height +
      nativeEvent.contentOffset.y) >= nativeEvent.contentSize.height - 10;
    setIsBottom(isCloseToBottom);
  }, [setIsBottom]);

  const onScroll = useCallback(({ nativeEvent }) => {
    checkIsBottom(nativeEvent);
  }, [checkIsBottom]);

  const onContentSizeChange = useCallback((width, height) =>
    setContentHeight(height), []);

  const onLayout = useCallback(({ nativeEvent }) =>
    setContainerHeight(nativeEvent.layout.height), []);

  useEffect(() => {
    // Compare the heights to determine if there is more content offscreen when
    // the component mounts.
    if (containerHeight > 0 && contentHeight > 0) {
      setIsBottom(containerHeight >= contentHeight);
    }
  }, [containerHeight, contentHeight]);

  return (
    <SafeAreaView
      style={{
        backgroundColor: backgroundColor,
        width: '100%',
        height: '100%',
      }}
    >
      <KeyboardDismissingView enabled={scrollView === false}
        style={{
          height: '100%',
          width: '100%',
          maxWidth: 600,
          alignSelf: 'center',
        }}
      >
        <StatusBarSpacer/>
        <View
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 1,
            paddingTop: 10,
            paddingBottom: 20,
          }}
        >
          {showCloseButton &&
            <Pressable
              onPress={() => navigation.popToTop()}
              style={{position: 'absolute', top: 0, left: 0, zIndex: 99}}
            >
              <Ionicons
                style={{
                  marginTop: 10,
                  marginLeft: 10,
                  fontSize: 30,
                }}
                name="close"
              />
            </Pressable>
          }
          {showBackButton &&
            <Pressable
              onPress={() => navigation.goBack()}
              style={{position: 'absolute', top: 0, left: 0, zIndex: 99}}
            >
              <FontAwesomeIcon
                style={{
                  margin: 15,
                  color: 'white',
                }}
                icon={faArrowLeft}
                size={24}
                color="white"
              />
            </Pressable>
          }
          <DefaultText
            style={{
              textAlign: 'center',
              fontWeight: '700',
              fontSize: 28,
              color: color,
              paddingLeft: 40,
              paddingRight: 40,
            }}
          >
            {title}
          </DefaultText>
          {typeof Description === 'string' && <DefaultText
            style={{
              ...descriptionStyle.style,
              color: color || descriptionStyle.style.color
            }}
          >
            {Description}
          </DefaultText>}
          {typeof Description !== 'string' && <Description/>}
        </View>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            overflow: 'visible',
            zIndex: 999,
          }}
        >
          {scrollView === false &&
            <InputElement
              ref={inputRef}
              input={input}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
              onSubmitSuccess={_onSubmitSuccess}
              title={title}
              showSkipButton={showSkipButton}
              theme={theme}
            />
          }
          {scrollView !== false && <>
              <ScrollView
                onScroll={onScroll}
                onContentSizeChange={onContentSizeChange}
                onLayout={onLayout}
                contentContainerStyle={{
                  flexGrow: 1,
                  justifyContent: 'center',
                }}
                bounces={false}
                overScrollMode="never"
              >
                <View style={{height: 20}}/>
                <InputElement
                  ref={inputRef}
                  input={input}
                  isLoading={isLoading}
                  setIsLoading={setIsLoading}
                  onSubmitSuccess={_onSubmitSuccess}
                  title={title}
                  showSkipButton={showSkipButton}
                  theme={theme}
                />
                <View style={{height: 20}}/>
              </ScrollView>
              <LinearGradient
                colors={[backgroundColor, transparentBackgroundColor]}
                style={{
                  position: 'absolute',
                  height: 20,
                  top: 0,
                  left: 10,
                  right: 10,
                }}
              />
              <LinearGradient
                colors={[
                  transparentBackgroundColor,
                  isBottom ? backgroundColor : '#00000033'
                ]}
                style={{
                  position: 'absolute',
                  height: 10,
                  bottom: 0,
                  left: 10,
                  right: 10,
                  borderBottomLeftRadius: 5,
                  borderBottomRightRadius: 5,
                }}
              />
            </>
          }
        </View>
        <View
          style={{
            flexShrink: 1,
            justifyContent: 'flex-end',
            alignItems: 'center',
            padding: 10,
            paddingBottom: 20,
          }}
        >
          <ButtonWithCenteredText
            secondary={theme !== 'light'}
            onPress={showSkipButton ? onPressSkip : onPressContinue}
            loading={isLoading}
            containerStyle={{
              width: '90%',
            }}
          >
            {buttonLabel ?? (showSkipButton ? 'Skip' : 'Continue')}
          </ButtonWithCenteredText>
        </View>
      </KeyboardDismissingView>
    </SafeAreaView>
  );
};

export {
  OptionScreen,
  noneFontSize,
};
