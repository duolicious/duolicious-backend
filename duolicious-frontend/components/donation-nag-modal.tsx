import {
  Linking,
  Modal,
  Platform,
  View,
} from 'react-native';
import {
  useState,
  useEffect,
} from 'react';
import { DefaultText } from './default-text';
import { ButtonWithCenteredText } from './button/centered-text';
import { signedInUser } from '../App';
import { api } from '../api/api';

const DonationNagModal = () => {
  const name = signedInUser?.name;
  const estimatedEndDate = signedInUser?.estimatedEndDate;
  const doShowDonationNag = signedInUser?.doShowDonationNag;

  if (!name) return null;
  if (!estimatedEndDate) return null;
  if (!doShowDonationNag) return null;

  const props = { name, estimatedEndDate };

  if (Platform.OS === 'web') {
    return <DonationNagModalWeb { ...props } />;
  } else {
    return <DonationNagModalMobile { ...props } />;
  }
};

const DonationNagModalWeb = ({
  name,
  estimatedEndDate,
}: {
  name: string
  estimatedEndDate: Date
}) => {
  const [isVisible, setIsVisible] = useState(true);

  const onPressDismiss = () => {
    setIsVisible(false);
    api('post', '/dismiss-donation');
  };

  const onPressDonate = () => {
    Linking.openURL('https://ko-fi.com/duolicious');
    onPressDismiss();
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={isVisible}
      statusBarTranslucent={true}
    >
      <View
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'row',
        }}
      >
        <View
          style={{
            flex: 1,
            maxWidth: 600,
            margin: 10,
            backgroundColor: 'white',
            borderRadius: 5,
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              backgroundColor: '#70f',
              padding: 10,
              gap: 10,
            }}
          >
            <DefaultText
              style={{
                fontSize: 22,
                fontWeight: 900,
                textAlign: 'center',
                color: 'white',
              }}
            >
              {name}, we need your help!
            </DefaultText>

            <CountdownTimer targetDate={estimatedEndDate} />
          </View>

          <View
            style={{
              gap: 10,
              paddingHorizontal: 10,
              paddingVertical: 20,
            }}
          >
            <DefaultText
              style={{
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
          </View>

          <View
            style={{
              padding: 10,
              paddingTop: 0,
            }}
          >
            <ButtonWithCenteredText
              onPress={onPressDonate}
              textStyle={{
                fontWeight: '700',
              }}
            >
              Donate via Ko-fi
            </ButtonWithCenteredText>

            <ButtonWithCenteredText
              onPress={onPressDismiss}
              secondary={true}
              textStyle={{
                fontWeight: '700',
              }}
            >
              Press S to spit on grave
            </ButtonWithCenteredText>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const DonationNagModalMobile = ({
  name,
  estimatedEndDate,
}: {
  name: string
  estimatedEndDate: Date
}) => {
  return null;
};

const CountdownTimer = ({ targetDate }: { targetDate: Date }) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  const doUpdate = () => {
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

  return (
    <View
      style={{
        opacity: 0.9,
        gap: 10,
      }}
    >
      <DefaultText
        style={{
          color: 'white',
          textAlign: 'center',
        }}
      >
        Duolicious will shut down in
      </DefaultText>
      <DefaultText
        style={{
          fontWeight: 700,
          textAlign: 'center',
          color: 'white',
        }}
      >
        {formatTime(timeLeft.days, 'day')}, {formatTime(timeLeft.hours, 'hr')}, {formatTime(timeLeft.minutes, 'min')}, {formatTime(timeLeft.seconds, 'sec')}
      </DefaultText>
      <DefaultText
        style={{
          color: 'white',
          textAlign: 'center',
        }}
      >
        without enough donations
      </DefaultText>
    </View>
  );
};

export {
  DonationNagModal,
};
