import {
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import {
  createElement,
  useState,
} from 'react';
import { ButtonGroup } from '@rneui/themed';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ButtonWithCenteredText } from './button/centered-text';
import { StatusBarSpacer } from './status-bar-spacer';
import { LabelledSlider } from './labelled-slider';
import { RangeSlider } from './range-slider';
import { DefaultText } from './default-text';
import { DefaultTextInput } from './default-text-input';
import { OtpInput } from './otp-input';
import { DatePicker } from './date-picker';
import { LocationSelector } from './location-selector';
import {
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
import { CheckChip, CheckChips } from './check-chip';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons/faArrowLeft'
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'

const InputElement = ({input, onAnswerGiven, title, showSkipButton}) => {
  const [isCodeIncorrect, setIsCodeIncorrect] = useState(false);

  if (isOptionGroupButtons(input)) {
    return <ButtonGroup_
      buttons={input.buttons}
      initialSelectedIndex={input.initialSelectedIndex}
      onPress={onAnswerGiven}
    />;
  }
  if (isOptionGroupVerification(input)) {
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
  }
  if (isOptionGroupSlider(input)) {
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
        {showSkipButton !== false &&
          <ButtonWithCenteredText
            onPress={onAnswerGiven}
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
  }
  if (isOptionGroupDeletion(input)) {
    return (
      <ButtonWithCenteredText
        onPress={onAnswerGiven}
        containerStyle={{
          marginTop: 30,
          marginLeft: 20,
          marginRight: 20,
        }}
      >
        Yes, delete my account right now
      </ButtonWithCenteredText>
    );
  }
  if (isOptionGroupGivenName(input)) {
    return (
      <DefaultTextInput
        placeholder="First name"
        textContentType="givenName"
        autoComplete="name-given"
      />
    );
  }
  if (isOptionGroupOtp(input)) {
    return (
      <>
        <OtpInput codeLength={6}/>
        <DefaultText
          style={{
            textAlign: 'center',
            color: '#faa',
            fontWeight: '600',
            height: 30,
          }}
        >
          {isCodeIncorrect ? 'Incorrect code' : ''}
        </DefaultText>
        <ButtonWithCenteredText
          containerStyle={{
            marginTop: 0,
            marginLeft: 20,
            marginRight: 20,
          }}
          fontSize={14}
        >
          Resend code
        </ButtonWithCenteredText>
      </>
    );
  }
  if (isOptionGroupDate(input)) {
    return <DatePicker/>;
  }
  if (isOptionGroupLocationSelector(input)) {
    return (
      <>
        <LocationSelector/>
        {showSkipButton === true &&
          <ButtonWithCenteredText
            onPress={onAnswerGiven}
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
  }
  if (isOptionGroupPhotos(input)) {
    return (
      <View
        style={{
          marginLeft: 20,
          marginRight: 20,
        }}
      >
        <SecondaryImages/>
      </View>
    );
  }
  if (isOptionGroupTextLong(input)) {
    return <DefaultLongTextInput
      style={{
        marginLeft: 20,
        marginRight: 20,
      }}
    />
  }

  if (isOptionGroupTextShort(input)) {
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
          onPress={onAnswerGiven}
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
  }

  if (isOptionGroupCheckChips(input)) {
    return (
      <>
        <CheckChips
          style={{
            marginLeft: 20,
            marginRight: 20,
            alignSelf: 'center',
          }}
        >
          {
            input.checkChips.map((checkChip, i) =>
              <CheckChip
                key={i}
                label={checkChip.label}
                initialCheckedState={checkChip.checked}
              />
            )
          }
        </CheckChips>
        {showSkipButton === true &&
          <ButtonWithCenteredText
            onPress={onAnswerGiven}
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
  }

  if (isOptionGroupRangeSlider(input)) {
    return <RangeSlider
      unitsLabel={input.rangeSlider.unitsLabel}
      minimumValue={input.rangeSlider.sliderMin}
      maximumValue={input.rangeSlider.sliderMax}
      containerStyle={{
        marginLeft: 20,
        marginRight: 20,
      }}
    />
  }

  if (isOptionGroupNone(input)) {
    return <></>;
  }

  throw Error('Unhandled input: ' + JSON.stringify(input));
};

const OptionScreen = ({navigation, route}) => {
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

  const {
    title,
    description,
    input,
    scrollView,
  } = thisOptionGroup;

  const onAnswerGiven = () => {
    switch (optionGroups.length) {
      case 0: {
        throw Error('Expected there to be some titles');
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
  };

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
              input={input}
              onAnswerGiven={onAnswerGiven}
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
                  input={input}
                  onAnswerGiven={onAnswerGiven}
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
            onPress={onAnswerGiven}
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
