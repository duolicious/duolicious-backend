import {
  View,
  Linking,
} from 'react-native';
import { DefaultText } from '../default-text';
import { ButtonWithCenteredText } from '../button/centered-text';
import { api } from '../../api/api';
import { KofiProgress } from './kofi-progress/kofi-progress';

const RightPanel = () => {
  const onPressDonate = () => {
    Linking.openURL('https://ko-fi.com/duolicious');
    api('post', '/dismiss-donation');
  };

  return (
    <View
      style={{
        maxWidth: 360,
        padding: 20,
      }}
    >
      <View
        style={{
          borderRadius: 10,
          backgroundColor: '#70f',
          width: '100%',
          padding: 20,
          gap: 20,
        }}
      >
        <DefaultText
          style={{
            color: 'white',
            textAlign: 'center',
            fontWeight: '900',
            fontSize: 22,
          }}
        >
          KEEP DUOLICIOUS ONLINE FOR JUST 2¢
        </DefaultText>

        <KofiProgress />

        <DefaultText
          style={{
            color: 'white',
            textAlign: 'center',
          }}
        >
          While we’re 100% volunteer-run, servers aren’t free. Thankfully, {}
          <DefaultText style={{ fontWeight: '700' }}>
            just 2¢ per user keeps us online another month.
          </DefaultText>
          {} That's less than 1% of what Tinder charges its average user, but
          without the paywalls or ads. Learn more about donating {}
          <DefaultText
            onPress={() => Linking.openURL('https://duolicious.app/donation-faq/')}
            style={{
              fontWeight: '700',
            }}
          >
            here
          </DefaultText>
          {} or donate now.
        </DefaultText>

        <ButtonWithCenteredText
          onPress={onPressDonate}
          textStyle={{
            fontWeight: '700',
          }}
          containerStyle={{
            marginTop: 0,
            marginBottom: 0,
          }}
          secondary={true}
        >
          Donate via Ko-fi
        </ButtonWithCenteredText>
      </View>
    </View>
  );
};

export {
  RightPanel,
};
