import {
  View,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { secToMinSec } from '../util/util';
import { SomethingWentWrongToast } from './toast';
import { ButtonWithCenteredText } from './button/centered-text';
import { DefaultText } from './default-text';
import Ionicons from '@expo/vector-icons/Ionicons';
import { japi, uriToBase64 } from '../api/api';
import { notify } from '../events/events';
import {
  AUDIO_URL,
} from '../env/env';

const AudioBio = ({
  initialSavedRecordingUuid,
  maxDuration,
}: {
  initialSavedRecordingUuid: string | null
  maxDuration: number
}) => {
  type MemoryState =
    | 'No recording yet'
    | 'Unsaved recording'
    | 'Saving'
    | 'Deleting'
    | 'Saved';

  type PlayingState =
    | 'Stopped'
    | 'Playing'
    | 'Recording';

  const [savedRecordingUri, setSavedRecordingUri] = useState(
    initialSavedRecordingUuid ?
    `${AUDIO_URL}/${initialSavedRecordingUuid}.aac` :
    null
  );

  const [unsavedRecordingUri, setUnsavedRecordingUri] = useState<
    null | string>(null);

  const [playingState, setPlayingState] = useState<PlayingState>(
    'Stopped');

  const recording = useRef<Audio.Recording>();

  const sound = useRef<Audio.Sound>();

  const [duration, setDuration] = useState<null | number>(); // seconds

  const [deleting, setDeleting] = useState(false);

  const [saving, setSaving] = useState(false);

  const memoryState: MemoryState = (() => {
    if (saving) {
      return 'Saving';
    }

    if (deleting) {
      return 'Deleting';
    }

    if (unsavedRecordingUri) {
      return 'Unsaved recording'
    }

    if (savedRecordingUri) {
      return 'Saved';
    }

    return 'No recording yet';
  })();

  const loading = saving || deleting;

  const playableRecordingUri = unsavedRecordingUri ?? savedRecordingUri;

  const recordButtonEnabled = playingState !== 'Playing' && !loading;

  const playButtonEnabled = (
    (playingState === 'Playing' || playingState === 'Stopped') &&
    (memoryState === 'Unsaved recording' || memoryState === 'Saved')
  );

  const discardButtonEnabled = (
    memoryState === 'Unsaved recording' || memoryState === 'Saved'
  );

  const saveButtonEnabled = memoryState === 'Unsaved recording';

  const startRecording = async () => {
    try {
      if ((await Audio.getPermissionsAsync())?.status !== 'granted') {
        await Audio.requestPermissionsAsync();
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

      if (recording.current) {
        await recording.current.stopAndUnloadAsync();
      }

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

      setPlayingState('Recording');

      return true;
    } catch (err) {
      console.error('Failed to start recording', err);
    }

    return false;
  }

  const stopRecording = async () => {
    const currentRecording = recording.current;
    recording.current = undefined;

    if (!currentRecording) {
      return;
    }

    await currentRecording.stopAndUnloadAsync();

    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

    const uri = currentRecording.getURI();

    if (!uri) {
      console.error('Recording URI was unexpectedly null');
      return;
    }

    setUnsavedRecordingUri(uri);

    setPlayingState('Stopped');

    return true;
  }

  const startPlayback = async () => {
    if (!sound.current) {
      return false;
    }

    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    } catch { }

    await sound.current.playFromPositionAsync(0);

    setPlayingState('Playing');

    return true;
  };

  const stopPlayback = async () => {
    if (!sound.current) {
      return false;
    }

    await sound.current.stopAsync();

    setPlayingState('Stopped');

    return true;
  };

  const discard = async () => {
    if (unsavedRecordingUri) {
      stopPlayback();
      setDuration(null);
      recording.current = undefined;
      setUnsavedRecordingUri(null);
    } else if (savedRecordingUri) {
      setDeleting(true);

      const response = await japi(
        'delete',
        '/profile-info',
        { audio_files: [-1] },
      );

      if (response.ok) {
        setSavedRecordingUri(null);
      } else {
        notify<React.FC>('toast', SomethingWentWrongToast);
      }

      setDeleting(false);
    }
  };

  const save = async () => {
    if (!unsavedRecordingUri) {
      return false;
    }

    setSaving(true);

    const base64 = await uriToBase64(unsavedRecordingUri);

    const response = await japi(
      'patch',
      '/profile-info',
      {
        base64_audio_file: {
          base64: `data:audio/*;base64,${base64}`,
        }
      },
    );

    if (response.ok) {
      setSavedRecordingUri(unsavedRecordingUri);
      setUnsavedRecordingUri(null);
    } else {
      notify<React.FC>('toast', SomethingWentWrongToast);
    }

    setSaving(false);

    return true;
  };

  const formattedStatus = (() => {
    const [mins, secs] = secToMinSec(duration ?? 0);
    const [maxMins, maxSecs] = secToMinSec(maxDuration);

    if (playingState === 'Recording') {
      return `Recording (${mins}:${secs}/${maxMins}:${maxSecs})`;
    }

    if (playingState === 'Playing') {
      return `Playing (${mins}:${secs})`;
    }

    return memoryState;
  })();

  useEffect(() => {
    const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
      if (!status.isLoaded) {
        return;
      }

      if (status.durationMillis) {
        setDuration(Math.floor(status.positionMillis / 1000));
      } else {
        setDuration(null);
      }

      if (status.didJustFinish) {
        setPlayingState('Stopped');
      }
    };

    const go = async () => {
      if (!playableRecordingUri) {
        return;
      }

      if (sound.current) {
        await sound.current.unloadAsync();
      }

      sound.current = (await Audio.Sound.createAsync(
        { uri: playableRecordingUri },
        {},
        onPlaybackStatusUpdate,
      )).sound;
    };

    go();
  }, [playableRecordingUri]);

  return (
    <View
      style={{
        width: '100%',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#999',
        padding: 10,
        gap: 15,
      }}
    >
      <View
        style={{
          width: '100%',
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 20,
        }}
      >
        <View
          style={{
            gap: 20,
            flexDirection: 'row',
            flex: 1,
            justifyContent: 'flex-start',
            alignItems: 'center',
          }}
        >
          <Ionicons
            disabled={!recordButtonEnabled}
            onPress={() => {
              if (!recordButtonEnabled) {
                return;
              }

              if (playingState === 'Stopped') {
                startRecording();
              }

              if (playingState === 'Recording') {
                stopRecording();
              }
            }}
            style={{
              fontSize: 52,
              color: 'crimson',
              opacity: recordButtonEnabled ? 1 : 0.2,
            }}
            name={playingState === 'Recording' ? 'stop-circle' : 'mic'}
          />
        </View>

        <View style={{ flex: 4 }} >
          <View
            style={{
              gap: 10,
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Ionicons
              disabled={!playButtonEnabled}
              onPress={async () => {
                if (!playButtonEnabled) {
                  return;
                }

                if (playingState === 'Stopped') {
                  await startPlayback();
                }

                if (playingState === 'Playing') {
                  await stopPlayback();
                }
              }}
              style={{
                flexShrink: 1,
                fontSize: 52,
                opacity: playButtonEnabled ? 1 : 0.2,
              }}
              name={
                playingState === 'Playing' ? 'stop-circle' : 'play-circle'}
            />
            <ButtonWithCenteredText
              loading={loading}
              containerStyle={{
                flex: 1,
                marginTop: 0,
                marginBottom: 0,
                opacity: saveButtonEnabled ? 1 : 0.2,
              }}
              onPress={async () => {
                if (!saveButtonEnabled) {
                  return;
                }

                await save();
              }}
            >
              Save
            </ButtonWithCenteredText>
            <ButtonWithCenteredText
              loading={loading}
              containerStyle={{
                flex: 1,
                marginTop: 0,
                marginBottom: 0,
                opacity: discardButtonEnabled ? 1 : 0.2,
              }}
              secondary={true}
              onPress={async () => {
                if (!discardButtonEnabled) {
                  return;
                }

                await discard();
              }}
            >
              {memoryState === 'Saved' ? 'Delete' : 'Discard'}
            </ButtonWithCenteredText>
          </View>
        </View>
      </View>
      <DefaultText>
        <DefaultText style={{ fontWeight: '700' }}>
          Status: {}
        </DefaultText>
        {formattedStatus}
      </DefaultText>
    </View>
  );
};

export { AudioBio };
