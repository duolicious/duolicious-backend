import {
  View,
} from 'react-native';
import {
  useState,
} from 'react';
import DropDownPicker from 'react-native-dropdown-picker';

const DatePicker = ({...props}) => {
  const [isDayOpen, setIsDayOpen] = useState(false);
  const [isMonthOpen, setIsMonthOpen] = useState(false);
  const [isYearOpen, setIsYearOpen] = useState(false);

  const [day, setDay] = useState(null);
  const [month, setMonth] = useState(null);
  const [year, setYear] = useState(null);

  const maxDay = year !== null && month !== null ?
    new Date(year, month, 0).getDate() :
    31;
  const days = [...Array(maxDay)].map((_, i) => {
    const n = (i + 1).toString();
    return {label: n, value: n};
  });

  const months = [
    {label: 'January', value: 1},
    {label: 'February', value: 2},
    {label: 'March', value: 3},
    {label: 'April', value: 4},
    {label: 'May', value: 5},
    {label: 'June', value: 6},
    {label: 'July', value: 7},
    {label: 'August', value: 8},
    {label: 'September', value: 9},
    {label: 'October', value: 10},
    {label: 'November', value: 11},
    {label: 'December', value: 12},
  ];

  const currentYear = new Date().getFullYear();
  const years = [...Array(100)].map(
    (_, i) => {
      const year = (currentYear - i - 18).toString();
      return {label: year, value: year}
    }
  );

  const dropdownStyleProps = {
    textStyle: {
      fontFamily: 'MontserratRegular',
    },
    style: {
      borderWidth: 1,
      borderColor: '#ccc',
    },
    dropDownContainerStyle: {
      borderWidth: 1,
      borderColor: '#ccc',
    },
  };

  return (
    <View
      style={{
        marginLeft: 20,
        marginRight: 20,
        flexDirection: 'row',
      }}
    >
      <View style={{flex: 1}}>
        <DropDownPicker
          {...dropdownStyleProps}
          open={isDayOpen}
          value={day}
          items={days}
          setOpen={setIsDayOpen}
          setValue={setDay}
          placeholder="Day"
        />
      </View>
      <View style={{width: 10}}/>
      <View style={{flex: 1}}>
        <DropDownPicker
          {...dropdownStyleProps}
          open={isMonthOpen}
          value={month}
          items={months}
          setOpen={setIsMonthOpen}
          setValue={setMonth}
          placeholder="Month"
        />
      </View>
      <View style={{width: 10}}/>
      <View style={{flex: 1}}>
        <DropDownPicker
          {...dropdownStyleProps}
          open={isYearOpen}
          value={year}
          items={years}
          setOpen={setIsYearOpen}
          setValue={setYear}
          placeholder="Year"
        />
      </View>
    </View>
  );
};

export {
  DatePicker,
};
