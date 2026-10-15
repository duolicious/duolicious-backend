import SelectableText from 'selectable-text';
import { defaultFontFamily, defaultFontSize } from '../default-text';
import { setQuoteFromSelection } from '../conversation-screen/quote';

const NativeAboutText = ({
  name,
  about,
  color,
}: {
  name: string,
  about: string,
  color: string,
}) => (
  <SelectableText
    text={about}
    color={color}
    fontFamily={defaultFontFamily}
    fontSize={defaultFontSize}
    onSelectionChange={(e) => setQuoteFromSelection(about, name, e.nativeEvent)}
  />
);

export {
  NativeAboutText,
};
