import {
  Animated,
  Dimensions,
  ImageBackground,
  Pressable,
  StyleProp,
  TextStyle,
  View,
} from 'react-native';
import {
  memo,
  useCallback,
  useEffect,
  useState,
} from 'react';
import CheckBox from './check-box';
import { TinderCard } from 'react-tinder-card'
import { DefaultText } from './default-text';
import { StackActions } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Check, FastForward } from "react-native-feather";
import { Skeleton } from '@rneui/themed';
import { japi } from '../api/api';
import { quizQueue } from '../api/queue';
import { markTraitDataDirty } from './traits-tab';

const cardBorders = {
  borderRadius: 10,
  shadowOffset: {
    width: 0,
    height: 2,
  },
  shadowOpacity: 0.2,
  shadowRadius: 5,
  elevation: 3,
};

const cardPadding = {
  paddingLeft: 10,
  paddingRight: 10,
  paddingTop: 5,
  paddingBottom: 10,
};

const LeftComponent = ({percentage}) => {
  return (
    <View
      style={{
        position: 'absolute',
        right: 0,
        top: '20%',
        backgroundColor: '#70f',
        paddingTop: 10,
        paddingBottom: 10,
        paddingLeft: 20,
        paddingRight: 20,
        borderRadius: 30,
        alignItems: 'center',
      }}
    >
      <DefaultText
        style={{
          fontSize: 20,
          fontFamily: 'TruenoBold',
          color: 'white',
        }}
      >
        {percentage}% said
      </DefaultText>
      <View style={{flexDirection: 'row', alignItems: 'center'}}>
        <DefaultText
          style={{
            fontSize: 50,
            fontFamily: 'TruenoBold',
            color: 'white',
          }}
        >
          NO{' '}
        </DefaultText>
        <X
          stroke="white"
          strokeWidth={4}
          width={40}
          height={40}
        />
      </View>
    </View>
  );
};

const RightComponent = ({percentage}) => {
  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        top: '20%',
        backgroundColor: '#70f',
        paddingTop: 10,
        paddingBottom: 10,
        paddingLeft: 20,
        paddingRight: 20,
        borderRadius: 30,
        alignItems: 'center',
      }}
    >
      <DefaultText
        style={{
          fontSize: 20,
          fontFamily: 'TruenoBold',
          color: 'white',
        }}
      >
        {percentage}% said
      </DefaultText>
      <View style={{flexDirection: 'row', alignItems: 'center'}}>
        <DefaultText style={{
          fontSize: 50,
          fontFamily: 'TruenoBold',
          color: 'white',
        }}>
          YES{' '}
        </DefaultText>
        <Check
          stroke="white"
          strokeWidth={4}
          width={40}
          height={40}
        />
      </View>
    </View>
  );
};

const DownComponent = memo(() => {
  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'flex-start',
      }}
    >
      <View
        style={{
          backgroundColor: 'black',
          paddingLeft: 20,
          paddingRight: 20,
          alignItems: 'center',
          flexDirection: 'row',
          borderRadius: 999,
        }}
      >
        <DefaultText style={{
          fontSize: 50,
          fontFamily: 'TruenoBold',
          color: 'white',
        }}>
          SKIP{' '}
        </DefaultText>
        <FastForward
          stroke="white"
          strokeWidth={4}
          width={40}
          height={40}
        />
      </View>
    </View>
  );
});

const QuizCard = ({
  children,
  noPercentage,
  yesPercentage,
  ...props
}) => {
  const {
    style,
    innerStyle,
    innerRef,
    questionNumber,
    topic,
    answerPubliclyValue = true,
    onChangeAnswerPublicly,
    imageBackgroundStyle,
    nonInteractiveContainerStyle,
    ...rest
  } = props;

  return (
    <TinderCard
      ref={innerRef}
      containerStyle={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        ...style,
      }}
      leftComponent={<LeftComponent percentage={noPercentage}/>}
      rightComponent={<RightComponent percentage={yesPercentage}/>}
      downComponent={<DownComponent/>}
      swipeRequirementType="position"
      swipeThreshold={75}
      {...rest}
    >
      <NonInteractiveQuizCard
        innerStyle={innerStyle}
        questionNumber={questionNumber}
        topic={topic}
        answerPubliclyValue={answerPubliclyValue}
        onChangeAnswerPublicly={onChangeAnswerPublicly}
        imageBackgroundStyle={imageBackgroundStyle}
        containerStyle={nonInteractiveContainerStyle}
        showTutorial={true}
      >
        {children}
      </NonInteractiveQuizCard>
    </TinderCard>
  );
};

