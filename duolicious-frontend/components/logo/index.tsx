import { useMemo } from 'react';
import { Easing, useDerivedValue } from 'react-native-reanimated';
import {
  Canvas,
  Group,
  Rect as SkiaRect,
  useClock,
} from '@shopify/react-native-skia';

// ---- Same coordinates as before ----
const logo16RectCoordinates = [
  { x: 1.5875,     y: 1.5875    },
  { x: 1.3229166,  y: 1.5875    },
  { x: 1.0583335,  y: 1.8520836 },
  { x: 0.79375011, y: 1.5875    },
  { x: 0.52916676, y: 1.5875    },
  { x: 0.26458347, y: 1.8520836 },
  { x: 0.26458347, y: 2.1166666 },
  { x: 0.52916676, y: 2.3812499 },
  { x: 0.79375011, y: 2.6458333 },
  { x: 1.0583335,  y: 2.9104166 },
  { x: 1.3229166,  y: 2.6458333 },
  { x: 1.5875,     y: 2.3812499 },
  { x: 1.8520833,  y: 2.1166666 },
  { x: 1.8520833,  y: 1.8520836 },
  { x: 2.1166666,  y: 1.5875    },
  { x: 2.1166666,  y: 1.3229166 },
  { x: 2.3812499,  y: 1.0583333 },
  { x: 2.6458333,  y: 1.0583333 },
  { x: 2.9104166,  y: 1.3229166 },
  { x: 3.175,      y: 1.0583333 },
  { x: 3.4395833,  y: 1.0583333 },
  { x: 3.7041664,  y: 1.3229166 },
  { x: 3.7041664,  y: 1.5875    },
  { x: 3.4395833,  y: 1.8520833 },
  { x: 3.175,      y: 2.1166666 },
  { x: 2.9104166,  y: 2.3812499 },
  { x: 2.6458333,  y: 2.1166666 },
  { x: 2.3812499,  y: 1.8520833 },
];

type Logo16Props = {
  size?: number;
  color?: string;
  rectSize?: number;
  fadeOutDelay?: number;
  fadeInDelay?: number;
  doAnimate?: boolean;
};

const VIEWBOX_16 = 4.2333331;

const ease = Easing.poly(5); // used inside worklets

const Logo16 = ({
  size = 48,
  color = 'white',
  rectSize = 0.26458332,
  fadeOutDelay = 5000,
  fadeInDelay = 500,
  doAnimate = false,
}: Logo16Props) => {
  // Single clock driving all rects (UI thread)
  const clock = useClock();

  // Precompute timeline constants (captured by worklets as plain numbers)
  const timeline = useMemo(() => {
    const COUNT = logo16RectCoordinates.length;
    const STAGGER = 40;
    const FADE = 400;
    const IN_WINDOW = (COUNT - 1) * STAGGER + FADE;
    const T1 = IN_WINDOW;
    const T2 = T1 + fadeOutDelay;
    const T3 = T2 + IN_WINDOW;
    const T4 = T3 + fadeInDelay; // total duration (loop)
    return { COUNT, STAGGER, FADE, T1, T2, T3, T4 };
  }, [fadeOutDelay, fadeInDelay]);

  // Child so each rect can have its own derived opacity without breaking hook rules
  const AnimatedLogoRect = ({
    coord,
    index,
  }: {
    coord: { x: number; y: number };
    index: number;
  }) => {
    const { STAGGER, FADE, T2, T4 } = timeline;

    const opacity = useDerivedValue(() => {
      // When animation is disabled, keep all rects visible
      if (!doAnimate) {
        return 1;
      }
      const t = clock.value % T4;

      const inStart = index * STAGGER;
      const inEnd = inStart + FADE;

      const outStart = T2 + index * STAGGER;
      const outEnd = outStart + FADE;

      // piecewise opacity curve using Easing.poly(5)
      if (t >= inStart && t <= inEnd) {
        const p = (t - inStart) / FADE;
        return ease(p); // 0 -> 1
      } else if (t > inEnd && t < outStart) {
        return 1;
      } else if (t >= outStart && t <= outEnd) {
        const p = (t - outStart) / FADE;
        return 1 - ease(p); // 1 -> 0
      }
      return 0;
    }, [clock, doAnimate, STAGGER, FADE, T2, T4, index]);

    return (
      <SkiaRect
        x={coord.x}
        y={coord.y}
        width={rectSize}
        height={rectSize}
        color={color}
        opacity={opacity}
      />
    );
  };

  return (
    <Canvas style={{ width: size, height: size }}>
      <Group transform={[{ scale: size / VIEWBOX_16 }]}>
        {logo16RectCoordinates.map((coord, index) => (
          <AnimatedLogoRect key={index} coord={coord} index={index} />
        ))}
      </Group>
    </Canvas>
  );
};

