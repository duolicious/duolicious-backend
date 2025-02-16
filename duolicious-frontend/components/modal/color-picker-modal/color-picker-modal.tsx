import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  StyleSheet,
  View,
  Animated,
  Pressable,
} from 'react-native';
import {
  listen,
  notify,
} from '../../../events/events';
import {
  Title,
} from '../../../components/title';
import {
  HsvColorPicker,
  HsvColorPickerRef,
} from './hsv-color-picker';
import {
  DefaultText,
} from '../../default-text';
import {
  backgroundColors,
} from '../background-colors';

type ColorPickedEvent = string;
type ShowColorPickerEvent = string;

const styles = StyleSheet.create({
  modal: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    ...backgroundColors.dark,
  },
  container: {
    borderColor: '#555',
    padding: 28,
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    width: 14,
    height: 14,
  },
  oldNewText: {
    color: 'white',
    textAlign: 'center',
  },
  dualColorComparisonContainer: {
   flexDirection: 'row',
   gap: 10,
  },
  singleColorComparisonContainer: {
    gap: 5,
  },
  title: {
    color: 'white',
    marginTop: 0,
    marginBottom: 20,
    fontWeight: '900',
  },
  container2: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    marginTop: 20,
  },
  bottomContainer: {
    height: 50,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 50,
  },
  buttonContainer: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    flexDirection: 'row',
  },
  defaultText: {
    color: 'white',
    fontWeight: '700',
  },
  pressable: {
    height: 40,
    width: 100,
  },
});


const ColorPickerModal: React.FC = () => {
  const [initialBackgroundColor, setInitialBackgroundColor] = useState('#ffffff');
  const [isShowing, setIsShowing] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);

  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: shouldShow ? 1 : 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => setIsShowing(shouldShow));
  }, [setIsShowing, shouldShow, opacity]);

  const hsvColorPickerRef = useRef<HsvColorPickerRef>(null);
  const [backgroundColor, setBackgroundColor] = useState(initialBackgroundColor);

  const onDragMove = useCallback(() => {
    setBackgroundColor(hsvColorPickerRef.current?.getColor() ?? '#ffffff');
  }, []);

  const pick = useCallback(() => {
    const color = hsvColorPickerRef.current?.getColor() ?? '#ffffff';

    notify<ColorPickedEvent>('color-picked', color);

    setShouldShow(false);
  }, []);

  const cancel = useCallback(() => {
    setShouldShow(false)
  }, []);

  useEffect(() => {
    return listen<ShowColorPickerEvent>(
      'show-color-picker',
      (color: string) => {
        setInitialBackgroundColor(color);
        setBackgroundColor(color);

        setShouldShow(true);
      }
    );
  }, []);

  useEffect(() => {
    if (shouldShow) {
      hsvColorPickerRef.current?.setColor(initialBackgroundColor);
    }
  }, [hsvColorPickerRef.current, initialBackgroundColor, shouldShow]);

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

  if (!(isShowing || shouldShow)) {
    return null;
  }

  return (
    <Animated.View style={[styles.modal, { opacity: opacity }]}>
      <Title style={styles.title}>
        Pick Your Color
      </Title>

      <View style={styles.container2}>
        <HsvColorPicker
          ref={hsvColorPickerRef}
          onDragMove={onDragMove}
        />
        <View style={styles.dualColorComparisonContainer}>
          <View style={styles.singleColorComparisonContainer}>
            <View
              style={{
                backgroundColor: initialBackgroundColor,
                width: 40,
                height: 40,
              }}
            />
            <DefaultText style={styles.oldNewText}>Old</DefaultText>
          </View>
          <View style={styles.singleColorComparisonContainer}>
            <View style={{ backgroundColor, width: 40, height: 40 }} />
            <DefaultText style={styles.oldNewText}>New</DefaultText>
          </View>
        </View>
      </View>

      <View style={styles.bottomContainer}>
        <View style={styles.buttonContainer}>
          <Button color="#999" onPress={cancel} title="Cancel" />
          <Button color="#70f" onPress={pick} title="Pick" />
        </View>
      </View>
    </Animated.View>
  );
};

export {
  ColorPickerModal,
  ShowColorPickerEvent,
};
