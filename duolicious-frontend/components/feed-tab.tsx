import {
  Platform,
  SafeAreaView,
  StyleSheet,
  View,
} from 'react-native';
import { useCallback, useRef } from 'react';
import { DefaultText } from './default-text';
import { DuoliciousTopNavBar } from './top-nav-bar';
import { useScrollbar } from './navigation/scroll-bar-hooks';
import { Avatar } from './avatar';
import { getShortElapsedTime } from '../util/util';
import { GestureResponderEvent, Pressable } from 'react-native';
import { EnlargeablePhoto } from './enlargeable-image';
import { commonStyles } from '../styles';
import { useOnline } from '../chat/application-layer/hooks/online';
import { ONLINE_COLOR } from '../constants/constants';
import { VerificationBadge } from './verification-badge';
import { useNavigation } from '@react-navigation/native';
import { japi } from '../api/api';
import { DefaultFlatList, DefaultFlashList } from './default-flat-list';
import { z } from 'zod';
import { notify } from '../events/events';
import { ReportModalInitialData } from './modal/report-modal';
import { Flag } from "react-native-feather";
import { AudioPlayer } from './audio-player';
import { useSkipped } from '../hide-and-block/hide-and-block';
import { TopNavBarButton } from './top-nav-bar-button';

const NAME_ACTION_TIME_GAP_VERTICAL = 16;

const DefaultList = Platform.OS === 'web' ? DefaultFlatList : DefaultFlashList;

const DataItemBaseSchema = z.object({
  time: z.string(),
  person_uuid: z.string(),
  name: z.string(),
  photo_uuid: z.string().nullable(),
  photo_blurhash: z.string().nullable(),
  is_verified: z.boolean(),
  match_percentage: z.number(),
});

const DataItemJoinedSchema = DataItemBaseSchema.extend({
  type: z.literal('joined'),
});

const DataItemAddedPhotoSchema = DataItemBaseSchema.extend({
  type: z.literal('added-photo'),
  added_photo_uuid: z.string(),
  added_photo_blurhash: z.string(),
  added_photo_extra_exts: z.array(z.string()),
});

const DataItemAddedVoiceBioSchema = DataItemBaseSchema.extend({
  type: z.literal('added-voice-bio'),
  added_audio_uuid: z.string(),
});

const DataItemUpdatedBioSchema = DataItemBaseSchema.extend({
  type: z.literal('updated-bio'),
  added_text: z.string(),
  background_color: z.string(),
  body_color: z.string(),
});

const DataItemSchema = z.discriminatedUnion('type', [
  DataItemJoinedSchema,
  DataItemAddedVoiceBioSchema,
  DataItemAddedPhotoSchema,
  DataItemUpdatedBioSchema,
]);

type DataItem = z.infer<typeof DataItemSchema>;
type DataItemJoined = z.infer<typeof DataItemJoinedSchema>;
type DataItemAddedPhoto = z.infer<typeof DataItemAddedPhotoSchema>;
type DataItemAddedVoiceBio = z.infer<typeof DataItemAddedVoiceBioSchema>;
type DataItemUpdatedBio = z.infer<typeof DataItemUpdatedBioSchema>;

const pageMetadata = {
  lastPage: null,
  seenPersonUuids: new Set<string>()
} as {
  lastPage: DataItem[] | null
  seenPersonUuids: Set<string>
};

const isValidDataItem = (item: unknown): item is DataItem => {
  const result = DataItemSchema.safeParse(item);

  if (!result.success) {
    console.warn(result.error);
  }

  return result.success;
};

const isDistinctItem = (item: DataItem) => {
  const result = !pageMetadata.seenPersonUuids.has(item.person_uuid);

  pageMetadata.seenPersonUuids.add(item.person_uuid);

  return result;
};

const fetchPage = async (pageNumber: number): Promise<DataItem[] | null> => {
  if (pageNumber === 1) {
    pageMetadata.lastPage = null;
    pageMetadata.seenPersonUuids = new Set();
  }

  const now           = new Date();
  const oneMinuteAgo  = new Date(now.getTime() - 60_000).toISOString(); // underscore for readability

  const lastPageTime = pageMetadata?.lastPage?.at(-1)?.time ?? oneMinuteAgo;

  const before = pageNumber === 1 ? oneMinuteAgo : lastPageTime;

  const response = await japi(
    'get',
    `/feed?before=${encodeURIComponent(before)}`
  );

  if (!response.ok) {
    return null
  }

  if (!Array.isArray(response.json)) {
    return null;
  }

  pageMetadata.lastPage = response
    .json
    .filter(isValidDataItem)
    .filter(isDistinctItem);

  return [...pageMetadata.lastPage];
};

