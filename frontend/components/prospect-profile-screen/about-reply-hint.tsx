import { useCallback, useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useIsFocused } from '@react-navigation/native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faHighlighter } from '@fortawesome/free-solid-svg-icons/faHighlighter';
import { faReply } from '@fortawesome/free-solid-svg-icons/faReply';
import { DefaultText } from '../default-text';
import { useQuote } from '../conversation-screen/quote';
import { seenReplyHint } from '../../kv-storage/seen-reply-hint';
import { bestTextOn } from '../../util/util';

const safeInkOn = (bg: string): string => {
  try {
    return bestTextOn(bg);
  } catch {
    return '#ffffff';
  }
};

const AboutReplyHint = ({
  name,
  color,
}: {
  name: string,
  color: string,
}) => {
  const [visible, setVisible] = useState(false);
  const quote = useQuote();
  const isFocused = useIsFocused();

  const isActive =
    !!quote && quote.attribution === name && !!quote.text.trim();

  // Gently bob the hint up and down so it reads as a floating call-to-action,
  // distinct from the static profile content around it.
  const bob = useSharedValue(0);

  useEffect(() => {
    bob.value = withRepeat(
      withSequence(
        withTiming(-5, { duration: 1000, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, []);

  const bobStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value }],
  }));

  useEffect(() => {
    let mounted = true;

    (async () => {
      const alreadySeen = await seenReplyHint();
      if (!mounted || alreadySeen) return;

      setVisible(true);
      seenReplyHint(true);
    })();

    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!isFocused) {
      setVisible(false);
    }
  }, [isFocused]);

  const dismiss = useCallback(() => setVisible(false), []);

  if (!visible) {
    return null;
  }

  const bubbleColor = color;
  const inkColor = safeInkOn(bubbleColor);

  return (
    <Animated.View
      entering={FadeInDown}
      exiting={FadeOut}
      style={[{ marginTop: 10, alignItems: 'flex-start' }, bobStyle]}
    >
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: 7,
          borderRightWidth: 7,
          borderBottomWidth: 9,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: bubbleColor,
          marginLeft: 16,
          marginBottom: -1,
        }}
      />
      <Pressable
        onPress={dismiss}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: bubbleColor,
          paddingVertical: 9,
          paddingHorizontal: 12,
          borderRadius: 8,
          ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
        }}
      >
        <FontAwesomeIcon
          icon={isActive ? faReply : faHighlighter}
          size={14}
          style={{ color: inkColor }}
        />
        <DefaultText
          style={{
            color: inkColor,
            fontSize: 13,
            flexShrink: 1,
          }}
        >
          {isActive
            ? 'Nice! – now tap the reply button at the bottom of the screen to quote your selection'
            : 'Tip: highlight any text on this profile to reply to it'}
        </DefaultText>
      </Pressable>
    </Animated.View>
  );
};

export {
  AboutReplyHint,
};
