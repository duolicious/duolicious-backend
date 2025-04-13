import { possessive, secToMinSec } from '../util/util';
import { useEffect, useRef, useState } from 'react';
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

const LoadingBar = () => {
  const duration = 500;
  const progress = useSharedValue(0);
  const [containerWidth, setContainerWidth] = useState(0);

  // Set bar to be 30% of the container's width.
  const barWidthRatio = 0.3;
  const barWidth = containerWidth * barWidthRatio;
  const maxTranslate = containerWidth - barWidth;

  useEffect(() => {
    // Animate progress from 0 to 1 and reverse it to create a bounce effect.
    progress.value = withRepeat(withTiming(1, { duration }), -1, true);
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
    <View style={styles.loadingBarContainer} onLayout={onContainerLayout}>
      {containerWidth > 0 && (
        <Animated.View
          style={[styles.loadingBar, animatedStyle, { width: barWidth }]}
        />
      )}
    </View>
  );
};

type AudioPlayerProps = {
  name: string | null | undefined,
  uuid: string | null | undefined,
  presentation: 'profile',
} | {
  uuid: string | null | undefined,
  sending: boolean,
  presentation: 'conversation',
};

const AudioPlayer = (props: AudioPlayerProps) => {
  const sound = useRef<Audio.Sound>();

  const [isPlaying, setIsPlaying] = useState(false);

  const [secondsElapsed, setSecondsElapsed] = useState(0);

  const [minutes, seconds] = secToMinSec(secondsElapsed);

  const playIcon = isPlaying ? 'pause' : 'play';

  const play = async () => {
    if (!sound.current) {
      return;
    }

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
      });

      const response = await sound.current.playAsync();

      setIsPlaying(response.isLoaded);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const pause = async () => {
    if (!sound.current) {
      return;
    }

    setIsPlaying(false);

    await sound.current.pauseAsync();
  };

  const togglePlayPlause = () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  useEffect(() => {
    const onPlaybackStatusUpdate = async (status: AVPlaybackStatus) => {
      if (!status.isLoaded) {
        return;
      }

      setSecondsElapsed(Math.floor(status.positionMillis / 1000));

      if (status.didJustFinish) {
        setIsPlaying(false);
        if (sound.current) {
          await sound.current.pauseAsync();
          await sound.current.setPositionAsync(0);
        }
      }
    };

    const go = async () => {
      if (!props.uuid) {
        return;
      }

      sound.current = (await Audio.Sound.createAsync(
        { uri: `${AUDIO_URL}/${props.uuid}.aac` },
        {},
        onPlaybackStatusUpdate,
        false,
      )).sound;
    };

    go();

    return () => {
      if (sound.current) {
        sound.current.unloadAsync();
      }
    };
  }, [props.uuid]);

  const middleText = (() => {
    let middleText = '';

    if (props.presentation === 'profile' && props.name)
      middleText += `${possessive(props.name)} `

    middleText += 'voice';

    if (props.presentation === 'profile')
      middleText += ' bio';

    if (props.presentation === 'conversation')
      middleText += ' message';

    return middleText;
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
        borderRadius: props.presentation === 'profile' ? 10 : 999,
        padding: 12,
        gap: 20,
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
        onPress={togglePlayPlause}
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

      {!props.uuid && props.presentation === 'conversation' && props.sending &&
        <LoadingBar/>
      }

      {!props.uuid && props.presentation === 'conversation' && !props.sending &&
        <DefaultText style={styles.audioPlayerMiddleText}>
          Failed to send
        </DefaultText>
      }

      {!!props.uuid &&
        <DefaultText style={styles.audioPlayerMiddleText}>
          {middleText}
        </DefaultText>
      }

      <DefaultText
        style={{
          textAlign: 'right',
          paddingRight: props.presentation === 'profile' ? 5 : 10,
          width: 50,
        }}
      >
        {`${minutes}:${seconds}`}
      </DefaultText>
    </View>
  );
};

const styles = StyleSheet.create({
  audioPlayerMiddleText: {
    fontWeight: 700,
    flex: 3,
    ...(Platform.OS === 'web' ? {
      wordBreak: 'break-all',
    } : {}),
    textAlign: 'center',
  },
  loadingBarContainer: {
    width: 100,
    height: 8,
    backgroundColor: '#ddd',
    borderRadius: 4,
    overflow: 'hidden',
  },
  loadingBar: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: 'black',
  },
});

export {
  AudioPlayer,
};
