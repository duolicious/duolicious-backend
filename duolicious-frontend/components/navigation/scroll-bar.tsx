import {
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  PanResponder,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { listen } from '../../events/events';

type ScrollViewData = {
  // The name of the Scrollview which is in control of the Scrollbar, or `null`
  // if no Scrollview is in control.
  controller: string | null;

  // A callback to call when the Scrollbar's thumb is dragged
  onThumbDrag?: (offset: number) => void;

  // The height of the controlling Scrollview's content
  contentHeight?: number;

  // The height of the controlling Scrollview's viewport
  scrollViewHeight?: number;

  // How far down the Scrollview has been scrolled
  offset?: number;
};

const Scrollbar = () => {
  /**
   * Single piece of state storing:
   *  - which ScrollView is controlling the scrollbar
   *  - the content/viewport heights
   *  - the current offset
   */
  const [scrollViewValues, setScrollViewValues] = useState<{
    controller: string | null;
    contentHeight: number;
    scrollViewHeight: number;
    offset: number;
  }>({
    controller: null,
    contentHeight: 0,
    scrollViewHeight: 0,
    offset: 0,
  });

  // We still keep a ref to the controlling ScrollView’s data,
  // mostly so we can store the onThumbDrag callback.
  const scrollViewDataRef = useRef<ScrollViewData>({ controller: null });

  // The current Animated thumb position
  const thumbPosition = useRef(new Animated.Value(0)).current;
  // The numeric value of the thumb position (faster reads inside PanResponder)
  const thumbPositionValue = useRef(0);

  // Where the thumb was when the user first put their finger down
  const gestureStartY = useRef(0);

  // Optional: track if user is dragging right now
  const isDragging = useRef(false);

  // Keep track of the old contentHeight so we can preserve offset after changes
  const oldContentHeightRef = useRef(0);

  const { height: trackHeight } = useWindowDimensions();

  /**
   * Calculate the thumb height each render
   */
  const minThumbHeight = 30;
  const thumbHeight = (() => {
    const { contentHeight, scrollViewHeight } = scrollViewValues;
    if (contentHeight <= 0) {
      return minThumbHeight;
    }
    return Math.min(
      trackHeight,
      Math.max(
        (scrollViewHeight / contentHeight) * scrollViewHeight,
        minThumbHeight
      )
    );
  })();

  // Just a helper to store these in refs so the PanResponder can use them
  const contentHeightRef = useRef(scrollViewValues.contentHeight);
  const scrollHeightRef = useRef(scrollViewValues.scrollViewHeight);
  const maxThumbOffsetRef = useRef(trackHeight - thumbHeight);

  /**
   * Immediately sets the thumb position based on a given scrollY.
   */
  const updateThumbPosition = (scrollY: number) => {
    const maxScroll =
      contentHeightRef.current - scrollHeightRef.current;
    if (maxScroll <= 0) {
      // No scrolling possible => put thumb at top
      thumbPosition.setValue(0);
      return;
    }
    const ratio = scrollY / maxScroll;
    const newThumbOffset = ratio * maxThumbOffsetRef.current;
    thumbPosition.setValue(newThumbOffset);
  };

  /**
   * Attempt to acquire or release control of the scrollbar.
   * A ScrollView has to have `onThumbDrag` to take control.
   * A ScrollView with `onThumbDrag===null` releases control
   * (but only if it owns the lock).
   */
  const tryControl = (data: ScrollViewData): boolean => {
    // Attempt to acquire lock
    if (data.onThumbDrag) {
      setScrollViewValues(prev => ({
        ...prev,
        controller: data.controller,
      }));
      scrollViewDataRef.current.controller = data.controller;
      return true;
    }

    // Attempt to release lock
    if (
      data.onThumbDrag === null &&
      data.controller === scrollViewDataRef.current.controller
    ) {
      setScrollViewValues(prev => ({
        ...prev,
        controller: null,
      }));
      scrollViewDataRef.current.controller = null;
      return false;
    }

    // Do we already have the lock?
    return scrollViewDataRef.current.controller === data.controller;
  };

  /**
   * PanResponder to handle drag events on the thumb.
   */
  const panResponderRef = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (evt) => {
        if (Platform.OS === 'web') {
          evt.preventDefault?.();
        }
        isDragging.current = true; // user started drag
        gestureStartY.current = thumbPositionValue.current;
      },

      onPanResponderMove: (evt, gestureState) => {
        if (Platform.OS === 'web') {
          evt.preventDefault?.();
        }
        const { dy } = gestureState;
        const currentMaxThumbOffset = maxThumbOffsetRef.current;

        // Proposed new thumb offset (clamp top/bottom)
        let newOffset = gestureStartY.current + dy;
        newOffset = Math.max(0, Math.min(newOffset, currentMaxThumbOffset));

        // Convert thumb offset -> content scroll offset
        const maxScroll =
          contentHeightRef.current - scrollHeightRef.current;
        const newScrollY =
          maxScroll <= 0 ? 0 : (newOffset / currentMaxThumbOffset) * maxScroll;

        // Notify parent to scroll
        scrollViewDataRef.current.onThumbDrag?.(newScrollY);

        // Update the thumb immediately
        thumbPosition.setValue(newOffset);
      },

      onPanResponderRelease: () => {
        isDragging.current = false; // user finished drag
      },
      onPanResponderTerminate: () => {
        isDragging.current = false; // user stopped
      },
    })
  );

  /**
   * Keep thumbPositionValue in sync with the Animated.Value.
   */
  useEffect(() => {
    const listenerId = thumbPosition.addListener(({ value }) => {
      thumbPositionValue.current = value;
    });
    return () => {
      thumbPosition.removeListener(listenerId);
    };
  }, [thumbPosition]);

  /**
   * 1) Whenever scrollViewValues (contentHeight, scrollViewHeight, offset) changes,
   *    store them in refs so PanResponder can read updated data.
   * 2) If we’re not dragging, move the thumb to match the new offset.
   */
  useEffect(() => {
    contentHeightRef.current = scrollViewValues.contentHeight;
    scrollHeightRef.current = scrollViewValues.scrollViewHeight;
    maxThumbOffsetRef.current = trackHeight - thumbHeight;

    if (!isDragging.current) {
      updateThumbPosition(scrollViewValues.offset);
    }
  }, [
    scrollViewValues.contentHeight,
    scrollViewValues.scrollViewHeight,
    scrollViewValues.offset,
    thumbHeight,
    trackHeight,
  ]);

  /**
   * Preserve the user’s scroll offset when new content arrives (e.g., infinite scroll).
   * If the content changes while the user is not actively dragging, we keep the same
   * “absolute” offset in terms of pixels scrolled. If user is dragging, skip or handle differently.
   */
  useEffect(() => {
    const oldContentHeight = oldContentHeightRef.current;
    oldContentHeightRef.current = scrollViewValues.contentHeight;

    // If there's no old content height or it hasn't changed, do nothing
    if (!oldContentHeight || oldContentHeight === scrollViewValues.contentHeight) {
      return;
    }
    if (isDragging.current) {
      // If user is in the middle of a drag, you might decide to skip
      // updating the offset here. Or handle it differently.
      return;
    }

    // The current thumb offset => oldScrollY in px
    const oldMaxScroll = oldContentHeight - scrollViewValues.scrollViewHeight;
    const newMaxScroll =
      scrollViewValues.contentHeight - scrollViewValues.scrollViewHeight;

    let oldScrollY = 0;
    if (oldMaxScroll > 0 && maxThumbOffsetRef.current > 0) {
      oldScrollY =
        (thumbPositionValue.current / maxThumbOffsetRef.current) * oldMaxScroll;
    }

    // Keep same absolute offset, but clamp if new content is smaller
    const newScrollY = Math.max(0, Math.min(newMaxScroll, oldScrollY));
    updateThumbPosition(newScrollY);

    // Potentially notify the controlling ScrollView that the offset changed
    // if you want two-way sync. For example:
    // scrollViewDataRef.current.onThumbDrag?.(newScrollY);
  }, [scrollViewValues.contentHeight, scrollViewValues.scrollViewHeight]);

  /**
   * Listen for the scrollview to mount or update. Instead of immediately calling
   * updateThumbPosition(data.offset), we just set our state. Then the effect above
   * will handle repositioning the thumb once contentHeight/scrollViewHeight/offset
   * have all updated in React.
   */
  useEffect(() => {
    return listen<ScrollViewData>(
      'main-scroll-view',
      (data) => {
        if (!data) {
          return;
        }
        if (!tryControl(data)) {
          return;
        }

        if (data.onThumbDrag !== undefined) {
          scrollViewDataRef.current.onThumbDrag = data.onThumbDrag;
        }

        // Update state in one go. If data.contentHeight or data.scrollViewHeight are null,
        // we preserve the existing values.
        setScrollViewValues((prev) => ({
          controller: data.controller ?? prev.controller,
          contentHeight: data.contentHeight ?? prev.contentHeight,
          scrollViewHeight: data.scrollViewHeight ?? prev.scrollViewHeight,
          offset: data.offset ?? prev.offset,
        }));
      },
      true
    );
  }, []);

  /**
   * Handle mouse wheel scrolling on web. We again read the “current” offsets
   * from refs, and if we can scroll, we convert deltaY to a newScrollY.
   */
  const handleWheel = (e: any) => {
    if (Platform.OS !== 'web') {
      return;
    }
    e.preventDefault?.();

    const delta = e.deltaY; // how much the wheel scrolled
    const maxScroll =
      contentHeightRef.current - scrollHeightRef.current;
    const currentMaxThumbOffset = maxThumbOffsetRef.current;

    // Convert the current thumb offset => current scroll offset
    let currentScrollY = 0;
    if (maxScroll > 0 && currentMaxThumbOffset > 0) {
      currentScrollY =
        (thumbPositionValue.current / currentMaxThumbOffset) * maxScroll;
    }

    // Apply the delta. Might need to tune this factor for a better feel
    const newScrollY = Math.min(
      Math.max(currentScrollY + delta, 0),
      maxScroll
    );

    // Notify parent, update thumb
    scrollViewDataRef.current.onThumbDrag?.(newScrollY);
    updateThumbPosition(newScrollY);
  };

  // If no controller or if the thumb is the full height => hide
  if (!scrollViewValues.controller || thumbHeight === trackHeight) {
    return null;
  }

  return (
    <View
      {...(Platform.OS === 'web' ? { onWheel: handleWheel } : {})}
      style={[styles.scrollbar, { height: trackHeight }]}
    >
      <Animated.View
        {...panResponderRef.current.panHandlers}
        style={[
          styles.thumb,
          {
            height: thumbHeight,
            transform: [{ translateY: thumbPosition }],
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  scrollbar: {
    width: 14,
    backgroundColor: 'white',
    borderColor: 'black',
    borderLeftWidth: 1,
    position: 'absolute',
    right: 0,
    top: 0,

    userSelect: 'none',          // prevent selection on web
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
    WebkitUserDrag: 'none',
  },
  thumb: {
    width: '100%',
    backgroundColor: '#70f',
    borderWidth: 1,
    borderColor: 'white',
    borderRadius: 99,

    touchAction: 'none',         // prevent selection on web
  },
});

export {
  Scrollbar,
  ScrollViewData,
};
