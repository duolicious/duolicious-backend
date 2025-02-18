import {
  useCallback,
  useState,
} from 'react';
import {
  Pressable,
  View,
} from 'react-native';
import { DefaultText } from './default-text';
import { longFriendlyTimestamp } from '../util/util';
import { Image } from 'expo-image';
import { IMAGES_URL } from '../env/env';
import { AutoResizingGif } from './auto-resizing-gif';
import { isMobile } from '../util/util';

type Props = {
  fromCurrentUser: boolean,
  timestamp: Date,
  text: string,
  imageUuid: string | null | undefined,
};

type MarkdownBlock = QuoteBlock | TextBlock;

type QuoteBlock = {
  type: 'quote';
  text: string;
  attribution?: string;
};

type TextBlock = {
  type: 'text';
  text: string;
};

const parseMarkdown = (markdown: string): MarkdownBlock[] => {
  const lines = markdown.split(/\r?\n/);
  const blocks: MarkdownBlock[] = [];
  let currentBlockType: 'quote' | 'text' | null = null;
  let currentBlockLines: string[] = [];

  const parseQuoteBlock = (lines: string[]): QuoteBlock => {
    const trimmedLines = lines.map(line => line.trim());
    let attribution: string | undefined;
    let endIndex = lines.length;

    for (let i = trimmedLines.length - 1; i >= 0; i--) {
      if (trimmedLines[i] === '') continue;
      if (/^-\s+/.test(trimmedLines[i])) {
        attribution = trimmedLines[i].replace(/^-\s+/, '');
        endIndex = i;
      }
      break;
    }

    return {
      type: 'quote',
      text: lines.slice(0, endIndex).join('\n').trim(),
      attribution,
    };
  };

  const flushBlock = (): void => {
    if (currentBlockLines.length === 0 || currentBlockType === null) return;

    if (currentBlockType === 'quote') {
      blocks.push(parseQuoteBlock(currentBlockLines));
    } else {
      blocks.push({
        type: 'text',
        text: currentBlockLines.join('\n').trim(),
      });
    }

    currentBlockLines = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith('>')) {
      if (currentBlockType !== 'quote') {
        flushBlock();
        currentBlockType = 'quote';
      }
      // Remove the leading ">" and an optional space.
      currentBlockLines.push(line.replace(/^>\s?/, ''));
    } else {
      if (currentBlockType !== 'text') {
        flushBlock();
        currentBlockType = 'text';
      }
      currentBlockLines.push(line);
    }
  }

  flushBlock();
  return blocks;
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
            gap: 10,
            ...(doRenderUrlAsImage ? {
              width: '100%',
            }: {
              padding: 10,
              flexShrink: 1,
            })
          }}
        >
          {doRenderUrlAsImage &&
            <AutoResizingGif
              uri={props.text}
              onError={() => setSpeechBubbleImageError(true)}
              requirePress={isMobile()}
            />
          }
          {!doRenderUrlAsImage &&
            <FormattedText
              text={props.text}
              color={props.fromCurrentUser ? 'white' : 'black'}
              fontSize={isEmojiOnly(props.text) ? 50 : 15}
            />
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

const FormattedText = ({
  text,
  color,
  fontSize,
}: {
  text: string
  color: string,
  fontSize: number,
}) => {
  const blocks = parseMarkdown(text);

  return (
    <>
      {blocks.map((block, i) =>
        <DefaultText
          key={i}
          selectable={true}
          style={{
            color,
            fontSize,
            ...(block.type === "quote" ? {
              paddingLeft: 7,
              paddingRight: 10,
              paddingVertical: 8,
              borderLeftWidth: 6,
              borderColor: 'black',
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              color: 'black',
              borderRadius: 4,
            }: {})
          }}
        >
          {block.type === "quote" && block?.attribution &&
            <DefaultText
              style={{
                fontWeight: '700',
              }}
            >
              {block.attribution}{'\n'}
            </DefaultText>
          }
          {block.text}
        </DefaultText>
      )}
    </>
  );
};

export {
  SpeechBubble,
  parseMarkdown,
};
