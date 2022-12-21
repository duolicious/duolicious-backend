import {
  Animated,
  View,
  StyleProp,
  ViewStyle,
} from 'react-native';
import {
  createRef,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  SkeletonQuizCard,
  NoMoreCards,
  QuizCard,
} from './quiz-card';
import { Direction } from 'react-tinder-card'
import { Avatar } from './avatar';
import { DonutChart } from './donut-chart';
import { DefaultText } from './default-text';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBarSpacer } from './status-bar-spacer';

const QuizCardMemo = memo(QuizCard);

declare interface ApiInterface {
  yes(): Promise<void>
  no(): Promise<void>
  skip(): Promise<void>
  undo(): Promise<void>
  canUndo(): boolean
}

const getRandomArbitrary = (min: number, max: number) => {
  return Math.random() * (max - min) + min;
}

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

const delay = async (ms: number) => {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const fetchNextQuiz = async (): Promise<string> => {
  await delay(getRandomInt(3000)); // Simulate network delay TODO

  const r = Math.round(getRandomArbitrary(0.0, 5.0));

  // return "You're in a relationship with someone who has a history of emotional manipulation and gaslighting, but you've been able to set healthy boundaries and make progress together. A new person comes into your life who seems genuine and empathetic, but you're not sure if they can handle the challenges of being with someone who has been emotionally abused in the past. Do you stick with your current partner or take a chance on the new person?";

  if (r === 0) {
    return 'Are you a Trump fan?';
  } else if (r === 1) {
    return 'Do you think feminism has had a positive effect on society?';
  } else if (r === 2) {
    return 'No one chooses their country of birth, so it’s foolish to be proud of it. ' +
    'No one chooses their country of birth, so it’s foolish to be proud of it. ' +
    'No one chooses their country of birth, so it’s foolish to be proud of it. ' +
    'No one chooses their country of birth, so it’s foolish to be proud of it. ' +
    'No one chooses their country of birth, so it’s foolish to be proud of it.' +
    'Do you agree?';
  } else if (r === 3) {
    return 'Do you like to watch scary movies?';
  } else if (r === 4) {
    return "Do you subscribe to the philosophy that responsibility's cool, but there's more things in life, like getting your dick rode all fuckin' night?";
  } else {
    return 'Do you like the taste of beer?';
  }
};

var matchPercentage = 0; // TODO Delete me
const randomProspect = (): ProspectState => {
  const animation = new Animated.Value(0);

  const interpolatedLeft = animation.interpolate({
    inputRange: [0, 3],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  const interpolatedScale = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.75, 1],
    extrapolate: 'clamp',
  });

  const interpolatedDonutOpacity = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });


  const interpolatedOpacity = animation.interpolate({
    inputRange: [2, 3],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return {
    userId: getRandomInt(99),
    matchPercentage: matchPercentage++,
    style: {
      transform: [
        { scale: interpolatedScale },
      ],
      opacity: interpolatedOpacity,
      left: interpolatedLeft
    },
    donutOpacity: interpolatedDonutOpacity,
    animation: animation,
  };
};

const fetchNBestProspects = async (n: number): Promise<ProspectState[]> => {
  await delay(getRandomInt(3000)); // Simulate network delay TODO

  return [...Array(n)].map(randomProspect);
};

type StackState = {
  serverHasMoreCards: boolean
  cards: CardState[]
  prospects: ProspectState[]
  topCardIndex: number
};

type CardState = {
  isFetched: boolean
  questionNumber: number
  questionText: string | undefined
  topic: string | undefined
  noPercentage: number
  yesPercentage: number
  style: {
    transform: [
      { rotate: string },
      { scale: Animated.AnimatedInterpolation<string | number> },
    ]
  }
  answerPublicly: boolean
  swipeDirection: Direction | undefined
  onChangeAnswerPublicly: (answerPublicly: boolean) => void
  preventSwipe: Direction[]
  scale: Animated.Value
  ref: any
};

type ProspectState = {
  userId: number
  matchPercentage: number
  style: {
    transform: [
      { scale: Animated.AnimatedInterpolation<string | number> },
    ],
    opacity: Animated.AnimatedInterpolation<string | number>
    left: Animated.AnimatedInterpolation<string | number>
  },
  donutOpacity: Animated.AnimatedInterpolation<string | number>
  animation: Animated.Value
};

const initialState: StackState = {
  topCardIndex: 0,
  serverHasMoreCards: true,
  cards: [],
  prospects: [],
};

const unfetchedCard = (questionNumber: number): CardState => {
  const scale = new Animated.Value(0);

  const interpolatedScale = scale.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1]
  });

  return {
    isFetched: false,
    questionNumber: questionNumber,
    questionText: undefined,
    topic: undefined,
    noPercentage: getRandomInt(100),
    yesPercentage: getRandomInt(100),
    answerPublicly: true,
    swipeDirection: undefined,
    style: {
      transform: [
        { rotate: getRandomArbitrary(-0.02, 0.02) + 'rad' },
        { scale: interpolatedScale },
      ],
    },
    onChangeAnswerPublicly: undefined,
    preventSwipe: ['up'],
    scale: scale,
    ref: createRef(),
  };
};

