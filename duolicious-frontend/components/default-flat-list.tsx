import {
  ActivityIndicator,
  FlatList,
  FlatListProps,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import {
  forwardRef,
  isValidElement,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { DefaultText }  from './default-text';

const styles = StyleSheet.create({
  activityIndicator: {
    marginTop: 20,
    marginBottom: 20,
  },
  errorText: {
    fontFamily: 'Trueno',
    margin: '20%',
    textAlign: 'center'
  },
  emptyText: {
    fontFamily: 'Trueno',
    margin: '20%',
    textAlign: 'center'
  },
  endText: {
    fontFamily: 'TruenoBold',
    color: '#000',
    fontSize: 16,
    textAlign: 'center',
    alignSelf: 'center',
    marginTop: 30,
    marginBottom: 30,
    marginLeft: '15%',
    marginRight: '15%',
  },
  flatList: {
    paddingTop: 10,
    alignItems: 'stretch',
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
});

type Page<ItemT> = ItemT[] | 'fetching'

type Book<ItemT> = {
  pages: Page<ItemT>[]
  isRefreshing: boolean
  isError: boolean
};

type Books<ItemT> = {
  [dataKey: string]: Book<ItemT>
};

const pageToItems = <ItemT,>(page: Page<ItemT>): ItemT[] =>
  page === 'fetching' ? [] : page;

const bookToItems = <ItemT,>(book: Book<ItemT>): ItemT[] =>
  book.isError ? [] : book.pages.flatMap(pageToItems);

const isPageFetching = <ItemT,>(page: Page<ItemT>) =>
  page === 'fetching';

const isBookFetching = <ItemT,>(book: Book<ItemT>) =>
  book.pages.length > 0 && isPageFetching(book.pages[book.pages.length - 1]);

const isPageLast = <ItemT,>(page: Page<ItemT>) =>
  page.length === 0;

const isBookComplete = <ItemT,>(book: Book<ItemT>) =>
  book.isError ||
  book.pages.length > 0 && isPageLast(book.pages[book.pages.length - 1] ?? []);

const isBookEmpty = <ItemT,>(book: Book<ItemT>) =>
  bookToItems(book).length === 0;

const pageNumberToFetch = <ItemT,>(book: Book<ItemT>) =>
  book.pages.length + 1;

const setBookFetching = <ItemT,>(book: Book<ItemT>): void => {
  book.pages.push('fetching');
  book.isRefreshing = false;
  book.isError = false;
};

const setBookFetched = <ItemT,>(
  book: Book<ItemT>,
  page: Page<ItemT>,
  index: number,
): void => {
  if (index < 0 || index > book.pages.length - 1) {
    throw new Error('Index out of range');
  }

  book.pages[index] = page;
};

const setBookError = <ItemT,>(book: Book<ItemT>): void => {
  book.pages = [];
  book.isRefreshing = false;
  book.isError = true;
};

const getBookOrDefault = <ItemT,>(
  books: Books<ItemT>,
  dataKey: string
): Book<ItemT> =>
  books[dataKey] ?? { pages: [], isRefreshing: false, isError: false };

const setBookFetchingInBooks = <ItemT,>(
  books: Books<ItemT>,
  dataKey: string,
) => {
  // It's important to perform the update in-place so that `fetchNextPage`
  // can start blocking concurrent `fetchPage` attempts before the next render.
  books[dataKey] = getBookOrDefault(books, dataKey);
  setBookFetching(books[dataKey]);
};

const setBookFetchedInBooks = <ItemT,>(
  books: Books<ItemT>,
  page: Page<ItemT>,
  dataKey: string,
  index: number,
) => {
  books[dataKey] = getBookOrDefault(books, dataKey);
  setBookFetched(books[dataKey], page, index);
};

const setBookErrorInBooks = <ItemT,>(
  books: Books<ItemT>,
  dataKey: string,
) => {
  books[dataKey] = getBookOrDefault(books, dataKey);
  setBookError(books[dataKey]);
};

type DefaultFlatListProps<ItemT> =
  Omit<
    FlatListProps<ItemT> & {
      emptyText?: string,
      errorText?: string,
      endText?: string,
      endTextStyle?: StyleProp<ViewStyle>,
      fetchPage: (pageNumber: number) => Promise<ItemT[] | null>,
      hideListHeaderComponentWhenEmpty?: boolean,
      hideListHeaderComponentWhenLoading?: boolean,
      dataKey?: string,
      disableRefresh?: boolean,
      innerRef?: any,
    },
    | "ListEmptyComponent"
    | "ListFooterComponent"
    | "data"
    | "keyExtractor"
    | "onContentSizeChange"
    | "onLayout"
    | "onRefresh"
    | "refreshing"
  >;

const ActivityIndicator_ = memo(() => {
  return (
    <View style={styles.activityIndicator}>
      <ActivityIndicator size="large" color="#70f" />
    </View>
  );
});

const RenderedHoc = memo(({Hoc}: {Hoc: any}) => {
  if (isValidElement(Hoc)) {
    return Hoc;
  } else if (Hoc) {
    return <Hoc/>;
  } else {
    return <></>;
  }
});

const ListHeaderComponent = memo(({
  isEmpty,
  isLoading,
  hideListHeaderComponentWhenEmpty,
  hideListHeaderComponentWhenLoading,
  ListHeaderComponent,
}: {
  isEmpty: boolean,
  isLoading: boolean,
  hideListHeaderComponentWhenEmpty: boolean,
  hideListHeaderComponentWhenLoading: boolean,
  ListHeaderComponent: any,
}) => {
  if (isEmpty && isLoading && hideListHeaderComponentWhenLoading) {
    return <></>;
  } else if (isEmpty && hideListHeaderComponentWhenEmpty) {
    return <></>;
  } else {
    return <RenderedHoc Hoc={ListHeaderComponent}/>;
  }
});

const ListEmptyComponent = memo(({
  isComplete,
  isError,
  emptyText,
  errorText,
}: {
  isComplete: boolean
  isError: boolean
  emptyText: string | null | undefined
  errorText: string | null | undefined
}) => {
  if (isError) {
    return (
      <DefaultText style={styles.errorText}>
        {errorText ? errorText : "Something went wrong"}
      </DefaultText>
    );
  } else if (!isComplete) {
    return <></>;
  } else {
    return (
      <DefaultText style={styles.emptyText}>
        {emptyText}
      </DefaultText>
    );
  }
});

const ListFooterComponent = memo(({
  isComplete,
  isEmpty,
  EndTextNotice,
}: {
  isComplete: boolean,
  isEmpty: boolean,
  EndTextNotice: any,
}) => {
  if (isComplete && isEmpty) {
    return <></>;
  } else if (isComplete && !isEmpty) {
    return <RenderedHoc Hoc={EndTextNotice}/>;
  } else {
    return <ActivityIndicator_/>;
  }
});

const EndTextNotice = ({
  endText
}: {
  endText: string | undefined
}) => {
  if (endText) {
    return (
      <DefaultText style={styles.endText}>
        {endText}
      </DefaultText>
    );
  } else {
    return <></>;
  }
};

const DefaultFlatList = forwardRef(<ItemT,>(props: DefaultFlatListProps<ItemT>, ref) => {
  const contentHeight = useRef(0);
  const viewportHeight = useRef(0);

  const flatList = useRef<FlatList>(null);

  const [books, setBooks] = useState<Books<ItemT>>({});

  const contentContainerStyle = useRef([
    styles.flatList,
    props.contentContainerStyle,
  ]);

  const dataKey = props.dataKey ?? 'default-key';

  const keyExtractor = useCallback((item: ItemT, index: number) => {
    return JSON.stringify({dataKey, index});
  }, [dataKey]);

  const fetchNextPage = async () => {
    const book = getBookOrDefault(books, dataKey);

    if (isBookComplete(book)) {
      return;
    }
    if (isBookFetching(book)) {
      return;
    }

    const pageNumberToFetchVal = pageNumberToFetch(book);

    setBookFetchingInBooks(books, dataKey);

    const page = await props.fetchPage(pageNumberToFetchVal);

    if (page === null) {
      setBookErrorInBooks(books, dataKey);
    } else {
      setBookFetchedInBooks(books, page, dataKey, pageNumberToFetchVal - 1);
    }

    setBooks({ ...books });
  };

  const onRefresh = () => {
    const book = getBookOrDefault(books, dataKey);

    if (props.disableRefresh) return;
    if (book.isRefreshing) return;

    setBooks({
      ...books,
      [dataKey]: {
        pages: [],
        isRefreshing: true,
        isError: false,
      }
    });
  };

  useImperativeHandle(ref, () => ({ refresh: onRefresh }), [onRefresh]);

  const onContentSizeChange = useCallback((width: number, height: number) => {
    contentHeight.current = height;
  }, []);

  const onLayout = useCallback(({ nativeEvent: { layout: { height } } }) => {
    viewportHeight.current = height;
  }, []);

  if (props.contentContainerStyle !== contentContainerStyle[1]) {
    contentContainerStyle.current = [
      styles.flatList,
      props.contentContainerStyle,
    ];
  }

  useEffect(() => {
    const book = getBookOrDefault(books, dataKey);

    if (
      contentHeight.current < viewportHeight.current &&
      !isBookComplete(book)
    ) {
      fetchNextPage()
    }
  }, [
    contentHeight,
    viewportHeight,
    books,
    dataKey,
  ]);

  const book = getBookOrDefault(books, dataKey);
  const items = bookToItems(book);

  return (
    <FlatList
      ref={flatList}
      refreshing={false}
      onRefresh={onRefresh}
      onEndReachedThreshold={props.onEndReachedThreshold ?? 1}
      onEndReached={fetchNextPage}
      data={items}
      ListEmptyComponent={
        <ListEmptyComponent
          isComplete={isBookComplete(book)}
          isError={book.isError}
          errorText={props.errorText}
          emptyText={props.emptyText} />
      }
      ListFooterComponent={
        <ListFooterComponent
          isComplete={isBookComplete(book)}
          isEmpty={isBookEmpty(book)}
          EndTextNotice={<EndTextNotice endText={props.endText} />}
        />
      }
      {...props}
      contentContainerStyle={contentContainerStyle.current}
      ListHeaderComponent={
        <ListHeaderComponent
            isEmpty={isBookEmpty(book)}
            isLoading={isBookFetching(book)}
            hideListHeaderComponentWhenEmpty={
              props.hideListHeaderComponentWhenEmpty ?? false
            }
            hideListHeaderComponentWhenLoading={
              props.hideListHeaderComponentWhenLoading ?? true
            }
            ListHeaderComponent={props.ListHeaderComponent}
        />
      }
      onContentSizeChange={onContentSizeChange}
      keyExtractor={keyExtractor}
      initialNumToRender={1}
      onLayout={onLayout}
    />
  );
});

export {
  DefaultFlatList,
  DefaultFlatListProps,
};
