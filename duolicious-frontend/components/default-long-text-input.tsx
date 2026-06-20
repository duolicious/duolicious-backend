import { ComponentProps } from 'react';
import { DefaultTextInput } from './default-text-input';

const DefaultLongTextInput = (props: ComponentProps<typeof DefaultTextInput>) => {
  const {style, ...rest} = props;

  return (
    <DefaultTextInput
      multiline={true}
      returnKeyType={undefined}
      style={{
        textAlignVertical: 'top',
        marginLeft: undefined,
        marginRight: undefined,
        height: undefined,
        ...style,
      }}
      {...rest}
    />
  );
};

export {
  DefaultLongTextInput,
};
