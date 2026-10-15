import { TextInput } from 'react-native';
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
  <TextInput
    value={about}
    multiline={true}
    scrollEnabled={false}
    editable={false}
    onSelectionChange={(e) =>
      setQuoteFromSelection(about, name, e.nativeEvent.selection)}
    style={{
      color,
      fontFamily: defaultFontFamily,
      fontSize: defaultFontSize,
      padding: 0,
      margin: 0,
    }}
  />
);

export {
  NativeAboutText,
};
