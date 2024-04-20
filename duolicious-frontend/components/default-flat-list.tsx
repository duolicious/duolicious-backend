import {
  ActivityIndicator,
  FlatList,
  FlatListProps,
  StyleProp,
  View,
  ViewStyle,
} from 'react-native';
import {
  forwardRef,
  isValidElement,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DefaultText }  from './default-text';
import { ButtonWithCenteredText } from './button/centered-text';

const style: StyleProp<ViewStyle> = {
  paddingTop: 10,
  alignItems: 'stretch',
  width: '100%',
  maxWidth: 600,
  alignSelf: 'center',
};

const loadMoreStyle = {
  marginLeft: '25%',
  marginRight: '25%',
  marginTop: 5,
  marginBottom: 40,
};

type DefaultFlatListProps<ItemT> =
  Omit<
    FlatListProps<ItemT> & {
      emptyText?: string,
      errorText?: string,
      endText?: string,
      endTextStyle?: StyleProp<ViewStyle>,
      fetchPage: (pageNumber: number) => Promise<ItemT[] | null>,
      firstPage?: number,
      initialNumberOfPages?: number
      hideListHeaderComponentWhenEmpty?: boolean,
      dataKey?: string,
      disableRefresh?: boolean,
      innerRef?: any,
    },
    | "ListEmptyComponent"
    | "ListFooterComponent"
    | "data"
    | "keyExtractor"
    | "onContentSizeChange"
    | "onRefresh"
    | "refreshing"
  >;

const ActivityIndicator_ = () => {
  const style = useRef(
    {
      marginTop: 20,
      marginBottom: 20,
    }
  ).current;

  return (
    <View style={style}>
      <ActivityIndicator size="large" color="#70f" />
    </View>
  );
}

