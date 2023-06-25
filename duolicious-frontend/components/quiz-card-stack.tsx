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
import { api, japi } from '../api/api';
import * as _ from "lodash";

const QuizCardMemo = memo(QuizCard);

declare interface ApiInterface {
  yes(): Promise<void>
  no(): Promise<void>
  skip(): Promise<void>
  undo(): Promise<void>
  canUndo(): boolean
  canSwipe(): boolean
}

class PromiseQueue {
  private taskQueue: Array<() => Promise<any>>;

  constructor() {
    this.taskQueue = [];
  }

  async addTask(task: () => Promise<any>): Promise<void> {
    // Add task to the queue
    this.taskQueue.push(task);

    // If there's more than one task in the queue, the previous tasks are still
    // running So we just return and let them finish
    if (this.taskQueue.length > 1) return;

    // Process all tasks
    while (this.taskQueue.length > 0) {
      const currentTask = this.taskQueue[0];
      await currentTask();
      this.taskQueue.shift();
    }
  }
}


// Operations on the cards need to finish in order. If we send two http request
// at roughly the same time, the server will see them in an arbitrary order. So
// if the user undoes then re-answers a question in short succession, their
// re-answer might be deleted. So we use a queue to make sure that doesn't
// happen.
const apiQueue = new PromiseQueue();

const getRandomArbitrary = (min: number, max: number) => {
  return Math.random() * (max - min) + min;
}

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

