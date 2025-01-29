import {
  Pressable,
  View,
} from 'react-native';
import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import { DefaultText } from './default-text';
import { Title } from './title';
import { DefaultLongTextInput } from './default-long-text-input';
import { ButtonWithCenteredText } from './button/centered-text';
import { X } from "react-native-feather";
import { listen } from '../events/events';
import { setSkipped } from '../hide-and-block/hide-and-block';
import { KeyboardDismissingView } from './keyboard-dismissing-view';
import { DefaultModal } from './deafult-modal';

type ReportModalInitialData = {
  name: string
  personUuid: string
  context: string
};

const ReportModal = () => {
  const [name, setName] = useState("");
  const [personUuid, setPersonUuid] = useState('');
  const [context, setContext] = useState("");
  const [reportText, setReportText] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTooFewChars, setIsTooFewChars] = useState(false);
  const [isSomethingWrong, setIsSomethingWrong] = useState(false);

  const maxChars = 2000;
  const numChars = reportText.length;

  const onChangeReportText = useCallback((s: string) => {
    setIsTooFewChars(false);
    setIsSomethingWrong(false);

    if (s.length <= maxChars)
      setReportText(s);
  }, [setIsTooFewChars, setReportText]);

  const close = useCallback(() => setIsVisible(false), [setIsVisible]);

  const submitReport = useCallback(async () => {
    if (numChars < 5) {
      setIsTooFewChars(true);
      return;
    }

    setIsTooFewChars(false);
    setIsSomethingWrong(false);


    setIsLoading(true);
    const completeReportText = `${context.slice(0, 7999)}\n${reportText}`;
    if (await setSkipped(personUuid, true, completeReportText)) {
      setIsVisible(false);
    } else {
      setIsSomethingWrong(true);
    }
    setIsLoading(false);
  }, [
    context,
    numChars,
    reportText,
    setIsLoading,
    setIsTooFewChars,
    setIsVisible,
    setSkipped,
  ]);

  const openReportModal = useCallback((data: ReportModalInitialData) => {
    if (!data.name) return;
    if (!data.context) return;

    setName(data.name);
    setPersonUuid(data.personUuid);
    setContext(data.context);
    setReportText("");
    setIsVisible(true);
    setIsLoading(false);
    setIsTooFewChars(false);
    setIsSomethingWrong(false);
  }, []);

  useEffect(() => {
    return listen('open-report-modal', openReportModal);
  }, [listen, openReportModal]);

  const ErrorMessage = useCallback(() => {
    if (isTooFewChars) {
      return (
        <DefaultText style={{color: "#e91010"}}>
          Must be at least 5 characters
        </DefaultText>
      );
    } else if (isSomethingWrong) {
      return (
        <DefaultText style={{color: "#e91010"}}>
          Something went wrong
        </DefaultText>
      );
    } else {
      return <View/>;
    }
  }, [isTooFewChars, isSomethingWrong]);

  return (
    <DefaultModal visible={isVisible} transparent={false} onRequestClose={close}>
      <KeyboardDismissingView
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'row',
        }}
      >
        <View
          style={{
            flex: 1,
            maxWidth: 600,
            margin: 10,
            backgroundColor: 'white',
            borderRadius: 5,
            padding: 10,
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
            }}
          >
            <Pressable onPress={close}>
              <X
                stroke="black"
                strokeWidth={3}
                height={24}
                width={24}
              />
            </Pressable>
          </View>
          <Title style={{
            marginTop: 0,
            alignSelf: 'center',
          }}>
            What would you like to report?
          </Title>
          <DefaultText
            style={{
              color: 'grey',
              fontSize: 14,
              alignSelf: 'center',
              textAlign: 'center',
            }}
          >
            Please include as much detail as possible. We won’t tell {name} you
            reported them.
          </DefaultText>
          <View>
            <DefaultLongTextInput
              value={reportText}
              onChangeText={onChangeReportText}
              numberOfLines={6}
              style={{
                backgroundColor: '#eee',
                borderWidth: 0,
                height: 200,
              }}
            />
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginTop: 5,
              }}
            >
              <ErrorMessage/>
              <DefaultText style={{color: 'grey', textAlign: 'right'}}>
                {numChars} of {maxChars}
              </DefaultText>
            </View>
          </View>
          <View
            style={{
              flexDirection: 'row',
            }}
          >
            <ButtonWithCenteredText
              onPress={close}
              containerStyle={{flex: 1}}
              backgroundColor="white"
              textStyle={{
                color: '#555',
                fontWeight: '700',
              }}
            >
              Cancel
            </ButtonWithCenteredText>
            <ButtonWithCenteredText
              onPress={submitReport}
              containerStyle={{flex: 1}}
              backgroundColor="#e91010"
              textStyle={{
                color: '#fff',
                fontWeight: '700',
              }}
              loading={isLoading}
            >
              Submit
            </ButtonWithCenteredText>
          </View>
        </View>
      </KeyboardDismissingView>
    </DefaultModal>
  );
}

export {
  ReportModal,
  ReportModalInitialData,
};
