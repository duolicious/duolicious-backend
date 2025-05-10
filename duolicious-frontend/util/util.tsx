import {
  Linking,
  Platform,
} from 'react-native';
import {
  differenceInCalendarDays,
  format,
  formatDistanceToNow,
  intervalToDuration,
  isThisWeek,
  isThisYear,
  isToday,
  isYesterday,
  subSeconds,
} from 'date-fns'
import * as _ from 'lodash';

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

const getShortElapsedTime = (start: Date) => {
  const end = new Date();
  const duration = intervalToDuration({ start, end });

  if (duration?.years ?? 0 > 0) return `${duration.years}y`;
  if (duration?.months ?? 0 > 0) return `${duration.months}mo`;
  if (duration?.days ?? 0 > 0) return `${duration.days}d`;
  if (duration?.hours ?? 0 > 0) return `${duration.hours}h`;
  if (duration?.minutes ?? 0 > 0) return `${duration.minutes}m`;
  return `${duration.seconds}s`;
}

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
  const possessiveMarker = String(s).endsWith('s') ? "’" : "’s";

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

const assertNever = (x: never): never => {
  throw new Error(`Unexpected object: ${x}`);
};

const truncateText = (
  text: string,
  maxLength?: number,
  maxLines?: number
) => {
  let result = text;
  let wasTruncated = false;

  if (maxLines) {
    const lines = result.split('\n');
    result = lines.slice(0, maxLines).join('\n');

    wasTruncated ||= lines.length > maxLines;
  }

  if (maxLength) {
    result = result.slice(0, maxLength);
    wasTruncated ||= result.length > maxLength;
  }

  if (wasTruncated) {
    result += '…';
  }

  return result;
};

export {
  assert,
  assertNever,
  compareArrays,
  delay,
  deleteFromArray,
  friendlyDate,
  friendlyTimeAgo,
  friendlyTimestamp,
  getRandomElement,
  getShortElapsedTime,
  isMobile,
  jsonParseSilently,
  longFriendlyTimestamp,
  parseUrl,
  possessive,
  secToMinSec,
  truncateText,
  withTimeout,
};
