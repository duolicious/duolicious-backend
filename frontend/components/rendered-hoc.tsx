import {
  ComponentType,
  ReactElement,
  memo,
  isValidElement,
} from 'react';

const RenderedHoc = memo(({Hoc}: {Hoc: ComponentType | ReactElement | null | undefined}) => {
  if (isValidElement(Hoc)) {
    return Hoc;
  } else if (Hoc) {
    return <Hoc/>;
  } else {
    return <></>;
  }
});

export {
  RenderedHoc,
};