const NonInteractiveQuizCard = ({children, ...props}) => {
  const {
    extraChildren,
    containerStyle,
    innerStyle,
    maxFontSize,
    answerPubliclyValue,
    answerPubliclyInitialValue,
    onChangeAnswerPublicly,
    questionNumber,
    topic,
    imageBackgroundStyle,
    showAnswerPubliclyCheckBox = true,
    showTutorial = false,
  } = props;

  const adjustedFontSize = (() => {
    const defaultFontSize = 26;

    const windowArea =
      Math.min(600, Dimensions.get('window').width) *
      Dimensions.get('window').height;

    // Window scale factor
    const w1 = Math.min(1, windowArea / 502750 + 250 / 2171);

    // Text length scale factor
    const w2 = Math.min(1, - children.length / 1000 + 12 / 10);

    const scaledFontSize = Math.round(defaultFontSize * w1 * w2);

    if (maxFontSize === undefined) {
      return scaledFontSize;
    } else if (scaledFontSize > maxFontSize) {
      return maxFontSize;
    } else {
      return scaledFontSize;
    }
  })();

  return (
    <Animated.View
      style={{
        display: 'flex',
        height: '100%',
        width: '100%',
        ...cardPadding,
        backgroundColor: 'transparent',
        ...containerStyle,
      }}
    >
      <ImageBackground
        source={require('../assets/background-noise.png')}
        resizeMode="repeat"
        style={{
          overflow: 'hidden',
          ...cardBorders,
          flexGrow: 1,
          backgroundColor: 'white',
          ...imageBackgroundStyle,
        }}
      >
        <View
          style={{
            width: '100%',
            flexGrow: 1,
            ...innerStyle,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              width: '100%',
              paddingTop: 10,
              paddingLeft: 15,
              paddingRight: 15,
              alignItems: 'center',
            }}
          >
            {questionNumber && topic &&
              <DefaultText
                style={{
                  flex: 1,
                  color: '#70f',
                  textAlign: 'left',
                }}
              >
                <DefaultText style={{fontWeight: '600'}}>
                  Q
                </DefaultText>
                {questionNumber} | {topic}
              </DefaultText>
            }
            {questionNumber && topic &&
              <DefaultText
                style={{
                  flex: 1,
                  fontFamily: 'TruenoBold',
                  fontSize: 16,
                  color: '#70f',
                  textAlign: 'right',
                }}
              >
                Duolicious
              </DefaultText>
            }
          </View>
          <View
            style={{
              margin: 20,
              flexGrow: 1,
              justifyContent: 'center',
              minWidth: 150,
            }}
          >
            <DefaultText
              style={{
                fontSize: adjustedFontSize,
                fontFamily: 'Trueno',
                textAlign: 'center',
              }}
            >
              {showTutorial && questionNumber === 1 &&
                <DefaultText style={{fontSize: adjustedFontSize * 0.8}}>
                  👋 Welcome to Duolicious Q&A, where we pick your brain in the
                  quest to unearth your perfect match! Let's start with an easy
                  one:
                  {'\n\n'}
                </DefaultText>
              }
              {showTutorial && questionNumber === 2 &&
                <DefaultText style={{fontSize: adjustedFontSize * 0.8}}>
                  Best. Answer. Ever! We'll use that to improve your matches
                  here{'\u00A0'}☝️, and when you search{'\u00A0'}🔎.
                  {'\n\n'}
                </DefaultText>
              }
              {showTutorial && questionNumber === 3 &&
                <DefaultText style={{fontSize: adjustedFontSize * 0.8}}>
                  You're on a roll! Next question...
                  {'\n\n'}
                </DefaultText>
              }
              {showTutorial && questionNumber === 4 &&
                <DefaultText style={{fontSize: adjustedFontSize * 0.8}}>
                  Some questions seem pretty silly, but we promise they help us
                  figure out who's right for you. Our smartypants AI told us so.
                  {'\n\n'}
                </DefaultText>
              }
              {showTutorial && questionNumber === 5 &&
                <DefaultText style={{fontSize: adjustedFontSize * 0.8}}>
                  ...But if a question is too silly (or controversial, or you're
                  just on the fence), then you can always skip by swiping down.
                  {'\n\n'}
                </DefaultText>
              }
              {showTutorial && questionNumber === 6 &&
                <DefaultText style={{fontSize: adjustedFontSize * 0.8}}>
                  If you've got an extra-spicy hot take, you can also answer
                  privately. Just uncheck "answer publicly". We'll keep your
                  answer hidden, but still use it to sort the folders from the
                  scrunchers.
                  {'\n\n'}
                </DefaultText>
              }
              {showTutorial && questionNumber === 7 &&
                <DefaultText style={{fontSize: adjustedFontSize * 0.8}}>
                  Looks like you've got the hang of it.  We're gonna zip it and
                  let you find your match{'\u00A0'}💑. Happy swiping!
                  {'\n\n'}
                </DefaultText>
              }
              {children}
              {showTutorial && questionNumber === 1 &&
                <DefaultText style={{fontSize: adjustedFontSize * 0.8}}>
                  {'\n\n'}
                  Drag this card left for "no", or right for "yes"
                </DefaultText>
              }
              {showTutorial && questionNumber === 2 &&
                <DefaultText style={{fontSize: adjustedFontSize * 0.8}}>
                  {'\n\n'}
                  (Left is "no", right is "yes")
                </DefaultText>
              }
              {showTutorial && questionNumber === 3 &&
                <DefaultText style={{fontSize: adjustedFontSize * 0.8}}>
                  {'\n\n'}
                  (As always, 👈 = no, yes = 👉)
                </DefaultText>
              }
            </DefaultText>
          </View>
          {showAnswerPubliclyCheckBox &&
            <CheckBox
              value={answerPubliclyValue}
              initialValue={answerPubliclyInitialValue}
              labelPosition="left"
              containerStyle={{
                marginTop: 0,
                marginBottom: 25,
                marginRight: 30,
                alignSelf: 'flex-end',
              }}
              onValueChange={onChangeAnswerPublicly}
            >
              Answer Publicly
            </CheckBox>
          }
          {extraChildren}
          {!extraChildren &&
            <LinearGradient
              locations={[
                0.0,
                0.15,
                1.0,
              ]}
              colors={[
                'transparent',
                'rgba(0, 0, 0, 0.85)',
                'rgba(0, 0, 0, 1.0)',
              ]}
              style={{
                width: '100%',
                height: 95,
              }}
            />
          }
        </View>
      </ImageBackground>
    </Animated.View>
  );
};

