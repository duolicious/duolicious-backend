import { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import Reanimated, { FadeIn, FadeOut } from 'react-native-reanimated';
import * as _ from "lodash";
import { ModalButton } from '../button/modal';
import { listen, notify } from '../../events/events';
import { backgroundColors } from './background-colors';
import { DefaultTextInput } from '../default-text-input';
import { AutoResizingGif } from '../auto-resizing-gif';
import {
  TENOR_API_KEY,
} from '../../env/env';
import {
  isMobile,
} from '../../util/util';

type GifPickedEvent = string;

const TENOR_SEARCH_URL = 'https://g.tenor.com/v1/search';
const NUM_COLS = 3;

const fadeIn = FadeIn.duration(200);
const fadeOut = FadeOut.duration(200);

const indexToPriority = (row: number): 'low' | 'normal' | 'high' => {
  if (row < 5) {
    return 'high';
  } else if (row < 10) {
    return 'normal';
  } else {
    return 'low';
  }
};

// Helper to render a single gif item
const RenderGifItem = ({
  gifUrl,
  previewUrl,
  onPress,
  isSelected,
  priority,
}: {
  gifUrl: string,
  previewUrl: string,
  onPress: (url: string) => void
  isSelected: boolean
  priority: null | 'low' | 'normal' | 'high'
}) => {
  return (
    <View style={styles.gifItemContainer}>
      <Pressable onPress={() => onPress(gifUrl)}>
        <AutoResizingGif
          priority={priority}
          uri={previewUrl}
          style={[
            styles.gifImage,
            isSelected ? styles.selectedGif : styles.unselectedGif,
          ]}
        />
      </Pressable>
    </View>
  );
};

const GifPickerModal: React.FC = () => {
  const [isShowing, setIsShowing] = useState(false);
  const [selectedGif, setSelectedGif] = useState<null | string>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [gifResults, setGifResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const cancel = useCallback(() => {
    setIsShowing(false);
  }, []);

  const pickGif = useCallback(() => {
    if (selectedGif) {
      notify<GifPickedEvent>('gif-picked', selectedGif);
      setIsShowing(false);
    }
  }, [selectedGif]);

  // Fetch gifs from Tenor when a search query is provided
  const fetchGifs = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const response = await fetch(
        `${TENOR_SEARCH_URL}` +
          `?q=${encodeURIComponent(query)}` +
          `&key=${TENOR_API_KEY}` +
          `&media_filter=gif,${isMobile() ? 'nanogif' : 'tinygif'}` +
          `&limit=${NUM_COLS * 16}`
      );
      const json = await response.json();
      // The Tenor API returns an array of results – adjust according to your needs
      setGifResults(json.results || []);
    } catch (error) {
      console.error('Error fetching gifs:', error);
    }
    setLoading(false);
  }, []);

  // Use lodash debounce to delay search requests
  const debouncedFetchGifs = useCallback(
    _.debounce((query: string) => {
      fetchGifs(query);
    }, 500),
    [fetchGifs]
  );

  useEffect(() => {
    debouncedFetchGifs(searchQuery);
  }, [searchQuery, debouncedFetchGifs]);

  useEffect(() => {
    return listen('show-gif-picker', () => {
      setIsShowing(true);
      setSelectedGif(null);
      setSearchQuery('');
      setGifResults([]);
      debouncedFetchGifs("");
    });
  }, [debouncedFetchGifs]);

  if (!isShowing) {
    return null;
  }

  // Divide gifResults equally between three columns
  const columns = _.times(NUM_COLS, () => []) as any[][];
  gifResults.forEach((item, index) => {
    columns[index % NUM_COLS].push(item);
  });

  return (
    <Reanimated.View
      style={styles.modal}
      entering={fadeIn}
      exiting={fadeOut}
    >
      <View style={styles.container}>
        <View style={styles.gifGalleryContainer}>
          <DefaultTextInput
            style={styles.searchInput}
            placeholder="Search Tenor"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus={true}
          />
          {loading ? (
            <ActivityIndicator
              size="large"
              color="#70f"
              style={styles.loadingIndicator}
            />
          ) : (
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollViewContainer}
            >
              {columns.map((column, i) =>
                <View key={i} style={styles.column}>
                  {column.map((item, j) =>
                    <RenderGifItem
                      key={j}
                      priority={indexToPriority(j)}
                      gifUrl={item.media[0]?.gif?.url}
                      previewUrl={
                        isMobile() ?
                          item.media[0]?.nanogif?.url :
                          item.media[0]?.tinygif?.url
                      }
                      isSelected={item.media[0]?.gif?.url === selectedGif}
                      onPress={setSelectedGif}
                    />
                  )}
                </View>
              )}
            </ScrollView>
          )}
        </View>
        <View style={styles.buttonContainer}>
          <ModalButton color="#999" onPress={cancel} title="Cancel" />
          <ModalButton color="#70f" onPress={pickGif} title="Send" />
        </View>
      </View>
    </Reanimated.View>
  );
};

const styles = StyleSheet.create({
  modal: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    ...backgroundColors.dark,
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 600,
    height: '80%',
    backgroundColor: 'white',
    borderRadius: 10,
    overflow: 'hidden',
  },
  buttonContainer: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    flexDirection: 'row',
    marginVertical: 10,
  },
  gifGalleryContainer: {
    width: '100%',
    gap: 10,
    flex: 1,
    padding: 10,
  },
  searchInput: {
    backgroundColor: '#eee',
    borderWidth: 0,
    marginLeft: 0,
    marginRight: 0,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  column: {
    flex: 1,
    gap: 10,
  },
  gifItemContainer: {
    justifyContent: 'center',
  },
  gifImage: {
    borderRadius: 5,
    borderWidth: 6,
  },
  selectedGif: {
    borderColor: '#70f',
  },
  unselectedGif: {
    borderColor: 'transparent',
  },
  loadingIndicator: {
    marginTop: 20,
  },
});

export {
  GifPickerModal,
  GifPickedEvent,
};