const useNavigationToProfile = (
  personUuid: string,
  photoBlurhash: string | null
) => {
  const navigation = useNavigation<any>();

  return useCallback(() => {
    navigation.navigate(
      'Prospect Profile Screen',
      {
        screen: 'Prospect Profile',
        params: { personUuid, photoBlurhash },
      }
    );
  }, [personUuid, photoBlurhash]);
};

const useNavigationToProfileGallery = (photoUuid) => {
  const navigation = useNavigation<any>();

  return useCallback(() => {
    navigation.navigate(
      'Prospect Profile Screen',
      {
        screen: 'Gallery Screen',
        params: { photoUuid },
      }
    );
  }, [photoUuid]);
};

const NameActionTime = ({
  personUuid,
  name,
  isVerified,
  action,
  time,
  doUseOnline,
  style,
}: {
  personUuid: string
  name: string
  isVerified: boolean
  action: string
  time: Date
  doUseOnline: boolean
  style?: any
}) => {
  const isOnline = useOnline(doUseOnline ? personUuid : null);

  const onPress = useCallback((event: GestureResponderEvent) => {
    event.stopPropagation();

    const data: ReportModalInitialData = {
      name,
      personUuid,
      context: 'Feed',
    };
    notify('open-report-modal', data);
  }, [notify, name, personUuid]);

  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
      }}
    >
      <View
        style={{
          flex: 1,
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 2,
          ...style,
        }}
      >
        <View
          style={{
            width: '100%',
            flexDirection: 'row',
            gap: 5,
            alignItems: 'center',
          }}
        >
          {isOnline &&
            <View
              style={{
                height: 10,
                width: 10,
                borderRadius: 999,
                backgroundColor: ONLINE_COLOR,
              }}
            />
          }
          <DefaultText
            style={{
              fontWeight: '700',
              color: 'black',
              flexShrink: 1,
            }}
          >
            {name}
          </DefaultText>
          {isVerified &&
            <VerificationBadge size={14} />
          }
        </View>
        <DefaultText
          style={{
            color: '#999',
            width: '100%',
          }}
        >
          {action} • {getShortElapsedTime(time)}
        </DefaultText>
      </View>
      <Flag
        hitSlop={20}
        onPress={onPress}
        stroke="rgba(0, 0, 0, 0.5)"
        strokeWidth={2}
        height={18}
        width={18}
        style={{
          marginLeft: 10,
        }}
      />
    </View>
  );
};

const FeedItemJoined = ({ dataItem }: { dataItem: DataItemJoined }) => {
  const onPress = useNavigationToProfile(
    dataItem.person_uuid,
    dataItem.photo_blurhash,
  );

  return (
    <Pressable
      onPress={onPress}
      style={styles.cardBorders}
    >
      {dataItem.photo_uuid &&
        <Avatar
          percentage={dataItem.match_percentage}
          personUuid={dataItem.person_uuid}
          photoUuid={dataItem.photo_uuid}
          photoBlurhash={dataItem.photo_blurhash}
          doUseOnline={!!dataItem.photo_uuid}
        />
      }
      <NameActionTime
        personUuid={dataItem.person_uuid}
        name={dataItem.name}
        isVerified={dataItem.is_verified}
        action="joined"
        time={new Date(dataItem.time)}
        doUseOnline={!dataItem.photo_uuid}
      />
    </Pressable>
  );
};

const FeedItemAddedPhoto = ({ dataItem }: { dataItem: DataItemAddedPhoto }) => {
  const onPress = useNavigationToProfile(
    dataItem.person_uuid,
    dataItem.photo_blurhash,
  );

  const onPressPhoto = useNavigationToProfileGallery(dataItem.added_photo_uuid);

  return (
    <Pressable
      onPress={onPress}
      style={styles.cardBorders}
    >
      {dataItem.photo_uuid &&
        <Avatar
          percentage={dataItem.match_percentage}
          personUuid={dataItem.person_uuid}
          photoUuid={dataItem.photo_uuid}
          photoBlurhash={dataItem.photo_blurhash}
          doUseOnline={!!dataItem.photo_uuid}
        />
      }
      <View style={{ flex: 1, gap: NAME_ACTION_TIME_GAP_VERTICAL }}>
        <NameActionTime
          personUuid={dataItem.person_uuid}
          name={dataItem.name}
          isVerified={dataItem.is_verified}
          action="added a photo"
          time={new Date(dataItem.time)}
          doUseOnline={!dataItem.photo_uuid}
        />
        <EnlargeablePhoto
          onPress={onPressPhoto}
          photoUuid={dataItem.added_photo_uuid}
          photoExtraExts={dataItem.added_photo_extra_exts}
          photoBlurhash={dataItem.added_photo_blurhash}
          isPrimary={true}
          style={{
            ...commonStyles.secondaryEnlargeablePhoto,
            marginTop: 0,
            marginBottom: 0,
          }}
        />
      </View>
    </Pressable>
  );
};

