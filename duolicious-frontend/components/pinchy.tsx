import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  GestureResponderEvent,
  Image,
  PanResponder,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { IMAGES_URL } from '../env/env';

const FitWithinScreenImage = ({ source, style, onUpdateImageSize, ...rest }) => {
  const isFetchingSize = useRef(false);
  const [imageSize, setImageSize] = useState({width: 0, height: 0});
  const [imageWidth, setImageWidth] = useState<number | null>(null);
  const [imageHeight, setImageHeight] = useState<number | null>(null);
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();

  useEffect(() => {
    if (isFetchingSize.current) {
      return;
    }

    isFetchingSize.current = true;
    // Get the dimensions of the image
    Image.getSize(source.uri, (width, height) => {
      setImageSize({width, height});
      isFetchingSize.current = false;
    });
  }, [source.uri]);

  useEffect(() => {
    // Check the image dimensions against the screen dimensions
    let newWidth = imageSize.width;
    let newHeight = imageSize.height;

    if (imageSize.width > viewportWidth) {
      newWidth = viewportWidth;
      newHeight = (viewportWidth / imageSize.width) * imageSize.height;
    }

    if (newHeight > viewportHeight) {
      newHeight = viewportHeight;
      newWidth = (viewportHeight / imageSize.height) * imageSize.width;
    }

    setImageWidth(newWidth);
    setImageHeight(newHeight);

    onUpdateImageSize({imageWidth: newWidth, imageHeight: newHeight});
  }, [
    imageSize.width,
    imageSize.height,
    viewportWidth,
    viewportHeight
  ]);

  if (imageWidth && imageHeight) {
    return (
      <Animated.Image
        source={source}
        {...rest}
        style={[style, { width: imageWidth, height: imageHeight }]}
      />
    );
  }

  return <ActivityIndicator size={60} color="#70f"/>;
};

const constrainPosition = (
  currentScale: number,
  imageDimensions: { imageWidth: number, imageHeight: number },
  viewportDimensions: { viewportWidth: number, viewportHeight },
  position: {x: number, y: number},
  gestureState?: {dx: number, dy: number},
) => {
  const { imageWidth, imageHeight } = imageDimensions;
  const { viewportWidth, viewportHeight } = viewportDimensions;
  const { x, y } = position;
  const { dx = 0, dy = 0 } = gestureState ?? {};

  const adjustedWidth = imageWidth * currentScale;
  const adjustedHeight = imageHeight * currentScale;

  const maxTranslateX = (adjustedWidth > viewportWidth) ?
    (adjustedWidth - viewportWidth) / 2 / currentScale :
    (viewportWidth - adjustedWidth) / 2 / currentScale;

  const maxTranslateY = (adjustedHeight > viewportHeight) ?
    (adjustedHeight - viewportHeight) / 2 / currentScale :
    (viewportHeight - adjustedHeight) / 2 / currentScale;

  return {
    x: (adjustedWidth > viewportWidth) ?
       Math.min(maxTranslateX, Math.max(-maxTranslateX, x + dx / currentScale)) :
       0,
    y: (adjustedHeight > viewportHeight) ?
       Math.min(maxTranslateY, Math.max(-maxTranslateY, y + dy / currentScale)) :
       0,
  };
};

