import {
  useCallback,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  View,
} from 'react-native';
import { DefaultText } from './default-text';
import { longFriendlyTimestamp } from '../util/util';
import { useImage, Image } from 'expo-image';
import { IMAGES_URL } from '../env/env';

type Props = {
  fromCurrentUser: boolean,
  timestamp: Date,
  text: string,
  imageUuid: string | null | undefined,
};

const isSafeImageUrl = (str: string): boolean => {
  const urlRegex = /^https:\/\/media\.tenor\.com\/\S+\.(gif|webp)$/i;
  return urlRegex.test(str);
};

const isEmojiOnly = (str: string): boolean => {
  const emojiRegex = /^\p{Emoji_Presentation}+$/u;
  return emojiRegex.test(str);
}

const SpeechBubble = (props: Props) => {
  const [showTimestamp, setShowTimestamp] = useState(false);
  const [speechBubbleImageError, setSpeechBubbleImageError] = useState(false);

  const onPress = useCallback(() => {
    setShowTimestamp(t => !t);
  }, [setShowTimestamp]);

  const doRenderUrlAsImage = (
    isSafeImageUrl(props.text) &&
    !speechBubbleImageError
  );

  const backgroundColor = (() => {
    if (doRenderUrlAsImage) {
      return 'transparent';
    } else if (isEmojiOnly(props.text)) {
      return 'transparent';
    } else if (props.fromCurrentUser) {
      return '#70f';
    } else {
      return '#eee';
    }
  })();

  return (
    <View
      style={{
        paddingTop: 5,
        paddingBottom: 5,
        paddingLeft: 10,
        paddingRight: 10,
        alignItems: props.fromCurrentUser ? 'flex-end' : 'flex-start',
        width: '100%',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          gap: 5,
          alignItems: 'flex-end',
          ...(doRenderUrlAsImage ? {
            width: '66%',
          }: {
            maxWidth: '80%',
          })
        }}
      >
        {props.imageUuid &&
          <Image
            source={{ uri: `${IMAGES_URL}/450-${props.imageUuid}.jpg` }}
            transition={150}
            style={{
              width: 24,
              height: 24,
              borderRadius: 9999,
            }}
          />
        }
        <Pressable
          onPress={onPress}
          style={{
            borderRadius: 10,
            backgroundColor: backgroundColor,
            ...(doRenderUrlAsImage ? {
              width: '100%',
            }: {
              padding: 10,
              flexShrink: 1,
            })
          }}
        >
          {doRenderUrlAsImage &&
            <SpeechBubbleImage
              uri={props.text}
              onError={() => setSpeechBubbleImageError(true)}
            />
          }
          {!doRenderUrlAsImage &&
            <DefaultText
              selectable={true}
              style={{
                color: props.fromCurrentUser ? 'white' : 'black',
                fontSize: isEmojiOnly(props.text) ? 50 : 15,
              }}
            >
              {props.text}
            </DefaultText>
          }
        </Pressable>
      </View>
      {showTimestamp &&
        <DefaultText
          selectable={true}
          style={{
            fontSize: 13,
            paddingTop: 10,
            alignSelf: props.fromCurrentUser ? 'flex-end' : 'flex-start',
            color: '#666',
          }}
        >
          {longFriendlyTimestamp(props.timestamp)}
        </DefaultText>
      }
    </View>
  );
};

const SpeechBubbleImage = ({
  uri,
  onError,
}: {
  uri: string
  onError: () => void
}) => {
  const image = useImage(uri, { onError });

  if (!image) {
    return (
      <View
        style={{
          // The dimensions are chosen so the height of the placeholder will be
          // less than or equal to the rendered image. Otherwise
          // scroll-to-bottom will be broken in the case that the image loads
          // after the conversation screen already scrolled to the bottom.
          width: '100%',
          aspectRatio: 1,

          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          borderRadius: 10,
          gap: 12,
        }}
      >
        <ActivityIndicator size="large" color="white" />
        <DefaultText
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: 'white',
          }}
        >
          GIF
        </DefaultText>
      </View>
    );
  }

  return (
    <Image
      source={image}
      transition={150}
      style={{
        width: '100%',
        aspectRatio: image.width / image.height,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 10,
        overflow: 'hidden',
      }}
    />
  );
};

export {
  SpeechBubble,
};