const AnswerIcon = ({answer, selected, enabled}) => {
  const backgroundColor = (() => {
    if (selected === false) return 'white';
    if (enabled) return '#70f';
    return '#cabcff';
  })();

  const checkColor = (() => {
    if (selected) return 'white';
    if (enabled) return 'black';
    return '#bcbcbc';
  })();

  return (
    <View
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        padding: 2,
        backgroundColor: backgroundColor,
        borderColor: selected === false ? '#bbb' : 'transparent',
        borderWidth: 1,
        borderRadius: 999,
        overflow: 'visible',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 3,
      }}
    >
      {answer === 'yes' ?
        <Check
          stroke={checkColor}
          width={18}
          height={18}
          /> :
        <X
          stroke={checkColor}
          width={18}
          height={18}
          />
      }
    </View>
  );
};

const AnswerIconGroup = ({answer, enabled}) => {
  return (
    <View
      style={{
        flexDirection: 'row',
      }}
    >
      <AnswerIcon answer="no" selected={answer === false} enabled={enabled}/>
      <DefaultText> </DefaultText>
      <AnswerIcon answer="yes" selected={answer === true} enabled={enabled}/>
    </View>
  );
};

const nextAnswer = (thisAnswer: boolean | null) => {
  if (thisAnswer === true) return false;
  if (thisAnswer === false) return null;
  if (thisAnswer === null) return true;
};