// ---------------- Logo14 (static) ----------------

type Logo14Props = {
  size?: number;
  color?: string;
  rectSize?: number;
};

const VIEWBOX_14 = 3.7041666;

const Logo14 = ({
  size = 42,
  color = 'white',
  rectSize = 0.26458332,
}: Logo14Props) => {
  return (
    <Canvas style={{ width: size, height: size }}>
      <Group transform={[{ scale: size / VIEWBOX_14 }]}>
        <SkiaRect color={color} width={rectSize} height={rectSize} x={2.1166666} y={0.79374993} />
        <SkiaRect color={color} width={rectSize} height={rectSize} x={2.3812499} y={0.79374993} />
        <SkiaRect color={color} width={rectSize} height={rectSize} x={1.8520831} y={1.0583333} />
        <SkiaRect color={color} width={rectSize} height={rectSize} x={1.8520831} y={1.3229166} />
        <SkiaRect color={color} width={rectSize} height={rectSize} x={2.1166666} y={1.5875} />
        <SkiaRect color={color} width={rectSize} height={rectSize} x={2.3812499} y={1.8520832} />
        <SkiaRect color={color} width={rectSize} height={rectSize} x={2.6458333} y={2.1166666} />
        <SkiaRect color={color} width={rectSize} height={rectSize} x={2.9104166} y={1.8520832} />
        <SkiaRect color={color} width={rectSize} height={rectSize} x={3.175} y={1.5875} />
        <SkiaRect color={color} width={rectSize} height={rectSize} x={3.4395831} y={1.3229166} />
        <SkiaRect color={color} width={rectSize} height={rectSize} x={3.4395831} y={1.0583333} />
        <SkiaRect color={color} width={rectSize} height={rectSize} x={2.6458333} y={1.0583333} />
        <SkiaRect color={color} width={rectSize} height={rectSize} x={2.9104166} y={0.79374993} />
        <SkiaRect color={color} width={rectSize} height={rectSize} x={3.175} y={0.79374993} />
        <SkiaRect color={color} width={rectSize} height={rectSize} x={rectSize} y={1.3229166} />
        <SkiaRect color={color} width={rectSize} height={rectSize} x={0.5291667} y={1.3229166} />
        <SkiaRect color={color} width={rectSize} height={rectSize} x={0} y={1.5875002} />
        <SkiaRect color={color} width={rectSize} height={rectSize} x={0} y={1.8520832} />
        <SkiaRect color={color} width={rectSize} height={rectSize} x={rectSize} y={2.1166666} />
        <SkiaRect color={color} width={rectSize} height={rectSize} x={0.5291667} y={2.3812499} />
        <SkiaRect color={color} width={rectSize} height={rectSize} x={0.79375011} y={2.6458333} />
        <SkiaRect color={color} width={rectSize} height={rectSize} x={1.0583332} y={2.3812499} />
        <SkiaRect color={color} width={rectSize} height={rectSize} x={1.3229165} y={2.1166666} />
        <SkiaRect color={color} width={rectSize} height={rectSize} x={1.5874999} y={1.8520832} />
        <SkiaRect color={color} width={rectSize} height={rectSize} x={1.5874999} y={1.5875002} />
        <SkiaRect color={color} width={rectSize} height={rectSize} x={0.79375011} y={1.5875002} />
        <SkiaRect color={color} width={rectSize} height={rectSize} x={1.0583332} y={1.3229166} />
        <SkiaRect color={color} width={rectSize} height={rectSize} x={1.3229165} y={1.3229166} />
      </Group>
    </Canvas>
  );
};

export { Logo16, Logo14 };
