import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  runOnJS,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
  RectButton,
  Pressable,
} from 'react-native-gesture-handler';
import { LayoutChangeEvent } from 'react-native';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  DefaultText,
} from '../default-text';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons/faPaperPlane';
import { DefaultLongTextInput } from '../default-long-text-input';
import { isMobile } from '../../util/util';
import { Audio } from 'expo-av';
import { uriToBase64 } from '../../api/api';
import { notify } from '../../events/events';
import { ValidationErrorToast } from '../toast';

const haptics = () => {
  if (Platform.OS !== 'web') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }
};

const useComponentWidth = () => {
  const [width, setWidth] = useState(0);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setWidth(width);
  }, []);

  return { width, onLayout };
};

const useRecorder = () => {
  const maxDuration = 2 * 60;

  const recording = useRef<Audio.Recording>();
  const recordingActive = useRef(false);
  const [duration, setDuration] = useState(0);

  const startRecording = async (): Promise<boolean> => {
    if (recording.current) {
      return true;
    };

    try {
      recordingActive.current = true;

      if ((await Audio.getPermissionsAsync())?.status !== 'granted') {
        await Audio.requestPermissionsAsync();
      }

      // The value of `recordingActive` might've changed while we were waiting
      // for the user to respond to our request for permissions.
      if (!recordingActive.current) {
        return false;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const onRecordingStatusUpdate = (status: Audio.RecordingStatus) => {
        const seconds = Math.floor(status.durationMillis / 1000);

        setDuration(seconds);

        if (seconds >= maxDuration) {
          stopRecording();
        }
      };

      const recordingOptions: Audio.RecordingOptions = {
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        web: {
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY.web,
          mimeType: undefined,
        }
      };

      recording.current = (await Audio.Recording.createAsync(
        recordingOptions,
        onRecordingStatusUpdate,
      )).recording;

      return true;
    } catch (err) {
      notify<React.FC>(
        'toast',
        () => <ValidationErrorToast error={String(err)} />
      );
    }

    return false;
  };

  const stopRecording = async () => {
    const currentRecording = recording.current;
    recordingActive.current = false;
    recording.current = undefined;

    if (!currentRecording) {
      return null;
    }

    await currentRecording.stopAndUnloadAsync();

    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

    const uri = currentRecording.getURI();

    if (!uri) {
      console.error('Recording URI was unexpectedly null');
      return null;
    }

    return `data:audio/*;base64,${await uriToBase64(uri)}`;
  };

  return { startRecording, stopRecording, duration };
};

const AutoResizingTextInput = Platform.OS === 'web' ? (props) => {
  const { height } = useWindowDimensions();

  return (
    <View style={{ flex: 1, maxHeight: height / 4 }}>
      <DefaultText
        style={{
          zIndex: -1,
          flexWrap: 'wrap',
          width: '100%',
          minHeight: 30,
          opacity: 0,
        }}
      >
        {props.value}
      </DefaultText>
      <DefaultLongTextInput
        {...props}
        style={{
          ...props.style,
          outline: 'none',
          position: 'absolute',
          width: '100%',
          height: '100%',
          minHeight: 30,
        }}
      />
    </View>
  );
} : (props) => {
  const { height } = useWindowDimensions();

  return (
    <DefaultLongTextInput
      {...props}
      style={{
        ...props.style,
        maxHeight: height / 4,
      }}
    />
  );
};

const Input = ({
  onPressSend,
  onChange,
  onPressGif,
  onAudioComplete,
  onFocus,
}: {
  onPressSend: (text: string) => void
  onChange: () => void
  onPressGif: () => void
  onAudioComplete: (audioBase64: string) => void
  onFocus: () => void,
}) => {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const { width, onLayout } = useComponentWidth();

  const { startRecording, stopRecording, duration } = useRecorder();

  // Shared value for GIF container width.
  const gifWidth = useSharedValue(40);
  // Shared value for horizontal translation of the mic during pan.
  const recordTranslateX = useSharedValue(0);
  // Shared value for opacity of the mic during recording.
  const recordOpacity = useSharedValue(1);
  // Shared flag to detect cancellation immediately.
  const cancelTriggered = useSharedValue(false);
  // Shared values for animating the input area and cancel overlay.
  const inputTranslateX = useSharedValue(0);
  const cancelTextTranslateX = useSharedValue(width); // initial offset

  // Shared value for arrow translation.
  const arrowTranslateX = useSharedValue(0);

  const microphoneOpacity = useSharedValue(1);
  // New shared values for cancellation animation on the red mic in the overlay.
  const micRotation = useSharedValue(0);
  const micTranslateY = useSharedValue(0);

  // Animate the GIF container based on text input.
  useEffect(() => {
    if (text.length > 0) {
      gifWidth.value = withTiming(0);
    } else {
      gifWidth.value = withTiming(40);
    }
  }, [text, gifWidth]);

  // Animate the input area and cancel overlay when recording starts/ends.
  useEffect(() => {
    if (isRecording) {
      inputTranslateX.value = withTiming(-width);
      cancelTextTranslateX.value = withTiming(0);
      recordOpacity.value = withTiming(0);
      startRecording().then((didStart) => {
        if (!didStart) {
          setIsRecording(didStart);
        }
      });
    } else {
      inputTranslateX.value = withTiming(0);
      cancelTextTranslateX.value = withTiming(width);
      recordOpacity.value = withTiming(1);
      recordTranslateX.value = withTiming(0);
      stopRecording();
    }
  }, [isRecording, inputTranslateX, cancelTextTranslateX, width]);

  // Animate arrow suggestion when recording is active.
  useEffect(() => {
    if (isRecording) {
      arrowTranslateX.value = withRepeat(
        withTiming(-10, { duration: 1000 }),
        -1,
        true
      );

      microphoneOpacity.value = withRepeat(
        withTiming(0, { duration: 700 }),
        -1,
        true
      );
    } else {
      arrowTranslateX.value = 0;
      microphoneOpacity.value = 1;
    }
  }, [isRecording, arrowTranslateX]);

  // Helper to format seconds as mm:ss.
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const animatedGifStyle = useAnimatedStyle(() => ({
    width: gifWidth.value,
    opacity: gifWidth.value / 40,
  }));

  const animatedInputStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: inputTranslateX.value }],
  }));

  // Timer (and red mic) overlay uses only the base overlay translation.
  const animatedTimerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: cancelTextTranslateX.value }],
  }));

  // Animated style for the red flashing microphone in the overlay.
  const animatedCancelMicrophoneStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${micRotation.value}deg` } as any,
      { translateY: micTranslateY.value },
    ],
    opacity: microphoneOpacity.value,
  }));

  // The "Slide to cancel" text and arrow add the mic's drag translation.
  const animatedCancelTextStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: cancelTextTranslateX.value + recordTranslateX.value }],
  }));

  // The microphone in the icon container only follows the drag.
  const animatedRecordingStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: recordTranslateX.value }],
    opacity: recordOpacity.value,
  }));

  // Animated style for the arrow suggestion.
  const animatedArrowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: arrowTranslateX.value }],
  }));

  // Define functions before they're used in gestures.
  const handleStartRecording = () => {
    cancelTriggered.value = false;
    // Reset cancellation animation values.
    micRotation.value = 0;
    micTranslateY.value = 0;
    setIsRecording(true);
    haptics();
  };

  const handleFinishRecording = () => {
    setIsRecording(false);
    haptics();

    (async () => {
      if (duration < 1) {
        return;
      }

      const base64 = await stopRecording();

      if (!base64) {
        return;
      }

      onAudioComplete(base64);
    })();
  };

  const handleCancelRecording = () => {
    cancelTriggered.value = true;
    // Animate the red mic in the overlay: rotate and jump, then fall.
    microphoneOpacity.value = withTiming(1);
    micRotation.value = withTiming(-180, { duration: 500 });
    micTranslateY.value = withSequence(
      withTiming(   0, { duration: 500 }),
      withTiming(-300, { duration: 500 }),
    );
    haptics();
    setTimeout(() => setIsRecording(false), 1000);
  };

  const handleFailedTap = () => {
    setShowHint(true);
    haptics();
    setTimeout(() => setShowHint(false), 2000);
  };

  const handleSendPress = () => {
    if (text.trim().length > 0) {
      onPressSend(text.trim());
      setText('');
    }
  };

  const handleTextChange = (newText) => {
    setText(newText);
    onChange();
  };

  const handleKeyPress = (event) => {
    if (
      !isMobile() &&
      event.key === 'Enter' &&
      (event.ctrlKey || event.altKey)
    ) {
      event.preventDefault();
      setText((text) => text + "\n");
    } else if (
      !isMobile() &&
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.ctrlKey &&
      !event.altKey
    ) {
      event.preventDefault();
      handleSendPress();
    }
  };

  // Tap gesture: quick press shows the hint for 2 seconds.
  const tapGesture = Gesture.Tap()
    .maxDuration(300)
    .onEnd(() => {
      runOnJS(handleFailedTap)();
    });

  // Create a long press gesture to trigger recording.
  const longPressGesture = Gesture.LongPress()
    .minDuration(300)
    .onStart(() => {
      runOnJS(handleStartRecording)();
    })
    .onEnd((_, success) => {
      if (success && !cancelTriggered.value) {
        runOnJS(handleFinishRecording)();
      }
    });

  // Create a pan gesture to let the user slide the mic leftwards.
  const panGesture = Gesture.Pan()
    .onStart(() => {
      cancelTriggered.value = false;
    })
    .onChange((event) => {
      if (!cancelTriggered.value) {
        recordTranslateX.value = Math.min(0, event.translationX);
      }
      if (event.translationX < -150 && !cancelTriggered.value) {
        runOnJS(handleCancelRecording)();
      }
    })
    .onEnd(() => {
      if (!cancelTriggered.value) {
        runOnJS(handleFinishRecording)();
      }
    });

  // Combine the long press and pan gestures so they work on the same element.
  const combinedGesture = Gesture.Simultaneous(longPressGesture, panGesture);
  const finalGesture = Gesture.Exclusive(tapGesture, combinedGesture);

  return (
    <KeyboardAvoidingView enabled={Platform.OS === 'ios'} behavior="padding">
      <View style={styles.container} onLayout={onLayout}>
        {/* Input wrapper: position relative so we can overlay the cancel overlay */}
        <View style={styles.inputWrapper}>
          <Animated.View style={[styles.inputContainer, animatedInputStyle]}>
            <AutoResizingTextInput
              style={styles.textInput}
              multiline={true}
              placeholder="Type a message..."
              value={text}
              onChangeText={handleTextChange}
              onKeyPress={handleKeyPress}
              onFocus={onFocus}
            />
            <RectButton onPress={onPressGif} hitSlop={10}>
              <Animated.View style={[styles.gifContainer, animatedGifStyle]}>
                <DefaultText
                  style={styles.gifText}
                  numberOfLines={1}
                  ellipsizeMode="clip"
                >
                  GIF
                </DefaultText>
              </Animated.View>
            </RectButton>
          </Animated.View>
          {isRecording && (
            <View style={styles.cancelOverlay}>
              <Animated.View style={[styles.timerStyle, animatedTimerStyle]}>
                <Animated.View style={animatedCancelMicrophoneStyle}>
                  <Ionicons name="mic" style={{ fontSize: 28, color: 'crimson' }} />
                </Animated.View>
                <DefaultText style={[styles.recordingText, styles.recordingTimer]}>
                  {formatTime(duration)}
                </DefaultText>
              </Animated.View>
              <Animated.View style={[styles.cancelTextStyle, animatedCancelTextStyle]}>
                <DefaultText style={styles.recordingText}>
                  Slide to cancel
                </DefaultText>
                <DefaultText
                  animated={true}
                  style={[styles.arrowText, animatedArrowStyle]}
                >
                  ←
                </DefaultText>
              </Animated.View>
            </View>
          )}
        </View>
        {/* Mic/Send icon container */}
        <View style={styles.iconContainer}>
          {showHint && (
            <View style={styles.hintContainer}>
              <DefaultText style={styles.hintText} numberOfLines={1}>
                Hold to record, release to send
              </DefaultText>
            </View>
          )}
          <GestureDetector gesture={finalGesture}>
            <Animated.View style={[styles.microphoneIcon, animatedRecordingStyle]}>
              <Ionicons name="mic" style={{ fontSize: 28, color: 'black' }} />
            </Animated.View>
          </GestureDetector>
          {text.trim().length !== 0 &&
            <Pressable onPress={handleSendPress} style={styles.sendPressable}>
              <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.sendAnimated}>
                <FontAwesomeIcon
                  icon={faPaperPlane}
                  size={20}
                  color="#70f"
                  style={{
                    marginRight: 5,
                    marginBottom: 5,
                    /* @ts-ignore */
                    outline: 'none',
                  }}
                />
              </Animated.View>
            </Pressable>
          }
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputWrapper: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eee',
    borderRadius: 10,
    paddingHorizontal: Platform.OS === 'web' ? 10 : 8,
    paddingVertical: Platform.OS === 'web' ? 10 : 6,
  },
  textInput: {
    backgroundColor: undefined,
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    marginLeft: undefined,
    marginRight: undefined,
    borderColor: undefined,
    borderWidth: undefined,
    borderRadius: undefined,
    height: undefined,
    flex: 1,
    textAlignVertical: 'center',
  },
  gifContainer: {
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: 5,
    borderWidth: 3,
    borderColor: 'black',
  },
  gifText: {
    fontSize: 16,
    fontWeight: 900,
    overflow: 'hidden',
    // @ts-ignore
    whiteSpace: 'nowrap',
    textOverflow: 'clip',
  },
  cancelOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordingTimer: {
    width: 50,
  },
  timerStyle: {
    flexDirection: 'row',
    gap: 10,
    zIndex: 999,
    height: '100%',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  cancelTextStyle: {
    flexDirection: 'row',
    height: '100%',
    alignItems: 'center',
  },
  recordingText: {
    fontSize: 16,
    color: 'black',
  },
  arrowText: {
    marginLeft: 20,
    fontSize: 18,
    color: 'gray',
  },
  iconContainer: {
    width: 40,
    height: 40,
    marginLeft: 5,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  microphoneIcon: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendPressable: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendAnimated: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgb(228, 204, 255)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#70f',
  },
  hintContainer: {
    position: 'absolute',
    bottom: 36,
    right: 22,
    width: 300,
    zIndex: 1000,
  },
  hintText: {
    backgroundColor: 'black',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
    borderBottomRightRadius: 2,
    color: 'white',
    fontSize: 14,
    flexShrink: 1,
    alignSelf: 'flex-end',
  },
});

export { Input };
