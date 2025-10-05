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
import { getShortElapsedTime, isMobile, assertNever, capLuminance } from '../util/util';
import { makeLinkProps } from '../util/navigation';
import { GestureResponderEvent, Pressable, Animated } from 'react-native';
import { EnlargeablePhoto } from './enlargeable-image';
import { commonStyles } from '../styles';
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
import { setQuote } from './conversation-screen/quote';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faReply } from '@fortawesome/free-solid-svg-icons/faReply';
import { OnlineIndicator } from './online-indicator';
import { useAppTheme } from '../app-theme/app-theme';
import { usePressableAnimation } from '../animation/animation';

const NAME_ACTION_TIME_GAP_VERTICAL = 16;

const DefaultList = Platform.OS === 'web' ? DefaultFlatList : DefaultFlashList;

type Action =
  | "Added a photo"
  | "Added a voice bio"
  | "Erased their bio"
  | "Joined"
  | "Recently online"
  | "Updated their bio"

const DataItemBaseSchema = z.object({
  time: z.string(),
  person_uuid: z.string(),
  name: z.string(),
  photo_uuid: z.string().nullable(),
  photo_blurhash: z.string().nullable(),
  is_verified: z.boolean(),
  match_percentage: z.number(),
  age: z.number().nullable(),
  gender: z.string(),
  location: z.string().nullable(),
});

const AddedPhotoFieldsSchema = DataItemBaseSchema.extend({
  added_photo_uuid: z.string(),
  added_photo_blurhash: z.string(),
  added_photo_extra_exts: z.array(z.string()),
});

const AddedVoiceBioFieldsSchema = DataItemBaseSchema.extend({
  added_audio_uuid: z.string(),
});

const UpdatedBioFieldsSchema = DataItemBaseSchema.extend({
  added_text: z.string(),
  background_color: z.string(),
  body_color: z.string(),
});

const JoinedFieldsSchema = DataItemBaseSchema;

const DataItemJoinedSchema = JoinedFieldsSchema.extend({
  type: z.literal('joined'),
});

const DataItemAddedPhotoSchema = AddedPhotoFieldsSchema.extend({
  type: z.literal('added-photo'),
});

const DataItemAddedVoiceBioSchema = AddedVoiceBioFieldsSchema.extend({
  type: z.literal('added-voice-bio'),
});

const DataItemUpdatedBioSchema = UpdatedBioFieldsSchema.extend({
  type: z.literal('updated-bio'),
});

const DataItemWasRecentlyOnlineWithBioSchema = UpdatedBioFieldsSchema.extend({
  type: z.literal('recently-online-with-bio'),
});

const DataItemWasRecentlyOnlineWithPhotoSchema = AddedPhotoFieldsSchema.extend({
  type: z.literal('recently-online-with-photo'),
});

const DataItemWasRecentlyOnlineWithVoiceBioSchema = AddedVoiceBioFieldsSchema.extend({
  type: z.literal('recently-online-with-voice-bio'),
});

const DataItemSchema = z.discriminatedUnion('type', [
  DataItemJoinedSchema,
  DataItemWasRecentlyOnlineWithBioSchema,
  DataItemWasRecentlyOnlineWithPhotoSchema,
  DataItemWasRecentlyOnlineWithVoiceBioSchema,
  DataItemAddedVoiceBioSchema,
  DataItemAddedPhotoSchema,
  DataItemUpdatedBioSchema,
]);

type DataItem = z.infer<typeof DataItemSchema>;
type DataItemWasRecentlyOnlineWithBio = z.infer<typeof DataItemWasRecentlyOnlineWithBioSchema>;
type DataItemWasRecentlyOnlineWithPhoto = z.infer<typeof DataItemWasRecentlyOnlineWithPhotoSchema>;
type DataItemWasRecentlyOnlineWithVoiceBio = z.infer<typeof DataItemWasRecentlyOnlineWithVoiceBioSchema>;

