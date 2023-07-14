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
  } = props;

  const compact = name1 === null && !name2;

  const [expanded, setExpanded] = useState(false);

  const { opacity, scaleXY } = LayoutAnimation.Properties;
  const { easeInEaseOut, linear } = LayoutAnimation.Types;

  const animatedBackgroundColor = useRef(new Animated.Value(1)).current;

  const backgroundColor = animatedBackgroundColor.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(222,222,222, 1)', 'rgba(255,255,255, 1)'],
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

          <Tick
            color="#666"
            position={percentage2}
            label={name2}
            labelPercentage={labelPercentage(percentage2)}
            extraHeight={20}/>
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
            </DefaultText>
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
