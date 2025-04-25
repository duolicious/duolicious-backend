import {
  useLayoutEffect,
  useState,
} from 'react';
import { japi } from '../api/api';
import { listen, notify } from '../events/events';
import { setConversationArchived } from '../chat/application-layer';
import * as _ from 'lodash';

type SkippedNetworkState
  = 'fetching'
  | 'posting'
  | 'settled'

type SkippedState = {
  isSkipped: boolean
  networkState: SkippedNetworkState
};

type Event = Partial<SkippedState> & {
  fireOnPostSkip?: boolean
};

const useSkipped = (
  personUuid: string | null | undefined,
  onPostSkip?: () => void
) => {
  const [state, setState] = useState<SkippedState>({
    isSkipped: false,
    networkState: 'settled',
  });

  useLayoutEffect(() => {
    if (!personUuid) {
      return;
    }

    return listen<Event>(
      `skipped-state-${personUuid}`,
      (partialNewData: Event | undefined) => {
        if (partialNewData === undefined) {
          return;
        }

        setState((oldData) => {
          const newData = { ...oldData, ...partialNewData};
          if (_.isEqual(oldData, newData)) {
            return oldData;
          } else {
            return newData;
          }
        });
      },
      true,
    );
  }, [personUuid]);

  useLayoutEffect(() => {
    if (!personUuid) {
      return;
    }

    return listen<Event>(
      `skipped-state-${personUuid}`,
      (partialNewData: Event | undefined) => {
        if (partialNewData === undefined) {
          return;
        }

        if (partialNewData?.fireOnPostSkip) {
          onPostSkip?.();
        }
      },
    );
  }, [personUuid]);

  return {
    isSkipped: state.isSkipped,
    isLoading: state.networkState !== 'settled',
    isFetching: state.networkState === 'fetching',
    isPosting: state.networkState === 'posting',
  };
};

const setSkipped = (
  personUuid: string,
  state: Event
) => {
  notify<Event>(`skipped-state-${personUuid}`, state);
};

const postSkipped = async (
  personUuid: string,
  isSkipped: boolean,
  reportReason?: string,
): Promise<boolean> => {
  const endpoint = (
    isSkipped ?
    `/skip/by-uuid/${personUuid}` :
    `/unskip/by-uuid/${personUuid}`);

  const payload =
    (isSkipped && reportReason) ?
    { report_reason: reportReason } :
    undefined;

  setSkipped(personUuid, { networkState: 'posting' });

  const response = await japi('post', endpoint, payload);

  if (!response.ok) {
    setSkipped(personUuid, { networkState: 'settled' });
    return false;
  }

  setSkipped(
    personUuid,
    {
      isSkipped,
      networkState: 'settled',
      fireOnPostSkip: isSkipped,
    }
  );

  setConversationArchived(personUuid, isSkipped);

  return true;
};

export {
  postSkipped,
  useSkipped,
  setSkipped,
};
