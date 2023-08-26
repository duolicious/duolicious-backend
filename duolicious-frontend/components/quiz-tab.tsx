import {
  View,
} from 'react-native';
import {
  useRef,
} from 'react';
import { ButtonWithCenteredText } from './button/centered-text';
import { QuizCardStack } from './quiz-card-stack';
import { X, Check, FastForward, RotateCcw } from "react-native-feather";

const QuizTab = ({navigation}) => {
  const stackRef = useRef(undefined);

  const inputElementsRef = useRef(undefined);

  const onPressUndo      = () => { stackRef.current.undo() };
  const onPressNo        = () => { stackRef.current.no() };
  const onPressYes       = () => { stackRef.current.yes() };
  const onPressSkip      = () => { stackRef.current.skip() };

  const onTopCardChanged = () => {
    inputElementsRef.current.setIsUndoEnabled(
      !!(stackRef.current && stackRef.current.canUndo())
    );

    inputElementsRef.current.setIsSwipeEnabled(
      !!(stackRef.current && stackRef.current.canSwipe())
    );
  };

  const onSwipe = (direction: string) => {
    if (inputElementsRef.current === undefined) return;
    if (stackRef.current === undefined) return;
    if (!stackRef.current.canSwipe()) return;

    if (direction === 'left' ) inputElementsRef.current.doNoPressAnimation();
    if (direction === 'right') inputElementsRef.current.doYesPressAnimation();
    if (direction === 'down' ) inputElementsRef.current.doSkipPressAnimation();
  };

  return (
    <>
      <QuizCardStack
        innerRef={stackRef}
        onTopCardChanged={onTopCardChanged}
        onSwipe={onSwipe}
        navigation={navigation}
      />
      <UndoNoYesSkip
        innerRef={inputElementsRef}
        onPressNo={onPressNo}
        onPressYes={onPressYes}
        onPressSkip={onPressSkip}
        onPressUndo={onPressUndo}
      />
    </>
  );
};

const UndoNoYesSkip = (props) => {
  const undoButtonRef = useRef(undefined);
  const noButtonRef = useRef(undefined);
  const yesButtonRef = useRef(undefined);
  const skipButtonRef = useRef(undefined);

  const {
    innerRef,
    onPressUndo,
    onPressNo,
    onPressYes,
    onPressSkip,
  } = props;

  class Api {
    setIsUndoEnabled(value: boolean) {
      if (undoButtonRef.current) undoButtonRef.current.isEnabled(value);
    }

    setIsSwipeEnabled(value: boolean) {
      if (noButtonRef.current) noButtonRef.current.isEnabled(value);
      if (yesButtonRef.current) yesButtonRef.current.isEnabled(value);
      if (skipButtonRef.current) skipButtonRef.current.isEnabled(value);
    }

    doYesPressAnimation() {
      if (yesButtonRef.current) {
        yesButtonRef.current.doPressAnimation();
      }
    }

    doNoPressAnimation() {
      if (noButtonRef.current) {
        noButtonRef.current.doPressAnimation();
      }
    }

    doSkipPressAnimation() {
      if (skipButtonRef.current) {
        skipButtonRef.current.doPressAnimation();
      }
    }
  };

  innerRef.current = new Api();

  const buttonStyle = {
    width: 60,
    height: 60,
    aspectRatio: 1,
    margin: 10,
  };

  return (
    <View
      style={{
        width: '100%',
        maxWidth: 600,
        alignSelf: 'center',
        position: 'absolute',
        bottom: 0,
        flexGrow: 0,
        flexShrink: 1,
        paddingLeft: 15,
        paddingRight: 15,
        paddingBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-around',
        ...props.style,
      }}
    >
      <ButtonWithCenteredText
        innerRef={undoButtonRef}
        className="pressable"
        containerStyle={buttonStyle}
        secondary={true}
        onPress={onPressUndo}
        backgroundColor="black"
        borderColor="white"
        borderWidth={2}
      >
        <RotateCcw
          stroke="white"
          strokeWidth={4}
          height={30}
          width={30}
        />
      </ButtonWithCenteredText>
      <ButtonWithCenteredText
        innerRef={noButtonRef}
        className="pressable"
        containerStyle={buttonStyle}
        onPress={onPressNo}
        backgroundColor="#70f"
        borderColor="white"
        borderWidth={2}
      >
        <X
          stroke="white"
          strokeWidth={4}
          width={30}
          height={30}
        />
      </ButtonWithCenteredText>
      <ButtonWithCenteredText
        innerRef={yesButtonRef}
        className="pressable"
        containerStyle={buttonStyle}
        onPress={onPressYes}
        backgroundColor="#70f"
        borderColor="white"
        borderWidth={2}
      >
        <Check
          stroke="white"
          strokeWidth={4}
          width={30}
          height={30}
        />
      </ButtonWithCenteredText>
      <ButtonWithCenteredText
        innerRef={skipButtonRef}
        className="pressable"
        containerStyle={buttonStyle}
        secondary={true}
        onPress={onPressSkip}
        backgroundColor="black"
        borderColor="white"
        borderWidth={2}
      >
        <FastForward
          stroke="white"
          strokeWidth={4}
          height={30}
          width={30}
        />
      </ButtonWithCenteredText>
    </View>
  );
};

export {
  QuizTab,
}
