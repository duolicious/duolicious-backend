import {
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import {
  createElement,
  forwardRef,
  useCallback,
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
  OptionGroupOtp,
  OptionGroup,
  isOptionGroupButtons,
  isOptionGroupDate,
  isOptionGroupDeletion,
  isOptionGroupGivenName,
  isOptionGroupLocationSelector,
  isOptionGroupOtp,
  isOptionGroupPhotos,
  isOptionGroupSlider,
  isOptionGroupTextLong,
  isOptionGroupTextShort,
  isOptionGroupVerification,
  isOptionGroupRangeSlider,
  isOptionGroupCheckChips,
  isOptionGroupNone,
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

type InputProps = {
  input,
  isLoading,
  setIsLoading,
  onSubmitSuccess,
  title,
  showSkipButton
};

const Buttons = forwardRef((props: InputProps, ref) => {
  const inputValueRef = useRef<string | undefined>(undefined);

  const onChangeInputValue = useCallback((value: number) => {
    inputValueRef.current = props.input.buttons[value];
  }, []);

  const submit = useCallback(async () => {
    props.setIsLoading(true);

    const ok = await props.input.submit(inputValueRef?.current);
    ok && props.onSubmitSuccess();

    props.setIsLoading(false);
  }, []);

  useImperativeHandle(ref, () => ({ submit }), []);

  return (
    <>
      <ButtonGroup_
        buttons={props.input.buttons}
        initialSelectedIndex={props.input.initialSelectedIndex}
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

const Verification = ({input}) => {
  // TODO
  if (true) {
    return (
      <>
        <DefaultTextInput
          placeholder="Mobile (with country code)"
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
        />
        <ButtonWithCenteredText
          containerStyle={{
            marginLeft: 20,
            marginRight: 20,
          }}
        >
          Send SMS
        </ButtonWithCenteredText>
      </>
    );
  } else {
    return (
      <DefaultText
        style={{
          textAlign: 'center',
          fontSize: 22,
          color: '#444',
        }}
      >
        You're already verified!
      </DefaultText>
    );
  }
};

const Slider = ({input, onPress, title, showDoneButton}) => {
  return (
    <>
      <LabelledSlider
        label={`${title} (${input.slider.unitsLabel})`}
        minimumValue={input.slider.sliderMin}
        maximumValue={input.slider.sliderMax}
        initialValue={input.slider.sliderInitial}
        step={input.slider.step}
        addPlusAtMax={input.slider.addPlusAtMax}
        style={{
          marginLeft: 20,
          marginRight: 20,
        }}
      />
      {showDoneButton &&
        <ButtonWithCenteredText
          onPress={onPress}
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
};

const Deletion = ({input, onPress}) => {
  return (
    <ButtonWithCenteredText
      onPress={onPress}
      containerStyle={{
        marginTop: 30,
        marginLeft: 20,
        marginRight: 20,
      }}
    >
      Yes, delete my account right now
    </ButtonWithCenteredText>
  );
};

const GivenName = forwardRef((props: InputProps, ref) => {
  const [isInvalid, setIsInvalid] = useState(false);
  const inputValueRef = useRef<string | undefined>(undefined);

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

const Otp = forwardRef((props: InputProps, ref) => {
  const [isLoadingResend, setIsLoadingResend] = useState(false);
  const [isInvalid, setIsInvalid] = useState(false);
  const inputValueRef = useRef<string | undefined>(undefined);

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
    setIsLoadingResend(false);
  }, []);

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
        onPress={isLoadingResend ? undefined : resend}
        loading={isLoadingResend}
      >
        Resend code
      </ButtonWithCenteredText>
    </>
  );
});

const LocationSelector = forwardRef((props: InputProps, ref) => {
  const [isInvalid, setIsInvalid] = useState(false);
  const inputValueRef = useRef<string | undefined>(undefined);

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
      <LocationSelector_ onChangeText={onChangeInputValue}/>
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

const Photos = forwardRef((props: InputProps, ref) => {
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

const TextLong = forwardRef((props: InputProps, ref) => {
  const [isInvalid, setIsInvalid] = useState(false);

  const inputValueRef = useRef<string | undefined>(undefined);

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
        onChangeText={onChangeInputValue}
        onSubmitEditing={submit}
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

const TextShort = ({input, onPress}) => {
  return (
    <>
      <DefaultTextInput
        style={{
          marginLeft: 20,
          marginRight: 20,
        }}
        placeholder="Type here..."
      />
      <ButtonWithCenteredText
        onPress={onPress}
        containerStyle={{
          marginTop: 30,
          marginLeft: 20,
          marginRight: 20,
        }}
      >
        Done
      </ButtonWithCenteredText>
    </>
  );
};

const CheckChips = forwardRef((props: InputProps, ref) => {
  const [isInvalid, setIsInvalid] = useState(false);
  const inputValueRef = useRef(new Set<string>(
    props.input.checkChips.flatMap(
      (checkChip, i) => checkChip.checked ? [checkChip.label] : []
    )
  ));

  const submit = useCallback(async () => {
    setIsInvalid(false);
    props.setIsLoading(true);

    const ok = await props.input.submit([...inputValueRef.current]);
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
          props.input.checkChips.map((checkChip, i) =>
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
          color: 'white',
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

const RangeSlider = ({input}) => {
  return <RangeSlider_
    unitsLabel={input.rangeSlider.unitsLabel}
    minimumValue={input.rangeSlider.sliderMin}
    maximumValue={input.rangeSlider.sliderMax}
    containerStyle={{
      marginLeft: 20,
      marginRight: 20,
    }}
  />
};

const None = forwardRef((props: InputProps, ref) => {
  const submit = useCallback(async () => {
    props.setIsLoading(true);

    const ok = await props.input.none.submit();
    ok && props.onSubmitSuccess();

    props.setIsLoading(false);
  }, []);

  useImperativeHandle(ref, () => ({ submit }), []);

  return <></>;
});

const InputElement = forwardRef((props: InputProps, ref) => {
  const props1 = {ref, ...props};

  if (isOptionGroupButtons(props.input)) {
    return <Buttons {...props1}/>;
  } else if (isOptionGroupVerification(props.input)) {
    return <Verification {...props1}/>;
  } else if (isOptionGroupSlider(props.input)) {
    return <Slider {...props1}/>;
  } else if (isOptionGroupDeletion(props.input)) {
    return <Deletion {...props1}/>;
  } else if (isOptionGroupGivenName(props.input)) {
    return <GivenName {...props1}/>
  } else if (isOptionGroupOtp(props.input)) {
    return <Otp {...props1}/>;
  } else if (isOptionGroupDate(props.input)) {
    return <DatePicker {...props1}/>;
  } else if (isOptionGroupLocationSelector(props.input)) {
    return <LocationSelector {...props1}/>;
  } else if (isOptionGroupPhotos(props.input)) {
    return <Photos {...props1}/>;
  } else if (isOptionGroupTextLong(props.input)) {
    return <TextLong {...props1}/>;
  } else if (isOptionGroupTextShort(props.input)) {
    return <TextShort {...props1}/>;
  } else if (isOptionGroupCheckChips(props.input)) {
    return <CheckChips {...props1}/>;
  } else if (isOptionGroupRangeSlider(props.input)) {
    return <RangeSlider {...props1}/>;
  } else if (isOptionGroupNone(props.input)) {
    return <None {...props1}/>;
  } else {
    throw Error('Unhandled input: ' + JSON.stringify(props.input));
  }
});

const OptionScreen = ({navigation, route}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isValid, setIsValid] = useState(true);

  const optionGroups: OptionGroup[] = route?.params?.optionGroups ?? [];
  const showSkipButton: boolean = route?.params?.showSkipButton ?? true;
  const showCloseButton: boolean = route?.params?.showCloseButton ?? true;
  const showBackButton: boolean = route?.params?.showBackButton ?? false;
  const buttonBorderWidth: number = route?.params?.buttonBorderWidth;
  const buttonBackgroundColor: number = route?.params?.buttonBackgroundColor;
  const buttonTextColor: number = route?.params?.buttonTextColor;
  const backgroundColor: string | undefined = route?.params?.backgroundColor;
  const color: string | undefined = route?.params?.color;

  const thisOptionGroup = optionGroups[0];

  const inputRef = useRef(undefined);

  const {
    title,
    description,
    input,
    scrollView,
  } = thisOptionGroup;

  const onSubmitSuccess = useCallback(async () => {
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
    if (!isLoading && submit) {
      return submit();
    }
  }, [isLoading, inputRef.current]);

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
              onSubmitSuccess={onSubmitSuccess}
              title={title}
              showSkipButton={showSkipButton}/>
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
                  onSubmitSuccess={onSubmitSuccess}
                  title={title}
                  showSkipButton={showSkipButton}/>
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
            secondary={true}
            borderWidth={buttonBorderWidth}
            backgroundColor={buttonBackgroundColor}
            textColor={buttonTextColor}
            onPress={onPressContinue}
            loading={isLoading}
          >
            {showSkipButton ? 'Skip' : 'Continue'}
          </ButtonWithCenteredText>
        </View>
      </View>
    </View>
  );
};

const ButtonGroup_ = ({buttons, initialSelectedIndex, ...rest}) => {
  const {onPress} = rest;

  const [selectedIndex, setSelectedIndex] = useState(initialSelectedIndex);

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

export {
  OptionScreen,
};
