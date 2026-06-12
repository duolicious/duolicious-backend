import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { DefaultText } from '../default-text';
import { longFriendlyTimestamp } from '../../util/util';
import {
  useReadReceipt,
  useReadReceiptUpsell,
} from '../../chat/application-layer/hooks/read-receipt';
import { showPointOfSale } from '../modal/point-of-sale-modal';
import { useAppTheme } from '../../app-theme/app-theme';

type Content =
  | { kind: 'read', timestamp: Date }
  | { kind: 'upsell' };

const ReadReceipt = ({ personUuid }: { personUuid: string }) => {
  const { appTheme } = useAppTheme();
  const readReceiptAt = useReadReceipt(personUuid);
  const showUpsell = useReadReceiptUpsell(personUuid);

  const content: Content | null =
    readReceiptAt ? { kind: 'read', timestamp: readReceiptAt } :
    showUpsell ? { kind: 'upsell' } :
    null;

  // Keep the last shown content so it doesn't blank out mid-fade.
  const [shown, setShown] = useState<Content | null>(content);

  const opacity = useSharedValue(content ? 1 : 0);

  useEffect(() => {
    if (content) {
      setShown(content);
    }
    opacity.value = withTiming(content ? 1 : 0);
  }, [
    content?.kind,
    content?.kind === 'read' ? content.timestamp.getTime() : 0,
  ]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const upsellGesture = useMemo(
    () => Gesture.Tap().onEnd(() => runOnJS(showPointOfSale)(true)),
    []
  );

  return (
    <Animated.View
      pointerEvents={content ? 'auto' : 'none'}
      style={[styles.container, animatedStyle]}
    >
      {shown?.kind === 'upsell' ?
        <GestureDetector gesture={upsellGesture}>
          <View>
            <DefaultText
              disableTheme={true}
              style={{
                ...styles.upsellText,
                ...{
                  color: appTheme.brandColor,
                  fontSize: appTheme.timestampFontSize,
                }
              }}
            >
              Get read receipts
            </DefaultText>
          </View>
        </GestureDetector>
      :
        <DefaultText
          disableTheme={true}
          style={{
            ...styles.text,
            ...{
              color: appTheme.hintColor,
              fontSize: appTheme.timestampFontSize,
            }
          }}
        >
          {shown?.kind === 'read' ?
            `Read ${longFriendlyTimestamp(shown.timestamp)}` : ''}
        </DefaultText>
      }
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingRight: 10,
    justifyContent: 'flex-end',
  },
  text: {
    textAlign: 'right',
  },
  upsellText: {
    textAlign: 'right',
    fontWeight: '700',
    cursor: 'pointer',
  },
});

export {
  ReadReceipt,
};
