import { LinearGradient } from 'expo-linear-gradient';

const Shadow = () => {
  return <LinearGradient
    colors={['rgba(0, 0, 0, 0.08)', 'transparent']}
    style={{
      alignSelf: 'stretch',
      height: 10,
    }}
  />;
};

export {
  Shadow,
};
