import {
  Animated,
  View,
} from 'react-native';
import { QAndADevice } from '../q-and-a-device';
import { Gold } from '../badges';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSignedInUser } from '../../events/signed-in-user';


const LabelToIcon = ({
  label,
  isFocused,
  unreadIndicatorOpacity,
  color = "black",
  backgroundColor = undefined,
  fontSize = 20,
  unreadIndicatorColor = '#70f',
}: {
  label: string
  isFocused: boolean
  unreadIndicatorOpacity: any,
  color?: string
  backgroundColor?: string | undefined
  fontSize?: number
  unreadIndicatorColor?: string
}) => {
  const [signedInUser] = useSignedInUser();

  const searchIcon =
    isFocused ? 'search' : 'search-outline';
  const inboxIcon =
    isFocused ? 'chatbubbles' : 'chatbubbles-outline';
  const feedIcon =
    isFocused ? 'planet' : 'planet-outline';
  const profileIcon =
    isFocused ? 'person' : 'person-outline';

  const height = fontSize + 2;

  const iconStyle = {
    fontSize: fontSize,
    color: color,
    height,
  };

  return (
    <>
      {label === 'Q&A' &&
        <QAndADevice
          color={color}
          height={height}
          isBold={isFocused}
          backgroundColor={backgroundColor}
        />
      }
      {label === 'Search' &&
        <Ionicons style={{...iconStyle}} name={searchIcon}/>
      }
      {label === 'Feed' &&
        <Ionicons style={{...iconStyle}} name={feedIcon}/>
      }
      {label === 'Inbox' &&
        <View>
          <Ionicons style={{...iconStyle}} name={inboxIcon}/>
          <Animated.View
            style={{
              position: 'absolute',
              top: 0,
              right: -13,
              height: 12,
              width: 12,
              backgroundColor: unreadIndicatorColor,
              borderRadius: 999,
              opacity: unreadIndicatorOpacity,
            }}
          />
        </View>
      }
      {label === 'Profile' &&
        <View>
          {!!signedInUser?.hasGold &&
            <Gold
              style={{
                position: 'absolute',
                top: -4,
                right: -14,
                backgroundColor,
              }}
              color={color}
              doAnimate={false}
            />
          }
          <Ionicons style={{...iconStyle}} name={profileIcon}/>
        </View>
      }
    </>
  );
};

export {
  LabelToIcon,
}
