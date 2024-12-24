import {
  Animated,
  View,
} from 'react-native';
import { QAndADevice } from '../q-and-a-device';
import Ionicons from '@expo/vector-icons/Ionicons';
import { DefaultText } from '../default-text';

const displayedTabs: Set<string> = new Set([
  "Q&A",
  "Search",
  "Inbox",
  "Traits",
  "Profile",
]);

const LabelToIcon = ({
  label,
  isFocused,
  unreadIndicatorOpacity,
  color = "black",
  backgroundColor = undefined,
  fontSize = 20,
  unreadIndicatorColor = '#70f',
}) => {
  const searchIcon =
    isFocused ? 'search' : 'search-outline';
  const inboxIcon =
    isFocused ? 'chatbubbles' : 'chatbubbles-outline';
  const profileIcon =
    isFocused ? 'person' : 'person-outline';

  const iconStyle = {
    fontSize: fontSize,
    color: color,
  };

  return (
    <>
      {label === 'Q&A' &&
        <QAndADevice
          color={color}
          fontSize={iconStyle.fontSize}
          isBold={isFocused}
          backgroundColor={backgroundColor}
        />
      }
      <View>
        {label === 'Search' &&
          <Ionicons style={{...iconStyle}} name={searchIcon}/>
        }
        {label === 'Inbox' &&
          <Ionicons style={{...iconStyle}} name={inboxIcon}/>
        }
        {label === 'Inbox' &&
          <Animated.View
            style={{
              position: 'absolute',
              top: 0,
              right: -13,
              height: 12,
              width: 12,
              backgroundColor: unreadIndicatorColor,
              borderRadius: 999,
              shadowOffset: {
                width: 0,
                height: 2,
              },
              shadowOpacity: 0.4,
              shadowRadius: 4,
              elevation: 4,
              opacity: unreadIndicatorOpacity,
            }}
          />
        }
        {label === 'Traits' &&
          <View
            style={{
              height: 20,
              overflow: 'visible',
            }}
          >
            <DefaultText
              style={{
                fontSize: fontSize + 2,
                marginTop: -6,
                fontWeight: isFocused ? '700' : undefined,
                color: color,
              }}
            >
              Ψ
            </DefaultText>
          </View>
        }
        {label === 'Profile' &&
          <Ionicons style={{...iconStyle}} name={profileIcon}/>
        }
      </View>
    </>
  );
};

export {
  displayedTabs,
  LabelToIcon,
}
