import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import { IMAGES_URL } from '../env/env';

const FitWithinScreenImage = ({ source, style, onUpdateImageSize }) => {
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
        style={[style, { width: imageWidth, height: imageHeight }]}
      />
    );
  }

  return <ActivityIndicator size="large" color="white"/>;
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

  const onUpdateImageSize = useCallback(({ imageWidth, imageHeight }) => {
    renderedImageSize.current = { imageWidth, imageHeight };
  }, []);

  const pan = useMemo(
    () => Gesture.Pan()
      .runOnJS(true)
      .onStart(() => {
        positionBase.current = { ...position.current };
      })
      .onUpdate((e) => {
        if (!positionBase.current) return;
        const newPosition = constrainPosition(
          scale.current,
          renderedImageSize.current,
          viewportDimensionsRef.current,
          positionBase.current,
          { dx: e.translationX, dy: e.translationY },
        );
        setPosition(newPosition);
      })
      .onEnd(() => {
        positionBase.current = null;
      }),
    [],
  );

  const pinch = useMemo(
    () => Gesture.Pinch()
      .runOnJS(true)
      .onStart(() => {
        scaleBase.current = scale.current;
      })
      .onUpdate((e) => {
        if (scaleBase.current == null) return;
        const newScale = Math.max(1, e.scale * scaleBase.current);
        const newPosition = constrainPosition(
          newScale,
          renderedImageSize.current,
          viewportDimensionsRef.current,
          position.current,
        );
        setScale(newScale);
        setPosition(newPosition);
      })
      .onEnd(() => {
        scaleBase.current = null;
      }),
    [],
  );

  const doubleTap = useMemo(
    () => Gesture.Tap()
      .runOnJS(true)
      .numberOfTaps(2)
      .maxDuration(300)
      .onEnd((e, success) => {
        if (success) handleDoubleTap(e.x, e.y);
      }),
    [],
  );

  const composed = useMemo(
    () => Gesture.Simultaneous(pinch, pan, doubleTap),
    [pinch, pan, doubleTap],
  );

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
    <GestureDetector gesture={composed}>
      <View style={styles.container}>
        <FitWithinScreenImage
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
        />
      </View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black',
    overflow: 'hidden',
    zIndex: 999,
    // @ts-ignore
    touchAction: 'none',
  },
});

export {
  Pinchy
};
