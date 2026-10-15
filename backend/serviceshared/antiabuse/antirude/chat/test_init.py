import json
import unittest
from pathlib import Path

from serviceshared.antiabuse.antirude.chat import is_rude


class TestIsRude(unittest.TestCase):
    def test_corpus_precision_and_recall(self) -> None:
        with open(Path(__file__).parent / 'corpus.jsonl') as f:
            corpus = [json.loads(line) for line in f]

        predictions = [(is_rude(e['text']), e['rude']) for e in corpus]

        true_positives = sum(p and r for p, r in predictions)
        precision = true_positives / sum(p for p, _ in predictions)
        recall = true_positives / sum(r for _, r in predictions)

        self.assertEqual(
            (round(precision, 3), round(recall, 3)),
            (0.877, 0.88))


if __name__ == '__main__':
    unittest.main()
