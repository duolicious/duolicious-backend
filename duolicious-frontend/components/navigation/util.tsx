import {
  Animated,
  View,
} from 'react-native';
import { QAndADevice } from '../q-and-a-device';
import Ionicons from '@expo/vector-icons/Ionicons';
import { DefaultText } from '../default-text';

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
          fontSize={fontSize}
          isBold={isFocused}
          backgroundColor={backgroundColor}
          height={height}
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
        <Ionicons style={{...iconStyle}} name={profileIcon}/>
      }
    </>
  );
};

export {
  LabelToIcon,
}