const Pinchy = ({uuid}: {uuid: string}) => {
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();

  const scaleBase = useRef<number | null>(null);
  const scale = useRef(1);
  const animatedScale = useRef(new Animated.Value(scale.current));

  const positionBase = useRef<{x: number, y: number} | null>(null);
  const position = useRef({ x: 0, y: 0 });
  const animatedPosition = useRef(new Animated.ValueXY(position.current));

  const pinchRef = useRef<number | null>(null);
  const lastTapRef = useRef<number | null>(null);

  const viewportDimensionsRef = useRef({ viewportWidth, viewportHeight });

  const renderedImageSize = useRef({imageWidth: 0, imageHeight: 0});

  const setScale = (s: number) => {
    scale.current = s;
    animatedScale.current.setValue(s);
  };

  const setPosition = (p: {x: number, y: number}) => {
    position.current = p;
    animatedPosition.current.setValue(p);
  };

  const handleDoubleTap = (tapX: number, tapY: number) => {
    const isZoomed = scale.current > 1 + 1e-5;

    if (isZoomed) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else {
      const offsetX = renderedImageSize.current.imageWidth / 2 - tapX;
      const offsetY = renderedImageSize.current.imageHeight / 2 - tapY;

      const newPosition = constrainPosition(
        2,
        renderedImageSize.current,
        viewportDimensionsRef.current,
        { x: offsetX, y: offsetY }
      );

      setScale(2);
      setPosition(newPosition);
    }
  };

  const handleSingleTap = (event: GestureResponderEvent) => {
    const now = Date.now();
    const tapX = event.nativeEvent.locationX;
    const tapY = event.nativeEvent.locationY;

    if (lastTapRef.current && now - lastTapRef.current < 300) {
      handleDoubleTap(tapX, tapY);
      lastTapRef.current = null;
    } else {
      lastTapRef.current = now;
    }
  };

  const onPinchMove = (event, gestureState) => {
    if (scaleBase.current === null) {
      scaleBase.current = scale.current;
    }

    if (positionBase.current === null) {
      positionBase.current = {
        x: position.current.x,
        y: position.current.y,
      };
    }

    let touches = event.nativeEvent.touches;
    if (touches.length > 1) {
      const touch1 = touches[0];
      const touch2 = touches[1];
      const distance = Math.sqrt(
        Math.pow(touch2.pageX - touch1.pageX, 2) +
        Math.pow(touch2.pageY - touch1.pageY, 2)
      );

      if (!pinchRef.current) {
        pinchRef.current = distance;
      }

      const newScale = Math.max(1, (distance / pinchRef.current) * scaleBase.current);
      const newPosition = constrainPosition(
        newScale,
        renderedImageSize.current,
        viewportDimensionsRef.current,
        positionBase.current,
        gestureState
      );

      setScale(newScale);
      setPosition(newPosition);
    } else {
      const newPosition = constrainPosition(
        scale.current,
        renderedImageSize.current,
        viewportDimensionsRef.current,
        positionBase.current,
        gestureState
      );
      setPosition(newPosition);
    }
  };

  const onPinchEnd = () => {
    scaleBase.current = null;
    positionBase.current = null;
    pinchRef.current = null;
  };

  const onUpdateImageSize = useCallback(({ imageWidth, imageHeight }) => {
    renderedImageSize.current = { imageWidth, imageHeight };
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: (e) => (e.preventDefault(), true),
      onPanResponderGrant: handleSingleTap,
      onPanResponderMove: onPinchMove,
      onPanResponderRelease: onPinchEnd,
      onPanResponderTerminate: onPinchEnd,
    })
  ).current;

  useEffect(() => {
    viewportDimensionsRef.current = { viewportWidth, viewportHeight };

    const newPosition = constrainPosition(
      scale.current,
      renderedImageSize.current,
      viewportDimensionsRef.current,
      position.current,
    );
    setPosition(newPosition);
  }, [viewportWidth, viewportHeight]);

  return (
    <View style={styles.container} pointerEvents="box-none">
      <FitWithinScreenImage
        {...panResponder.panHandlers}
        source={{ uri: `${IMAGES_URL}/original-${uuid}.jpg` }}
        style={[
          {
            transform: [
              { scale: animatedScale.current },
              { translateX: animatedPosition.current.x },
              { translateY: animatedPosition.current.y },
            ],
          },
        ]}
        onUpdateImageSize={onUpdateImageSize}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    touchAction: 'none',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black',
    overflow: 'hidden',
    zIndex: 999,
  },
});

export {
  Pinchy
};
