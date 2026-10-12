import { describe, expect, test } from '@jest/globals';
import { clubsRedesign } from './trials';

describe('trial arms', () => {
  test.each([
    [undefined, false],
    [389200, false],
    [390248, false],
    [390249, false],
    [390250, false],
    [390251, false],
    [390252, false],
    [390253, false],
    [391398, false],
    [391399, false],
    [391400, true],
    [391401, true],
    [391402, false],
    [391403, false],
    [391404, true],
    [391548, true],
    [391549, true],
    [391550, false],
    [391551, false],
    [391552, true],
  ])('person %p', (personId, redesign) => {
    expect(clubsRedesign(personId)).toBe(redesign);
  });
});
