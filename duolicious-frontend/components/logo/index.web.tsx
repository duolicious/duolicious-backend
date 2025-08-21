import { useEffect, useRef, useMemo } from 'react';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { G, Rect } from 'react-native-svg';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

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

const Logo16 = ({
  size = 48,
  color = 'white',
  rectSize = 0.26458332,
  fadeOutDelay = 5000,
  fadeInDelay = 500,
  doAnimate = false,
}: {
  size?: number,
  color?: string,
  rectSize?: number,
  fadeOutDelay?: number,
  fadeInDelay?: number,
  doAnimate?: boolean,
}) => {
  // ---- One shared "clock" per Logo16 ----
  const progress = useRef(useSharedValue(0)).current;

  // Precompute the timeline constants once per render
  const timeline = useMemo(() => {
    const COUNT = logo16RectCoordinates.length;
    const STAGGER = 40;
    const FADE = 400;
    const IN_WINDOW = (COUNT - 1) * STAGGER + FADE;
    const T1 = IN_WINDOW;
    const T2 = T1 + fadeOutDelay;
    const T3 = T2 + IN_WINDOW;
    const T4 = T3 + fadeInDelay; // total duration
    return { COUNT, STAGGER, FADE, T1, T2, T3, T4 };
  }, [fadeOutDelay, fadeInDelay]);

  useEffect(() => {
    if (!doAnimate) {
      cancelAnimation(progress);
      return;
    }

    progress.value = 0;
    progress.value = withRepeat(
      withTiming(timeline.T4, { duration: timeline.T4, easing: Easing.linear }),
      -1,
      false
    );

    return () => {
      cancelAnimation(progress);
    };
  }, [doAnimate, progress, timeline.T4]);

  // Child component so we can use hooks without breaking the Rules of Hooks
  const AnimatedLogoRect = ({
    coord,
    index,
  }: {
    coord: { x: number; y: number };
    index: number;
  }) => {
    const animatedProps = useAnimatedProps(() => {
      // When animation is disabled, keep all rects visible
      if (!doAnimate) {
        return { opacity: 1 as number };
      }

      // Single timeline ("clock") drives all rects
      const t = progress.value % timeline.T4;

      const inStart = index * timeline.STAGGER;
      const inEnd = inStart + timeline.FADE;

      const outStart = timeline.T2 + index * timeline.STAGGER;
      const outEnd = outStart + timeline.FADE;

      // piecewise opacity curve with Easing.poly(5)
      let opacity = 0;

      if (t >= inStart && t <= inEnd) {
        const p = (t - inStart) / timeline.FADE;
        opacity = Easing.poly(5)(p); // 0 -> 1
      } else if (t > inEnd && t < outStart) {
        opacity = 1;
      } else if (t >= outStart && t <= outEnd) {
        const p = (t - outStart) / timeline.FADE;
        opacity = 1 - Easing.poly(5)(p); // 1 -> 0
      } else {
        opacity = 0;
      }

      return { opacity: opacity as number };
    });

    return (
      <AnimatedRect
        width={rectSize}
        height={rectSize}
        x={coord.x}
        y={coord.y}
        fill={color}
        // animatedProps uses the single shared clock
        animatedProps={animatedProps}
      />
    );
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 4.2333331 4.2333332">
      <G>
        {logo16RectCoordinates.map((coord, index) => (
          <AnimatedLogoRect key={index} coord={coord} index={index} />
        ))}
      </G>
    </Svg>
  );
};