const AnsweredQuizCard = ({
  children,
  questionNumber,
  topic,
  user1,
  answer1,
  user2,
  answer2,
  answer2Publicly,
}) => {
  type CardState = {
    answer: boolean | null,
    public_: boolean,
  }

  const [state, setState] = useState<CardState>({
    answer: answer2,
    public_: answer2Publicly
  });

  const textColor = useCallback(() => {
    if (state.answer === null)
      return '#666';
    if (answer1 === state.answer) {
      return '#5a5';
    } else {
      return '#e57';
    }
  }, [state.answer])();

  const onPressAnswerIconGroup = useCallback(async () => {
    setState((state: CardState): CardState => {
      const nextAnswer_ = nextAnswer(state.answer);

      quizQueue.addTask(async () => {
        await japi(
          'post',
          '/answer',
          {
            question_id: questionNumber,
            answer: nextAnswer_,
            public: state.public_,
          }
        );

        markTraitDataDirty();
      });

      return {
        ...state,
        answer: nextAnswer_,
      };
    });
  }, [setState]);

  const onChangeAnswerPublicly = useCallback((public_: boolean) => {
    setState((state: CardState): CardState => {
      quizQueue.addTask(async () =>
        japi(
          'post',
          '/answer',
          {
            question_id: questionNumber,
            answer: state.answer,
            public: public_,
          }
        )
      );

      return {
        ...state,
        public_: public_,
      };
    });
  }, [setState]);

  const extraChildren = (
    <View
      style={{
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        paddingBottom: 20,
        paddingLeft: 20,
        paddingRight: 20,
      }}
    >
      <View
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          marginRight: 30,
        }}
      >
        <DefaultText style={{ fontWeight: '500', color: textColor }} >
          {user1}:{' '}
        </DefaultText>
        <AnswerIconGroup answer={answer1} enabled={false}/>
      </View>
      <View
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
        }}
      >
        <DefaultText style={{ fontWeight: '500', color: '#666' }}>
          {user2}:{' '}
        </DefaultText>
        <Pressable onPress={onPressAnswerIconGroup}>
          <AnswerIconGroup answer={state.answer} enabled={true}/>
        </Pressable>
      </View>
    </View>
  );

  return (
    <NonInteractiveQuizCard
      answerPubliclyInitialValue={answer2Publicly}
      onChangeAnswerPublicly={onChangeAnswerPublicly}
      questionNumber={questionNumber}
      topic={topic}
      containerStyle={{
        height: undefined,
        width: undefined,
        paddingLeft: 15,
        paddingRight: 15,
      }}
      innerStyle={{
        flexGrow: undefined,
        width: '100%',
      }}
      maxFontSize={18}
      extraChildren={extraChildren}
    >
      {children}
    </NonInteractiveQuizCard>
  );
};

const SearchQuizCard = ({children, questionNumber, topic, answer}) => {
  const [answerState, setAnswer2State] = useState(answer);

  const onPress = useCallback(() => {
    setAnswer2State(answer => nextAnswer(answer));
  }, []);

  const extraChildren = (
    <View
      style={{
        width: '100%',
        paddingLeft: 20,
        paddingRight: 20,
      }}
    >
      <View
        style={{
          alignItems: 'center',
          justifyContent: 'space-between',
          flexDirection: 'row',
          flexWrap: 'wrap',
          paddingBottom: 20,
        }}
      >
        <View
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
          }}
        >
          <DefaultText
            style={{
              fontWeight: '500',
              color: '#666'
            }}
          >
            Answer: </DefaultText>
          <Pressable onPress={onPress}>
            <AnswerIconGroup answer={answerState} enabled={true}/>
          </Pressable>
        </View>
        <CheckBox
          initialValue={true}
          labelPosition="left"
          containerStyle={{
            marginTop: 0,
            marginBottom: 0,
            marginRight: 0,
            marginLeft: 0,
          }}
        >
          <DefaultText
            style={{
              fontWeight: '500',
              color: '#666'
            }}
          >
            Accept unanswered
          </DefaultText>
        </CheckBox>
      </View>
    </View>
  );

  return (
    <NonInteractiveQuizCard
      answerPubliclyInitialValue={true}
      questionNumber={questionNumber}
      topic={topic}
      containerStyle={{
        height: undefined,
        width: undefined,
        paddingLeft: 0,
        paddingRight: 0,
      }}
      innerStyle={{
        flexGrow: undefined,
        width: '100%',
      }}
      maxFontSize={18}
      extraChildren={extraChildren}
      showAnswerPubliclyCheckBox={false}
    >
      {children}
    </NonInteractiveQuizCard>
  );
};

type BottomQuizCardProps = {
  status: "loading" | "no-more-cards"
}

const SkeletonQuizCard = (props) => {
  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        ...cardPadding,
        ...props.innerStyle,
      }}
    >
      <Skeleton
        style={{
          height: '100%',
          ...cardBorders,
          backgroundColor: 'rgb(220, 220, 225)',
        }}
        skeletonStyle={{
          backgroundColor: 'rgb(240, 240, 245)',
        }}
      />
    </Animated.View>
  );
};

const NoMoreCards = () => {
  return (
    <View
      style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 5,
        paddingBottom: 5,
      }}
    >
      <DefaultText
        style={{
          fontFamily: 'TruenoBold',
          fontSize: 22,
          textAlign: 'center',
          padding: '20%',
        }}
      >
        Those are all the questions we've got for now
      </DefaultText>
    </View>
  );
};

export {
  AnsweredQuizCard,
  NoMoreCards,
  QuizCard,
  SearchQuizCard,
  SkeletonQuizCard,
}
