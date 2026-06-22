import { formatCount, truncateText } from './util';

describe('truncateText', () => {
  /* ──────────────────────────────────────────────────────────── *
   *   No‑op cases (should not truncate, no ellipsis added)       *
   * ──────────────────────────────────────────────────────────── */
  it('returns the original text when no limits are reached', () => {
    const text = 'Hello world';
    expect(truncateText(text, { maxLength: 20 })).toBe(text);
    expect(truncateText(text, { maxLines: 3 })).toBe(text);
    expect(truncateText(text, {})).toBe(text);
  });

  it('does not truncate when length exactly equals maxLength', () => {
    const text = '12345';
    expect(truncateText(text, { maxLength: 5 })).toBe(text);
  });

  /* ──────────────────────────────────────────────────────────── *
   *   Length‑wise truncation                                     *
   * ──────────────────────────────────────────────────────────── */
  it('truncates by length and appends an ellipsis', () => {
    const long = 'abcdefghijklmnopqrstuvwxyz';
    const result = truncateText(long, { maxLength: 10 });

    expect(result).toBe('abcdefghij…');          // first 10 chars + ellipsis
    // Length should be maxLength + 1 (for the ellipsis)
    expect(Array.from(result).length).toBe(11);
    expect(result.endsWith('…')).toBe(true);
  });

  it('counts Unicode grapheme clusters correctly', () => {
    const thumbs = '👍👍👍👍👍';                   // 5 emoji
    const result = truncateText(thumbs, { maxLength: 3 });

    expect(result).toBe('👍👍👍…');
    expect(Array.from(result).length).toBe(4);   // 3 glyphs + ellipsis
  });

  /* ──────────────────────────────────────────────────────────── *
   *   Line‑wise truncation                                       *
   * ──────────────────────────────────────────────────────────── */
  it('truncates by number of lines and appends an ellipsis', () => {
    const multiLine = ['line1', 'line2', 'line3'].join('\n');
    const result = truncateText(multiLine, { maxLines: 2 });

    expect(result).toBe('line1\nline2…');
    expect(result.endsWith('…')).toBe(true);
    expect(result.split('\n').length).toBe(2);   // now only two lines
  });

  /* ──────────────────────────────────────────────────────────── *
   *   Combined limits                                            *
   * ──────────────────────────────────────────────────────────── */
  it('applies line‑wise first, then length‑wise truncation', () => {
    const text = ['1234567890', 'abcdefghij', 'klmnopqrst'].join('\n');
    // After line truncation we have "1234567890\nabcdefghij"
    // Then length truncation to 15 chars keeps "1234567890\nabcd"
    const result = truncateText(text, { maxLines: 2, maxLength: 15 });

    expect(result).toBe('1234567890\nabcd…');
    expect(result.endsWith('…')).toBe(true);
    expect(Array.from(result).length).toBe(16);  // 15 + ellipsis
  });
});

describe('formatCount', () => {
  it('returns the number as a string below 1000', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(1)).toBe('1');
    expect(formatCount(10)).toBe('10');
    expect(formatCount(100)).toBe('100');
    expect(formatCount(999)).toBe('999');
  });

  it('formats thousands with K, no decimal for whole numbers', () => {
    expect(formatCount(1_000)).toBe('1K');
    expect(formatCount(2_000)).toBe('2K');
    expect(formatCount(42_000)).toBe('42K');
    expect(formatCount(100_000)).toBe('100K');
    expect(formatCount(999_000)).toBe('999K');
  });

  it('formats thousands with one decimal place when needed', () => {
    expect(formatCount(1_100)).toBe('1.1K');
    expect(formatCount(1_500)).toBe('1.5K');
    expect(formatCount(42_500)).toBe('42.5K');
  });

  it('formats millions with M, no decimal for whole numbers', () => {
    expect(formatCount(1_000_000)).toBe('1M');
    expect(formatCount(10_000_000)).toBe('10M');
  });

  it('formats millions with one decimal place when needed', () => {
    expect(formatCount(1_100_000)).toBe('1.1M');
    expect(formatCount(2_500_000)).toBe('2.5M');
  });
});
