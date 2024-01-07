import {
  ActivityIndicator,
  ListRenderItemInfo,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  View,
} from 'react-native';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import CheckBox from './check-box';
import { ButtonWithCenteredText } from './button/centered-text';
import { DefaultText } from './default-text';
import { TopNavBar } from './top-nav-bar';
import { ButtonForOption } from './button/option';
import { Title } from './title';
import {
  OptionGroup,
  OptionGroupInputs,
  searchBasicsOptionGroups,
  searchInteractionsOptionGroups,
  getCurrentValue,
  isOptionGroupCheckChips,
  isOptionGroupRangeSlider,
  isOptionGroupButtons,
  isOptionGroupSlider,
} from '../data/option-groups';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OptionScreen } from './option-screen';
import Ionicons from '@expo/vector-icons/Ionicons';
import { DefaultTextInput } from './default-text-input';
import { SearchQuizCard } from './quiz-card';
import { api, japi } from '../api/api';
import * as _ from "lodash";
import { signedInUser } from '../App';
import { cmToFeetInchesStr, kmToMilesStr } from '../units/units';
import debounce from 'lodash/debounce';
import { Notice } from './notice';
import { TopNavBarButton } from './top-nav-bar-button';

const getCurrentValueAsLabel = (og: OptionGroup<OptionGroupInputs> | undefined) => {
  if (!og) return undefined;

  const currentValue = getCurrentValue(og.input);

  if (
    isOptionGroupCheckChips(og.input) &&
    _.isArray(currentValue) &&
    _.every(currentValue, _.isString)
  ) {
    if (currentValue.length === og.input.checkChips.values.length) {
      return undefined;
    } else {
      return currentValue.join(', ');
    }
  } else if (isOptionGroupSlider(og.input)) {
    const currentValue = og.input.slider.currentValue;

    if (currentValue === undefined) {
      return undefined;
    } else if (og.title === 'Furthest Distance') {
      return _.isNil(currentValue) ? undefined :
        signedInUser?.units === 'Imperial' ?
        `${kmToMilesStr(currentValue)} mi.` :
        `${currentValue} km`;
    } else {
      return `${currentValue}`;
    }
  } else if (
    isOptionGroupRangeSlider(og.input) &&
    typeof currentValue === 'object' &&
    'sliderMin' in currentValue &&
    'sliderMax' in currentValue
  ) {
    const currentMin = og.input.rangeSlider.currentMin;
    const currentMax = og.input.rangeSlider.currentMax;

    if (_.isNil(currentMin) && _.isNil(currentMax)) {
      return undefined;
    } else if (og.title === 'Age') {
      return `${currentMin ?? 'any'}–${currentMax ?? 'any'} years`;
    } else if (og.title === 'Height') {
      const _currentMin = _.isNil(currentMin) ? 'any' :
        signedInUser?.units === 'Imperial' ?
        cmToFeetInchesStr(currentMin) :
        `${currentMin} cm`;

      const _currentMax = _.isNil(currentMax) ? 'any' :
        signedInUser?.units === 'Imperial' ?
        cmToFeetInchesStr(currentMax) :
        `${currentMax} cm`;

      return `${_currentMin}–${_currentMax}`;
    } else {
      return `${currentMin ?? 'any'}–${currentMax ?? 'any'}`;
    }
  } else {
    return currentValue;
  }
};

const optionGroupToDataKey = (og: OptionGroup<OptionGroupInputs>) =>
  og.title.toLowerCase().replaceAll(' ', '_');

type AnswerItem = {
  question_id: number,
  question: string,
  topic: string,
  answer: boolean | null,
  accept_unanswered: boolean,
};

const fetchQuestionSearch = async (q: string): Promise<AnswerItem[]> => {
  const resultsPerPage = 25;
  const offset = 0;

  const response = await api(
    'get',
    `/search-filter-questions` +
    `?q=${encodeURIComponent(q)}&n=${resultsPerPage}&o=${offset}`,
  );

  return response.ok ? response.json : [];
};

const Stack = createNativeStackNavigator();

const SearchFilterScreen = ({navigation}) => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Search Filter Tab" component={SearchFilterScreen_} />
      <Stack.Screen name="Search Filter Option Screen" component={OptionScreen} />
      <Stack.Screen name="Q&A Filter Screen" component={QandQFilterScreen} />
    </Stack.Navigator>
  );
};