const fetchCardContents = async (card: CardState): Promise<CardState> => {
  return card.isFetched ?
    card :
    {
      ...card,
      questionText: await fetchNextQuiz(),
      topic: 'Ethics',
      isFetched: true,
    };
};

const numRemainingCards = (state: StackState): number => {
  return state.cards.length - state.topCardIndex;
};

const addNextCardInPlace = async (
  state: StackState,
  onAddCallback?: () => void,
  onFetchCallback?: () => void
) => {
  const numRemainingCards_ = numRemainingCards(state);
  const bottomCardIndex = state.cards.length - 1;
  const bottomCard = state.cards[bottomCardIndex];
  const nextQuestionNumber =
    state.cards.length === 0 ?
    1 :
    bottomCard.questionNumber + 1;

  state.cards.push(unfetchedCard(nextQuestionNumber));

  numRemainingCards_ < 2 && onAddCallback && onAddCallback();

  const newBottomCardIndex = state.cards.length - 1;
  state.cards[newBottomCardIndex] = await fetchCardContents(
    state.cards[newBottomCardIndex]
  );
  numRemainingCards_ < 2 && onFetchCallback && onFetchCallback();
};

const addNextProspectsInPlace = async (
  state: StackState,
  callback?: () => void,
  n: number = 1,
) => {
  const prospects = state.prospects;

  prospects.push(...await fetchNBestProspects(n));

  Animated.parallel(
    getBestProspects(prospects).map((prospect, i) => {
      return Animated.timing(prospect.animation, {
        toValue: i,
        duration: 500,
        useNativeDriver: false,
      })
    })
  ).start();

  const offscreenProspect = prospects[prospects.length - 5];
  if (offscreenProspect) {
    offscreenProspect.animation.setValue(3);
  }

  callback && callback();
};

const removeNextProspectInPlace = async (
  state: StackState,
  callback?: () => void,
) => {
  const prospects = state.prospects;

  Animated.parallel(
    getBestProspects(prospects).map((prospect, i) => {
      return Animated.timing(prospect.animation, {
        toValue: i - 1,
        duration: 500,
        useNativeDriver: false,
      });
    })
  ).start(() => {
    getBestProspects(prospects).map((prospect, i) => {
      prospect.animation.setValue(i - 1);
    });
    prospects.pop();
    callback && callback();
  });
};

const getBestProspects = (prospects: ProspectState[]) => {
  return [
    prospects[prospects.length - 1],
    prospects[prospects.length - 2],
    prospects[prospects.length - 3],
    prospects[prospects.length - 4],
  ].filter(prospect => prospect);
};

