import { useEffect, useState } from 'react';
import { listen, notify, lastEvent } from '../../events/events';
import { truncateText } from '../../util/util';

const eventKey = `conversation-quote`;

const attributionRegex = /^\s*-\s*/;

type MarkdownBlock = QuoteBlock | TextBlock;

type QuoteBlock = {
  type: 'quote';
  text: string;
  attribution?: string;
};

type TextBlock = {
  type: 'text';
  text: string;
};

type Quote = {
  text: string
  attribution: string
};

const useQuote = (): Quote | null => {
  const _lastEvent = lastEvent<Quote>(eventKey) ?? null;

  const [quote, setQuote] = useState<Quote | null>(_lastEvent);

  useEffect(() => {
    return listen(eventKey, setQuote);
  }, []);

  return quote;
};

const setQuote = (quote: Quote | null) => {
  return notify(eventKey, quote);
};

const parseMarkdown = (markdown: string): MarkdownBlock[] => {
  const lines = markdown.split(/\r?\n/);
  const blocks: MarkdownBlock[] = [];
  let currentBlockType: 'quote' | 'text' | null = null;
  let currentBlockLines: string[] = [];

  const parseQuoteBlock = (lines: string[]): QuoteBlock => {
    const trimmedLines = lines.map(line => line.trim());
    let attribution: string | undefined;
    let endIndex = lines.length;

    for (let i = trimmedLines.length - 1; i >= 0; i--) {
      if (trimmedLines[i] === '') continue;
      if (attributionRegex.test(trimmedLines[i])) {
        attribution = trimmedLines[i].replace(attributionRegex, '');
        endIndex = i;
      }
      break;
    }

    return {
      type: 'quote',
      text: lines.slice(0, endIndex).join('\n').trim(),
      attribution,
    };
  };

  const flushBlock = (): void => {
    if (currentBlockLines.length === 0 || currentBlockType === null) return;

    if (currentBlockType === 'quote') {
      blocks.push(parseQuoteBlock(currentBlockLines));
    } else {
      blocks.push({
        type: 'text',
        text: currentBlockLines.join('\n').trim(),
      });
    }

    currentBlockLines = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith('>')) {
      if (currentBlockType !== 'quote') {
        flushBlock();
        currentBlockType = 'quote';
      }
      // Remove the leading ">" and an optional space.
      currentBlockLines.push(line.replace(/^>\s*/, ''));
    } else {
      if (currentBlockType !== 'text') {
        flushBlock();
        currentBlockType = 'text';
      }
      currentBlockLines.push(
        line.replace(
          /^(\\+)>/,
          (s, slashes) => '\\'.repeat(Math.floor(slashes.length / 2)) + '>'
        )
      );
    }
  }

  flushBlock();
  return blocks;
};

const quoteToMarkdown = (quote: Quote | null, doTruncate: boolean): string => {
  if (!quote) {
    return '';
  }

  const truncatedText = doTruncate
    ? truncateText(quote.text, { maxLength: 100, maxLines: 3 })
    : quote.text;

  const truncatedAttribution = doTruncate
    ? truncateText(quote.attribution, { maxLength: 100, maxLines: 1 })
    : quote.attribution;

  const formattedQuote = truncatedText
    .split('\n')
    .map((line) => `>${line}`)
    .join('\n');

  const formattedAttribution = '>- ' + truncatedAttribution.replaceAll('\n', '');

  return formattedQuote + '\n' + formattedAttribution;
};

const quotablePortion = (quote: Quote | null) => {
  if (!quote) {
    return '';
  }

  const bestBlock = parseMarkdown(quote.text)
    .filter((block) => !!block.text.trim()) // ignore empty blocks
    .map((block, i) => ({ block, i }))
    .sort((a, b) => {
      if (a.block.type === b.block.type) {
        return a.i < b.i ? -1 : 1;
      } else if (a.block.type === 'text') {
        return -1;
      } else {
        return 1;
      }
    })

  if (bestBlock.length === 0) {
    return '';
  }

  return bestBlock[0].block.text;
};

const quoteToPreviewMarkdown = (quote: Quote | null) => {
  if (!quote) {
    return '';
  }

  const _quotablePortion = quotablePortion(quote);

  if (_quotablePortion.length === 0) {
    return '';
  }

  const quotable: Quote = {
    text: _quotablePortion,
    attribution: quote.attribution,
  };

  return quoteToMarkdown(quotable, true);
};

const quoteToMessageMarkdown = (quote: Quote | null) => {
  if (!quote) {
    return '';
  }

  const _quotablePortion = quotablePortion(quote);

  if (_quotablePortion.length === 0) {
    return '';
  }

  const quotable: Quote = {
    text: _quotablePortion,
    attribution: quote.attribution,
  };

  return quoteToMarkdown(quotable, false);
};

export {
  Quote,
  setQuote,
  useQuote,
  parseMarkdown,
  quoteToPreviewMarkdown,
  quoteToMessageMarkdown,
};
