import { Pressable } from 'react-native';
import { X } from "react-native-feather";
import { useAppTheme } from '../../app-theme/app-theme';

const Close = ({
  onPress,
  style = { top: 10, right: 10 },
}: {
  onPress: () => void,
  style?: any,
}) => {
  const { appTheme } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      style={{
        position: 'absolute',
        ...style,
      }}
    >
      <X
        stroke={appTheme.secondaryColor}
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
