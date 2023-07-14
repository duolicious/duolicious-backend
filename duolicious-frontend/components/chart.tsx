import {
  Animated,
  LayoutAnimation,
  Pressable,
  View,
} from 'react-native';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { DefaultText } from './default-text';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ArrowLeft, ArrowRight } from "react-native-feather";

const Chart = ({name1, percentage1, name2, percentage2, ...props}) => {
  const {
    children,
    dimensionName,
    minLabel,
    maxLabel,
    showScoreBumper = true,
  } = props;

  const compact = name1 === null && !name2;

  const [expanded, setExpanded] = useState(false);
  const [bump, setBump] = useState<number>(0.0);

  const { opacity, scaleXY } = LayoutAnimation.Properties;
  const { easeInEaseOut, linear } = LayoutAnimation.Types;

  const animatedBackgroundColor = useRef(new Animated.Value(1)).current;
  const animatedBumpOpacity = useRef(new Animated.Value(0)).current;
  const animatedBumpScale = useRef(new Animated.Value(0)).current;

  const backgroundColor = animatedBackgroundColor.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(222,222,222, 1)', 'rgba(255,255,255, 1)'],
    extrapolate: 'clamp',
  });

  const bumpLeftOpacity = animatedBumpOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.2],
    extrapolate: 'clamp',
  });

  const bumpRightOpacity = animatedBumpOpacity.interpolate({
    inputRange: [-1, 0],
    outputRange: [0.2, 1],
    extrapolate: 'clamp',
  });

  const bumpLeftScale = animatedBumpScale.interpolate({
    inputRange: [-1, 1],
    outputRange: [1.3, 0.7],
    extrapolate: 'clamp',
  });

  const bumpRightScale = animatedBumpScale.interpolate({
    inputRange: [-1, 1],
    outputRange: [0.7, 1.3],
    extrapolate: 'clamp',
  });

  const onPressChart = useCallback(() => {
    LayoutAnimation.configureNext({
      duration: 100,
      update: { type: easeInEaseOut, property: scaleXY }
    });
    setExpanded(expanded => !expanded);
  }, [setExpanded]);

  const onPressInChart = useCallback(() => {
    Animated.timing(animatedBackgroundColor, {
      toValue: 0,
      duration: 100,
      useNativeDriver: false,
    }).start();
  }, []);

  const onPressOutChart = useCallback(() => {
    Animated.timing(animatedBackgroundColor, {
      toValue: 1,
      duration: 150,
      useNativeDriver: false,
    }).start();
  }, []);

  if (dimensionName && (minLabel || maxLabel)) {
    throw new Error("dimensionName can't be set at the same time as minLabel or maxLabel");
  }

  const clamp = (x: number, min: number, max: number) => {
    return Math.min(max, Math.max(min, x));
  };

  const labelPercentage = (percentage: number | undefined) => {
    if (percentage === undefined) return undefined;
    if (minLabel || maxLabel) return clamp(2 * Math.abs(percentage - 50), 0, 100);
    return percentage;
  };

  const bumpEqualsZero = useCallback((bump: number) => {
    return Math.abs(bump) < 1e-5;
  }, []);

  const canBumpUp =
    bump < +1e-5 && ((percentage2 ?? 0) + bump) < (1 - 1e-5);

  const canBumpDown =
    bump > -1e-5 && ((percentage2 ?? 0) + bump) > ((dimensionName ? 0 : -1) + 1e-5);

  useEffect(() => {
    const animatedValueOpacity = (() => {
      if (canBumpUp && canBumpDown) return 0;
      return canBumpUp ? 1 : -1;
    })();
    const animatedValueScale = (() => {
      if (bumpEqualsZero(bump)) return 0;
      return bump > 1e-5 ? 1 : -1;
    })();

    Animated.parallel([
      Animated.timing(animatedBumpOpacity, {
        toValue: animatedValueOpacity,
        duration: 100,
        useNativeDriver: false,
      }),
      Animated.timing(animatedBumpScale, {
        toValue: animatedValueScale,
        duration: 100,
        useNativeDriver: false,
      }),
    ]).start();
  }, [canBumpUp, canBumpDown, bump]);

  const bumpX = useCallback((currentBump: number, bumpSize: number) => {
    LayoutAnimation.configureNext({
      duration: 100,
      create: { type: linear, property: opacity },
      update: { type: easeInEaseOut, property: scaleXY },
      delete: { type: linear, property: opacity }
    });

    if (bumpEqualsZero(currentBump)) {
      let bumpResult = (percentage2 ?? 0) + bumpSize;
      bumpResult = clamp(bumpResult, dimensionName ? 0 : -1, 1);
      return bumpResult - (percentage2 ?? 0);
    } else if (currentBump > 0) {
      if (bumpSize > 1e-5) {
        return currentBump;
      } else {
        return 0;
      }
    } else if (currentBump < 0) {
      if (bumpSize < 1e-5) {
        return currentBump;
      } else {
        return 0;
      }
    } else {
      return 0; // Should never happen
    }
  }, [percentage2, dimensionName]);

  const bumpLeft  = useCallback(() => {
    setBump((bump) => bumpX(bump, -10));
  }, [bumpX]);

  const bumpRight = useCallback(() => {
    setBump((bump) => bumpX(bump, +10));
  }, [bumpX]);

  const minLabel_ = minLabel ? `100%` : '0%';
  const maxLabel_ = maxLabel ? `100%` : '100%';

  const Tick = useCallback(({position, color, ...props}) => {
    const {label, labelPercentage, extraHeight, round = false} = props;

    const position_ = position && Math.round(position);
    const extraHeight_ = extraHeight || 0;

    const labelPosition = position_ < 50 ?
      {left: `${position_}%`} :
      {right: `${100 - position_}%`};

    return <>
      {
        position_ !== undefined && <View
          style={{
            position: 'absolute',
            left: `${position_}%`,
            marginLeft: round ? -5 : (label === undefined ? 0 : -1),
            backgroundColor: color,
            top: 40 - extraHeight_ - (compact ? 40 : 0),
            width: round ? 11 : (label === undefined ? 1 : 3),
            height: 11 + extraHeight_,
            borderRadius: 999,
          }}
        />
      }
      {
        position_ !== undefined && label && <DefaultText
          style={{
            position: 'absolute',
            ...labelPosition,
            top: 20 - extraHeight_,
            color: color,
            fontWeight: '600',
          }}
        >
          {label} <DefaultText style={{fontWeight: '400'}}>
            ({labelPercentage}%)
          </DefaultText>
        </DefaultText>
      }
      {
        position_ !== undefined && label === null && <DefaultText
          style={{
            position: 'absolute',
            ...labelPosition,
            marginLeft: 10,
            marginRight: 10,
            top: -5,
            color: color,
          }}
        >
          {labelPercentage}%
        </DefaultText>
      }
      {
        position_ === undefined && (label || label === null) && <View
          style={{
            width: '100%',
            position: 'absolute',
            top: label === null ? -5 : (20 - extraHeight_),
            flexDirection: 'row',
            justifyContent: 'center',
          }}
        >
          <DefaultText
            style={{
              color: color,
              fontWeight: '600',
              backgroundColor: label === null ? 'white' : undefined,
              borderRadius: 5,
            }}
          >
            {label}<DefaultText style={{fontWeight: '400'}}>
              {' '}(Not enough Q&A answers){' '}
            </DefaultText>
          </DefaultText>
        </View>
      }
    </>
  }, [compact]);

  const TraitInfoButton = useCallback(() => {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <DefaultText style={{color: '#888'}}>
          {expanded ? 'Hide ' : ''}Details
        </DefaultText>
        <Ionicons
          style={{
            color: '#888',
            fontSize: 16,
          }}
          name={expanded ? 'chevron-up' : 'chevron-down'}
        />
      </View>
    );
  }, [expanded]);

  return (
    <Animated.View
      style={{
        backgroundColor: backgroundColor,
        borderRadius: 5,
        marginTop: 10,
        marginBottom: 10,
        shadowOffset: {
          width: 0,
          height: 3,
        },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 8,
        overflow: 'hidden',
      }}
    >
      <Pressable
        style={{
          padding: 10,
        }}
        onPress={onPressChart}
        onPressIn={onPressInChart}
        onPressOut={onPressOutChart}
      >
        <View
          style={{
            width: '100%',
          }}
        >
          <View
            style={{
              position: 'absolute',
              top: compact ? 5 : 45,
              backgroundColor: '#ddd',
              height: 1,
              width: '100%',
            }}
          />

          <View
            style={{
              marginTop: 60 - (compact ? 40 : 0),
              flexDirection: 'row',
            }}
          >
            <DefaultText style={{flex: 1, textAlign: 'left', color: "#666"}}>
              {minLabel_}
            </DefaultText>
            {(minLabel || maxLabel) &&
              <DefaultText style={{flex: 3, textAlign: 'center', color: "#666"}}>
                0%
              </DefaultText>
            }
            {!minLabel && !maxLabel &&
              <DefaultText style={{flex: 3, textAlign: 'center', fontWeight: '500'}}>
                {dimensionName}
              </DefaultText>
            }
            <DefaultText style={{flex: 1, textAlign: 'right', color: "#666"}}>
              {maxLabel_}
            </DefaultText>
          </View>

          {minLabel && maxLabel &&
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
              }}
            >
              <DefaultText style={{ fontWeight: '500', flex: 1 }}>
                {minLabel}
              </DefaultText>
              <View style={{flex: 1}}>
                {!expanded && <TraitInfoButton/>}
              </View>
              <DefaultText style={{ fontWeight: '500', flex: 1, textAlign: 'right' }}>
                {maxLabel}
              </DefaultText>
            </View>
          }

          <Tick color="#ddd" position={0}/>
          <Tick color="#ddd" position={50}/>
          <Tick color="#ddd" position={100}/>

          {!bumpEqualsZero(bump) &&
            <Tick
              color="#666"
              position={percentage2}
              label={name2}
              labelPercentage={
                `${labelPercentage(percentage2) ?? 0}` +
                (bump < 0 && dimensionName ? ' - ' : ' + ') +
                `${bump}`}
              extraHeight={20}/>
          }
          <Tick
            color="#666"
            position={percentage2}
            label={bumpEqualsZero(bump) ? name2 : ""}
            labelPercentage={labelPercentage(percentage2)}
            extraHeight={bumpEqualsZero(bump) ? 20 : 0}/>
          <Tick
            color="#70f"
            position={percentage1}
            label={name1}
            round={compact}
            labelPercentage={labelPercentage(percentage1)}
            extraHeight={0}/>
        </View>
        {expanded && <>
            <DefaultText
              style={{
                color: '#888',
                marginTop: 25,
                marginBottom: 25,
                alignSelf: 'stretch',
              }}
            >
              {children}

              {showScoreBumper && <>
                  {children && '\n\n'}Duolicious whips-up this score using three
                  ingredients: Rahim's Q&A answers, your score-bumps, and our
                  smartypants AI. (We use a few tricks to improve accuracy and
                  fairness, so bumps will take some time to influence Rahim's
                  score.)
                </>
              }
            </DefaultText>
            {showScoreBumper &&
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-around',
                }}
              >
                <Pressable onPress={bumpLeft} style={{padding: 20}}>
                  <Animated.View style={{
                    opacity: bumpLeftOpacity,
                    transform: [ { scale: bumpLeftScale } ]
                  }}>
                    <ArrowLeft
                      stroke="#70f"
                      strokeWidth={4}
                      width={30}
                      height={30}
                    />
                  </Animated.View>
                </Pressable>
                <DefaultText
                  style={{
                    fontFamily: 'TruenoBold',
                    color: '#70f',
                    textAlign: 'center',
                  }}
                >
                  Bump Rahim's Score
                </DefaultText>
                <Pressable onPress={bumpRight} style={{padding: 20}}>
                  <Animated.View style={{
                    opacity: bumpRightOpacity,
                    transform: [ { scale: bumpRightScale } ]
                  }}>
                    <ArrowRight
                      stroke="#70f"
                      strokeWidth={4}
                      width={30}
                      height={30}
                    />
                  </Animated.View>
                </Pressable>
              </View>
            }
          </>
        }
        {(!(minLabel && maxLabel) || expanded) &&
          <TraitInfoButton/>
        }
      </Pressable>
    </Animated.View>
  );
};

export {
  Chart,
};
