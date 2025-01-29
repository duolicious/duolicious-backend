import { ButtonGroup as ButtonGroup_ } from '@rneui/themed';

const ButtonGroup = (props) => {
  const {containerStyle, textStyle, secondary, ...rest} = props;

  const borderRadius = 18;
  const secondaryBorderRadius = 12;

  const secondaryContainerStyle = {
    marginBottom: 10,
    height: 34,
  };

  const secondaryTextStyle = {
    fontSize: 11,
  };

  return (
    <ButtonGroup_
      selectedButtonStyle={{
        backgroundColor: 'rgb(228, 204, 255)', // = #70f, 0.2 opacity
        borderRadius: secondary === true ? secondaryBorderRadius : borderRadius,
        borderWidth: 1,
        borderBottomWidth: 3,
        borderColor: '#70f',
      }}
      selectedTextStyle={{
        color: '#70f',
      }}
      activeOpacity={0}
      containerStyle={{
        marginTop: 0,
        marginLeft: 0,
        marginRight: 0,
        marginBottom: 10,
        borderWidth: 0,
        overflow: 'visible',
        borderRadius: secondary === true ? secondaryBorderRadius : borderRadius,
        height: 48,
        ...(secondary === true ? secondaryContainerStyle : {}),
        ...containerStyle,
      }}
      innerBorderStyle={{
        width: 0,
      }}
      textStyle={{
        fontFamily: 'MontserratMedium',
        textAlign: 'center',
      fontSize: 14,
        ...(secondary === true ? secondaryTextStyle : {}),
        ...textStyle,
      }}
      {...rest}
    />
  );
};

export {
  ButtonGroup,
};
