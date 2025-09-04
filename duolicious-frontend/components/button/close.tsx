import { Pressable } from 'react-native';
import { X } from "react-native-feather";

const Close = ({
  onPress,
  style = { top: 10, right: 10 },
}: {
  onPress: () => void,
  style?: any,
}) => {
  return (
    <Pressable
      onPress={onPress}
      style={{
        position: 'absolute',
        ...style,
      }}
    >
      <X
        stroke="black"
        strokeWidth={3}
        height={24}
        width={24}
      />
    </Pressable>
  );
};

export {
  Close,
};
