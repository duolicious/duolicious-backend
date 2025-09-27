import {
  ActivityIndicator,
  Animated as RNAnimated,
  Pressable,
  SafeAreaView,
  StyleSheet,
  View,
} from 'react-native';
import { memo, useCallback, useEffect, useState } from 'react';
import { DefaultText } from './default-text';
import { TopNavBar } from './top-nav-bar';
import { useScrollbar } from './navigation/scroll-bar-hooks';
import { Avatar } from './avatar';
import { commonStyles } from '../styles';
import { VerificationBadge } from './verification-badge';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { japi } from '../api/api';
import { useSkipped } from '../hide-and-block/hide-and-block';
import { useAppTheme } from '../app-theme/app-theme';
import { usePressableAnimation } from '../animation/animation';
import { ButtonGroup } from './button-group';
import Animated from 'react-native-reanimated';
import * as _ from 'lodash';
import { z } from 'zod';
import { listen, notify, lastEvent } from '../events/events';
import {
  format,
  isThisYear,
  isToday,
  isYesterday,
} from 'date-fns'
import { GestureResponderEvent } from 'react-native';
import { ReportModalInitialData } from './modal/report-modal';
import { Flag } from "react-native-feather";
import { Notice } from './notice';
import { showPointOfSale } from './modal/point-of-sale-modal';
import { useSignedInUser } from '../events/signed-in-user';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faGhost } from '@fortawesome/free-solid-svg-icons/faGhost';
import { useTooltip } from './tooltip';
import { happenedInLast7Days } from '../util/util';

const friendlyTimestamp = (date: Date): string => {
  if (isToday(date)) {
    // Format as 'hh:mm'
    return 'Today, ' + format(date, 'h:mm aaa')
  } else if (isYesterday(date)) {
    // Format as 'hh:mm'
    return 'Yesterday, ' + format(date, 'h:mm aaa')
  } else if (happenedInLast7Days(date)) {
    // Format as 'eeee' (day of the week)
    return format(date, 'eeee, h:mm aaa')
  } else if (isThisYear(date)) {
    // Format as 'd MMM' (date and month)
    return format(date, 'd MMM, h:mm aaa')
  } else {
    // Format as 'd MMM yyyy' (date, month and year)
    return format(date, 'd MMM yyyy, h:mm aaa')
  }
};

// Event keys
const EVENT_NUM_VISITORS = 'num-visitors';

// Keep public setter for badge count
const setNumVisitors = (num: number) => {
  notify<number>(EVENT_NUM_VISITORS, num);
};

const useNumVisitors = () => {
  const initialNumVisitors = lastEvent<number>(EVENT_NUM_VISITORS) ?? 0;
  const [numVisitors, setNumVisitors_] = useState(initialNumVisitors);

  useEffect(() => {
    listen<number>(
      EVENT_NUM_VISITORS,
      (x) => {
        if(x !== undefined) {
          setNumVisitors_(x);
        }
      }
    );
  }, []);

  return numVisitors;
};

const DataItemSchema = z.object({
  person_uuid: z.string(),
  photo_uuid: z.string().nullable(),
  photo_blurhash: z.string().nullable(),
  time: z.string(),
  name: z.string(),
  age: z.number().nullable(),
  gender: z.string(),
  location: z.string().nullable(),
  is_verified: z.boolean(),
  match_percentage: z.number(),
  verification_required_to_view: z.union([
    z.literal('photos'),
    z.literal('basics'),
    z.null(),
  ]),
  is_new: z.boolean(),
  was_invisible: z.boolean(),
});

const DataSchema = z.object({
  visited_you: z.array(DataItemSchema),
  you_visited: z.array(DataItemSchema),
});

type DataItem = z.infer<typeof DataItemSchema>;
type Data = z.infer<typeof DataSchema>;

const isValidData = (item: unknown): item is Data => {
  const result = DataSchema.safeParse(item);

  if (!result.success) {
    console.warn(result.error);
  }

  return result.success;
};