type JoinedFields = z.infer<typeof JoinedFieldsSchema>;
type UpdatedBioFields = z.infer<typeof UpdatedBioFieldsSchema>;
type AddedPhotoFields = z.infer<typeof AddedPhotoFieldsSchema>;
type AddedVoiceBioFields = z.infer<typeof AddedVoiceBioFieldsSchema>;

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

  return useCallback((e) => {
    e.preventDefault();

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

const useNavigationToConversation = (
  personUuid: string,
  name: string,
  photoUuid: string | null,
  photoBlurhash: string | null,
  quote: string,
) => {
  const navigation = useNavigation<any>();

  return useCallback((e) => {
    e.preventDefault();

    setQuote({ text: quote, attribution: name });

    navigation.navigate(
      'Conversation Screen',
      {
        personUuid,
        name,
        photoUuid,
        photoBlurhash,
      }
    );
  }, [personUuid, name, photoUuid, photoBlurhash, quote]);
};

const AgeGenderLocation = ({
  personUuid,
  name,
  isVerified,
  age,
  gender,
  userLocation,
  doUseOnline,
  style,
}: {
  personUuid: string
  name: string
  isVerified: boolean
  age: number | null
  gender: string
  userLocation: string | null
  doUseOnline: boolean
  style?: any
}) => {
  const { appTheme } = useAppTheme();

  const onPressReport = useCallback((event: GestureResponderEvent) => {
    event.stopPropagation();

    const data: ReportModalInitialData = {
      name,
      personUuid,
      context: 'Feed',
    };
    notify('open-report-modal', data);
  }, [notify, name, personUuid]);

  const onPress = useNavigationToProfile(
    personUuid,
    null
  );

  const link = makeLinkProps(`/profile/${personUuid}`);

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
        <Pressable
          style={{
            width: '100%',
            flexDirection: 'row',
            gap: 5,
            alignItems: 'center',
          }}
          onPress={onPress}
          {...link}
        >
          {doUseOnline &&
            <OnlineIndicator
              personUuid={personUuid}
              size={12}
              borderWidth={0}
            />
          }
          <DefaultText
            style={{
              fontWeight: '700',
              flexShrink: 1,
            }}
          >
            {name}
          </DefaultText>
          {isVerified &&
            <VerificationBadge size={14} />
          }
        </Pressable>
        <DefaultText style={{ color: appTheme.hintColor }}>
          {
            [
              age,
              gender,
            ]
              .filter(Boolean)
              .join(' • ')
          }
        </DefaultText>
        {userLocation &&
          <DefaultText style={{ color: appTheme.hintColor }}>
            {userLocation}
          </DefaultText>
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
          marginLeft: 10,
        }}
      />
    </View>
  );
};

const ActionTime = ({
  action,
  time,
  style,
}: {
  action: Action
  time: Date
  style?: any
}) => {
  const { appTheme } = useAppTheme();

  return (
    <View
      style={{
        alignItems: 'center',
        width: '100%',
        flexDirection: 'row',
        ...style,
      }}
    >
      <DefaultText
        style={{
          color: appTheme.secondaryColor,
          fontWeight: '700',
          fontSize: 18,
        }}
      >
        {action}
      </DefaultText>
      <DefaultText
        style={{
          color: appTheme.hintColor,
        }}
      >
        {' '}• {getShortElapsedTime(time)}
      </DefaultText>
    </View>
  );
};

const FeedItemJoined = ({ fields }: { fields: JoinedFields }) => {
  const { appTheme } = useAppTheme();

  const onPress = useNavigationToProfile(
    fields.person_uuid,
    fields.photo_blurhash,
  );

  const { backgroundColor, onPressIn, onPressOut } = usePressableAnimation();

  const props = isMobile() ? {
    onPress,
    onPressIn,
    onPressOut,
  } : {
    disabled: true,
  };

  return (
    <Pressable style={styles.pressableStyle} {...props}>
      <Animated.View style={[styles.cardBorders, appTheme.card, { backgroundColor }]}>
        {fields.photo_uuid &&
          <Avatar
            percentage={fields.match_percentage}
            personUuid={fields.person_uuid}
            photoUuid={fields.photo_uuid}
            photoBlurhash={fields.photo_blurhash}
            doUseOnline={!!fields.photo_uuid}
          />
        }
        <View style={{ flex: 1, gap: NAME_ACTION_TIME_GAP_VERTICAL }}>
          <AgeGenderLocation
            personUuid={fields.person_uuid}
            name={fields.name}
            isVerified={fields.is_verified}
            age={fields.age}
            gender={fields.gender}
            userLocation={fields.location}
            doUseOnline={!fields.photo_uuid}
          />
          <ActionTime action="Joined" time={new Date(fields.time)} />
        </View>
      </Animated.View>
    </Pressable>
  );
};