const SearchFilterScreen_ = ({navigation, route}) => {
  const onPressRefresh = route?.params?.onPressRefresh;

  const [, _triggerRender] = useState({});
  const triggerRender = useCallback(() => _triggerRender({}), [_triggerRender]);

  const [data, setData] = useState<any>(null);

  const answers: AnswerItem[] = data?.answer ?? [];

  const onSubmitSuccess = useCallback(() => {
    triggerRender();
  }, [triggerRender]);

  const onPressQAndAAnswers = useCallback(() => {
    return navigation.navigate("Q&A Filter Screen", {answers, triggerRender})
  }, [navigation, answers]);

  const Button_ = useCallback((props) => {
    return <ButtonForOption
      navigation={navigation}
      navigationScreen="Search Filter Option Screen"
      showSkipButton={false}
      theme="light"
      noSettingText="Any"
      onSubmitSuccess={onSubmitSuccess}
      {...props}
    />;
  }, []);

  const addCurrentValue = (optionGroups: OptionGroup<OptionGroupInputs>[]) =>
    optionGroups.map(
      (
        og: OptionGroup<OptionGroupInputs>,
        i: number
      ): OptionGroup<OptionGroupInputs> =>
        _.merge(
          {},
          og,
          isOptionGroupCheckChips(og.input) ? {
            input: {
              checkChips: {
                values: og.input.checkChips.values.map((v) => ({
                  ...v,
                  checked: (
                    (data ?? {})[
                      optionGroupToDataKey(og)
                    ] ?? ([] as string[])
                  ).includes(v.label)
                }))
              }
            }
          } : {},
          isOptionGroupButtons(og.input) ? {
            input: {
              buttons: {
                currentValue: (data ?? {})[optionGroupToDataKey(og)]
              }
            }
          } : {},
          isOptionGroupSlider(og.input) ? {
            input: {
              slider: {
                currentValue: (data ?? {})[optionGroupToDataKey(og)]
              }
            }
          } : {},
          isOptionGroupRangeSlider(og.input) && og.title === 'Age' ? {
            input: {
              rangeSlider: {
                currentMin: (data ?? {})[optionGroupToDataKey(og)]?.min_age,
                currentMax: (data ?? {})[optionGroupToDataKey(og)]?.max_age,
              }
            }
          } : {},
          isOptionGroupRangeSlider(og.input) && og.title === 'Height' ? {
            input: {
              rangeSlider: {
                currentMin: (data ?? {})[optionGroupToDataKey(og)]?.min_height_cm,
                currentMax: (data ?? {})[optionGroupToDataKey(og)]?.max_height_cm,
              }
            }
          } : {},
        )
    );

  useEffect(() => {
    (async () => {
      const response = await api('get', '/search-filters');
      if (response.json) {
        setData(response.json);
      }
    })();
  }, []);

  const [
    _searchBasicsOptionGroups,
    _searchInteractionsOptionGroups,
  ] = useMemo(
    () => [
      addCurrentValue(searchBasicsOptionGroups),
      addCurrentValue(searchInteractionsOptionGroups),
    ],
    [data]
  );

  useEffect(() => {
    _searchBasicsOptionGroups.forEach((og: OptionGroup<OptionGroupInputs>) => {
      if (isOptionGroupSlider(og.input) && og.title === 'Furthest Distance') {
        og.input.slider.unitsLabel = (
          signedInUser?.units === 'Imperial' ?
          "mi." : 'km');

        og.input.slider.valueRewriter = (
          signedInUser?.units === 'Imperial' ?
          kmToMilesStr : undefined);
      }

      if (isOptionGroupRangeSlider(og.input) && og.title === 'Height') {
        og.input.rangeSlider.unitsLabel = (
          signedInUser?.units === 'Imperial' ?
          "ft'in\"" : 'cm');

        og.input.rangeSlider.valueRewriter = (
          signedInUser?.units === 'Imperial' ?
          cmToFeetInchesStr : undefined);
      }
    });
  }, [_searchBasicsOptionGroups, signedInUser?.units]);

  const goBack = useCallback(() => {
    onPressRefresh && onPressRefresh();
    navigation.goBack();
  }, [navigation, onPressRefresh]);

  return (
    <>
      <TopNavBar
        style={{
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <TopNavBarButton
          onPress={goBack}
          iconName="arrow-back"
          style={{left: 15}}
        />
        <DefaultText
          style={{
            fontWeight: '700',
            fontSize: 20,
          }}
        >
          Search Filters
        </DefaultText>
      </TopNavBar>

      {data &&
        <ScrollView
          contentContainerStyle={{
            maxWidth: 600,
            width: '100%',
            alignSelf: 'center',
            alignItems: 'stretch',
            padding: 10,
            paddingBottom: 50,
          }}
        >
          <Title>Q&A Answers</Title>
          <ButtonForOption
            label="Q&A Answers"
            setting={
              (answers === undefined || answers.length === 0) ?
              undefined :
              (`${answers.length} Answer` + (answers.length === 1 ? '' : 's'))
            }
            noSettingText="Any"
            onPress={onPressQAndAAnswers}
          />
          <Title>Basics</Title>
          {
            _searchBasicsOptionGroups.map((og, i) =>
              <Button_
                key={i}
                setting={getCurrentValueAsLabel(og)}
                optionGroups={_searchBasicsOptionGroups.slice(i)}
              />
            )
          }
          <Title>Interactions</Title>
          {
            _searchInteractionsOptionGroups.map((og, i) =>
              <Button_
                key={i}
                setting={getCurrentValueAsLabel(og)}
                optionGroups={_searchInteractionsOptionGroups.slice(i)}
              />
            )
          }
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
    </>
  );
};

const QandQFilterScreen = ({navigation, route}) => {
  const answers: AnswerItem[] = route?.params?.answers;
  const triggerRender = route?.params?.triggerRender;

  const numAnswersStr = _.isNil(answers) ? '' : ` (${answers.length})`;

  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<AnswerItem[] | null>();
  const [isLoading, setIsLoading] = useState(false);

  const clearSearchText = useCallback(() => setSearchText(""), []);

  const _fetchQuestionSearch = useCallback(debounce(async (q: string) => {
    const results = await fetchQuestionSearch(q);

    setSearchResults(results);
    setIsLoading(false);
  }, 500), []);

  const onChangeTextDebounced = useCallback(async (q) => {
    setSearchText(q);
    setSearchResults(null);
    setIsLoading(true);
    await _fetchQuestionSearch(q);
  }, [_fetchQuestionSearch]);

  const onAnswerChange = useCallback((newAnswers: AnswerItem[]) => {
    answers.length = 0;
    answers.push(...newAnswers);
    triggerRender();
  }, [answers]);

  return (
    <>
      <TopNavBar
        style={{
          alignItems: 'stretch',
        }}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={{
            zIndex: 999,
            position: 'absolute',
            bottom: 0,
            left: 0,
            height: '100%',
            aspectRatio: 1,
            justifyContent: 'center',
            alignItems: 'center',
            marginLeft: 10,
          }}
        >
          <Ionicons
            style={{
              fontSize: 20,
            }}
            name="arrow-back"
          />
        </Pressable>
        <DefaultTextInput
          placeholder="Search questions..."
          style={{
            marginLeft: 50,
            marginRight: 50,
            borderRadius: 0,
            borderWidth: 0,
            height: '100%',
          }}
          value={searchText}
          onChangeText={onChangeTextDebounced}
        />
        {searchText !== "" &&
          <Pressable
            onPress={clearSearchText}
            style={{
              zIndex: 999,
              position: 'absolute',
              bottom: 0,
              right: 0,
              height: '100%',
              aspectRatio: 1,
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 10,
            }}
          >
            <Ionicons
              style={{
                fontSize: 20,
              }}
              name="close"
            />
          </Pressable>
        }
      </TopNavBar>
      {isLoading &&
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
      {!isLoading &&
        <ScrollView
          contentContainerStyle={{
            paddingTop: 0,
            paddingLeft: 10,
            paddingRight: 10,
            maxWidth: 600,
            width: '100%',
            alignSelf: 'center',
          }}
        >
          {searchText === "" && _.isEmpty(answers) &&
            <DefaultText
              style={{
                fontFamily: 'Trueno',
                margin: '20%',
                textAlign: 'center'
              }}
            >
              You haven't added any Q&A filters
            </DefaultText>
          }
          {searchText !== "" && _.isEmpty(searchResults) &&
            <DefaultText
              style={{
                fontFamily: 'Trueno',
                margin: '20%',
                textAlign: 'center'
              }}
            >
              Your search didn't match any Q&A questions
            </DefaultText>
          }
          {searchText === "" && !_.isEmpty(answers) &&
            <>
              <Title>Q&A Answers You'll Accept ({(answers ?? []).length})</Title>
              {(answers ?? []).map((a) =>
                <SearchQuizCard
                  key={JSON.stringify(a)}
                  questionNumber={a.question_id}
                  topic={a.topic}
                  answer={a.answer}
                  initialCheckBoxValue={a.accept_unanswered}
                  onAnswerChange={onAnswerChange}
                >
                  {a.question}
                </SearchQuizCard>
              )}
              <Notice style={{ marginTop: 5, marginBottom: 5, marginLeft: 0, marginRight: 0 }}>
                <DefaultText style={{color: '#70f'}} >
                  You haven't got any other Q&A filters
                </DefaultText>
              </Notice>
            </>
          }
          {searchText !== "" && !_.isEmpty(searchResults) &&
            <>
              <Title>Search Results</Title>
              {(searchResults ?? []).map((a) =>
                <SearchQuizCard
                  key={JSON.stringify(a)}
                  questionNumber={a.question_id}
                  topic={a.topic}
                  answer={a.answer}
                  initialCheckBoxValue={a.accept_unanswered}
                  onAnswerChange={onAnswerChange}
                >
                  {a.question}
                </SearchQuizCard>
              )}
              <Notice style={{ marginTop: 5, marginBottom: 5, marginLeft: 0, marginRight: 0 }}>
                <DefaultText style={{color: '#70f'}} >
                  No more search results to show
                </DefaultText>
              </Notice>
            </>
          }
        </ScrollView>
      }
    </>
  );
};

export {
  SearchFilterScreen,
}
