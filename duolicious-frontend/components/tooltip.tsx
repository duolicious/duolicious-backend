import { useCallback, useEffect, useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { DefaultText } from './default-text';
import { listen, notify } from '../events/events';
import { isMobile } from '../util/util';

type TooltipState = {
  text: string
  measurement: {
    x: number
    y: number
    width: number
    height: number
    pageX: number
    pageY: number
  },
} | null | undefined;

const EVENT_KEY = 'tooltip';

const setTooltip = (state: TooltipState) => {
  notify<TooltipState>(EVENT_KEY, state);
}

const Tooltip = ({
  children,
  style,
}: {
  children: any,
  style?: object,
}) => {
  return (
    <DefaultText
      style={{
        backgroundColor: 'black',
        color: 'white',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 5,
        fontSize: 14,
        textAlign: 'center',
        maxWidth: 150,
        ...style,
      }}
    >
      {children}
    </DefaultText>
  );
};

const TooltipListener = () => {
  const [state, setState] = useState<TooltipState>(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  useEffect(() => {
    listen<TooltipState>(EVENT_KEY, setState);
  }, []);

  if (!state) {
    return null;
  }

  const props = isMobile() ? {
    onStartShouldSetResponder: () => true,
    onResponderGrant: () => setTooltip(null),
  } : {
    onMouseMove: (e) => {
      if (e.target === e.currentTarget) {
        setTooltip(null);
      }
    }
  };

  const horizontalDirection: 'left' | 'right' =
    state.measurement.pageX > windowWidth / 2
    ? 'left'
    : 'right';

  const verticalDirection: 'up' | 'down' =
    state.measurement.pageY > windowHeight / 2
    ? 'up'
    : 'down';

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
      }}
      {...props}
    >
      <View
        style={{
          position: 'absolute',

          ...(horizontalDirection === 'right' ? {
            left: state.measurement.pageX,
            paddingLeft: Math.max(0, state.measurement.width - 4),
          } : {
            right: windowWidth - state.measurement.pageX - state.measurement.width,
            paddingRight: Math.max(0, state.measurement.width - 4),
          }),

          ...(verticalDirection === 'down' ? {
            top: state.measurement.pageY,
            paddingTop: Math.max(0, state.measurement.height - 4),
          } : {
            bottom: windowHeight - state.measurement.pageY - state.measurement.height,
            paddingBottom: Math.max(0, state.measurement.height - 4),
          }),
        }}
      >
        <Tooltip>{state.text}</Tooltip>
      </View>
    </View>
  );
};

const useTooltip = (text: string) => {
  const viewRef = useRef<View>(null);

  const showTooltip = useCallback(() => {
    viewRef.current?.measure((x, y, width, height, pageX, pageY) => {
      setTooltip({
        text,
        measurement: {
          x,
          y,
          width,
          height,
          pageX,
          pageY,
        }
      });
    });
  }, [text]);

  const onStartShouldSetResponder = useCallback(() => true, []);

  const props = isMobile() ? {
    onStartShouldSetResponder,
    onResponderGrant: showTooltip,
  } : {
    onMouseEnter: showTooltip,
  };

  return { viewRef, props };
};

export {
  Tooltip,
  TooltipListener,
  useTooltip,
};
