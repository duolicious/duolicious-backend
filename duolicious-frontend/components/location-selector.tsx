import {
  useState,
} from 'react';
import {
  View,
} from 'react-native';
import {
  AutocompleteDropdown,
  TAutocompleteDropdownItem,
} from 'react-native-autocomplete-dropdown';

const LocationSelector = () => {
  const dataSet: TAutocompleteDropdownItem[] = [
    { id: '1', title: 'New York, USA'},
    { id: '2', title: 'Sydney, Australia'},
    { id: '3', title: 'Paris, France'},
    { id: '4', title: 'Llanfairpwllgwyngyll, Wales'},
    { id: '5', title: 'Fuerstenfeldbruck, Germany'},
  ];

  const [
    selectedItem,
    setSelectedItem,
  ] = useState<TAutocompleteDropdownItem | undefined>(undefined);

  return (
    <AutocompleteDropdown
      showChevron={false}
      showClear={false}
      useFilter={false}
      clearOnFocus={false}
      closeOnBlur={false}
      closeOnSubmit={false}
      initialValue={selectedItem}
      onSelectItem={setSelectedItem}
      dataSet={dataSet}
      textInputProps={{
        placeholder: 'Type a location...',
        autoCorrect: false,
        autoCapitalize: 'none',
        style: {
          backgroundColor: 'white',
          color: 'black',
          fontFamily: 'MontserratRegular',
          borderRadius: 10,
          fontSize: 14,
          borderColor: '#ccc',
          borderWidth: 1,
        },
      }}
      inputContainerStyle={{
        backgroundColor: 'transparent',
      }}
      suggestionsListTextStyle={{
        fontFamily: 'MontserratRegular',
      }}
      containerStyle={{
        marginTop: 0,
        marginBottom: 0,
        marginRight: 20,
        marginLeft: 20,
      }}
      debounce={1000}
      inputHeight={50}
      direction="down"
    />
  );
};

export {
  LocationSelector,
};
