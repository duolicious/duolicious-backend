import { parseMarkdown } from './speech-bubble';

describe('parseMarkdown', () => {
  test('should return an empty text block for an empty string', () => {
    expect(parseMarkdown('')).toEqual([
      { type: 'text', text: '' }
    ]);
  });

  test('should handle markdown with only quote blocks', () => {
    const markdown = `> Quote one
> Quote two`;
    expect(parseMarkdown(markdown)).toEqual([
      { type: 'quote', text: 'Quote one\nQuote two' }
    ]);
  });

  test('should handle markdown with only text blocks', () => {
    const markdown = `Line one
Line two
Line three`;
    expect(parseMarkdown(markdown)).toEqual([
      { type: 'text', text: 'Line one\nLine two\nLine three' }
    ]);
  });

  test('should correctly separate quote and text blocks', () => {
    const markdown = `> Quote one
> Quote two

Regular text line one.
Regular text line two.

> Quote three

Regular text after quote.`;
    expect(parseMarkdown(markdown)).toEqual([
      { type: 'quote', text: 'Quote one\nQuote two' },
      { type: 'text', text: 'Regular text line one.\nRegular text line two.' },
      { type: 'quote', text: 'Quote three' },
      { type: 'text', text: 'Regular text after quote.' }
    ]);
  });

  test('should parse the provided sample correctly', () => {
    const markdown = `> You're pretty cool
> :)

Thanks, but I'm not really.

I'm a pretty big fan of you though...

> What do you like to drink during winter?

Mom makes really nice chicken broth around this time of year.`;
    expect(parseMarkdown(markdown)).toEqual([
      { type: 'quote', text: "You're pretty cool\n:)" },
      { type: 'text', text: "Thanks, but I'm not really.\n\nI'm a pretty big fan of you though..." },
      { type: 'quote', text: "What do you like to drink during winter?" },
      { type: 'text', text: "Mom makes really nice chicken broth around this time of year." }
    ]);
  });

  test('should extract optional attribution from quote block', () => {
    const markdown = `> I like turtles
>
> - turtle kid`;
    expect(parseMarkdown(markdown)).toEqual([
      { type: 'quote', text: 'I like turtles', attribution: 'turtle kid' }
    ]);
  });
});

