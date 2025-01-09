import * as React from 'react';
import { Animated, Easing } from 'react-native';
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
  // Create an array of Animated.Values, one per Rect.
  const animatedValues = React.useRef(
    logo16RectCoordinates.map(() => new Animated.Value(doAnimate ? 0 : 1))
  ).current;

  // Ref to store the animation instance
  const animationRef = React.useRef<Animated.CompositeAnimation | null>(null);

  React.useEffect(() => {
    if (!doAnimate) {
      return;
    }

    // Create the animation sequence
    const animation = Animated.loop(
      Animated.sequence([
        Animated.stagger(
          40,
          animatedValues.map(animVal =>
            Animated.timing(animVal, {
              toValue: 1,
              duration: 400,
              easing: Easing.poly(5),
              useNativeDriver: true,
            })
          )
        ),
        Animated.delay(fadeOutDelay),
        Animated.stagger(
          40,
          animatedValues.map(animVal =>
            Animated.timing(animVal, {
              toValue: 0,
              duration: 400,
              easing: Easing.poly(5),
              useNativeDriver: true,
            })
          )
        ),
        Animated.delay(fadeInDelay),
      ])
    );

    // Store the animation reference and start it
    animationRef.current = animation;
    animation.start();

    // Cleanup function to stop the animation
    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
      }
    };
  }, [animatedValues, doAnimate, fadeOutDelay, fadeInDelay]);

  return (
    <Svg width={size} height={size} viewBox="0 0 4.2333331 4.2333332">
      <G>
        {logo16RectCoordinates.map((coord, index) => (
          <AnimatedRect
            key={index}
            width={rectSize}
            height={rectSize}
            x={coord.x}
            y={coord.y}
            fill={color}
            opacity={animatedValues[index]}
          />
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