const delay = async (ms: number) => {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const fetchNextQuestions = async (n: number = 10, o: number = 0): Promise<{
  id: number,
  question: string,
  topic: string,
  yesPercentage: string,
  noPercentage: string
}[]> => {
  const response = await api('GET', `/next-questions?n=${n}&o=${o}`);

  return response.json.map(q => ({
    id: q.id,
    question: q.question,
    topic: q.topic,
    yesPercentage: Math.round(q.count_yes / (q.count_yes + q.count_no + 1e-5)).toString(),
    noPercentage:  Math.round(q.count_no  / (q.count_yes + q.count_no + 1e-5)).toString(),
  }));
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
  cards: CardState[]
  prospects: ProspectState[]
  topCardIndex: number
  questionNumbers: Set<number>
};

type CardState = {
  isFetched: boolean
  questionNumber: number | undefined
  questionText: string | undefined
  topic: string | undefined
  noPercentage: string | undefined
  yesPercentage: string | undefined
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
  cards: [],
  prospects: [],
  questionNumbers: new Set<number>(),
};

const unfetchedCard = (): CardState => {
  const scale = new Animated.Value(0);

  const interpolatedScale = scale.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1]
  });

  return {
    isFetched: false,
    questionNumber: undefined,
    questionText: undefined,
    topic: undefined,
    noPercentage: getRandomInt(100).toString(),
    yesPercentage: getRandomInt(100).toString(),
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

const numRemainingCards = (state: StackState): number => {
  return state.cards.length - state.topCardIndex;
};

const addNextCardsInPlace = async (
  state: StackState,
  onAddCallback?: () => void,
  onFetchCallback?: () => void,
  onTopCardChangedCallback?: () => void,
): Promise<void> => {
  const targetStackSize = 15
  const targetStackSizeSlack = 5;

  const numRemainingCards_ = numRemainingCards(state);
  const bottomCardIndex = state.cards.length - 1;
  const bottomCard = state.cards[bottomCardIndex];

  if (numRemainingCards_ + targetStackSizeSlack > targetStackSize) {
    return;
  }

  const numCardsToAdd = (targetStackSize + targetStackSizeSlack) - numRemainingCards_;

  const unfetchedCards = Array(numCardsToAdd)
    .fill(undefined)
    .map(unfetchedCard);
  state.cards.push(...unfetchedCards);

  numRemainingCards_ < 2 && onAddCallback && onAddCallback();

  const nextQuestions = await fetchNextQuestions(
    unfetchedCards.length, numRemainingCards_);

  // Pop the unfetched cards off the stack in case the server is running out of
  // questions and can't give us enough cards to meet the target.
  unfetchedCards.forEach(() => state.cards.pop());

  _.zip(unfetchedCards, nextQuestions).forEach(([u, q]) => {
    if (!state.questionNumbers.has(q.id)) {
      state.questionNumbers.add(q.id);

      u.questionNumber = q.id;
      u.questionText = q.question;
      u.topic = q.topic;
      u.yesPercentage = q.yesPercentage;
      u.noPercentage = q.noPercentage;
      u.isFetched = true;
    }
  });

  const fetchedCards = unfetchedCards.filter(c => c.isFetched);
  state.cards.push(...fetchedCards);

  numRemainingCards_ < 2 && onFetchCallback && onFetchCallback();

  numRemainingCards_ === 0 &&
    onTopCardChangedCallback &&
    onTopCardChangedCallback();
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
  card1,
  card2,
  card3,
  triggerRender,
  onSwipe,
  onCardLeftScreen,
  onMountQuizCard,
}) => {
  const stackContainerStyle = useRef<StyleProp<ViewStyle>>({
    flexGrow: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 600,
  }).current;

  const cards: CardState[] = [card1, card2, card3].filter(Boolean);

  const onScreenCards = cards.filter(c => c.isFetched && !c.swipeDirection);

  return (
    <View style={stackContainerStyle}>
      {!onScreenCards.length && <NoMoreCards/>}
      {
        cards.map((card, i) => {
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
              onMount={onMountQuizCard}
            >
              {card.questionText}
            </QuizCardMemo>
          } else {
            return <SkeletonQuizCard
              key={`${i}-skeleton-quiz-card`}
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

      apiQueue.addTask(
        async () => await japi(
          'delete',
          '/answer',
          { question_id: previouslySwipedCard.questionNumber }
        )
      );

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
    canSwipe() {
      return stateRef.topCardIndex < stateRef.cards.length;
    }
  }

  innerRef.current = new Api();

  const onSwipe_ = useCallback(async (direction: Direction) => {
    const swipedCard = stateRef.cards[stateRef.topCardIndex];

    swipedCard.swipeDirection = direction;

    apiQueue.addTask(
      async () => {
        const answer = (() => {
          if (direction === 'left') return false;
          if (direction === 'right') return true;
          if (direction === 'down') return null;
        })();

        await japi(
          'post',
          '/answer',
          {
            question_id: swipedCard.questionNumber,
            answer: answer,
            public: swipedCard.answerPublicly
          }
        );

        addNextCardsInPlace(
          stateRef,
          undefined,
          triggerRender,
          onTopCardChanged
        );

        if (direction === 'left' || direction === 'right') {
          addNextProspectsInPlace(stateRef, triggerRender);
        }
      }
    );

    stateRef.topCardIndex++;

    onTopCardChanged && onTopCardChanged();

    onSwipe(direction);
  }, []);

  const onCardLeftScreen = useCallback(() => {
    triggerRender();
  }, []);

  useEffect(() => {
    addNextProspectsInPlace(stateRef, triggerRender, 3);

    addNextCardsInPlace(
      stateRef,
      triggerRender,
      triggerRender,
      onTopCardChanged
    );
  }, []);

  const onMountQuizCard = useCallback((questionNumber: number) => {
    japi('post', '/view-question', { question_id: questionNumber });
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
        card1={stateRef.cards[stateRef.topCardIndex + 1]}
        card2={stateRef.cards[stateRef.topCardIndex + 0]}
        card3={stateRef.cards[stateRef.topCardIndex - 1]}
        triggerRender={triggerRender}
        onSwipe={onSwipe_}
        onCardLeftScreen={onCardLeftScreen}
        onMountQuizCard={onMountQuizCard}
      />
    </>
  );
};

export {
  ApiInterface,
  QuizCardStack
};
