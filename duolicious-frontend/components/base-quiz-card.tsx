/*
 * Adapted from https://github.com/3DJakob/react-tinder-card at v1.6.2
 *
 */

import {
  ReactNode,
  Ref,
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
} from 'react';
import {
  Dimensions,
  PanResponder,
  RegisteredStyle,
  StyleProp,
  View,
  ViewStyle,
} from 'react-native';
import { useSpring, animated } from '@react-spring/native';

type Direction = 'left' | 'right' | 'up' | 'down' | 'none'
type SwipeHandler = (direction: Direction) => void
type CardLeftScreenHandler = (direction: Direction) => void
type SwipeRequirementFufillUpdate = (direction: Direction) => void
type SwipeRequirementUnfufillUpdate = () => void

interface API {
  /**
   * Programmatically trigger a swipe of the card in one of the valid directions `'left'`, `'right'`, `'up'` and `'down'`. This function, `swipe`, can be called on a reference of the BaseQuizCard instance.
   *
   * @param dir The direction in which the card should be swiped. One of: `'left'`, `'right'`, `'up'` and `'down'`.
   */
  swipe(dir?: Direction): Promise<void>

  /**
   * Restore swiped-card state. Use this function if you want to undo a swiped-card (e.g. you have a back button that shows last swiped card or you have a reset button. The promise is resolved once the card is returned
   */
   restoreCard (): Promise<void>
}

interface Props {
  ref?: Ref<API>

  /**
   * Callback that will be executed when a swipe has been completed. It will be called with a single string denoting which direction the swipe was in: `'left'`, `'right'`, `'up'` or `'down'`.
   */
  onSwipe?: SwipeHandler

  /**
   * Callback that will be executed when a `BaseQuizCard` has left the screen. It will be called with a single string denoting which direction the swipe was in: `'left'`, `'right'`, `'up'` or `'down'`.
   */
  onCardLeftScreen?: CardLeftScreenHandler

  /**
   * An array of directions for which to prevent swiping out of screen. Valid arguments are `'left'`, `'right'`, `'up'` and `'down'`.
   *
   * @default []
   */
  preventSwipe?: string[]

   /**
   * The threshold of which to accept swipes. If swipeRequirementType is set to velocity it is the velocity threshold and if set to position it is the position threshold.
   * On native the default value is 1 as the physics works differently there.
   * If swipeRequirementType is set to position it is recommended to set this based on the screen width so cards can be swiped on all screen sizes.
   *
   * @default 300
   */
  swipeThreshold?: number

  /**
   * Style to add to the container.
   */
  containerStyle?: RegisteredStyle<ViewStyle>

  /**
   * The children passed in is what will be rendered as the actual card.
   */
  children?: ReactNode

  initialPosition?: Direction

  leftComponent?: JSX.Element
  rightComponent?: JSX.Element
  downComponent?: JSX.Element
}

const { height, width } = Dimensions.get('window');

const settings = {
  maxTilt: 20, // in deg
  rotationPower: 50,
  swipeThreshold: 0.5 // need to update this threshold for RN (1.5 seems reasonable...?)
}

// physical properties of the spring
const physics = {
  animateOut: {
    friction: 30,
    tension: 400
  },
  animateBack: {
    friction: 20,
    tension: 200
  }
}

const pythagoras = (x, y) => {
  return Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2))
}

const normalize = (vector) => {
  const length = Math.sqrt(Math.pow(vector.x, 2) + Math.pow(vector.y, 2))
  return { x: vector.x / length, y: vector.y / length }
}

const rotateByDx = (dx) => {
  return Math.max(Math.min(dx * 0.05, settings.maxTilt), -settings.maxTilt)
}

const finalXyrot = (gesture) => {
  const finalX = diagonal() * normalize(gesture).x
  const finalY = diagonal() * normalize(gesture).y
  const finalRotation = rotateByDx(finalX)

  return {x: finalX, y: finalY, rot: finalRotation};
}