type SectionKey = 'visited_you' | 'you_visited';

const sectionFromIndex = (sectionIndex: number): SectionKey =>
  sectionIndex === 0 ? 'visited_you' : 'you_visited';

const setVisitorKeys = (sectionKey: SectionKey, visitorKeys: string[]) => {
  notify<string[]>(sectionKey, visitorKeys);
};

const useVisitorKeys = (sectionKey: SectionKey): string[] | null => {
  const initial = lastEvent<string[]>(sectionKey) ?? null;

  const [visitorKeys, setVisitorKeys] = useState<string[] | null>(initial);

  useEffect(() => {
    return listen<string[]>(
      sectionKey,
      (newItem) => {
        if (!newItem) {
          return;
        }

        setVisitorKeys((prev) => _.isEqual(prev, newItem) ? prev : newItem);
      },
      true,
    );
  }, [sectionKey]);

  return visitorKeys;
};

const setVisitorDataItem = (
  key: string,
  dataItem: DataItem,
  ignoreEarlierVisit: boolean
) => {
  if (!ignoreEarlierVisit) {
    notify<DataItem>(key, dataItem);
    return;
  }

  const lastVisitTime = new Date(lastEvent<DataItem>(key)?.time ?? 0);
  const thisVisitTime = new Date(dataItem.time);

  if (thisVisitTime > lastVisitTime) {
    notify<DataItem>(key, dataItem);
  }
};

const useVisitorDataItem = (key: string): DataItem => {
  const initial = lastEvent<DataItem>(key);

  if (!initial) {
    throw new Error('item key not found');
  }

  const [item, setItem] = useState<DataItem>(initial);

  useEffect(() => {
    return listen<DataItem>(
      key,
      (newItem) => {
        if (!newItem) {
          return;
        }

        setItem((prev) => _.isEqual(prev, newItem) ? prev : newItem);
      },
    );
  }, [key]);

  return item;
};

// Notify updates to the visitors store
const setData = (data: Data) => {
  for (let dataItem of data.visited_you) {
    setVisitorDataItem(`visited_you-${dataItem.person_uuid}`, dataItem, true);
  }

  for (let dataItem of data.you_visited) {
    setVisitorDataItem(`you_visited-${dataItem.person_uuid}`, dataItem, true);
  }

  setVisitorKeys(
    'visited_you',
    data.visited_you.map(d => `visited_you-${d.person_uuid}`)
  );

  setVisitorKeys(
    'you_visited',
    data.you_visited.map(d => `you_visited-${d.person_uuid}`)
  );

  setNumVisitors(data.visited_you.filter(d => d.is_new).length);
};

const fetchVisitors = async (): Promise<void> => {
  const response = await japi('get', '/visitors', undefined, { maxRetries: 0 });

  if (!response.ok) {
    return;
  }

  if (!isValidData(response.json)) {
    return;
  }

  setData(response.json);
};

const markVisitorsCheckedAsync = async () => {
  await japi('post', '/mark-visitors-checked');
  setNumVisitors(0);
};

const markVisitorsChecked = () => {
  markVisitorsCheckedAsync();
};

const markVisitorChecked = (personUuid: string) => {
  const key = `visited_you-${personUuid}`;

  const dataItem = lastEvent<DataItem>(key);

  if (!dataItem) {
    return;
  }

  setVisitorDataItem(key, { ...dataItem, is_new: false }, false);
};

const useNavigationToProfile = (
  personUuid: string,
  photoBlurhash: string | null,
  verificationRequired: boolean
) => {
  const navigation = useNavigation<any>();

  const onPress = useCallback((e) => {
    e.preventDefault();

    if (verificationRequired) {
      return navigation.navigate('Profile');
    } else if (personUuid) {
      markVisitorChecked(personUuid);

      return navigation.navigate(
        'Prospect Profile Screen',
        {
          screen: 'Prospect Profile',
          params: { personUuid, photoBlurhash },
        }
      );
    }

  }, [personUuid, photoBlurhash, verificationRequired]);

  return {
    onPress,
    href: verificationRequired ? undefined : `/profile/${personUuid}`
  };
};

