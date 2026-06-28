import { useCallback, useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useIsFocused } from '@react-navigation/native';
import Svg, { Polygon, Polyline } from 'react-native-svg';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faHighlighter } from '@fortawesome/free-solid-svg-icons/faHighlighter';
import { faReply } from '@fortawesome/free-solid-svg-icons/faReply';
import { DefaultText } from '../default-text';
import { useQuote } from '../conversation-screen/quote';
import { seenReplyHint } from '../../kv-storage/seen-reply-hint';
import { safeBestTextOn } from '../../util/util';

const AboutReplyHint = ({ color }: { color: string }) => {
  const [visible, setVisible] = useState(false);
  const quote = useQuote();
  const isFocused = useIsFocused();

  // Gently bob the hint up and down so it reads as a floating call-to-action,
  // distinct from the static profile content around it. The bob lives on its
  // own inner view so its transform doesn't fight the enter/exit layout
  // animations applied to the outer view.
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
    let active = true;

    (async () => {
      const alreadySeen = await seenReplyHint();
      if (!active || alreadySeen) return;

      setVisible(true);
    })();

    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (quote) {
      seenReplyHint(true);
    }
  }, [Boolean(quote)]);

  useEffect(() => {
    if (!isFocused) {
      setVisible(false);
    }
  }, [isFocused]);

  // ...or by tapping the hint to dismiss it.
  const dismiss = useCallback(() => {
    setVisible(false);
    seenReplyHint(true);
  }, []);

  if (!visible) {
    return null;
  }

  const bubbleColor = color;
  const inkColor = safeBestTextOn(bubbleColor, '#ffffff');

  return (
    <Animated.View
      pointerEvents="box-none"
      entering={FadeIn}
      exiting={FadeOut}
      style={{
        position: 'absolute',
        top: '100%',
        left: 5,
        right: -5,
        marginTop: 10,
        zIndex: 10,
        elevation: 10,
      }}
    >
      <Animated.View style={[{ alignItems: 'flex-start' }, bobStyle]}>
      {/*
        The pointer is a single SVG shape rather than two stacked CSS-border
        triangles. Stacked triangles leave an internal horizontal seam between
        the border-colored and fill-colored layers that shimmers at fractional
        `bob` positions. Here the fill is one polygon and only the two slanted
        edges are stroked (the base is left open), so there's no internal seam
        and nothing horizontal to shimmer. It's lifted above the bubble and its
        base overlaps the bubble's top edge so the fill covers the bubble's top
        border line where they join.
      */}
      <View style={{ marginLeft: 16, marginBottom: -3, zIndex: 2 }}>
        <Svg width={18} height={11}>
          {/*
            The fill extends all the way down to the base (y=10) so it buries
            the bubble's 1px top border and never shimmers. The stroked edges,
            however, stop 1px short (y=9) so the angled outline lines up with
            the top of the bubble's borders instead of overshooting downward.
          */}
          <Polygon points="9,1 1,10 17,10" fill={bubbleColor} />
          <Polyline
            points="1.9,9 9,1 16.1,9"
            fill="none"
            stroke={inkColor}
            strokeWidth={1}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      <Pressable
        onPress={dismiss}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: bubbleColor,
          borderWidth: 1,
          borderColor: inkColor,
          paddingVertical: 9,
          paddingHorizontal: 12,
          borderRadius: 8,
          zIndex: 1,
          ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
        }}
      >
        <FontAwesomeIcon
          icon={quote ? faReply : faHighlighter}
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
          {quote
            ? 'Nice! – now tap the reply button at the bottom of the screen to quote your selection'
            : 'Tip: highlight any text on this profile to reply to it'}
        </DefaultText>
      </Pressable>
      </Animated.View>
    </Animated.View>
  );
};

export {
  AboutReplyHint,
};