const diagonal = () => pythagoras(height, width)

const animateOut = async (gesture, setSpringTarget, dir?: Direction) => {
  const normalizedGesture = (() => {
    if (dir === 'right')
      return { x: Math.max( 2, gesture.x), y: gesture.y }
    if (dir === 'left')
      return { x: Math.min(-2, gesture.x), y: gesture.y }
    if (dir === 'up')
      return { x: gesture.x              , y: Math.min(-2, gesture.y) }
    if (dir === 'down')
      return { x: gesture.x              , y: Math.max( 2, gesture.y) }

    return gesture
  })();

  const velocity = pythagoras(normalizedGesture.x, normalizedGesture.y)
  const duration = diagonal() / velocity

  setSpringTarget.current[0].start({
    ...finalXyrot(normalizedGesture),
    config: { duration: duration }
  })

  // for now animate back
  return await new Promise((resolve) =>
    setTimeout(() => {
      resolve(undefined);
    }, duration)
  )
}

const animateBack = (setSpringTarget) => {
  // translate back to the initial position
  return new Promise((resolve) => {
    setSpringTarget.current[0].start({ x: 0, y: 0, rot: 0, config: physics.animateBack, onRest: resolve })
  })
}

const getSwipeDirection = (
  property,
  swipeThreshold = settings.swipeThreshold
): Direction => {
  if (Math.abs(property.x) > Math.abs(property.y)) {
    if (property.x > swipeThreshold) {
      return 'right'
    } else if (property.x < -swipeThreshold) {
      return 'left'
    }
  } else {
    if (property.y > swipeThreshold) {
      return 'down'
    } else if (property.y < -swipeThreshold) {
      return 'up'
    }
  }
  return 'none'
}

// must be created outside of the BaseQuizCard forwardRef
const AnimatedView = animated(View)

