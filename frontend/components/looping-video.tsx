import { RefObject, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  GestureResponderEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import {
  VideoContentFit,
  VideoPlayer,
  VideoView,
  useVideoPlayer,
} from 'expo-video';
import { useEvent } from 'expo';
import { useIsFocused } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import * as _ from 'lodash';
import { lastEvent, notify, useDerivedEvent } from '../events/events';

const EV_VIDEO_MUTED = 'video-muted';
const EV_FOCUSED_VIDEO = 'focused-video';

const useVideoMuted = () =>
  useDerivedEvent<boolean, boolean>(
    EV_VIDEO_MUTED,
    (muted) => muted ?? true,
    [],
  );

const useLoopingPlayer = (uri: string | null, muted: boolean) => {
  const player = useVideoPlayer(uri, (player) => {
    player.loop = true;
    player.muted = muted;
  });

  useEffect(() => {
    player.muted = muted;
  }, [player, muted]);

  return player;
};

const VideoSurface = ({
  player,
  playing,
  contentFit,
}: {
  player: VideoPlayer
  playing: boolean
  contentFit: VideoContentFit
}) => {
  useEffect(() => {
    if (playing) {
      player.play();
    } else {
      player.pause();
    }
  }, [player, playing]);

  return <VideoView
    player={player}
    style={{ position: 'absolute', width: '100%', height: '100%' }}
    contentFit={contentFit}
    nativeControls={false}
    surfaceType="textureView"
    useExoShutter={false}
    playsInline={true}
    pointerEvents="none"
  />;
};

const LoopingVideo = ({
  uri,
  muted,
  playing,
  contentFit,
}: {
  uri: string
  muted: boolean
  playing: boolean
  contentFit: VideoContentFit
}) => (
  <VideoSurface
    player={useLoopingPlayer(uri, muted)}
    playing={playing}
    contentFit={contentFit}
  />
);

const useVisibleFraction = (ref: RefObject<View | null>): number => {
  const [visibleFraction, setVisibleFraction] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      ref.current?.measureInWindow((x, y, width, height) => {
        const window = Dimensions.get('window');

        const visibleWidth = Math.min(x + width, window.width) - Math.max(x, 0);
        const visibleHeight = Math.min(y + height, window.height) - Math.max(y, 0);

        setVisibleFraction(
          width > 0 && height > 0 && visibleWidth > 0 && visibleHeight > 0
            ? visibleWidth * visibleHeight / (width * height)
            : 0
        );
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return visibleFraction;
};

const visibleFractions = new Map<string, number>();

const reportVisibleFraction = (id: string, visibleFraction: number) => {
  if (visibleFraction > 0) {
    visibleFractions.set(id, visibleFraction);
  } else {
    visibleFractions.delete(id);
  }

  const focused = _.maxBy([...visibleFractions], ([, f]) => f)?.[0] ?? null;

  if (focused !== (lastEvent<string | null>(EV_FOCUSED_VIDEO) ?? null)) {
    notify<string | null>(EV_FOCUSED_VIDEO, focused);
  }
};

const AutoplayVideo = ({
  uri,
  withControls = false,
}: {
  uri: string
  withControls?: boolean
}) => {
  const id = useId();
  const isScreenFocused = useIsFocused();
  const ref = useRef<View>(null);
  const visibleFraction = useVisibleFraction(ref);
  const [hasPlayed, setHasPlayed] = useState(false);
  const videoMuted = useVideoMuted();
  const isFocused = useDerivedEvent<string | null, boolean>(
    EV_FOCUSED_VIDEO,
    (focused) => focused === id,
    [id],
  );
  const [userPaused, setUserPaused] = useState(false);
  const player = useLoopingPlayer(
    hasPlayed ? uri : null,
    !withControls || videoMuted || !isFocused,
  );

  const playing = isScreenFocused && (
    withControls ? isFocused && !userPaused : visibleFraction > 0);

  useEffect(() => {
    if (playing) {
      setHasPlayed(true);
    }
  }, [playing]);

  useEffect(() => {
    if (withControls) {
      reportVisibleFraction(id, visibleFraction);
    }
  }, [withControls, visibleFraction]);

  useEffect(() => () => reportVisibleFraction(id, 0), []);

  useEffect(() => {
    if (!isFocused) {
      setUserPaused(false);
    }
  }, [isFocused]);

  return (
    <View ref={ref} style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {hasPlayed &&
        <VideoSurface player={player} playing={playing} contentFit="cover" />
      }
      {withControls && isFocused &&
        <VideoControls
          player={player}
          playing={playing}
          onTogglePlaying={() => setUserPaused((paused) => !paused)}
        />
      }
    </View>
  );
};

const VideoControls = ({
  player,
  playing,
  onTogglePlaying,
  style,
}: {
  player: VideoPlayer
  playing: boolean
  onTogglePlaying: () => void
  style?: StyleProp<ViewStyle>
}) => (
  <View style={[StyleSheet.absoluteFill, style]} pointerEvents="box-none">
    <ControlButton
      icon={playing ? 'pause' : 'play'}
      label={playing ? 'Pause' : 'Play'}
      style={{ left: 10, bottom: 10 }}
      onPress={onTogglePlaying}
    />
    <VideoProgress player={player} />
    <SoundButton />
  </View>
);

const ControlButton = ({
  icon,
  label,
  style,
  onPress,
}: {
  icon: 'pause' | 'play' | 'volume-mute' | 'volume-high'
  label: string
  style: StyleProp<ViewStyle>
  onPress: () => void
}) => (
  <Pressable
    onPress={(event: GestureResponderEvent) => {
      event.preventDefault();
      event.stopPropagation();
      onPress();
    }}
    hitSlop={8}
    aria-label={label}
    style={[styles.circle, { width: 32, height: 32 }, style]}
  >
    <Ionicons name={icon} size={16} color="white" />
  </Pressable>
);

const SoundButton = () => {
  const muted = useVideoMuted();

  return (
    <ControlButton
      icon={muted ? 'volume-mute' : 'volume-high'}
      label={muted ? 'Unmute' : 'Mute'}
      style={{ right: 10, bottom: 10 }}
      onPress={() => notify<boolean>(EV_VIDEO_MUTED, !muted)}
    />
  );
};

const VideoProgress = ({ player }: { player: VideoPlayer }) => {
  const time = useEvent(player, 'timeUpdate', null);
  const [width, setWidth] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);

  useEffect(() => {
    player.timeUpdateEventInterval = 0.1;
  }, [player]);

  const scrubGesture = useMemo(() => {
    const seek = (x: number) => {
      const fraction = _.clamp(x / width, 0, 1);
      setScrub(fraction);

      if (player.duration > 0) {
        player.currentTime = fraction * player.duration;
      }
    };

    return Gesture.Pan()
      .minDistance(0)
      .onBegin((e) => {
        scheduleOnRN(seek, e.x);
      })
      .onUpdate((e) => {
        scheduleOnRN(seek, e.x);
      })
      .onFinalize(() => {
        scheduleOnRN(setScrub, null);
      });
  }, [player, width]);

  const progress = scrub ?? (
    player.duration > 0 ? (time?.currentTime ?? 0) / player.duration : 0);

  return (
    <Pressable
      onPress={(event: GestureResponderEvent) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      style={styles.progressTouchArea}
    >
      <GestureDetector gesture={scrubGesture}>
        <View
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          style={[StyleSheet.absoluteFill, { justifyContent: 'center' }]}
        >
          <View
            style={[
              styles.progressTrack,
              { height: scrub === null ? 3 : 6 },
            ]}
          >
            <View
              style={[styles.progressFill, { width: `${progress * 100}%` }]}
            />
          </View>
        </View>
      </GestureDetector>
    </Pressable>
  );
};

const PlayBadge = ({
  size,
  style,
}: {
  size: number
  style?: StyleProp<ViewStyle>
}) => (
  <View
    pointerEvents="none"
    style={[styles.circle, { width: size, height: size }, style]}
  >
    <Ionicons
      name="play"
      size={size * 0.55}
      color="white"
      style={{ marginLeft: size * 0.08 }}
    />
  </View>
);

const styles = StyleSheet.create({
  circle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTouchArea: {
    position: 'absolute',
    left: 52,
    right: 52,
    bottom: 12,
    height: 28,
  },
  progressTrack: {
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'white',
  },
});

export {
  AutoplayVideo,
  LoopingVideo,
  PlayBadge,
  VideoControls,
  VideoSurface,
  useLoopingPlayer,
  useVideoMuted,
};
