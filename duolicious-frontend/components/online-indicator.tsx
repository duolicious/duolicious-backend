import { View } from 'react-native';
import { useOnline } from '../chat/application-layer/hooks/online';
import { ONLINE_COLOR } from '../constants/constants';
import { assertNever } from '../util/util';

const OnlineIndicator = ({
  personUuid,
  size,
  borderWidth,
  innerSize,
  style,
}: {
  personUuid: string | null | undefined
  size: number
  borderWidth: number
  innerSize?: number
  style?: object
}) => {
  const innerSize_ = innerSize ?? Math.ceil((size - 2 * borderWidth) / 2.0);

  const onlineStatus = useOnline(personUuid);

  if (onlineStatus === 'online' || onlineStatus === 'within-1-day') {
    return (
      <View
        style={{
          backgroundColor: 'white',
          borderRadius: 999,
          width: size,
          height: size,
          justifyContent: 'center',
          alignItems: 'center',
          ...style,
        }}
      >
        <View
          style={{
            backgroundColor: ONLINE_COLOR,
            borderRadius: 999,
            width: size - 2 * borderWidth,
            height: size - 2 * borderWidth,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {onlineStatus === 'within-1-day' &&
            <View
              style={{
                backgroundColor: 'white',
                borderRadius: 999,
                width: innerSize_,
                height: innerSize_,
              }}
            />
          }
        </View>
      </View>
    );
  } else if (onlineStatus === 'offline') {
    return null;
  } else {
    return assertNever(onlineStatus);
  }
};

export {
  OnlineIndicator
};