const FeedItemAddedVoiceBio = ({ dataItem }: { dataItem: DataItemAddedVoiceBio }) => {
  const onPress = useNavigationToProfile(
    dataItem.person_uuid,
    dataItem.photo_blurhash,
  );

  return (
    <Pressable
      onPress={onPress}
      style={styles.cardBorders}
    >
      {dataItem.photo_uuid &&
        <Avatar
          percentage={dataItem.match_percentage}
          personUuid={dataItem.person_uuid}
          photoUuid={dataItem.photo_uuid}
          photoBlurhash={dataItem.photo_blurhash}
          doUseOnline={!!dataItem.photo_uuid}
        />
      }
      <View style={{ flex: 1, gap: NAME_ACTION_TIME_GAP_VERTICAL }}>
        <NameActionTime
          personUuid={dataItem.person_uuid}
          name={dataItem.name}
          isVerified={dataItem.is_verified}
          action="added a voice bio"
          time={new Date(dataItem.time)}
          doUseOnline={!dataItem.photo_uuid}
        />
        <AudioPlayer
          uuid={dataItem.added_audio_uuid}
          presentation="feed"
          style={{ marginTop: 0 }}
        />
      </View>
    </Pressable>
  );
};

const FeedItemUpdatedBio = ({ dataItem }: { dataItem: DataItemUpdatedBio }) => {
  const onPress = useNavigationToProfile(
    dataItem.person_uuid,
    dataItem.photo_blurhash,
  );

  return (
    <Pressable
      onPress={onPress}
      style={styles.cardBorders}
    >
      {dataItem.photo_uuid &&
        <Avatar
          percentage={dataItem.match_percentage}
          personUuid={dataItem.person_uuid}
          photoUuid={dataItem.photo_uuid}
          photoBlurhash={dataItem.photo_blurhash}
          doUseOnline={!!dataItem.photo_uuid}
        />
      }
      <View style={{ flex: 1, gap: NAME_ACTION_TIME_GAP_VERTICAL }}>
        <NameActionTime
          personUuid={dataItem.person_uuid}
          name={dataItem.name}
          isVerified={dataItem.is_verified}
          action={
            dataItem.added_text.trim()
              ? "updated their bio"
              : "erased their bio"
          }
          time={new Date(dataItem.time)}
          doUseOnline={!dataItem.photo_uuid}
          style={{
            paddingHorizontal: 10,
          }}
        />
        <DefaultText
          style={{
            backgroundColor: dataItem.background_color,
            color: dataItem.body_color,
            borderRadius: 10,
            padding: 10,
          }}
        >
          {dataItem.added_text}
        </DefaultText>
      </View>
    </Pressable>
  );
};

const FeedItem = ({ dataItem }: { dataItem: DataItem }) => {
  const { isSkipped } = useSkipped(dataItem.person_uuid);

  if (isSkipped) {
    return <></>;
  } else if (dataItem.type === 'joined') {
    return <FeedItemJoined dataItem={dataItem} />;
  } else if (dataItem.type === 'added-photo') {
    return <FeedItemAddedPhoto dataItem={dataItem} />;
  } else if (dataItem.type === 'added-voice-bio') {
    return <FeedItemAddedVoiceBio dataItem={dataItem} />;
  } else if (dataItem.type === 'updated-bio') {
    return <FeedItemUpdatedBio dataItem={dataItem} />;
  } else {
    return <></>;
  }
};

const FeedTab = () => {
  const {
    onLayout,
    onContentSizeChange,
    onScroll,
    showsVerticalScrollIndicator,
    observeListRef,
  } = useScrollbar('traits');

  const listRef = useRef<any>(undefined);

  const onPressRefresh = useCallback(() => {
    const refresh = listRef?.current?.refresh;
    refresh && refresh();
  }, []);

  return (
    <SafeAreaView style={styles.safeAreaView}>
      <DuoliciousTopNavBar>
        {Platform.OS === 'web' &&
          <TopNavBarButton
            onPress={onPressRefresh}
            iconName="refresh"
            position="left"
            secondary={true}
            label="Refresh"
          />
        }
      </DuoliciousTopNavBar>
      <DefaultList
        ref={listRef}
        innerRef={observeListRef}
        emptyText={
          "Your feed is empty right now. Check back later to see what " +
          "everyone’s doing\xa0👀"
        }
        errorText={"Something went wrong while fetching your feed\xa0😵‍💫"}
        endText={
          "You’re all caught up! Check back later to see what " +
          "everyone’s doing\xa0👀"
        }
        fetchPage={fetchPage}
        contentContainerStyle={styles.listContentContainerStyle}
        renderItem={({ item }: { item: DataItem }) =>
          <FeedItem dataItem={item} />
        }
        keyExtractor={(item: DataItem) => item.person_uuid}
        onLayout={onLayout}
        onContentSizeChange={onContentSizeChange}
        onScroll={onScroll}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      />
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
    marginBottom: 20,
  },
});

export {
  FeedTab,
};