const Logo14 = ({
  size = 42,
  color = 'white',
  rectSize = 0.26458332
}: {
  size?: number,
  color?: string,
  rectSize?: number,
}) => {
  return (
    <Svg
       width={size}
       height={size}
       viewBox="0 0 3.7041665 3.7041666"
    >
      <G>
        <Rect
           fill={color} strokeWidth="1" strokeLinecap="round" strokeDashoffset="6.8276"
           id="Rect499"
           width={rectSize}
           height={rectSize}
           x="2.1166666"
           y="0.79374993" />
        <Rect
           fill={color} strokeWidth="1" strokeLinecap="round" strokeDashoffset="6.8276"
           id="Rect501"
           width={rectSize}
           height={rectSize}
           x="2.3812499"
           y="0.79374993" />
        <Rect
           fill={color} strokeWidth="1" strokeLinecap="round" strokeDashoffset="6.8276"
           id="Rect503"
           width={rectSize}
           height={rectSize}
           x="1.8520831"
           y="1.0583333" />
        <Rect
           fill={color} strokeWidth="1" strokeLinecap="round" strokeDashoffset="6.8276"
           id="Rect505"
           width={rectSize}
           height={rectSize}
           x="1.8520831"
           y="1.3229166" />
        <Rect
           fill={color} strokeWidth="1" strokeLinecap="round" strokeDashoffset="6.8276"
           id="Rect507"
           width={rectSize}
           height={rectSize}
           x="2.1166666"
           y="1.5875" />
        <Rect
           fill={color} strokeWidth="1" strokeLinecap="round" strokeDashoffset="6.8276"
           id="Rect509"
           width={rectSize}
           height={rectSize}
           x="2.3812499"
           y="1.8520832" />
        <Rect
           fill={color} strokeWidth="1" strokeLinecap="round" strokeDashoffset="6.8276"
           id="Rect511"
           width={rectSize}
           height={rectSize}
           x="2.6458333"
           y="2.1166666" />
        <Rect
           fill={color} strokeWidth="1" strokeLinecap="round" strokeDashoffset="6.8276"
           id="Rect513"
           width={rectSize}
           height={rectSize}
           x="2.9104166"
           y="1.8520832" />
        <Rect
           fill={color} strokeWidth="1" strokeLinecap="round" strokeDashoffset="6.8276"
           id="Rect515"
           width={rectSize}
           height={rectSize}
           x="3.175"
           y="1.5875" />
        <Rect
           fill={color} strokeWidth="1" strokeLinecap="round" strokeDashoffset="6.8276"
           id="Rect517"
           width={rectSize}
           height={rectSize}
           x="3.4395831"
           y="1.3229166" />
        <Rect
           fill={color} strokeWidth="1" strokeLinecap="round" strokeDashoffset="6.8276"
           id="Rect519"
           width={rectSize}
           height={rectSize}
           x="3.4395831"
           y="1.0583333" />
        <Rect
           fill={color} strokeWidth="1" strokeLinecap="round" strokeDashoffset="6.8276"
           id="Rect521"
           width={rectSize}
           height={rectSize}
           x="2.6458333"
           y="1.0583333" />
        <Rect
           fill={color} strokeWidth="1" strokeLinecap="round" strokeDashoffset="6.8276"
           id="Rect523"
           width={rectSize}
           height={rectSize}
           x="2.9104166"
           y="0.79374993" />
        <Rect
           fill={color} strokeWidth="1" strokeLinecap="round" strokeDashoffset="6.8276"
           id="Rect525"
           width={rectSize}
           height={rectSize}
           x="3.175"
           y="0.79374993" />
        <Rect
           fill={color} strokeWidth="1" strokeLinecap="round" strokeDashoffset="6.8276"
           id="Rect499-7"
           width={rectSize}
           height={rectSize}
           x={rectSize}
           y="1.3229166" />
        <Rect
           fill={color} strokeWidth="1" strokeLinecap="round" strokeDashoffset="6.8276"
           id="Rect501-5"
           width={rectSize}
           height={rectSize}
           x="0.5291667"
           y="1.3229166" />
        <Rect
           fill={color} strokeWidth="1" strokeLinecap="round" strokeDashoffset="6.8276"
           id="Rect503-3"
           width={rectSize}
           height={rectSize}
           x="3.4701156e-08"
           y="1.5875002" />
        <Rect
           fill={color} strokeWidth="1" strokeLinecap="round" strokeDashoffset="6.8276"
           id="Rect505-5"
           width={rectSize}
           height={rectSize}
           x="3.4701156e-08"
           y="1.8520832" />
        <Rect
           fill={color} strokeWidth="1" strokeLinecap="round" strokeDashoffset="6.8276"
           id="Rect507-6"
           width={rectSize}
           height={rectSize}
           x={rectSize}
           y="2.1166666" />
        <Rect
           fill={color} strokeWidth="1" strokeLinecap="round" strokeDashoffset="6.8276"
           id="Rect509-2"
           width={rectSize}
           height={rectSize}
           x="0.5291667"
           y="2.3812499" />
        <Rect
           fill={color} strokeWidth="1" strokeLinecap="round" strokeDashoffset="6.8276"
           id="Rect511-9"
           width={rectSize}
           height={rectSize}
           x="0.79375011"
           y="2.6458333" />
        <Rect
           fill={color} strokeWidth="1" strokeLinecap="round" strokeDashoffset="6.8276"
           id="Rect513-1"
           width={rectSize}
           height={rectSize}
           x="1.0583332"
           y="2.3812499" />
        <Rect
           fill={color} strokeWidth="1" strokeLinecap="round" strokeDashoffset="6.8276"
           id="Rect515-2"
           width={rectSize}
           height={rectSize}
           x="1.3229165"
           y="2.1166666" />
        <Rect
           fill={color} strokeWidth="1" strokeLinecap="round" strokeDashoffset="6.8276"
           id="Rect517-7"
           width={rectSize}
           height={rectSize}
           x="1.5874999"
           y="1.8520832" />
        <Rect
           fill={color} strokeWidth="1" strokeLinecap="round" strokeDashoffset="6.8276"
           id="Rect519-0"
           width={rectSize}
           height={rectSize}
           x="1.5874999"
           y="1.5875002" />
        <Rect
           fill={color} strokeWidth="1" strokeLinecap="round" strokeDashoffset="6.8276"
           id="Rect521-9"
           width={rectSize}
           height={rectSize}
           x="0.79375011"
           y="1.5875002" />
        <Rect
           fill={color} strokeWidth="1" strokeLinecap="round" strokeDashoffset="6.8276"
           id="Rect523-3"
           width={rectSize}
           height={rectSize}
           x="1.0583332"
           y="1.3229166" />
        <Rect
           fill={color} strokeWidth="1" strokeLinecap="round" strokeDashoffset="6.8276"
           id="Rect525-6"
           width={rectSize}
           height={rectSize}
           x="1.3229165"
           y="1.3229166" />
      </G>
    </Svg>
  );
};

export {
  Logo16,
  Logo14,
};
