import { possessive, secToMinSec } from '../util/util';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, View, Pressable, StyleSheet, LayoutChangeEvent } from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { AUDIO_URL } from '../env/env';
import Ionicons from '@expo/vector-icons/Ionicons';
import { DefaultText } from './default-text';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import {
  LinearGradient,
} from 'expo-linear-gradient';
import * as _ from 'lodash';

const LoadingBar = () => {
  const duration = 500;
  const progress = useSharedValue(1);
  const [containerWidth, setContainerWidth] = useState(0);

  const barWidthRatio = 0.4;
  const barWidth = containerWidth * barWidthRatio;
  const maxTranslate = containerWidth - barWidth;

  useEffect(() => {
    // Animate progress from 0 to 1 and reverse it to create a bounce effect.
    progress.value = withRepeat(withTiming(0, { duration }), -1, true);
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: progress.value * maxTranslate }],
    };
  });

  const onContainerLayout = (event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  };

  return (
    <View style={styles.loadingBarContainer}>
      <View style={styles.loadingBar} onLayout={onContainerLayout}>
        {containerWidth > 0 && (
          <Animated.View
            style={[styles.loadingBarFill, animatedStyle, { width: barWidth }]}
          >
            <LinearGradient
              colors={['transparent', '#000', 'transparent']}
              style={{ width: '100%', height: '100%' }}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </Animated.View>
        )}
      </View>
    </View>
  );
};

type AudioPlayerProps = {
  name: string | null | undefined,
  uuid: string | null | undefined,
  presentation: 'profile'
  style?: any
} | {
  uuid: string | null | undefined,
  presentation: 'feed',
  style?: any
} | {
  uuid: string | null | undefined,
  sending: boolean,
  presentation: 'conversation',
  style?: any
};

const AudioPlayer = (props: AudioPlayerProps) => {
  const sound = useRef<Audio.Sound>();

  const isMounted = useRef(true);

  const [isPlaying, setIsPlaying] = useState(false);

  const [isPlaybackStarting, setIsPlaybackStarting] = useState(false);

  const [isBuffering, setIsBuffering] = useState(false);

  const [secondsElapsed, setSecondsElapsed] = useState(0);

  const [minutes, seconds] = secToMinSec(secondsElapsed);

  const [showLoader, setShowLoader] = useState(
    props.presentation === 'conversation' && props.sending
  );

  const playIcon = isPlaying ? 'pause' : 'play';

  const debouncedShowLoader = useRef(
    _.debounce((x: boolean) => setShowLoader(x), 200)
  ).current;

  const nextDebouncedShowLoaderValue = (
      isPlaybackStarting
      || isPlaying && isBuffering
      || !props.uuid && props.presentation === 'conversation' && props.sending
  );

  useEffect(() => {
    // Debouncing the loader is necessary to stop it from briefly flickering
    // in the case that the audio has already been fetched from the server
    debouncedShowLoader(nextDebouncedShowLoaderValue);
  }, [nextDebouncedShowLoaderValue])

  const onPlaybackStatusUpdate = useCallback(async (status: AVPlaybackStatus) => {
    if (!isMounted.current) {
      return;
    }

    if (!status.isLoaded) {
      return;
    }

    setSecondsElapsed(Math.floor(status.positionMillis / 1000));

    setIsBuffering(status.isBuffering);

    if (status.didJustFinish) {
      setIsPlaying(false);
      if (sound.current) {
        await sound.current.stopAsync();
      }
    }
  }, []);

  const play = async () => {
    if (!props.uuid) {
      return;
    }

    if (isPlaybackStarting) {
      return;
    }

    setIsPlaybackStarting(true);
    setIsPlaying(true);

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
      });

      if (!sound.current) {
        const uri = `${AUDIO_URL}/${props.uuid}.aac`;

        const result = await Audio.Sound.createAsync(
          { uri },
          {},
          onPlaybackStatusUpdate,
          false,
        );

        sound.current = result.sound;
      }

      if (!isMounted.current) {
        await sound.current.unloadAsync();
        return;
      }

      await sound.current.playAsync();
    } catch (err) {
      setIsPlaying(false);
      console.error('Failed to start playback', err);
    } finally {
      setIsPlaybackStarting(false);
    }
  };

  const pause = async () => {
    if (!sound.current) {
      return;
    }

    setIsPlaying(false);

    await sound.current.pauseAsync();
  };

  const togglePlayPause = () => {
    if (isPlaybackStarting) return;

    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (sound.current) {
        sound.current.unloadAsync();
        sound.current = undefined;
      }
    };
  }, [props.uuid]);

  const middleText = (() => {
    if (props.presentation === 'conversation') {
      return !props.uuid && !props.sending ? 'failed to send' : 'voice message';
    } else if (props.presentation === 'feed') {
      return 'Voice bio'
    } else if (props.name) {
      return `${possessive(props.name)} voice bio`
    } else {
      return 'failed to send';
    }
  })();

  return (
    <View
      style={{
        width: '100%',
        maxWidth: props.presentation === 'conversation' ? 275 : undefined,
        marginTop: 20,
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderColor: 'rgba(0, 0, 0, 0.1)',
        borderWidth: 1,
        borderRadius: props.presentation === 'conversation' ? 999 : 10,
        padding: 12,
        gap: 20,
        ...props.style,
      }}
    >
      <Pressable
        style={{
          backgroundColor: 'black',
          borderRadius: 999,
          height: 36,
          width: 36,
          justifyContent: 'center',
          alignItems: 'center',
        }}
        onPress={togglePlayPause}
        disabled={isPlaybackStarting || isBuffering}
      >
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left:  playIcon === 'play' ?  1 : 0,
            right: playIcon === 'play' ? -1 : 0,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Ionicons style={{ fontSize: 24, color: 'white' }} name={playIcon} />
        </View>
      </Pressable>

      <View style={styles.middleContainer}>
        <DefaultText
          style={
            showLoader
              ? {...styles.middleText, ...styles.transparent}
              : {...styles.middleText}
          }
        >
          {middleText}
        </DefaultText>

        {showLoader &&
          <LoadingBar/>
        }
      </View>

      <DefaultText
        style={{
          textAlign: 'right',
          paddingRight: props.presentation === 'conversation' ? 10 : 5,
          width: 50,
        }}
      >
        {`${minutes}:${seconds}`}
      </DefaultText>
    </View>
  );
};

const styles = StyleSheet.create({
  middleContainer: {
    flex: 3,
    justifyContent: 'center',
  },
  middleText: {
    fontWeight: 700,
    ...(Platform.OS === 'web' ? {
      wordBreak: 'break-all',
    } : {}),
    textAlign: 'center',
  },
  transparent: {
    opacity: 0,
  },
  loadingBarContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  loadingBar: {
    height: 8,
    backgroundColor: '#ddd',
    borderRadius: 4,
    overflow: 'hidden',
  },
  loadingBarFill: {
    height: '100%',
    borderRadius: 999,
  },
});

export {
  AudioPlayer,
};