const BaseQuizCard = forwardRef(
  (
    {
      children,
      onSwipe,
      onCardLeftScreen,
      preventSwipe = [],
      swipeThreshold = settings.swipeThreshold,
      containerStyle,
      initialPosition,
      leftComponent,
      rightComponent,
      downComponent
    }: Props,
    ref
  ) => {
    const isAnimating = useRef(false);

    const startPosition = (() => {
      if (initialPosition === 'left')  return finalXyrot({x: -1, y:  0})
      if (initialPosition === 'right') return finalXyrot({x:  1, y:  0})
      if (initialPosition === 'up')    return finalXyrot({x:  0, y: -1})
      if (initialPosition === 'down')  return finalXyrot({x:  0, y:  1})
      return {x: 0, y: 0, rot: 0};
    })()

    const [{ x, y, rot }, setSpringTarget] = useSpring(() => ({
      ...startPosition,
    }))
    settings.swipeThreshold = swipeThreshold

    useImperativeHandle(ref, () => ({
      async swipe (dir: Direction = 'right') {
        if (isAnimating.current) return;
        isAnimating.current = true;

        if (onSwipe) onSwipe(dir)
        const power = 2.0
        const disturbance = (Math.random() - 0.5) / 2
        if (dir === 'right') {
          await animateOut({ x:  power, y: disturbance }, setSpringTarget)
        } else if (dir === 'left') {
          await animateOut({ x: -power, y: disturbance }, setSpringTarget)
        } else if (dir === 'up') {
          await animateOut({ x: disturbance, y: -power }, setSpringTarget)
        } else if (dir === 'down') {
          await animateOut({ x: disturbance, y:  power }, setSpringTarget)
        }
        if (onCardLeftScreen) onCardLeftScreen(dir)

        isAnimating.current = false;
      },
      async restoreCard () {
        if (isAnimating.current) return;
        isAnimating.current = true;

        await animateBack(setSpringTarget)

        isAnimating.current = false;
      }
    }));

    const handleSwipeReleased = useCallback(
      async (setSpringTarget, gesture) => {
        if (isAnimating.current) return;
        isAnimating.current = true;

        // Check if this is a swipe
        const dir = getSwipeDirection({
          x: gesture.dx,
          y: gesture.dy,
        });

        if (dir === 'none' || preventSwipe.includes(dir)) {
          // Card was not flicked away, animate back to start
          await animateBack(setSpringTarget)
        } else {
          if (onSwipe) onSwipe(dir)

          await animateOut(
            {x: gesture.vx, y: gesture.vy},
            setSpringTarget,
            dir,
          )

          if (onCardLeftScreen) onCardLeftScreen(dir)
        }

        isAnimating.current = false;
      },
      [onSwipe, onCardLeftScreen, preventSwipe]
    );

    const panResponder = useRef(
      PanResponder.create({
        // Ask to be the responder:
        onStartShouldSetPanResponder:
          (evt, gestureState) => false,
        onStartShouldSetPanResponderCapture:
          (evt, gestureState) => false,
        onMoveShouldSetPanResponder:
          (evt, gestureState) => !isAnimating.current,
        onMoveShouldSetPanResponderCapture:
          (evt, gestureState) => !isAnimating.current,

        onPanResponderGrant: (evt, gestureState) => {
          // The gesture has started.
          // Probably wont need this anymore as position relative to swipe!
          setSpringTarget.current[0].start({
            x: gestureState.dx,
            y: gestureState.dy,
            rot: 0,
            immediate: true,
          })
        },
        onPanResponderMove: (evt, gestureState) => {
          // use guestureState.vx / guestureState.vy for velocity calculations
          // translate element
          setSpringTarget.current[0].start({
            x: gestureState.dx,
            y: gestureState.dy,
            rot: rotateByDx(gestureState.dx),
            immediate: true,
          })
        },
        onPanResponderTerminationRequest: (evt, gestureState) => {
          return true;
        },
        onPanResponderRelease: (evt, gestureState) => {
          // The user has released all touches while this view is the
          // responder. This typically means a gesture has succeeded
          // enable
          handleSwipeReleased(setSpringTarget, gestureState)
        }
      })
    ).current;

    return (
      <AnimatedView
        {...panResponder.panHandlers}
        style={[
          {
            transform: [
              { translateX: x },
              { translateY: y },
              { rotate: rot.to((rot) => `${rot}deg`) }
            ],
          },
          containerStyle
        ]}
      >
        <AnimatedView
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            zIndex: x.to((x) => Math.round(Math.abs(x))),
            opacity: x.to((x) =>
              getSwipeDirection({x, y: y.get()}, 0) === 'left' ?
                Math.max(0.0, - x * 0.01 - 0.5) :
                0.0
            ),
            transform: [
              { rotate: rot.to((rot) => `${-rot}deg`) }
            ],
          }}
        >
          {leftComponent}
        </AnimatedView>
        <AnimatedView
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            zIndex: x.to((x) => Math.round(Math.abs(x))),
            opacity: x.to((x) =>
              getSwipeDirection({x, y: y.get()}, 0) === 'right' ?
                Math.max(0.0, x * 0.01 - 0.5) :
                0.0
            ),
            transform: [
              { rotate: rot.to((rot) => `${-rot}deg`) }
            ],
          }}
        >
          {rightComponent}
        </AnimatedView>
        <AnimatedView
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            zIndex: y.to((y) => Math.round(Math.abs(y))),
            opacity: y.to((y) =>
              getSwipeDirection({x: x.get(), y}, 0) === 'down' ?
                Math.max(0.0, y * 0.01 - 0.5) :
                0.0
            ),
            transform: [
              { rotate: rot.to((rot) => `${-rot}deg`) }
            ],
          }}
        >
          {downComponent}
        </AnimatedView>
        {children}
      </AnimatedView>
    )
  }
)

export {
  BaseQuizCard,
  Direction,
}
