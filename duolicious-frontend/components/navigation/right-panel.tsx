import {
  useEffect,
  useState,
} from 'react';
import {
  View,
  Linking,
} from 'react-native';
import { DefaultText } from '../default-text';
import { ButtonWithCenteredText } from '../button/centered-text';
import { signedInUser } from '../../App';
import { api } from '../../api/api';

const CountdownTimer = ({ targetDate }: { targetDate: Date | undefined }) => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  const doUpdate = () => {
    if (!targetDate) {
      return;
    }

    const currentTime = new Date().getTime();
    const targetTime = targetDate.getTime();
    const difference = targetTime - currentTime;

    if (difference <= 0) {
      setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
    } else {
      let days = Math.floor(difference / (1000 * 60 * 60 * 24));
      let hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      let minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      let seconds = Math.floor((difference % (1000 * 60)) / 1000);

      // Stop at 1 day
      if (days === 0) {
        days = 1;
        hours = 0;
        minutes = 0;
        seconds = 0;
      }

      setTimeLeft({ days, hours, minutes, seconds });
    }
  };

  useEffect(() => {
    doUpdate();

    const intervalId = setInterval(doUpdate, 1000);

    return () => clearInterval(intervalId);
  }, [targetDate]);

  // Helper function to format singular/plural
  const formatTime = (value, unit) => {
    return `${value} ${unit}${value !== 1 ? 's' : ''}`;
  };

  if (!targetDate) {
    return null;
  }

  return (
    <View
      style={{
        backgroundColor: 'black',
        borderRadius: 10,
        gap: 10,
        paddingHorizontal: 10,
        paddingVertical: 16,
      }}
    >
      <DefaultText
        style={{
          color: 'white',
          textAlign: 'center',
        }}
      >
        Duolicious has enough donations to keep running for
      </DefaultText>
      <DefaultText
        style={{
          fontWeight: 700,
          textAlign: 'center',
          color: 'white',
        }}
      >
        {formatTime(timeLeft.days, 'day')}, {formatTime(timeLeft.hours, 'hr')}, {formatTime(timeLeft.minutes, 'min')}
      </DefaultText>
    </View>
  );
};

const RightPanel = () => {
  const onPressDonate = () => {
    Linking.openURL('https://ko-fi.com/duolicious');
    api('post', '/dismiss-donation');
  };

  const estimatedEndDate = signedInUser?.estimatedEndDate;

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
            fontWeight: '900',
            fontSize: 22,
            textAlign: 'center',
          }}
        >
          Support Duolicious
        </DefaultText>

        <CountdownTimer targetDate={estimatedEndDate} />

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
          {} That's less than 1% of what Tinder charges, but without the
          paywalls or ads. Learn more about donating {}
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
