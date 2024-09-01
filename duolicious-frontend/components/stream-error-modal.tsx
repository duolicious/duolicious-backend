import {
  Platform,
  Text,
  View,
} from 'react-native';
import {
  useEffect,
  useState,
} from 'react';
import { DefaultText } from './default-text';
import { listen } from '../events/events';

const StreamErrorModal = () => {
  const [showError, setShowError] = useState(false);

  useEffect(() => listen('stream-error', () => setShowError(true)), []);

  if (!showError) {
    return <></>;
  };

  if (Platform.OS !== 'web') {
    return <></>;
  }

  return (
    <View
      style={{
        backgroundColor: '#70f',
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: '100%',
          maxWidth: 600,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 10,
        }}
      >
        <Text
          style={{
            color: 'white',
            alignSelf: 'center',
            fontFamily: 'TruenoBold',
            fontSize: 24,
            textAlign: 'center',
          }}
          selectable={false}
        >
          Duolicious
        </Text>
        <DefaultText
          style={{
            fontSize: 48,
            color: 'white',
            marginTop: 40,
            marginBottom: 40,
            textAlign: 'center',
          }}
        >
          Too many tabs!
        </DefaultText>
        <DefaultText
          style={{
            color: 'white',
            textAlign: 'center',
          }}
        >
          Duolicious is open in another tab. Close all other tabs and refresh
          this page.
        </DefaultText>
      </View>
    </View>
  );
}

export {
  StreamErrorModal,
};
