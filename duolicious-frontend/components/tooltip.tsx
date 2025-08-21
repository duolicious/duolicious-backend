import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { DefaultText } from './default-text';
import { listen, notify } from '../events/events';
import { isMobile } from '../util/util';

type TooltipState = {
  text: string
  paddingLeft: number
  paddingTop: number
  top: number
  left: number
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

  useEffect(() => {
    listen<TooltipState>(EVENT_KEY, setState);
  }, []);

  if (!state) {
    return null;
  }

  const { paddingLeft, paddingTop } = state;

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
          top: state.top === undefined ? undefined : state.top,
          left: state.left === undefined ? undefined : state.left,

          paddingTop: state.top === undefined ? undefined : paddingTop,
          paddingLeft: state.left === undefined ? undefined : paddingLeft,
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
    viewRef.current?.measureInWindow((x, y, width, height) => {
      // Position the tooltip at the center of the icon
      const state: TooltipState = {
        left: x,
        top: y,
        paddingLeft: Math.max(0, width - 4),
        paddingTop: Math.max(0, height - 4),
        text,
      };

      setTooltip(state);
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