const VisitorsItem = ({ itemKey }: { itemKey: string }) => {
  const dataItem = useVisitorDataItem(itemKey);
  const { appTheme } = useAppTheme();

  const { isSkipped } = useSkipped(dataItem.person_uuid);
  const { backgroundColor, onPressIn, onPressOut } = usePressableAnimation();
  const navigationProps = useNavigationToProfile(
    dataItem.person_uuid,
    dataItem.photo_blurhash,
    dataItem.verification_required_to_view !== null,
  );
  const { viewRef, props } = useTooltip('You were invisible');

  const onPressReport = useCallback((event: GestureResponderEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const data: ReportModalInitialData = {
      name: dataItem.name,
      personUuid: dataItem.person_uuid,
      context: 'Visitors',
    };
    notify('open-report-modal', data);
  }, [dataItem.name, dataItem.person_uuid]);

  if (isSkipped) {
    return <></>;
  }

  return (
    <Pressable
      style={styles.pressableStyle}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      {...navigationProps}
    >
      <RNAnimated.View style={[styles.cardBorders, appTheme.card, { backgroundColor }]}>
        <Avatar
          percentage={dataItem.match_percentage}
          personUuid={dataItem.person_uuid}
          photoUuid={dataItem.photo_uuid}
          photoBlurhash={dataItem.photo_blurhash}
          verificationRequired={dataItem.verification_required_to_view}
        />
        <View style={{ flexShrink: 1, gap: 2 }} >
          <View
            style={{
              width: '100%',
              flexDirection: 'row',
              gap: 5,
              alignItems: 'center',
            }}
          >
            <DefaultText
              style={{
                fontWeight: '700',
                flexShrink: 1,
              }}
            >
              {dataItem.name}
            </DefaultText>
            {dataItem.is_verified &&
              <VerificationBadge size={14} />
            }
          </View>
          <DefaultText style={{ color: appTheme.hintColor }}>
            {
              [
                dataItem.age,
                dataItem.gender,
              ]
                .filter(Boolean)
                .join(' • ')
            }
          </DefaultText>
          {dataItem.location &&
            <DefaultText style={{ color: appTheme.hintColor }}>
              {dataItem.location}
            </DefaultText>
          }
          <DefaultText style={{ marginTop: 20, color: appTheme.hintColor }}>
            {friendlyTimestamp(new Date(dataItem.time))}
          </DefaultText>
        </View>
        <View
          style={{
            flexGrow: 1,
            alignItems: 'flex-end',
            marginRight: 5,
          }}
        >
          {dataItem.is_new &&
            <View
              style={{
                backgroundColor: appTheme.brandColor,
                height: 12,
                width: 12,
                borderRadius: 999,
              }}
            />
          }
          {dataItem.was_invisible &&
            <View
              ref={viewRef}
              {...props}
            >
              <FontAwesomeIcon
                icon={faGhost}
                size={22}
                style={{ color: appTheme.brandColor }}
              />
            </View>
          }
        </View>
        <Flag
          hitSlop={20}
          onPress={onPressReport}
          stroke={`${appTheme.secondaryColor}80`}
          strokeWidth={2}
          height={18}
          width={18}
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
          }}
        />
      </RNAnimated.View>
    </Pressable>
  );
};

const VisitorsItemMemo = memo(VisitorsItem);

const RenderItem = ({ item }: { item: string }) => {
  return <VisitorsItemMemo itemKey={item} />
};

const keyExtractor = (id: string) => id;