const Prospects = ({
  navigation,
  prospect1,
  prospect2,
  prospect3,
  prospect4,
}: {
  navigation: any,
  prospect1: ProspectState | undefined,
  prospect2: ProspectState | undefined,
  prospect3: ProspectState | undefined,
  prospect4: ProspectState | undefined,
}) => {
  const lgColors = useRef([
    'rgb(255, 255, 255)',
    'rgba(255, 255, 255, 0.1)',
    'transparent',
  ]).current;
  const lgLocations = useRef([
    0.0,
    0.75,
    1.0,
  ]).current;
  const lgStyle = useRef({
    width: '100%',
    zIndex: 999,
    paddingTop: 5,
    paddingBottom: 10,
  }).current;

  const v1Style = useRef<StyleProp<ViewStyle>>({
    marginLeft: 5,
    marginRight: 5,
    flexDirection: 'row',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 600,
  }).current;

  const dcViewStyle = useRef<StyleProp<ViewStyle>>({
    alignItems: 'center',
    justifyContent: 'center',
    width: '33.333%',
  }).current;
  const dcStyle = useRef({
    width: 90,
    height: 90,
    backgroundColor: 'white',
    borderRadius: 999,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  }).current;

  const Prospect = useCallback(({style, userId, matchPercentage}) => (
    <Animated.View
      style={{
        position: 'absolute',
        width: '33.3333%',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      <Avatar
        navigation={navigation}
        userId={userId}
        percentage={matchPercentage}
        shadow={true}
      />
    </Animated.View>
  ), []);

  const ProspectDonutPercentage = useCallback(({donutOpacity, matchPercentage}) => (
    <Animated.View
      style={{
        position: 'absolute',
        left: 0,
        alignItems: 'center',
        justifyContent: 'center',
        width: '33.333%',
        opacity: donutOpacity,
      }}
    >
      <DonutChart
        style={{
          width: 90,
          height: 90,
          backgroundColor: 'white',
          borderRadius: 999,
        }}
        percentage={matchPercentage}
      >
        <DefaultText
          style={{
            paddingBottom: 7,
            fontWeight: '500',
            fontSize: 9,
          }}
        >
          Best Match
        </DefaultText>
      </DonutChart>
    </Animated.View>
  ), []);

  const BestMatches = useCallback(() => (
    <View
      style={{
        width: '100%',
        maxWidth: 600,
        alignSelf: 'center',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 5,
        }}
      >
        <View
          style={{
            height: 1,
            flexGrow: 1,
            backgroundColor: 'black',
            marginLeft: 5,
            marginRight: 5,
          }}
        />
        <DefaultText
          style={{
            textAlign: 'center',
            fontWeight: '500',
          }}
        >
          Best Matches Based on Q&A
        </DefaultText>
        <View
          style={{
            height: 1,
            flexGrow: 1,
            backgroundColor: 'black',
            marginLeft: 5,
            marginRight: 5,
          }}
        />
      </View>
    </View>
  ), []);

  const bestMatchPercentage = prospect1?.matchPercentage;
  const bestProspects = [
    prospect1,
    prospect2,
    prospect3,
    prospect4,
  ].filter(prospect => prospect);

  return (
    <LinearGradient
      colors={lgColors}
      locations={lgLocations}
      style={lgStyle}
    >
      <StatusBarSpacer extraHeight={0}/>
      <View style={v1Style}>
        {
          bestProspects.map((prospect, i) =>
            <Prospect
              key={`${prospect.userId}-${prospect.matchPercentage}`}
              style={prospect.style}
              userId={prospect.userId}
              matchPercentage={prospect.matchPercentage} />
          )
        }
        <View style={dcViewStyle}>
          <DonutChart style={dcStyle} percentage={undefined}/>
        </View>
        {
          bestProspects.map((prospect, i) =>
            <ProspectDonutPercentage
              key={`${prospect.userId}-${prospect.matchPercentage}`}
              donutOpacity={prospect.donutOpacity}
              matchPercentage={prospect.matchPercentage}
            />
          )
        }
      </View>
      <BestMatches/>
    </LinearGradient>
  );
};

const ProspectsMemo = memo(Prospects);

const QuizCardStack_ = ({
  serverHasMoreCards,
  card1,
  card2,
  card3,
  triggerRender,
  onSwipe,
  onCardLeftScreen,
}) => {
  const stackContainerStyle = useRef<StyleProp<ViewStyle>>({
    flexGrow: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 600,
  }).current;

  return (
    <View style={stackContainerStyle}>
      {!serverHasMoreCards && <NoMoreCards/>}
      {
        [
          card1,
          card2,
          card3,
        ].map((card, i) => {
            if (card === undefined) {
              return;
            }

            Animated.timing(card.scale, {
              toValue: 1.0,
              duration: 500,
              useNativeDriver: false,
            }).start();

            card.onChangeAnswerPublicly = card.onChangeAnswerPublicly ?? (
              (answerPublicly: boolean) => {
                card.answerPublicly = answerPublicly;
                triggerRender();
              }
            );

            if (card.isFetched) {
              return <QuizCardMemo
                key={`${card.questionNumber}-quiz-card`}
                initialPosition={card.swipeDirection}
                preventSwipe={card.preventSwipe}
                innerRef={card.ref}
                onSwipe={onSwipe}
                onCardLeftScreen={onCardLeftScreen}
                nonInteractiveContainerStyle={card.style}
                questionNumber={card.questionNumber}
                topic={card.topic}
                noPercentage={card.noPercentage}
                yesPercentage={card.yesPercentage}
                answerPubliclyValue={card.answerPublicly}
                onChangeAnswerPublicly={card.onChangeAnswerPublicly}
              >
                {card.questionText}
              </QuizCardMemo>
            } else {
              return <SkeletonQuizCard
                key={`${card.questionNumber}-skeleton-quiz-card`}
                innerStyle={card.style}
              />
            }
        })
      }
    </View>
  );
};

const QuizCardStackMemo = memo(QuizCardStack_);

const QuizCardStack = (props) => {
  const {
    innerRef,
    onTopCardChanged,
    onSwipe,
    navigation,
  } = props;

  const stateRef = useRef<StackState>(initialState).current;

  const [, triggerRender_] = useState({});
  const triggerRender = () => triggerRender_({});

  class Api implements ApiInterface {
    async swipe(direction) {
      const cards = stateRef.cards;
      const topCardIndex = stateRef.topCardIndex;
      const topCard = cards[topCardIndex];
      const topCardRef = topCard.ref.current;
      if (topCardRef) {
        topCard.ref.current.swipe(direction);
      }
    }
    async restoreCard() {
      if (stateRef.topCardIndex === 0) {
        return;
      }

      const bottomCard = stateRef.cards[
        stateRef.topCardIndex + 1
      ];

      if (bottomCard) {
        bottomCard.scale.setValue(0);
      }

      const previouslySwipedCard = stateRef.cards[
        stateRef.topCardIndex - 1
      ];

      previouslySwipedCard.ref.current.restoreCard();

      if (
        previouslySwipedCard.swipeDirection === 'left' ||
        previouslySwipedCard.swipeDirection === 'right'
      ) {
        removeNextProspectInPlace(stateRef, triggerRender);
      }

      previouslySwipedCard.swipeDirection = undefined;

      stateRef.topCardIndex--;

      triggerRender();
      onTopCardChanged && onTopCardChanged();
    }

    async yes () { await this.swipe('right') }
    async no  () { await this.swipe('left') }
    async skip() { await this.swipe('down') }
    async undo() { await this.restoreCard() }
    canUndo() {
      return stateRef.topCardIndex > 0;
    }
  }

  innerRef.current = new Api();

  const onSwipe_ = useCallback(async (direction: Direction) => {
    addNextCardInPlace(stateRef, undefined, triggerRender);
    // TODO: This should happen after  the server has received and processes the swipe
    if (direction === 'left' || direction === 'right') {
      addNextProspectsInPlace(stateRef, triggerRender);
    }

    const swipedCard = stateRef.cards[stateRef.topCardIndex];

    swipedCard.swipeDirection = direction;

    stateRef.topCardIndex++;

    onTopCardChanged && onTopCardChanged();

    onSwipe(direction);
  }, []);

  const onCardLeftScreen = useCallback(() => {
    triggerRender();
  }, []);

  useEffect(() => {
    addNextProspectsInPlace(stateRef, triggerRender, 3);

    addNextCardInPlace(stateRef, triggerRender, triggerRender);
    addNextCardInPlace(stateRef, triggerRender, triggerRender);

    onTopCardChanged && onTopCardChanged();

    // Maintain a buffer to 10 questions, in addition to the two visible cards
    // on the top of the stack
    for (var i = 0; i < 10; i++) {
      addNextCardInPlace(stateRef);
    }
  }, []);

  return (
    <>
      <ProspectsMemo
        navigation={navigation}
        prospect1={stateRef.prospects[stateRef.prospects.length - 1]}
        prospect2={stateRef.prospects[stateRef.prospects.length - 2]}
        prospect3={stateRef.prospects[stateRef.prospects.length - 3]}
        prospect4={stateRef.prospects[stateRef.prospects.length - 4]}
      />
      <QuizCardStackMemo
        serverHasMoreCards={stateRef.serverHasMoreCards}
        card1={stateRef.cards[stateRef.topCardIndex + 1]}
        card2={stateRef.cards[stateRef.topCardIndex + 0]}
        card3={stateRef.cards[stateRef.topCardIndex - 1]}
        triggerRender={triggerRender}
        onSwipe={onSwipe_}
        onCardLeftScreen={onCardLeftScreen}
      />
    </>
  );
};

export {
  ApiInterface,
  QuizCardStack
};
