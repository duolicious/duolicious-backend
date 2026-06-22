import { getBestResolution } from './resolution';

describe('getBestResolution', () => {
  it('returns null when the input list is null', () => {
    expect(getBestResolution(null)).toBeNull();
  });

  it('returns null when the input list is undefined', () => {
    expect(getBestResolution(undefined)).toBeNull();
  });

  it('returns null when the input list is empty', () => {
    expect(getBestResolution([])).toBeNull();
  });

  it('ignores invalid resolution strings and returns null if none are valid', () => {
    const candidates = ['foo', '1080x', 'x720', '1920-1080'];
    expect(getBestResolution(candidates)).toBeNull();
  });

  it('returns the only valid resolution when exactly one entry parses', () => {
    const candidates = ['foo', '800x600', 'bar'];
    expect(getBestResolution(candidates)).toBe('800x600');
  });

  it('uses the default target (900 × 900) when none is supplied', () => {
    const candidates = ['1024x768', '900x900', '1600x900'];
    // 900 × 900 is an exact match with error 0, so it should win.
    expect(getBestResolution(candidates)).toBe('900x900');
  });

  it('picks the resolution that minimises |Δw| + |Δh| for a custom target', () => {
    const target = { width: 1920, height: 1080 };
    const candidates = ['1280x720', '2560x1440', '1920x1080'];
    expect(getBestResolution(candidates, target)).toBe('1920x1080');
  });

  it('breaks ties predictably (first with equal error wins)', () => {
    const target = { width: 1000, height: 1000 };
    const candidates = ['900x1100', '1100x900']; // both error = 200
    expect(getBestResolution(candidates, target)).toBe('900x1100');
  });
});
