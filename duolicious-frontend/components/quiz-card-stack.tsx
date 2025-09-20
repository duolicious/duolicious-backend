import {
  Animated,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import {
  createRef,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  SkeletonQuizCard,
  NoMoreCards,
  QuizCard,
} from './quiz-card';
import { Direction } from './base-quiz-card';
import { Avatar } from './avatar';
import { DonutChart } from './donut-chart';
import { DefaultText } from './default-text';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBarSpacer } from './status-bar-spacer';
import { api, japi } from '../api/api';
import { quizQueue } from '../api/queue';
import * as _ from "lodash";
import { useSkipped } from '../hide-and-block/hide-and-block';
import { useAppTheme } from '../app-theme/app-theme';

const styles = StyleSheet.create({
  stackContainerStyle: {
    flexGrow: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 600,
    // @ts-ignore
    touchAction: 'none',
  },
});


const QuizCardMemo = memo(QuizCard);

declare interface ApiInterface {
  yes(): Promise<void>
  no(): Promise<void>
  skip(): Promise<void>
  undo(): Promise<void>
  canUndo(): boolean
  canSwipe(): boolean
}

const getRandomArbitrary = (min: number, max: number) => {
  return Math.random() * (max - min) + min;
}

const getRandomInt = (max) => Math.floor(Math.random() * max);

const fetchNextQuestions = async (n: number = 10, o: number = 0): Promise<{
  id: number,
  question: string,
  topic: string,
  yesPercentage: string,
  noPercentage: string
}[]> => {
  const response = await api('GET', `/next-questions?n=${n}&o=${o}`);

  const clamp = (min, max, x) => Math.min(max, Math.max(min, x));

  const percentage = (numerator: number, denominator_b: number): string => {
    return Math.round(
      100 * clamp(0, 99, numerator / (numerator + denominator_b + 1e-5))
    ).toString()
  };

  return response.json.map(q => ({
    id: q.id,
    question: q.question,
    topic: q.topic,
    yesPercentage: percentage(q.count_yes, q.count_no),
    noPercentage:  percentage(q.count_no, q.count_yes),
  }));
};

