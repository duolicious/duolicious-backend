import {
  forwardRef,
  useCallback,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import debounce from 'lodash/debounce';
import { DefaultText } from './default-text';
import { DefaultTextInput } from './default-text-input';
import { japi } from '../api/api';

const LocationSelector = ({onChangeText, ...rest}) => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<string[] | null>(null);
  const [text, setText] = useState(rest.currentValue ?? "");
  const [displayResults, setDisplayResults] = useState(false);

  const getSuggestions = useCallback(debounce(async (q: string) => {
    let json;
    try {
      const response = await japi(
        'get',
        '/search-locations?q=' + encodeURIComponent(q),
      );
      json = response.json;
    } catch {
      setItems(null);
    }

    setItems(json);
    setLoading(false);
  }, 500), []);

  const onChangeTextDebounced = useCallback(async (q) => {
    onChangeText(q);
    setText(q);
    setLoading(true);
    setDisplayResults(true);
    getSuggestions(q);
  }, [getSuggestions]);

  const Item = useCallback(({text}) => {
    return (
      <Pressable onPress={() => {
        setDisplayResults(false);
        onChangeText(text);
        setText(text);
      }}>
        <DefaultText style={{padding: 15}}>{text}</DefaultText>
      </Pressable>
    );
  }, []);

  return (
    <>
      <DefaultTextInput
        autoFocus={true}
        placeholder="Type a location..."
        value={text}
        onChangeText={onChangeTextDebounced}
      />
      <View
        style={{
          marginTop: 5,
          marginLeft: 20,
          marginRight: 20,
          paddingTop: 5,
          paddingBottom: 5,
        }}
      >
        {displayResults &&
          <ScrollView
            showsVerticalScrollIndicator={!loading}
            style={{
              position: 'absolute',
              width: '100%',
              top: 0,
              borderRadius: 10,
              backgroundColor: 'white',
              maxHeight: Dimensions.get('screen').height * 0.25,
              shadowOffset: {
                width: 0,
                height: 2,
              },
              shadowOpacity: 0.4,
              shadowRadius: 6,
              elevation: 8,
            }}
          >
            {loading &&
              <ActivityIndicator size="large" color="#70f" style={{ padding: 5 }}/>
            }
            {!loading && items &&
              items.map((item) => <Item key={item} text={item}/>)
            }
            {!loading && !items?.length &&
              <DefaultText style={{ padding: 15, textAlign: 'center'}} >
                No results
              </DefaultText>
            }
          </ScrollView>
        }
      </View>
    </>
  );
};

export {
  LocationSelector,
};
