import {
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  View,
} from 'react-native';
import {
  useCallback,
  useState,
} from 'react';
import CheckBox from './check-box';
import { ButtonWithCenteredText } from './button/centered-text';
import { DefaultText } from './default-text';
import { TopNavBar } from './top-nav-bar';
import { ButtonForOption } from './button/option';
import { Title } from './title';
import {
  searchBasicsOptionGroups,
  searchInteractionsOptionGroups,
} from '../data/option-groups';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OptionScreen } from './option-screen';
import Ionicons from '@expo/vector-icons/Ionicons';
import { DefaultTextInput } from './default-text-input';
import { SearchQuizCard } from './quiz-card';
import { DefaultFlatList } from './default-flat-list';

// TODO: Language
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

const SearchFilterScreen_ = ({navigation}) => {
  const Button_ = useCallback((props) => {
    return <ButtonForOption
      navigation={navigation}
      navigationScreen="Search Filter Option Screen"
      showSkipButton={false}
      buttonTextColor="white"
      buttonBackgroundColor="#70f"
      buttonBorderWidth={0}
      noSettingText="Any"
      {...props}
    />;
  }, []);


  return (
    <>
      <TopNavBar
        style={{
          alignItems: 'center',
          justifyContent: 'center',
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
        <DefaultText
          style={{
            fontWeight: '700',
            fontSize: 20,
          }}
        >
          Search Filters
        </DefaultText>
      </TopNavBar>

      <ScrollView
        contentContainerStyle={{
          maxWidth: 600,
          width: '100%',
          alignSelf: 'center',
          alignItems: 'stretch',
          padding: 10,
        }}
      >
        <Title>Q&A Answers</Title>
        <ButtonForOption
          label="Q&A Answers"
          noSettingText="Any"
          onPress={() => navigation.navigate("Q&A Filter Screen")}
        />
        <Title>Basics</Title>
        {
          searchBasicsOptionGroups.map((_, i) => {
            return <Button_ key={i} optionGroups={searchBasicsOptionGroups.slice(i)}/>
          })
        }
        <Title>Interactions</Title>
        {
          searchInteractionsOptionGroups.map((_, i) => {
            return <Button_ key={i} optionGroups={searchInteractionsOptionGroups.slice(i)}/>
          })
        }
      </ScrollView>
    </>
  );
};

const QandQFilterScreen = ({navigation}) => {
  const [searchText, setSearchText] = useState("");

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
          placeholder="Search Questions..."
          style={{
            marginLeft: 50,
            marginRight: 50,
            borderRadius: 0,
            borderWidth: 0,
            height: '100%',
          }}
          value={searchText}
          onChangeText={setSearchText}
        />
        {searchText !== "" &&
          <Pressable
            onPress={() => setSearchText("")}
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
      <DefaultFlatList
        contentContainerStyle={{
          paddingTop: 0,
          paddingLeft: 10,
          paddingRight: 10,
        }}
        emptyText={
          searchText === "" ?
            "You haven't added any Q&A filters" :
            "Your search didn't match any Q&A questions"
        }
        endText={
          searchText === "" ?
            "You haven't added any other Q&A filters" :
            "No more Q&A questions to show"
        }
        dataKey={searchText}
        fetchPage={async (): Promise<any[]> => await Array(1)}
        ListHeaderComponent={
          searchText === "" ?
          <Title>Q&A Answers You'll Accept</Title> :
          <Title>Search Results</Title>
        }
        renderItem={(x) =>
          <SearchQuizCard
            questionNumber={420}
            topic="Faith"
            answer="yes"
          >
            Do you believe in the power of your PlayStation?
          </SearchQuizCard>
        }
      />
    </>
  );
};

export {
  SearchFilterScreen,
}
