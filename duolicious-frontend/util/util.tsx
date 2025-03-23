import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Linking,
  Platform,
} from 'react-native';
import {
  differenceInCalendarDays,
  format,
  formatDistanceToNow,
  isThisWeek,
  isThisYear,
  isToday,
  isYesterday,
  subSeconds,
} from 'date-fns'
import _ from 'lodash';

const isMobile = () => {
  const re = /(android|iphone|ipod|iemobile|blackberry|webos|symbian)/i;

  return (
    Platform.OS === 'android' ||
    Platform.OS === 'ios' ||
    re.test(window.navigator.userAgent)
  );
};

/* Compare arrays as they would be in Python
 */
const compareArrays = (arrA: any[], arrB: any[]): number => {
  let minLength = Math.min(arrA.length, arrB.length);

  for (let i = 0; i < minLength; i++) {
    if (arrA[i] < arrB[i]) {
      return -1;
    } else if (arrA[i] > arrB[i]) {
      return 1;
    }
  }

  return arrA.length - arrB.length;
}

const assert = (x: boolean) => { if (!x) throw new Error('Assertion failed')};

const jsonParseSilently = (text: string): any => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const friendlyTimestamp = (date: Date): string => {
  if (isToday(date)) {
    // Format as 'hh:mm'
    return format(date, 'h:mm aaa')
  } else if (isThisWeek(date)) {
    // Format as 'eeee' (day of the week)
    return format(date, 'eee')
  } else if (isThisYear(date)) {
    // Format as 'd MMM' (date and month)
    return format(date, 'd MMM')
  } else {
    // Format as 'd MMM yyyy' (date, month and year)
    return format(date, 'd MMM yyyy')
  }
};

const longFriendlyTimestamp = (date: Date): string => {
  // Format as 'hh:mm'
  const timeOfDay = format(date, 'h:mm aaa');

  if (isToday(date)) {
    return timeOfDay;
  } else {
    return friendlyTimestamp(date) + ', ' + timeOfDay
  }
};

const friendlyDate = (date: Date): string => {
  if (isToday(date)) {
    return 'Today';
  }

  if (isYesterday(date)) {
    return 'Yesterday';
  }

  // Check if the date is within the last 7 days
  if (differenceInCalendarDays(new Date(), date) < 7) {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'long'
    }).format(date);
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    ...(isThisYear(date) ? {} : { year: 'numeric' }),
  }).format(date);
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const deleteFromArray = <T,>(array: T[], element: T): T[] => {
  let index = array.indexOf(element);
  if (index !== -1) {
    array.splice(index, 1);
  }
  return array;
};

const withTimeout = <T,>(ms: number, promise: Promise<T>): Promise<T | 'timeout'> => {
  const timeout = new Promise<T | 'timeout'>((resolve) =>
    setTimeout(() => resolve('timeout'), ms)
  );
  return Promise.race([promise, timeout]);
};

const parseUrl = async () => {
  const initialUrl = await Linking.getInitialURL();

  if (!initialUrl) {
    return null;
  }

  const url = new URL(initialUrl);

  const match = url.pathname.match(/^\/([^\/]+)\/([^\/]+)$/);
  const left = match ? match[1] : undefined;
  const right = match ? match[2] : undefined;

  if (!left)
    return null

  if (!right)
    return null;

  return { left, right };
};

const friendlyTimeAgo = (secondsAgo: number): string => {
  const lastOnlineDate = subSeconds(new Date(), secondsAgo);

  return _.capitalize(formatDistanceToNow(lastOnlineDate));
}

const possessive = (s: string) => {
  const possessiveMarker = String(s).endsWith('s') ? "'" : "'s";

  return s + possessiveMarker;
};

const secToMinSec = (sec: number): [string, string] => {
  const minutes = String(Math.floor(sec / 60));
  const seconds = String(sec % 60).padStart(2, '0');

  return [minutes, seconds];
};

const getRandomElement = <T,>(list: T[]): T | undefined =>
    list.length === 0 ?
    undefined :
    list[Math.floor(Math.random() * list.length)];

const useAutoResetBoolean = (delay: number = 5000): [boolean, (newValue: boolean) => void]  => {
  const [value, setValue] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const setAutoResetValue = useCallback(
    (newValue: boolean) => {
      // Clear any existing timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      // Update state immediately
      setValue(newValue);

      // If setting to true, start a timer to reset to false after the delay
      if (newValue) {
        timerRef.current = setTimeout(() => {
          setValue(false);
          timerRef.current = null;
        }, delay);
      }
    },
    [delay]
  );

  // Clear timer when component unmounts to avoid memory leaks
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return [value, setAutoResetValue];
};

export {
  assert,
  compareArrays,
  delay,
  deleteFromArray,
  friendlyDate,
  friendlyTimeAgo,
  friendlyTimestamp,
  getRandomElement,
  isMobile,
  jsonParseSilently,
  longFriendlyTimestamp,
  parseUrl,
  possessive,
  secToMinSec,
  withTimeout,
  useAutoResetBoolean,
};
