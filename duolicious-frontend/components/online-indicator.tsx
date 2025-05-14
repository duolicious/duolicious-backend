import { useCallback, useRef } from 'react';
import { View } from 'react-native';
import { friendlyOnlineStatus, useOnline } from '../chat/application-layer/hooks/online';
import { ONLINE_COLOR } from '../constants/constants';
import { assertNever } from '../util/util';
import * as _ from 'lodash';
import { TooltipState, setTooltip } from './tooltip';

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

  const viewRef = useRef<View>(null);

  const showTooltip = useCallback(() => {
    viewRef.current?.measureInWindow((x, y, width, height) => {
      // Position the tooltip at the center of the icon
      const state: TooltipState = {
        left: x + width / 2,
        top: y + height / 2,
        text: friendlyOnlineStatus(onlineStatus),
      };

      setTooltip(state);
    });
  }, [onlineStatus]);

  if (onlineStatus === 'online' || onlineStatus === 'online-recently') {
    return (
      <View
        ref={viewRef}
        style={{
          backgroundColor: 'white',
          borderRadius: 999,
          width: size,
          height: size,
          justifyContent: 'center',
          alignItems: 'center',
          ...style,
        }}
        // @ts-ignore
        onMouseEnter={
          () => showTooltip()
        }
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
          {onlineStatus === 'online-recently' &&
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