const VisitorsTab = () => {
  const { appTheme } = useAppTheme();
  const [signedInUser] = useSignedInUser();
  const {
    onLayout,
    onContentSizeChange,
    onScroll,
    showsVerticalScrollIndicator,
    observeListRef,
  } = useScrollbar('visitors');

  const [sectionIndex, setSectionIndex] = useState(0);

  useFocusEffect(
    useCallback(() => {
      markVisitorsChecked();
      return markVisitorsChecked;
    }, [])
  );

  const keys = useVisitorKeys(sectionFromIndex(sectionIndex));

  const emptyText = sectionIndex === 0 ? (
    "Nobody’s visited your profile yet. Try answering more Q&A questions or " +
    "updating your profile"
  ) : (
    "You haven’t visited anybody’s profile recently"
  );

  const endText = sectionIndex === 0 ? (
    "That’s everybody who’s visited you recently"
  ) : (
    "That’s everybody you’ve visited recently"
  );

  return (
    <SafeAreaView style={styles.safeAreaView}>
      <TopNavBar>
        <DefaultText
          style={{
            fontWeight: '700',
            fontSize: 20,
          }}
        >
          Visitors
        </DefaultText>
      </TopNavBar>
      {!keys &&
        <View style={{height: '100%', justifyContent: 'center', alignItems: 'center'}}>
          <ActivityIndicator size="large" color={appTheme.brandColor} />
        </View>
      }
      {!!keys &&
        <View style={styles.flatListContainer} onLayout={onLayout}>
          <Animated.FlatList<string>
            ref={observeListRef}
            data={keys}
            ListHeaderComponent={
              <>
                <ButtonGroup
                  buttons={[
                    'Visited You',
                    'You Visited',
                  ]}
                  selectedIndex={sectionIndex}
                  onPress={setSectionIndex}
                  containerStyle={{
                    marginTop: 5,
                    marginLeft: 20,
                    marginRight: 20,
                  }}
                />
                {!signedInUser?.hasGold &&
                  <Notice
                    onPress={() => showPointOfSale('inquiry')}
                    style={{
                      marginTop: 10,
                    }}
                  >
                    <FontAwesomeIcon
                      icon={faGhost}
                      size={22}
                      style={{ color: appTheme.brandColor }}
                    />
                    <DefaultText
                      style={{
                        marginLeft: 8,
                        color: appTheme.brandColor,
                      }}
                    >
                      Browse invisibly by supporting Duolicious
                    </DefaultText>
                  </Notice>
                }
              </>
            }
            ListEmptyComponent={
              <DefaultText style={styles.emptyText}>
                {emptyText}
              </DefaultText>
            }
            ListFooterComponent={
              keys.length > 0 ?
                <DefaultText style={styles.endText}>{endText}</DefaultText> :
                null
            }
            renderItem={RenderItem}
            keyExtractor={keyExtractor}
            onContentSizeChange={onContentSizeChange}
            onScroll={onScroll}
            showsVerticalScrollIndicator={showsVerticalScrollIndicator}
            contentContainerStyle={styles.listContentContainerStyle}
          />
        </View>
      }
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  listContentContainerStyle: {
    paddingTop: 10,
    paddingLeft: 10,
    paddingRight: 10,
    paddingBottom: 20,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  safeAreaView: {
    flex: 1
  },
  cardBorders: {
    ...commonStyles.cardBorders,
    flexDirection: 'row',
    gap: 10,
    padding: 10,
    alignItems: 'center',
    width: '100%',
  },
  pressableStyle: {
    marginTop: 20,
    width: '100%',
  },
  flatListContainer: {
    flex: 1,
  },
  emptyText: {
    fontFamily: 'Trueno',
    margin: '20%',
    textAlign: 'center',
  },
  endText: {
    fontFamily: 'TruenoBold',
    fontSize: 16,
    textAlign: 'center',
    alignSelf: 'center',
    marginTop: 30,
    marginBottom: 30,
    marginLeft: '15%',
    marginRight: '15%',
  }
});

export {
  VisitorsTab,
  fetchVisitors,
  useNumVisitors,
};
