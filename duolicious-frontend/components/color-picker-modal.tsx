import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  Animated,
} from 'react-native';
import {
  listen,
  notify,
} from '../events/events';
import {
  Title,
} from '../components/title';

type ColorPickedEvent = string;

const styles = StyleSheet.create({
  modal: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressable: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
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
  title: {
    color: 'white',
    marginTop: 0,
    marginBottom: 0,
  },
});

const hslToHex = (hsl: string): string => {
    // Parse the HSL string to extract hue, saturation, and lightness
    const [hue, saturation, lightness] = hsl.match(/\d+/g)?.map(Number) || [0, 0, 0];

    const s: number = saturation / 100;
    const l: number = lightness / 100;

    let c: number = (1 - Math.abs(2 * l - 1)) * s;
    let x: number = c * (1 - Math.abs((hue / 60) % 2 - 1));
    let m: number = l - c / 2;
    let r: number = 0, g: number = 0, b: number = 0;

    if (0 <= hue && hue < 60) {
        r = c; g = x; b = 0;
    } else if (60 <= hue && hue < 120) {
        r = x; g = c; b = 0;
    } else if (120 <= hue && hue < 180) {
        r = 0; g = c; b = x;
    } else if (180 <= hue && hue < 240) {
        r = 0; g = x; b = c;
    } else if (240 <= hue && hue < 300) {
        r = x; g = 0; b = c;
    } else if (300 <= hue && hue < 360) {
        r = c; g = 0; b = x;
    }

    const hexR: string = Math.round((r + m) * 255).toString(16).padStart(2, '0');
    const hexG: string = Math.round((g + m) * 255).toString(16).padStart(2, '0');
    const hexB: string = Math.round((b + m) * 255).toString(16).padStart(2, '0');

    return `#${hexR}${hexG}${hexB}`;
}

const generateColorGrid = (rows: number, cols: number): string[][] => {
  const colorGrid: string[][] = [];
  for (let i = 0; i < rows; i++) {
    const row: string[] = [];
    for (let j = 0; j < cols; j++) {
      let hue = Math.floor((i / (rows - 1)) * 360); // Hue based on row
      let saturation = 100; // Full saturation for vibrant colors
      let lightness = Math.floor(((j + 1)/ (cols + 1)) * 100); // Lightness based on column

      if (i === rows - 1) { // The last row for grayscale
        hue = 0; // Hue doesn't matter for grayscale
        saturation = 0; // No saturation for grayscale
        lightness = Math.floor((j / (cols - 1)) * 100); // Lightness from 0% (black) to 100% (white)
      }

      row.push(hslToHex(`hsl(${hue}, ${saturation}%, ${lightness}%)`));
    }
    colorGrid.push(row);
  }
  return colorGrid;
};

const ColorGrid: React.FC<{ onColorPick: (color: string) => void }> = ({ onColorPick }) => {
  const colorGrid = generateColorGrid(20, 20);

  return (
    <Pressable style={styles.container}>
      {colorGrid.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((color, colIndex) => (
            <Pressable
              key={colIndex}
              style={[styles.cell, { backgroundColor: color }]}
              onPress={() => onColorPick(color)}
            />
          ))}
        </View>
      ))}
    </Pressable>
  );
};

const ColorPickerModal: React.FC = () => {
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

  const onPressColor = useCallback((color: string) => {
    notify<ColorPickedEvent>('color-picked', color);
    setShouldShow(false);
  }, []);

  const onPressNowhere = useCallback(() => {
    setShouldShow(false)
  }, []);

  useEffect(() => {
    return listen('show-color-picker', () => setShouldShow(true));
  }, [setShouldShow]);

  if (!(isShowing || shouldShow)) {
    return null;
  }

  return (
    <Animated.View style={[styles.modal, { opacity: opacity }]}>
      <Pressable
        style={styles.pressable}
        onPress={onPressNowhere}
      >
        <Title style={styles.title}>
          Pick Your Color
        </Title>
        <ColorGrid onColorPick={onPressColor} />
      </Pressable>
    </Animated.View>
  );
};

export { ColorPickerModal };
