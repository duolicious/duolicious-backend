import { View } from 'react-native';
import { QAndADevice } from '../q-and-a-device';
import { Gold } from '../badges';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSignedInUser } from '../../events/signed-in-user';
import { isMobile } from '../../util/util';
import { DefaultText } from '../default-text';

const LabelToIcon = ({
  label,
  isFocused,
  numUnread,
  indicatorColor,
  indicatorBackgroundColor,
  indicatorBorderColor,
  color,
  backgroundColor,
  fontSize = 20,
}: {
  label: string
  isFocused: boolean
  numUnread: number
  indicatorColor: string
  indicatorBackgroundColor: string
  indicatorBorderColor: string
  color: string
  backgroundColor: string
  fontSize?: number
}) => {
  const [signedInUser] = useSignedInUser();

  const cappedNumUnread = Math.min(numUnread, 99);
  const maybePlus = numUnread > 99 ? '+' : '';

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
          {numUnread > 0 &&
            <View
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                justifyContent: 'flex-start',
                alignItems: 'flex-end',
              }}
            >
              <View
                style={{
                  width: '15%',
                  height: '100%',
                  overflow: 'visible',
                }}
              >
                <DefaultText
                  style={{
                    position: 'absolute',
                    top: -2,
                    left: 0,
                    fontFamily: 'TruenoBold',
                    borderWidth: 1,
                    borderRadius: 6,
                    paddingHorizontal: 4,
                    paddingVertical: 1,
                    fontSize: 12,
                    borderColor: indicatorBorderColor,
                    backgroundColor: indicatorBackgroundColor,
                    color: indicatorColor,
                  }}
                >
                  {cappedNumUnread}{maybePlus}
                </DefaultText>
              </View>
            </View>
          }
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
                backgroundColor: 'transparent',
              }}
              color={color}
              doAnimate={false}
              enableTooltip={!isMobile()}
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
