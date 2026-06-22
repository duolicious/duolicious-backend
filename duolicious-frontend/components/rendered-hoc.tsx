import {
  memo,
  isValidElement,
} from 'react';

const RenderedHoc = memo(({Hoc}: {Hoc: any}) => {
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
