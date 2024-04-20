import {
  View,
} from 'react-native';
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState
} from 'react';
import DropDownPicker from 'react-native-dropdown-picker';
import { DefaultText } from '../components/default-text';


interface DatePickerProps {
  input: any;
  setIsLoading: (isLoading: boolean) => void;
  onSubmitSuccess: () => void;
}

const DatePicker = forwardRef((
  {
    input,
    setIsLoading,
    onSubmitSuccess
  }: DatePickerProps,
  ref: any
) => {
  const [isDayOpen, setIsDayOpen] = useState(false);
  const [isMonthOpen, setIsMonthOpen] = useState(false);
  const [isYearOpen, setIsYearOpen] = useState(false);

  const [day, setDay] = useState(null);
  const [month, setMonth] = useState(null);
  const [year, setYear] = useState(null);

  const [isInvalid, setIsInvalid] = useState(false);

  const maxDay = year !== null && month !== null ?
    new Date(year, month, 0).getDate() :
    31;
  const days = [...Array(maxDay)].map((_, i) => {
    const n = (i + 1).toString();
    return {label: n, value: n};
  });

  const submit = useCallback(async () => {
    setIsLoading(true);

    const dateString = (
      String(year) + '-' +
      String(month).padStart(2, '0') + '-' +
      String(day).padStart(2, '0')
    );

    const ok = await input.date.submit(dateString);
    setIsInvalid(!ok);
    ok && onSubmitSuccess();

    setIsLoading(false);
  }, [year, month, day]);

  useImperativeHandle(ref, () => ({ submit }), [submit]);

  const setOpenDay = useCallback((value: any) => {
    setIsInvalid(false);
    setIsDayOpen(value);
  }, []);

  const setOpenMonth = useCallback((value: any) => {
    setIsInvalid(false);
    setIsMonthOpen(value);
  }, []);

  const setOpenYear = useCallback((value: any) => {
    setIsInvalid(false);
    setIsYearOpen(value);
  }, []);

  const months = [
    {label: 'Jan', value:  1},
    {label: 'Feb', value:  2},
    {label: 'Mar', value:  3},
    {label: 'Apr', value:  4},
    {label: 'May', value:  5},
    {label: 'Jun', value:  6},
    {label: 'Jul', value:  7},
    {label: 'Aug', value:  8},
    {label: 'Sep', value:  9},
    {label: 'Oct', value: 10},
    {label: 'Nov', value: 11},
    {label: 'Dec', value: 12},
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
    <>
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
            setOpen={setOpenDay}
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
            setOpen={setOpenMonth}
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
            setOpen={setOpenYear}
            setValue={setYear}
            placeholder="Year"
          />
        </View>
      </View>
      <DefaultText
        style={{
          zIndex: -1,
          elevation: -1,
          textAlign: 'center',
          color: 'white',
          marginTop: 15,
          opacity: isInvalid ? 1 : 0
        }}
      >
        That doesn’t look like a valid date of birth 🤨
      </DefaultText>
    </>
  );
});

export {
  DatePicker,
};