const DefaultFlatList = forwardRef(<ItemT,>(props: DefaultFlatListProps<ItemT>, ref) => {
  const insets = useSafeAreaInsets();

  // This is a workaround for what I think might be a bug in React Native
  // where the FlatList stops redrawing list items when the flatlist goes
  // off-screen.
  const [, _forceRender] = useState({});
  const forceRender = () => _forceRender({});
  const allItemsWereInvisible = useRef<boolean>(false);

  const flatList = useRef<any>(null);
  const [datas, setDatas] = useState<{[dataKey: string]: ItemT[]} >({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const lastFetchedPageNumbers = useRef<{[dataKey: string]: number} >({});
  const lastFetchedPages = useRef<{[dataKey: string]: ItemT[]} >({});
  const isFetchingRef = useRef<{[dataKey: string]: boolean}>({});
  const [isFetchingOnPressState, setIsFetchingOnPressState] = useState<
    {[dataKey: string]: boolean}
  >({});
  const contentContainerStyle = useRef([
    style,
    props.contentContainerStyle,
  ]);
  // A horrible hack. Fuck React Native.
  const scrollToEndNTimes = useRef<{[dataKey: string]: number}>({});
  const [isError, setIsError] = useState(false);

  const dataKey = props.dataKey ?? 'default-key';
  const data = datas[dataKey];

  scrollToEndNTimes.current[dataKey] = scrollToEndNTimes.current[dataKey] ?? 2;

  const onEndReachedThreshold = props.onEndReachedThreshold ?? 1;
  const firstPage = props.firstPage ?? 1;
  const initialNumberOfPages = props.initialNumberOfPages ?? 1;

  const keyExtractor = useCallback((item: ItemT, index: number) => {
    const indexKey = props.inverted ? data.length - index : index;
    return JSON.stringify({dataKey, indexKey});
  }, [data?.length ?? -1, props.inverted, dataKey]);

  const fetchNextPage = useCallback(async () => {
    if (lastFetchedPages.current[dataKey]?.length === 0) {
      return;
    }
    if (isFetchingRef.current[dataKey]) {
      return;
    }

    const pageNumberDelta = props.inverted ? -1 : 1;

    const pageNumberToFetch = lastFetchedPageNumbers.current[dataKey] === undefined ?
      firstPage :
      lastFetchedPageNumbers.current[dataKey] + pageNumberDelta;

    isFetchingRef.current[dataKey] = true;
    const page = await props.fetchPage(pageNumberToFetch);
    isFetchingRef.current[dataKey] = false;

    if (page === null) {
      setIsError(true);
      return;
    }

    lastFetchedPageNumbers.current[dataKey] = page.length === 0 ?
      lastFetchedPageNumbers.current[dataKey] :
      pageNumberToFetch;
    lastFetchedPages.current[dataKey] = page;

    setDatas(datas => {
      const newDatas = {...datas};
      if (pageNumberToFetch === firstPage) {
        newDatas[dataKey] = page;
      } else if (props.inverted) {
        newDatas[dataKey] = [...page, ...(newDatas[dataKey] ?? [])];
      } else {
        newDatas[dataKey] = [...(newDatas[dataKey] ?? []), ...page];
      }
      return newDatas;
    })
  }, [props.fetchPage, firstPage, dataKey, setIsError]);

  const onPressLoadMore = useCallback(async () => {
    setIsFetchingOnPressState(state => {
      const newState = {...state};
      newState[dataKey] = true;
      return newState;
    });
    await fetchNextPage();
    setIsFetchingOnPressState(state => {
      const newState = {...state};
      newState[dataKey] = false;
      return newState;
    });
  }, [fetchNextPage]);

  const onRefresh_ = useCallback(() => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    setIsError(false);

    const newDatas = {...datas};
    delete newDatas[dataKey];

    delete lastFetchedPageNumbers.current[dataKey];
    delete lastFetchedPages.current[dataKey];

    setDatas(newDatas);

    setIsRefreshing(false);
  }, [setIsRefreshing, isRefreshing, datas, dataKey, setIsError]);
  const onRefresh = props.disableRefresh === true ? undefined : onRefresh_;

  const ListEmptyComponent = useCallback(() => {
    return (
      <DefaultText
        style={{
          fontFamily: 'Trueno',
          margin: '20%',
          textAlign: 'center'
        }}
      >
        {props.emptyText}
      </DefaultText>
    );
  }, [props.emptyText]);

  const EndTextNotice = useCallback(() => {
    if (props.endText) {
      return (
        <DefaultText style={{
          fontFamily: 'TruenoBold',
          color: '#000',
          fontSize: 16,
          textAlign: 'center',
          alignSelf: 'center',
          marginTop: 30,
          marginBottom: 30,
          marginLeft: '15%',
          marginRight: '15%',
        }}>
          {props.endText}
        </DefaultText>
      );
    } else {
      return <></>;
    }
  }, [props.endText]);

  const ListHeaderComponent = useCallback(() => {
    const ListHeaderComponent_ = () => {
      if (isValidElement(props.ListHeaderComponent)) {
        return props.ListHeaderComponent;
      } else if (props.ListHeaderComponent) {
        return <props.ListHeaderComponent/>;
      } else {
        return <></>;
      }
    };

    if (data !== undefined && data.length === 0) {
      return props.hideListHeaderComponentWhenEmpty === true ?
        <></> :
        <ListHeaderComponent_/>;
    } else if (
      lastFetchedPages.current[dataKey] !== undefined &&
      lastFetchedPages.current[dataKey].length === 0 &&
      props.inverted
    ) {
      return (
        <>
          <ListHeaderComponent_/>
          <EndTextNotice/>
        </>
      );
    } else if (props.inverted && !isFetchingOnPressState[dataKey]) {
      return (
        <>
          <ListHeaderComponent_/>
          <ButtonWithCenteredText
            onPress={onPressLoadMore}
            containerStyle={loadMoreStyle}
          >
            Load More...
          </ButtonWithCenteredText>
        </>
      );
    } else if (props.inverted && isFetchingOnPressState[dataKey]) {
      return (
        <>
          <ListHeaderComponent_/>
          <ActivityIndicator_/>
        </>
      );
    } else {
      return <ListHeaderComponent_/>;
    }
  }, [
    props.ListHeaderComponent,
    props.hideListHeaderComponentWhenEmpty,
    isFetchingOnPressState[dataKey],
    data,
  ]);

  const ListFooterComponent = useCallback(() => {
    if (data !== undefined && data.length === 0) {
      return <></>;
    } else if (
      lastFetchedPages.current[dataKey] !== undefined &&
      lastFetchedPages.current[dataKey].length === 0 &&
      !props.inverted
    ) {
      return <EndTextNotice/>;
    } else if (!props.inverted) {
      return <ActivityIndicator_/>;
    } else {
      return <></>;
    }
  }, [data, dataKey, lastFetchedPages.current[dataKey], props.inverted]);

  const onContentSizeChange = useCallback(() => {
    if (!flatList.current) return;
    if (!props.inverted) return;

    if (scrollToEndNTimes.current[dataKey] > 0) {
      // React Native is buggy crap. `scrollToEnd` doesn't work with
      // `ListHeaderComponent`.
      flatList.current.scrollToOffset({offset: 999999});
      scrollToEndNTimes.current[dataKey] -= 1;
    }
  }, [
    flatList.current,
    props.inverted,
    scrollToEndNTimes.current[dataKey],
  ]);

  const onEndReached = props.inverted ? undefined : fetchNextPage;

  const append = useCallback((item: ItemT) => {
    scrollToEndNTimes.current[dataKey] = 1;
    setDatas(datas => {
      const newDatas = {...datas};
      newDatas[dataKey] = [...(newDatas[dataKey] ?? []), item];
      return newDatas;
    });
  }, [dataKey]);

  if (props.innerRef) {
    props.innerRef.current = { append };
  }

  if (props.contentContainerStyle !== contentContainerStyle[1]) {
    contentContainerStyle.current = [style, props.contentContainerStyle];
  }

  useImperativeHandle(ref, () => ({ refresh: onRefresh_ }), [onRefresh_]);

  useEffect(() => {
    if (
      data === undefined ||
      Math.abs(
        firstPage - (lastFetchedPageNumbers.current[dataKey] ?? firstPage)
      ) < initialNumberOfPages - 1
    ) {
      fetchNextPage();
    }
  }, [
    data,
    firstPage,
    lastFetchedPageNumbers.current[dataKey],
    initialNumberOfPages,
    fetchNextPage,
    isError,
  ]);

  const onViewableItemsChanged = useCallback((x: any) => {
    allItemsWereInvisible.current ||= x.viewableItems.length === 0;

    if (x.viewableItems.length > 0 && allItemsWereInvisible.current) {
      allItemsWereInvisible.current = false;
      forceRender();
    }
  }, []);

  if (isError) {
    return (
      <DefaultText
        style={{
          fontFamily: 'Trueno',
          margin: '20%',
          textAlign: 'center'
        }}
      >
        {props.errorText ? props.errorText : "Something went wrong"}
      </DefaultText>
    );
  }

  if (data === undefined) {
    return (
      <View
        style={[
          {
            marginTop: 20 + insets.top,
            marginBottom: 20,
          },
          style,
        ]}
      >
        <ActivityIndicator size="large" color="#70f" />
      </View>
    );
  }

  return (
    <FlatList
      ref={flatList}
      refreshing={isRefreshing}
      onRefresh={onRefresh}
      onEndReachedThreshold={onEndReachedThreshold}
      onEndReached={onEndReached}
      data={data}
      ListEmptyComponent={ListEmptyComponent}
      ListFooterComponent={ListFooterComponent}
      {...props}
      inverted={false}
      contentContainerStyle={contentContainerStyle.current}
      ListHeaderComponent={ListHeaderComponent}
      onContentSizeChange={onContentSizeChange}
      keyExtractor={keyExtractor}
      onViewableItemsChanged={onViewableItemsChanged}
      initialNumToRender={1}
    />
  );
});

export {
  DefaultFlatList,
  DefaultFlatListProps,
};
