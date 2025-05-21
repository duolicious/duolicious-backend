import {
  Linking,
  Platform,
  Text,
  View,
} from 'react-native';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import { DefaultText } from './default-text';
import {
  randomGagMaintenanceNotice,
  randomGagUpdateNotice,
} from '../data/gag-utility-notices';
import { assertNever } from '../util/util'
import { ButtonWithCenteredText } from './button/centered-text';

type ServerStatus = "ok" | "down for maintenance" | "please update";

const useHasDonations = (estimatedEndDate: Date | undefined) => {
  const [hasDonations, setHasDonations] = useState(() => {
    return estimatedEndDate ? estimatedEndDate > new Date() : true;
  });

  useEffect(() => {
    if (!estimatedEndDate) {
      setHasDonations(true);
      return;
    }

    const now = new Date();
    const timeUntilEnd = estimatedEndDate.getTime() - now.getTime();

    if (timeUntilEnd <= 0) {
      setHasDonations(false);
      return;
    }

    // Set a timer to update when the date is no longer in the future
    const timer = setTimeout(() => {
      setHasDonations(false);
    }, timeUntilEnd);

    return () => clearTimeout(timer); // Clean up the timer if the date changes
  }, [estimatedEndDate]);

  return hasDonations;
};

const UtilityScreen = ({
  serverStatus,
  hasDonations,
}: {
  serverStatus:
    | "down for maintenance"
    | "please update"
  hasDonations: true
} | {
  serverStatus: ServerStatus
  hasDonations: false
}) => {
  const getBody = () => {
    if (serverStatus === "down for maintenance") {
      return randomGagMaintenanceNotice();
    } else if (serverStatus === "please update") {
      return randomGagUpdateNotice();
    } else if (!hasDonations) {
      return "";
    } else {
      return assertNever(serverStatus);
    }
  };

  const getTitle = () => {
    if (serverStatus === "down for maintenance") {
      return "Down For Maintenance";
    } else if (serverStatus === "please update") {
      if (Platform.OS === 'web') {
        return "Please Refresh This Page 😇"
      } else {
        return "Please Update Your App 😇"
      }
    } else if (!hasDonations) {
      return "Got Any Change?"
    } else {
      return assertNever(serverStatus);
    }
  };

  const onPressDonate = () => {
    Linking.openURL('https://ko-fi.com/duolicious');
  };

  const title_ = useMemo(getTitle, [serverStatus]);
  const body_ = useMemo(getBody, [serverStatus]);

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
          {title_}
        </DefaultText>
        <DefaultText
          style={{
            color: 'white',
            textAlign: 'center',
          }}
        >
          {body_}
        </DefaultText>
        {!hasDonations && <>
          <DefaultText
            style={{
              color: 'white',
              textAlign: 'center',
            }}
          >
            Even though we’re donation-based, have no ads, and ask for less than
            1% of what Tinder charges per user, we still need to pay our bills
            to stay running.
            {'\n\n'}
            Thankfully, {}
            <DefaultText style={{ fontWeight: '700' }}>
              your donation can bring us back for everyone, instantly
            </DefaultText>.
            {} Learn more about donating {}
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
            secondary={true}
            containerStyle={{
              marginTop: 40,
              width: '90%',
            }}
          >
            Donate via Ko-fi
          </ButtonWithCenteredText>
          <DefaultText
            style={{
              color: 'white',
              textAlign: 'center',
            }}
          >
            You’ll need to refresh this page after donating to use Duolicious
            again
          </DefaultText>
        </>}
      </View>
    </View>
  );
};

export {
  ServerStatus,
  UtilityScreen,
  useHasDonations,
};
