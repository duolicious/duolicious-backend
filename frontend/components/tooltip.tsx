import { ReactNode, useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { DefaultText } from './default-text';
import { listen, notify } from '../events/events';
import { isMobile } from '../util/util';
import {
  AnchorMeasurement,
  AnchoredOverlay,
  tooltipAnchorStyle,
  useAnchorMeasurement,
  useWindowOverlayDimensions,
} from './anchored-overlay';

type TooltipState = {
  text: string
  measurement: AnchorMeasurement,
} | null | undefined;

const EVENT_KEY = 'tooltip';

const setTooltip = (state: TooltipState) => {
  notify<TooltipState>(EVENT_KEY, state);
}

const Tooltip = ({
  children,
  style,
}: {
  children: ReactNode,
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
  const windowDimensions = useWindowOverlayDimensions();

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
    onMouseMove: (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        setTooltip(null);
      }
    }
  };

  return (
    <AnchoredOverlay visible={!!state} overlayProps={props}>
      <View style={tooltipAnchorStyle(state.measurement, windowDimensions)}>
        <Tooltip>{state.text}</Tooltip>
      </View>
    </AnchoredOverlay>
  );
};

const useTooltip = (text: string) => {
  const { anchorRef: viewRef, measureAnchor } = useAnchorMeasurement();

  const showTooltip = useCallback(() => {
    measureAnchor((measurement) => {
      setTooltip({
        text,
        measurement,
      });
    });
  }, [measureAnchor, text]);

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