const prospectState = (
  personId: number,
  personUuid: string,
  photoUuid: string,
  photoBlurhash: string,
  matchPercentage: number,
  verificationRequired: 'photos' | 'basics' | null,
): ProspectState => {
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
    personId: personId,
    personUuid: personUuid,
    photoUuid: photoUuid,
    photoBlurhash: photoBlurhash,
    matchPercentage: matchPercentage,
    verificationRequired: verificationRequired,
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

const fetchNBestProspects = async (
  n: number,
  refreshNeighborhood: boolean,
): Promise<ProspectState[]> => {
  const response = refreshNeighborhood || n > 1 ?
    await japi('get', `/search?n=${n}&o=0`) :
    await japi('get', '/search');

  if (!response.ok) {
    return [];
  }

  response.json.reverse();
  return response.json.map(x => prospectState(
    x.prospect_person_id,
    x.prospect_uuid,
    x.profile_photo_uuid,
    x.profile_photo_blurhash,
    x.match_percentage,
    x.verification_required_to_view,
  ));
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
  onChangeAnswerPublicly: ((answerPublicly: boolean) => void) | undefined
  preventSwipe: Direction[]
  scale: Animated.Value
  ref: any
};

type ProspectState = {
  personId: number
  personUuid: string
  photoUuid: string
  photoBlurhash: string
  matchPercentage: number
  verificationRequired: 'photos' | 'basics' | null
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

const initialState = (): StackState => ({
  topCardIndex: 0,
  cards: [],
  prospects: [],
  questionNumbers: new Set<number>(),
});

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
    if (u && q && !state.questionNumbers.has(q.id)) {
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

  const topCardQuestionNumber = state.cards[
    state.topCardIndex
  ]?.questionNumber ?? -1;

  prospects.push(...await fetchNBestProspects(
    n,
    [4, 8, 16, 32, 64].includes(topCardQuestionNumber)
  ));

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

const Prospect = ({
  navigation,
  style,
  personId,
  personUuid,
  photoUuid,
  photoBlurhash,
  matchPercentage,
  verificationRequired,
}) => {
  const { isSkipped, wasPostSkipFiredInThisSession } = useSkipped(personUuid);

  return <Animated.View
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
      personId={personId}
      personUuid={personUuid}
      photoUuid={photoUuid}
      photoBlurhash={photoBlurhash}
      percentage={matchPercentage}
      isSkipped={isSkipped && wasPostSkipFiredInThisSession}
      verificationRequired={verificationRequired}
    />
  </Animated.View>
};

const ProspectDonutPercentage = ({ donutOpacity, matchPercentage }) => {
  const { appTheme } = useAppTheme();

  return (
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
          backgroundColor: appTheme.primaryColor,
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
  );
};

const Prospects = ({
  navigation,
  topCardIndex,
  prospect1,
  prospect2,
  prospect3,
  prospect4,
}: {
  navigation: any,
  topCardIndex: number,
  prospect1: ProspectState | undefined,
  prospect2: ProspectState | undefined,
  prospect3: ProspectState | undefined,
  prospect4: ProspectState | undefined,
}) => {
  const { appTheme } = useAppTheme();

  const animatedTranslateY = useRef(new Animated.Value(0)).current;

  const translateY = animatedTranslateY.interpolate({
    inputRange: [0, 1],
    outputRange: [-150, 0],
    extrapolate: 'clamp',
  });

  const lgColors = useMemo<readonly [string, string, string]>(() => [
    `${appTheme.primaryColor}ff`,
    `${appTheme.primaryColor}bf`,
    `${appTheme.primaryColor}00`,
  ], [appTheme.primaryColor]);

  const lgLocations = useRef<readonly [number, number, number]>([
    0.0,
    0.75,
    1.0,
  ]).current;

  const lgStyle = useRef<StyleProp<ViewStyle>>({
    width: '100%',
    zIndex: 999,
    paddingTop: 5,
    paddingBottom: 15,
  }).current;

  const v1Style = useRef<Animated.WithAnimatedValue<StyleProp<ViewStyle>>>({
    marginLeft: 5,
    marginRight: 5,
    flexDirection: 'row',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 600,
    transform: [
      { translateY: translateY },
    ],
  }).current;

  const dcViewStyle = useRef<StyleProp<ViewStyle>>({
    alignItems: 'center',
    justifyContent: 'center',
    width: '33.333%',
  }).current;

  const bestProspects = [
    prospect1,
    prospect2,
    prospect3,
    prospect4,
  ].flatMap(prospect => prospect ? [prospect] : []);

  useEffect(() => {
    Animated.parallel([
      ...bestProspects.map((prospect, i) => {
        return Animated.timing(prospect.animation, {
          toValue: i,
          duration: 500,
          useNativeDriver: false,
        })
      }),
      Animated.timing(animatedTranslateY, {
        toValue: bestProspects.some(Boolean) ? 1 : 0,
        duration: 500,
        useNativeDriver: false,
      })
    ]).start();
  }, [prospect1, prospect2, prospect3, prospect4]);

  return (
    <LinearGradient
      colors={lgColors}
      locations={lgLocations}
      style={lgStyle}
    >
      <StatusBarSpacer extraHeight={0}/>
      <Animated.View style={v1Style}>
        {
          bestProspects.map((prospect, i) =>
            <Prospect
              key={String(topCardIndex - i)}
              navigation={navigation}
              style={prospect.style}
              personId={prospect.personId}
              personUuid={prospect.personUuid}
              photoUuid={prospect.photoUuid}
              photoBlurhash={prospect.photoBlurhash}
              matchPercentage={prospect.matchPercentage}
              verificationRequired={prospect.verificationRequired} />
          )
        }
        <View style={dcViewStyle}>
          <DonutChart
            style={{
              width: 90,
              height: 90,
              backgroundColor: appTheme.primaryColor,
              borderRadius: 999,
            }}
            percentage={undefined}
          />
        </View>
        {
          bestProspects.map((prospect, i) =>
            <ProspectDonutPercentage
              key={String(topCardIndex - i)}
              donutOpacity={prospect.donutOpacity}
              matchPercentage={prospect.matchPercentage}
            />
          )
        }
      </Animated.View>
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
}: {
  card1: CardState,
  card2: CardState,
  card3: CardState,
  triggerRender: () => void,
  onSwipe: (direction: Direction) => Promise<void>,
  onCardLeftScreen: () => void,
}) => {
  const cards: CardState[] = [card1, card2, card3].filter(Boolean);

  const onScreenCards = cards.filter(c => c.isFetched && !c.swipeDirection);

  useEffect(() => {
    Animated.parallel(
      cards.map((card) =>
        Animated.timing(card.scale, {
          toValue: 1.0,
          duration: 500,
          useNativeDriver: false,
        })
      )
    ).start();
  }, [JSON.stringify(cards.map((card) => card.questionNumber))]);

  return (
    <View style={styles.stackContainerStyle}>
      {!onScreenCards.length && <NoMoreCards/>}
      {
        cards.map((card, i) => {
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

  const stateRef = useRef<StackState>(initialState()).current;

  const [, triggerRender_] = useState({});
  const triggerRender = () => triggerRender_({});

  class Api implements ApiInterface {
    async swipe(direction) {
      const cards = stateRef.cards;
      const topCardIndex = stateRef.topCardIndex;
      const topCard = cards[topCardIndex];
      if (topCard === undefined) {
        return;
      }
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

      const previousSwipeDirection = previouslySwipedCard.swipeDirection;

      quizQueue.addTask(
        async () => {
          await japi(
            'delete',
            '/answer',
            { question_id: previouslySwipedCard.questionNumber }
          );

          if (
            previousSwipeDirection === 'left' ||
            previousSwipeDirection === 'right'
          ) {
            removeNextProspectInPlace(stateRef, triggerRender);
          }
        }
      );

      previouslySwipedCard.swipeDirection = undefined;

      stateRef.topCardIndex--;

      triggerRender();
      onTopCardChanged && onTopCardChanged();
    }

    // eslint-disable-next-line react/no-this-in-sfc
    async yes () { await this.swipe('right') }

    // eslint-disable-next-line react/no-this-in-sfc
    async no  () { await this.swipe('left') }

    // eslint-disable-next-line react/no-this-in-sfc
    async skip() { await this.swipe('down') }

    // eslint-disable-next-line react/no-this-in-sfc
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

    quizQueue.addTask(
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

        if (direction === 'left' || direction === 'right') {
          await addNextProspectsInPlace(stateRef, triggerRender);
        }

        addNextCardsInPlace(
          stateRef,
          undefined,
          triggerRender,
          onTopCardChanged
        );
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

  return (
    <>
      <ProspectsMemo
        navigation={navigation}
        topCardIndex={stateRef.prospects.length - 1}
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
      />
    </>
  );
};

export {
  ApiInterface,
  QuizCardStack
};