const FeedItemWasRecentlyOnline = ({
  dataItem
}: {
  dataItem:
    | DataItemWasRecentlyOnlineWithBio
    | DataItemWasRecentlyOnlineWithPhoto
    | DataItemWasRecentlyOnlineWithVoiceBio
}) => {
  switch (dataItem.type) {
    case 'recently-online-with-bio':
      return <FeedItemUpdatedBio fields={dataItem} action="Recently online" />;
    case 'recently-online-with-photo':
      return <FeedItemAddedPhoto fields={dataItem} action="Recently online" />;
    case 'recently-online-with-voice-bio':
      return <FeedItemAddedVoiceBio fields={dataItem} action="Recently online" />;
    default:
      return assertNever(dataItem);
  }
};

const FeedItemAddedPhoto = ({
  fields,
  action = "Added a photo",
}: {
  fields: AddedPhotoFields,
  action?: Action,
}) => {
  const { appTheme } = useAppTheme();

  const onPress = useNavigationToProfile(
    fields.person_uuid,
    fields.photo_blurhash,
  );

  const onPressPhoto = useNavigationToProfileGallery(fields.added_photo_uuid);

  const { backgroundColor, onPressIn, onPressOut } = usePressableAnimation();

  const props = isMobile() ? {
    onPress,
    onPressIn,
    onPressOut,
  } : {
    disabled: true,
  };

  return (
    <Pressable style={styles.pressableStyle} {...props}>
      <Animated.View style={[styles.cardBorders, appTheme.card, { backgroundColor }]}>
        {fields.photo_uuid &&
          <Avatar
            percentage={fields.match_percentage}
            personUuid={fields.person_uuid}
            photoUuid={fields.photo_uuid}
            photoBlurhash={fields.photo_blurhash}
            doUseOnline={!!fields.photo_uuid}
          />
        }
        <View style={{ flex: 1, gap: NAME_ACTION_TIME_GAP_VERTICAL }}>
          <AgeGenderLocation
            personUuid={fields.person_uuid}
            name={fields.name}
            isVerified={fields.is_verified}
            age={fields.age}
            gender={fields.gender}
            userLocation={fields.location}
            doUseOnline={!fields.photo_uuid}
          />
          <ActionTime action={action} time={new Date(fields.time)} />
          <EnlargeablePhoto
            onPress={onPressPhoto}
            photoUuid={fields.added_photo_uuid}
            photoExtraExts={fields.added_photo_extra_exts}
            photoBlurhash={fields.added_photo_blurhash}
            isPrimary={true}
            style={{
              ...commonStyles.secondaryEnlargeablePhoto,
              marginTop: 0,
              marginBottom: 0,
            }}
          />
        </View>
      </Animated.View>
    </Pressable>
  );
};

const FeedItemAddedVoiceBio = ({
  fields,
  action = "Added a voice bio"
}: {
  fields: AddedVoiceBioFields
  action?: Action
}) => {
  const { appTheme } = useAppTheme();

  const onPress = useNavigationToProfile(
    fields.person_uuid,
    fields.photo_blurhash,
  );

  const { backgroundColor, onPressIn, onPressOut } = usePressableAnimation();

  const props = isMobile() ? {
    onPress,
    onPressIn,
    onPressOut,
  } : {
    disabled: true,
  };

  return (
    <Pressable style={styles.pressableStyle} {...props}>
      <Animated.View style={[styles.cardBorders, appTheme.card, { backgroundColor }]}>
        {fields.photo_uuid &&
          <Avatar
            percentage={fields.match_percentage}
            personUuid={fields.person_uuid}
            photoUuid={fields.photo_uuid}
            photoBlurhash={fields.photo_blurhash}
            doUseOnline={!!fields.photo_uuid}
          />
        }
        <View style={{ flex: 1, gap: NAME_ACTION_TIME_GAP_VERTICAL }}>
          <AgeGenderLocation
            personUuid={fields.person_uuid}
            name={fields.name}
            isVerified={fields.is_verified}
            age={fields.age}
            gender={fields.gender}
            userLocation={fields.location}
            doUseOnline={!fields.photo_uuid}
          />
          <ActionTime action={action} time={new Date(fields.time)} />
          <AudioPlayer
            uuid={fields.added_audio_uuid}
            presentation="feed"
            style={{ marginTop: 0 }}
          />
        </View>
      </Animated.View>
    </Pressable>
  );
};

