import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  Image,
  useWindowDimensions,
} from 'react-native'
import { DefaultText } from './default-text';
import { listen, notify } from '../events/events';

const buttonHeight = 110; // Define the height for the button

type ImageCropperInput = {
  base64: string
  callback: string
  showProtip?: boolean
};

type ImageCropperOutput = {
  originalBase64: string
  top: number
  left: number
  size: number
} | null;

type NonNullImageCropperOutput = Exclude<ImageCropperOutput, null>;

const ImageCropper = () => {
  const [data, setData] = useState<ImageCropperInput>();
  const [realImageSize, setRealImageSize] = useState({ width: 0, height: 0 });
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const imageSource = useMemo(() => ({uri: data?.base64}), [data?.base64]);

  const imageSize = useRef<{width: number, height: number}>();

  const cropAreaBase = useRef<
    {top: number, left: number, size: number} | null
  >(null);
  const cropArea = useRef({ top: 0, left: 0, size: 0 });
  const animatedCropArea = useRef({
    top: new Animated.Value(0),
    left: new Animated.Value(0),
    right: new Animated.Value(0),
    bottom: new Animated.Value(0),
    size: new Animated.Value(0),
  });

  const setCropArea = (p: {top: number, left: number, size: number}) => {
    cropArea.current = p;

    animatedCropArea.current.top.setValue(p.top);
    animatedCropArea.current.bottom.setValue(p.top + p.size);
    animatedCropArea.current.left.setValue(p.left);
    animatedCropArea.current.right.setValue(p.left + p.size);
    animatedCropArea.current.size.setValue(p.size);
  };

  const statusBarHeight = (
    Platform.OS === 'web' ? 0 : (StatusBar.currentHeight ?? 0));

  const onPanResponderMove = (event, gestureState) => {
    if (!imageSize.current) {
      return;
    }

    if (cropAreaBase.current === null) {
      cropAreaBase.current = {
        top: cropArea.current.top,
        left: cropArea.current.left,
        size: cropArea.current.size,
      };
    }

    let newTop = cropAreaBase.current.top + gestureState.dy;
    let newLeft = cropAreaBase.current.left + gestureState.dx;

    // Bounds checking
    newTop = Math.max(0, newTop);
    newLeft = Math.max(0, newLeft);
    const maxTop = imageSize.current.height - cropAreaBase.current.size;
    const maxLeft = imageSize.current.width - cropAreaBase.current.size;
    newTop = Math.min(maxTop, newTop);
    newLeft = Math.min(maxLeft, newLeft);

    setCropArea({top: newTop, left: newLeft, size: cropAreaBase.current.size});
  };

  const onPressEnd = () => {
    cropAreaBase.current = null;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove,
      onPanResponderRelease: onPressEnd,
      onPanResponderTerminate: onPressEnd,
    })
  ).current;

  const initDims = useCallback((width: number, height: number) => {
    const aspectRatio = width / height;

    // Reduce the available height by the button's height
    const availableHeight = windowHeight - buttonHeight - statusBarHeight;

    let newWidth, newHeight;

    if (windowWidth / availableHeight < aspectRatio) {
      newWidth = windowWidth;
      newHeight = windowWidth / aspectRatio;
    } else {
      newWidth = availableHeight * aspectRatio;
      newHeight = availableHeight;
    }

    imageSize.current = { width: newWidth, height: newHeight };

    setRealImageSize({ width, height });
    const cropSize = Math.min(newWidth, newHeight);

    setCropArea({
      top: (newHeight - cropSize) / 2,
      left: (newWidth - cropSize) / 2,
      size: cropSize
    });
  }, [windowWidth, windowHeight]);

  useEffect(() => {
    if (!data) return;

    Image.getSize(data.base64, initDims, console.error);
  }, [data, initDims]);

  useEffect(() => {
    return listen<ImageCropperInput>(
      'image-cropper-open',
      (data) => setData(data)
    );
  }, [listen, data]);

  const onCancelPress = () => {
    if (!data) {
      return;
    }

    notify<ImageCropperOutput>(data.callback, null);

    setData(undefined);
    imageSize.current = undefined;
  };

  const onCropPress = async () => {
    if (!data) {
      return;
    }

    if (!imageSize.current) {
      return;
    }

    const realCropArea = {
      top: realImageSize.height / imageSize.current.height * cropArea.current.top,
      left: realImageSize.width / imageSize.current.width * cropArea.current.left,
      size: Math.min(realImageSize.height, realImageSize.width),
    };

    notify<ImageCropperOutput>(
      data.callback,
      {
        originalBase64: data.base64,
        top:  Math.round(realCropArea.top),
        left: Math.round(realCropArea.left),
        size: realCropArea.size,
      }
    );

    setData(undefined);
    imageSize.current = undefined;
  };

  const Button = ({onPress, title, color}) => {
    const animatedOpacity = useRef(new Animated.Value(1)).current;

    const opacityLo = 0.7;
    const opacityHi = 1.0;

    const fade = (callback?: () => void) => {
      animatedOpacity.stopAnimation();
      animatedOpacity.setValue(opacityLo);
      callback && callback();
    };

    const unfade = (callback?: () => void) => {
      animatedOpacity.stopAnimation();
      Animated.timing(animatedOpacity, {
        toValue: opacityHi,
        duration: 200,
        useNativeDriver: true,
      }).start((result) => result.finished && callback && callback());
    };

    return <Pressable
      style={styles.pressable}
      onPressIn={() => fade()}
      onPressOut={() => unfade()}
      onPress={onPress}
    >
      <Animated.View
        style={{
          borderRadius: 5,
          backgroundColor: color,
          flexGrow: 1,
          justifyContent: 'center',
          alignItems: 'center',
          opacity: animatedOpacity,
        }}
      >
        <DefaultText
          selectable={false}
          style={styles.defaultText}
        >
          {title}
        </DefaultText>
      </Animated.View>
    </Pressable>
  };

  if (!data) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={{
        marginTop: statusBarHeight,
        width:  imageSize.current?.width ?? 0,
        height: imageSize.current?.height ?? 0,
        backgroundColor: 'black'
      }}>
        <Image
          resizeMode="cover"
          source={imageSource}
          style={styles.image}
        />

        {/* Opaque overlay view - top */}
        <Animated.View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: animatedCropArea.current.top,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
        }} />

        {/* Opaque overlay view - bottom */}
        <Animated.View style={{
          position: 'absolute',
          top: animatedCropArea.current.bottom,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
        }} />

        {/* Opaque overlay view - left */}
        <Animated.View style={{
          position: 'absolute',
          top: animatedCropArea.current.top,
          left: 0,
          width: animatedCropArea.current.left,
          height: animatedCropArea.current.size,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
        }} />

        {/* Opaque overlay view - right */}
        <Animated.View style={{
          position: 'absolute',
          top: animatedCropArea.current.top,
          left: animatedCropArea.current.right, // This looks wrong but it's right
          right: 0,
          height: animatedCropArea.current.size,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
        }} />

        {/* Crop window */}
        <Animated.View
          {...panResponder.panHandlers}
          style={{
            position: 'absolute',
            top: animatedCropArea.current.top,
            left: animatedCropArea.current.left,
            width: animatedCropArea.current.size,
            height: animatedCropArea.current.size,
            borderWidth: 2,
            borderColor: 'transparent',
            backgroundColor: 'transparent',
          }}
        />
      </View>
      <View style={styles.bottomContainer}>
        <View style={styles.buttonContainer}>
          <Button color="#999" onPress={onCancelPress} title="Cancel" />
          <Button color="#70f" onPress={onCropPress} title="Crop" />
        </View>
        {(data?.showProtip ?? true) &&
          <DefaultText style={styles.protip}>
            <DefaultText style={styles.boldProtip} >
              Pro-tip: {}
            </DefaultText>
            Visitors to your profile can see the uncropped pic too
          </DefaultText>
        }
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    touchAction: 'none',
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black',
  },
  pressable: {
    height: 40,
    width: 100,
  },
  defaultText: {
    color: 'white',
    fontWeight: '700',
  },
  bottomContainer: {
    height: buttonHeight,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 10,
    paddingRight: 10,
  },
  buttonContainer: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    flexDirection: 'row',
  },
  protip: {
    color: 'white',
    textAlign: 'center',
  },
  boldProtip: {
    fontWeight: '700',
  },
  image: {
    width: '100%',
    height: '100%',
  }
});

export {
  ImageCropper,
  ImageCropperInput,
  ImageCropperOutput,
  NonNullImageCropperOutput,
};
