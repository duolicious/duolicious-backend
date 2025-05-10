import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { DefaultText } from './default-text';

type VerticalButtonGroupProps = {
  buttons: string[];
  selectedIndex: number;
  onPress: (index: number) => void;
  containerStyle?: ViewStyle;
  disabled?: boolean;
};

const VerticalButtonGroup: React.FC<VerticalButtonGroupProps> = ({
  buttons,
  selectedIndex,
  onPress,
  containerStyle,
  disabled = false,
}) => {
  return (
    <View
      style={[
        styles.baseContainer,
        containerStyle,
        { opacity: disabled ? 0.3 : 1 },
      ]}
      pointerEvents={disabled ? 'none' : 'auto'}
    >
      {buttons.map((label, i) => {
        const isSelected = i === selectedIndex;
        const isLast     = i === buttons.length - 1;
        return (
          <Pressable
            key={i}
            onPress={() => onPress(i)}
            style={[
              styles.button,
              {
                borderBottomWidth: isLast ? 0 : 1,
                backgroundColor: isSelected ? '#70f' : 'white',
              },
            ]}
          >
            <DefaultText
              style={{
                fontWeight: '500',
                color: isSelected ? 'white' : 'black',
              }}
            >
              {label}
            </DefaultText>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  baseContainer: {
    flexDirection: 'column',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  baseIndicator: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#70f',
  },
  button: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomColor: '#ddd',
  },
});

export { VerticalButtonGroup };