const FeedItemUpdatedBio = ({
  fields,
  action = "Updated their bio"
}: {
  fields: UpdatedBioFields,
  action?: Action,
}) => {
  const { appThemeName, appTheme } = useAppTheme();

  const onPress = useNavigationToProfile(
    fields.person_uuid,
    fields.photo_blurhash,
  );

  const onPressReply = useNavigationToConversation(
    fields.person_uuid,
    fields.name,
    fields.photo_uuid,
    fields.photo_blurhash,
    fields.added_text,
  );

  const { backgroundColor, onPressIn, onPressOut } = usePressableAnimation();

  const props = isMobile() ? {
    onPress,
    onPressIn,
    onPressOut,
  } : {
    disabled: true,
  };

  return (
    <Pressable style={styles.pressableStyle} {...props}>
      <Animated.View style={[styles.cardBorders, appTheme.card, { backgroundColor }]}>
        {fields.photo_uuid &&
          <Avatar
            percentage={fields.match_percentage}
            personUuid={fields.person_uuid}
            photoUuid={fields.photo_uuid}
            photoBlurhash={fields.photo_blurhash}
            doUseOnline={!!fields.photo_uuid}
          />
        }
        <View style={{ flex: 1, gap: isMobile() ? 8 : 10 }}>
          <View style={{ flex: 1, gap: NAME_ACTION_TIME_GAP_VERTICAL }}>
            <AgeGenderLocation
              personUuid={fields.person_uuid}
              name={fields.name}
              isVerified={fields.is_verified}
              age={fields.age}
              gender={fields.gender}
              userLocation={fields.location}
              doUseOnline={!fields.photo_uuid}
              style={{
                paddingHorizontal: 10,
              }}
            />
            <ActionTime
              action={action}
              time={new Date(fields.time)}
              style={{ paddingHorizontal: 10 }}
            />
            <DefaultText
              style={{
                backgroundColor:
                  appThemeName === 'dark'
                    ? capLuminance(fields.background_color)
                    : fields.background_color,
                color: fields.body_color,
                borderRadius: 10,
                padding: 10,
              }}
            >
              {fields.added_text}
            </DefaultText>
          </View>
          <View style={{ alignItems: 'flex-end' }} >
            <Pressable
              style={{
                flexDirection: 'row',
                gap: 6,
                paddingRight: 5,
              }}
              hitSlop={20}
              onPress={onPressReply}
            >
              <DefaultText style={{ fontWeight: 700 }}>
                Reply
              </DefaultText>
              <FontAwesomeIcon
                icon={faReply}
                size={16}
                color={appTheme.secondaryColor}
                style={{
                  /* @ts-ignore */
                  outline: 'none',
                }}
              />
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
};

const FeedItem = ({ dataItem }: { dataItem: DataItem }) => {
  const { isSkipped } = useSkipped(dataItem.person_uuid);

  if (isSkipped) {
    return <></>;
  }

  switch (dataItem.type) {
    case 'joined':
      return <FeedItemJoined fields={dataItem} />;
    case 'recently-online-with-bio':
    case 'recently-online-with-photo':
    case 'recently-online-with-voice-bio':
      return <FeedItemWasRecentlyOnline dataItem={dataItem} />;
    case 'added-photo':
      return <FeedItemAddedPhoto fields={dataItem} />;
    case 'added-voice-bio':
      return <FeedItemAddedVoiceBio fields={dataItem} />;
    case 'updated-bio':
      return <FeedItemUpdatedBio fields={dataItem} />;
    default:
      return assertNever(dataItem);
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
  },
  pressableStyle: {
    marginBottom: 20,
  },
});

export {
  FeedTab,
};
