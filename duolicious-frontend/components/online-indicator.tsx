import { useMemo } from 'react';
import { View, PixelRatio } from 'react-native';
import { friendlyOnlineStatus, useOnline } from '../chat/application-layer/hooks/online';
import { ONLINE_COLOR } from '../constants/constants';
import { assertNever } from '../util/util';
import * as _ from 'lodash';
import { useTooltip } from './tooltip';

/**
 * Renders a small circular presence indicator.
 *
 * The component historically suffered from sub‑pixel rounding issues on high‑dpi
 * screens that made the green dot appear slightly off‑centre.  The fix is to
 * snap *every* diameter value (outer circle, inner circle, and optional core)
 * to the device pixel‑grid using `PixelRatio.roundToNearestPixel`, so that the
 * layout engine never has to pick half‑pixels.
 *
 * We deliberately keep the three‑View nesting (white → green → white) because a
 * two‑layer solution that relies on `borderWidth` introduces an unwanted faint
 * border caused by antialiasing.
 */
const OnlineIndicator = ({
  personUuid,
  size,
  borderWidth,
  innerSize,
  style,
}: {
  personUuid: string | null | undefined;
  /** Total diameter, in logical points. */
  size: number;
  /** Thickness of the white ring, in logical points. */
  borderWidth: number;
  /** Diameter of the innermost white dot when using the "online‑recently" state. */
  innerSize?: number;
  /** Extra container styles. */
  style?: object,
}) => {
  const onlineStatus = useOnline(personUuid);
  const { viewRef, props } = useTooltip(friendlyOnlineStatus(onlineStatus));

  /**
   * Snap all dimensions to the physical pixel‑grid.
   *
   * Rounding every value avoids half‑pixel placement that makes the dot look
   * visually off‑centre or blurry on some devices (especially Android phones
   * with odd device‑pixel‑ratio numbers).
   */
  const { outerD, innerD, coreD } = useMemo(() => {
    const outer = PixelRatio.roundToNearestPixel(size);
    const ring   = PixelRatio.roundToNearestPixel(borderWidth);
    const inner  = PixelRatio.roundToNearestPixel(outer - 2 * ring);
    const core   = PixelRatio.roundToNearestPixel(
      innerSize ?? inner / 2,
    );

    return { outerD: outer, innerD: inner, coreD: core };
  }, [size, borderWidth, innerSize]);

  if (onlineStatus === 'online' || onlineStatus === 'online-recently') {
    return (
      <View
        ref={viewRef}
        // Using explicit width/height instead of "aspectRatio: 1" makes the
        // PixelRatio rounding above actually take effect in layout.
        style={{
          backgroundColor: 'white',
          borderRadius: 999,
          width: outerD,
          height: outerD,
          justifyContent: 'center',
          alignItems: 'center',
          ...style,
        }}
        {...props}
      >
        <View
          style={{
            backgroundColor: ONLINE_COLOR,
            borderRadius: 999,
            width: innerD,
            height: innerD,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {onlineStatus === 'online-recently' &&
            <View
              style={{
                backgroundColor: 'white',
                borderRadius: 999,
                width: coreD,
                height: coreD,
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
