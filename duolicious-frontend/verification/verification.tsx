import { japi } from '../api/api';
import { listen, notify } from '../events/events';
import { delay } from '../util/util';

type VerificationEvent = {
  photos?: {
    [position: string]: boolean
  }
  gender?: boolean
  age?: boolean
  ethnicity?: boolean
  status?:
    | 'uploading-photo'
    | 'enqueued'
    | 'running'
    | 'success'
    | 'failure'
  message?: string
};

const verificationWatcher = async () => {
  var checkUntil = null as null | Date;
  var lastStatus = '';

  listen(
    'watch-verification',
    () => {
      checkUntil = new Date(Date.now() + 60 * 1000); // A minute from now
      lastStatus = '';
    },
  );

  while (true) {
    await delay(1000);

    if (checkUntil === null) {
      continue;
    }

    const isTimeReached = new Date() > checkUntil;
    const isDone = ['success', 'failure'].includes(lastStatus);

    if (isTimeReached && !isDone) {
      notify<VerificationEvent>(
        'updated-verification',
        {
          status: 'failure',
          message: 'Verification took too long. Try again later.',
        }
      );

      lastStatus = 'failure';
    }

    if (isTimeReached) {
      continue;
    }

    if (isDone) {
      continue;
    }

    const response = await japi('get', '/check-verification');

    if (!response.ok) {
      console.error('Verification response not ok:', response);
      continue;
    }

    notify<VerificationEvent>(
      'updated-verification',
      {
        status: response.json.status,
        message: response.json.message,
        photos: response.json.verified_photos,
        gender: response.json.verified_gender,
        age: response.json.verified_age,
        ethnicity: response.json.verified_ethnicity,
      }
    );

    lastStatus = response.json.status ?? '';
  }
};

export {
  VerificationEvent,
  verificationWatcher,
};
