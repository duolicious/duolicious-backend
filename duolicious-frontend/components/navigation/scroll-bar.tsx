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
  controller: string | null,

  // A callback to call when the Scrollbar's thumb is dragged
  onThumbDrag?: (offset: number) => void,

  // The height of the controlling Scrollview's content
  contentHeight?: number,

  // The height of the controlling Scrollview's viewport
  scrollViewHeight?: number,

  // How far down the Scrollview has been scrolled
  offset?: number,
};

const Scrollbar = () => {
  const [controller, setController] = useState<null | string>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const [scrollViewHeight, setScrollViewHeight] = useState(0);

  // We store the scrollView's info (including onThumbDrag) here
  const scrollViewDataRef = useRef<ScrollViewData>({ controller: null });

  // The current Animated thumb position
  const thumbPosition = useRef(new Animated.Value(0)).current;
  // The numeric value of the thumb position
  const thumbPositionValue = useRef(0);

  // Where the thumb was when the user first put their finger down
  const gestureStartY = useRef(0);

  // Optional: track if user is dragging right now
  const isDragging = useRef(false);

  // Keep track of the old contentHeight so we can preserve offset after changes
  const oldContentHeightRef = useRef(0);

  const { height: trackHeight } = useWindowDimensions();

  // Compute thumb size and max offset each render
  const minThumbHeight = 30;
  const thumbHeight = contentHeight <= 0
    ? minThumbHeight
    : Math.min(
        trackHeight,
        Math.max(
            (scrollViewHeight / contentHeight) * scrollViewHeight,
            minThumbHeight));

  const maxThumbOffset = trackHeight - thumbHeight;

  // ---
  // Store these values in refs so the PanResponder always has up-to-date data
  // without being re-created. We’ll update them in an effect below.
  // ---
  const contentHeightRef = useRef(contentHeight);
  const scrollHeightRef = useRef(scrollViewHeight);
  const maxThumbOffsetRef = useRef(maxThumbOffset);

  // The function that sets the thumb position immediately
  const updateThumbPosition = (scrollY: number) => {
    const maxScroll = contentHeightRef.current - scrollHeightRef.current;
    const ratio = maxScroll <= 0 ? 0 : scrollY / maxScroll;
    const newThumbOffset = ratio * maxThumbOffsetRef.current;
    thumbPosition.setValue(newThumbOffset);
  };

  // We track the ScrollView which is currently in control. There should only be
  // one ScrollView in charge of the Scrollbar at a time. This function checks
  // if the event emitter has permission to control the Scrollbar.
  //
  // It's effectively a semaphore that prevents race conditions around the times
  // when one ScrollView goes off-screen and appears on-screen in short
  // succession. Events could be received out-of-order in this case.
  //
  // `tryControl` checks if the `controller` can control the scrollbar and
  // returns true if so.
  const tryControl = (data: ScrollViewData): boolean => {
    // Attempt to acquire lock. Control can be "stolen" from another ScrollView.
    if (data.onThumbDrag) {
      setController(data.controller);
      scrollViewDataRef.current.controller = data.controller;
      return true;
    }

    // Attempt to release lock. The ScrollView which emitted the event needs to
    // be in control of the scrollbar in order to release it. Otherwise it might
    // actually be releasing another ScrollView's control.
    if (
      data.onThumbDrag === null &&
      data.controller === scrollViewDataRef.current.controller
    ) {
      setController(null);
      scrollViewDataRef.current.controller = null;
      return false;
    }


    // Do we already have the lock?
    return scrollViewDataRef.current.controller === data.controller;
  };

  // Create the PanResponder once. All the dynamic data is read from refs.
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

        // read the current max offset from ref
        const currentMaxThumbOffset = maxThumbOffsetRef.current;

        let newOffset = gestureStartY.current + dy;
        // clamp top/bottom
        newOffset = Math.max(0, Math.min(newOffset, currentMaxThumbOffset));

        // Convert thumb offset -> content scroll offset
        const maxScroll =
          contentHeightRef.current - scrollHeightRef.current;
        const newScrollY =
          maxScroll <= 0 ? 0 : (newOffset / currentMaxThumbOffset) * maxScroll;

        // Notify parent to scroll
        if (scrollViewDataRef.current.onThumbDrag) {
          scrollViewDataRef.current.onThumbDrag(newScrollY);
        }

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

  // Keep thumbPositionValue in sync with the Animated.Value
  useEffect(() => {
    const listenerId = thumbPosition.addListener(({ value }) => {
      thumbPositionValue.current = value;
    });
    return () => {
      thumbPosition.removeListener(listenerId);
    };
  }, [thumbPosition]);

  // Whenever contentHeight or scrollHeight changes, store them in refs.
  useEffect(() => {
    contentHeightRef.current = contentHeight;
    scrollHeightRef.current = scrollViewHeight;
    maxThumbOffsetRef.current = maxThumbOffset;
  }, [contentHeight, scrollViewHeight, maxThumbOffset]);

  // Preserve the user’s scroll offset when new content arrives (like infinite scroll).
  // We'll do that only if we're NOT currently dragging. (Your choice.)
  useEffect(() => {
    const oldContentHeight = oldContentHeightRef.current;
    oldContentHeightRef.current = contentHeight;

    // If there's no old content height or it hasn't changed, do nothing
    if (!oldContentHeight || oldContentHeight === contentHeight) {
      return;
    }
    if (isDragging.current) {
      // If user is in the middle of a drag, you might decide to skip
      // updating the offset here. Or handle it differently.
      return;
    }

    // The current thumb offset => oldScrollY in px
    const oldMaxScroll = oldContentHeight - scrollViewHeight;
    const newMaxScroll = contentHeight - scrollViewHeight;

    let oldScrollY = 0;
    if (oldMaxScroll > 0 && maxThumbOffsetRef.current > 0) {
      oldScrollY =
        (thumbPositionValue.current / maxThumbOffsetRef.current) *
        oldMaxScroll;
    }

    // Keep same absolute offset, but clamp if new content is smaller
    const newScrollY = Math.max(0, Math.min(newMaxScroll, oldScrollY));

    updateThumbPosition(newScrollY);
  }, [contentHeight, scrollViewHeight]);

  // Listen for the scrollview to mount
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

        if (data.contentHeight !== undefined) {
          setContentHeight(data.contentHeight);
        }

        if (data.scrollViewHeight !== undefined) {
          setScrollViewHeight(data.scrollViewHeight);
        }

        if (data.offset !== undefined && !isDragging.current) {
          updateThumbPosition(data.offset);
        }
      },
      true
    );
  }, []);

  const handleWheel = (e: any) => {
    if (Platform.OS !== 'web') {
      return;
    }
    e.preventDefault?.();

    // We'll treat deltaY as the scroll "step"
    const delta = e.deltaY;
    const maxScroll = contentHeightRef.current - scrollHeightRef.current;
    const currentMaxThumbOffset = maxThumbOffsetRef.current;

    // Convert the current thumb offset => current scroll offset
    let currentScrollY = 0;
    if (maxScroll > 0 && currentMaxThumbOffset > 0) {
      currentScrollY =
        (thumbPositionValue.current / currentMaxThumbOffset) * maxScroll;
    }

    // Apply the delta. You might want to tune this to a certain step factor.
    const newScrollY = Math.min(
      Math.max(currentScrollY + delta, 0),
      maxScroll
    );

    // Notify parent and update thumb
    if (scrollViewDataRef.current.onThumbDrag) {
      scrollViewDataRef.current.onThumbDrag(newScrollY);
    }
    updateThumbPosition(newScrollY);
  };

  if (!controller || thumbHeight === trackHeight) {
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
