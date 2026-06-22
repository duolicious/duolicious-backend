import { describe, expect, test } from '@jest/globals';
import { remap } from '../../components/images/logic';

describe('remap', () => {
  test('1', () => {
    const actual = remap(
      {
        1: true,
        2: true,
        3: true,
        4: true,
        5: true,
        6: true,
        7: true,
      },
      1,
      1,
    );
    const expected = {
      1: 1,
      2: 2,
      3: 3,
      4: 4,
      5: 5,
      6: 6,
      7: 7,
    };

    expect(actual).toEqual(expected);
  });

  test('2', () => {
    const actual = remap(
      {
        1: true,
        2: true,
        3: true,
        4: true,
        5: true,
        6: true,
        7: true,
      },
      1,
      2,
    );
    const expected = {
      1: 2,
      2: 1,
      3: 3,
      4: 4,
      5: 5,
      6: 6,
      7: 7,
    };

    expect(actual).toEqual(expected);
  });

  test('3', () => {
    const actual = remap(
      {
        1: true,
        2: true,
        3: true,
        4: false,
        5: true,
        6: false,
        7: true,
      },
      5,
      7,
    );
    const expected = {
      1: 1,
      2: 2,
      3: 3,
      4: 4,
      5: 7,
      6: 5,
      7: 6,
    };

    expect(actual).toEqual(expected);
  });

  test('4', () => {
    const actual = remap(
      {
        1: true,
        2: true,
        3: true,
        4: false,
        5: true,
        6: true,
        7: true,
      },
      3,
      4,
    );
    const expected = {
      1: 1,
      2: 2,
      3: 4,
      4: 3,
      5: 5,
      6: 6,
      7: 7,
    };

    expect(actual).toEqual(expected);
  });

  test('5', () => {
    const actual = remap(
      {
        1: true,
        2: true,
        3: true,
        4: false,
        5: true,
        6: false,
        7: true,
      },
      7,
      5,
    );
    const expected = {
      1: 1,
      2: 2,
      3: 3,
      4: 4,
      5: 6,
      6: 7,
      7: 5,
    };

    expect(actual).toEqual(expected);
  });

  test('6', () => {
    const actual = remap(
      {
        1: true,
        2: true,
        3: true,
        4: false,
        5: true,
        6: false,
        7: true,
      },
      3,
      7,
    );
    const expected = {
      1: 1,
      2: 2,
      3: 7,
      4: 4,
      5: 5,
      6: 3,
      7: 6,
    };

    expect(actual).toEqual(expected);
  });

  test('7', () => {
    const actual = remap(
      {
        1: true,
        2: false,
        3: true,
        4: false,
        5: true,
        6: false,
        7: true,
      },
      1,
      2,
    );
    const expected = {
      1: 2,
      2: 1,
      3: 3,
      4: 4,
      5: 5,
      6: 6,
      7: 7,
    };

    expect(actual).toEqual(expected);
  });

  test('8', () => {
    const actual = remap(
      {
        1: true,
        2: false,
        3: true,
        4: false,
        5: true,
        6: false,
        7: true,
      },
      1,
      3,
    );
    const expected = {
      1: 3,
      2: 1,
      3: 2,
      4: 4,
      5: 5,
      6: 6,
      7: 7,
    };

    expect(actual).toEqual(expected);
  });

  test('9', () => {
    const actual = remap(
      {
        1: true,
        2: false,
        3: true,
        4: true,
        5: true,
        6: true,
        7: true,
      },
      1,
      7,
    );
    const expected = {
      1: 7,
      2: 1,
      3: 2,
      4: 3,
      5: 4,
      6: 5,
      7: 6,
    };

    expect(actual).toEqual(expected);
  });

  test('10', () => {
    const actual = remap(
      {
        1: true,
        2: false,
        3: false,
        4: true,
        5: true,
        6: true,
        7: true,
      },
      1,
      7,
    );
    const expected = {
      1: 7,
      2: 2,
      3: 1,
      4: 3,
      5: 4,
      6: 5,
      7: 6,
    };

    expect(actual).toEqual(expected);
  });

  test('11', () => {
    const actual = remap(
      {
        1: true,
        2: false,
        3: false,
        4: false,
        5: true,
        6: true,
        7: true,
      },
      1,
      7,
    );
    const expected = {
      1: 7,
      2: 2,
      3: 3,
      4: 1,
      5: 4,
      6: 5,
      7: 6,
    };

    expect(actual).toEqual(expected);
  });
});
