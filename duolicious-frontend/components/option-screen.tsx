import {
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import {
  createElement,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
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
import {
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
} from '../data/option-groups';
import {
  SecondaryImages,
} from './images';
import { DefaultLongTextInput } from './default-long-text-input';
import { LinearGradient } from 'expo-linear-gradient';
import { CheckChip as CheckChip_, CheckChips as CheckChips_ } from './check-chip';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons/faArrowLeft'
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { japi } from '../api/api';
import { signedInUser } from '../App';
import { cmToFeetInchesStr } from '../units/units';
import { delay } from '../util/util';

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
        onSubmitEditing={submit}
      />
      <DefaultText
        style={{
          textAlign: 'center',
          color: 'white',
          marginTop: 5,
          opacity: isInvalid ? 1 : 0,
        }}
      >
        That doesn't look like a real name 🤨
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
  const [isInvalid, setIsInvalid] = useState(false);


  const submit = useCallback(async () => {
    if (!props.isLoading) {
      props.onSubmitSuccess();
    }
  }, [props.isLoading]);

  useImperativeHandle(ref, () => ({ submit }), []);

  return (
    <View
      style={{
        marginLeft: 20,
        marginRight: 20,
      }}
    >
      <SecondaryImages
        input={props.input}
        firstFileNumber={1}
        setIsLoading={props.setIsLoading}
        setIsInvalid={setIsInvalid}
      />
      <DefaultText
        style={{
          textAlign: 'center',
          color: 'white',
          marginTop: 5,
          opacity: isInvalid ? 1 : 0,
        }}
      >
        Something went wrong. Make sure your images are smaller than 10MB and
        5000x5000 pixels.
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
        }}
        autoFocus={true}
        onChangeText={onChangeInputValue}
        onSubmitEditing={submit}
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
        onSubmitEditing={submit}
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

const None = forwardRef((props: InputProps<OptionGroupNone>, ref) => {
  const submit = useCallback(async () => {
    props.setIsLoading(true);

    const ok = await props.input.none.submit();
    ok && props.onSubmitSuccess();

    props.setIsLoading(false);
  }, []);

  useImperativeHandle(ref, () => ({ submit }), []);

  return (
    <DefaultText
      style={{
        color: 'white',
        textAlign: 'center',
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 20,
        fontSize: 16,
      }}
    >
      {props.input.none.description}
    </DefaultText>
  );
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
  } else if (isOptionGroupNone(props.input)) {
    return <None {...{ref, ...props, input: props.input}}/>;
  } else {
    throw Error('Unhandled input: ' + JSON.stringify(props.input));
  }
});

const OptionScreen = ({navigation, route}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isValid, setIsValid] = useState(true);

  const optionGroups: OptionGroup<OptionGroupInputs>[] = route?.params?.optionGroups ?? [];
  const showSkipButton: boolean = route?.params?.showSkipButton ?? true;
  const showCloseButton: boolean = route?.params?.showCloseButton ?? true;
  const showBackButton: boolean = route?.params?.showBackButton ?? false;
  const backgroundColor: string | undefined = route?.params?.backgroundColor;
  const color: string | undefined = route?.params?.color;
  const onSubmitSuccess: any | undefined = route?.params?.onSubmitSuccess;
  const theme: any | undefined = route?.params?.theme;

  const thisOptionGroup = optionGroups[0];

  const inputRef = useRef<any>(undefined);

  const {
    title,
    description,
    input,
    scrollView,
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

  return (
    <View
      style={{
        backgroundColor: backgroundColor,
        width: '100%',
        height: '100%',
      }}
    >
      <View
        style={{
          height: '100%',
          width: '100%',
          maxWidth: 600,
          alignSelf: 'center',
        }}
      >
        <StatusBarSpacer/>
        {showCloseButton &&
          <Pressable onPress={() => navigation.popToTop()}>
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
          <Pressable onPress={() => navigation.goBack()}>
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
        <View
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 1,
            paddingTop: showCloseButton || showBackButton ? 0 : 40,
            paddingBottom: 40,
          }}
        >
          <DefaultText
            style={{
              textAlign: 'center',
              fontWeight: '700',
              fontSize: 28,
              color: color,
              paddingLeft: 20,
              paddingRight: 20,
            }}
          >
            {title}
          </DefaultText>
          <DefaultText
            style={{
              color: color || '#777',
              textAlign: 'center',
              paddingLeft: 20,
              paddingRight: 20,
              paddingTop: 20,
            }}
          >
            {description}
          </DefaultText>
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
                contentContainerStyle={{
                  flexGrow: 1,
                  justifyContent: 'center',
                }}
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
                colors={[backgroundColor || 'white', 'transparent']}
                style={{
                  position: 'absolute',
                  height: 20,
                  width: '100%',
                  top: 0,
                  left: 0,
                }}
              />
              <LinearGradient
                colors={['transparent', backgroundColor || 'white']}
                style={{
                  position: 'absolute',
                  height: 20,
                  width: '100%',
                  bottom: 0,
                  left: 0,
                }}
              />
            </>
          }
        </View>
        <View
          style={{
            flexShrink: 1,
            justifyContent: 'flex-end',
            padding: 20,
            paddingBottom: 40,
          }}
        >
          <ButtonWithCenteredText
            secondary={theme !== 'light'}
            onPress={showSkipButton ? onPressSkip : onPressContinue}
            loading={isLoading}
          >
            {showSkipButton ? 'Skip' : 'Continue'}
          </ButtonWithCenteredText>
        </View>
      </View>
    </View>
  );
};

export {
  OptionScreen,
};
