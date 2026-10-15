# Rude intro classifier

Trains the model behind `serviceshared/antiabuse/antirude/chat`, which decides
whether an intro is rude enough to hide in the recipient's "Hidden intros"
folder. This is a training pipeline, not a service: a developer runs it by hand
against a copy of the production database.

## The corpus

Three files hold labelled messages, one JSON object per line with a `text`
and a `rude` field:

- `serviceshared/antiabuse/antirude/chat/corpus.jsonl` is the benchmark.
  `test_init.py` beside it snapshots the classifier's precision and recall on
  it, so any change to either shows up in CI and in review. Besides intros, it
  holds the phrases from the unit tests the corpus replaced.
- `train.jsonl` is what the model learns from.
- `synthetic.jsonl` holds short messages written by hand rather than taken
  from the database. They cover coded requests that are rare there, such as
  "what's your menu?", and harmless look-alikes such as "do you send memes?".
  The model learns from them too.

This repository is public and the intros are private messages, so no file
holds a real message. Every line of the first two is a paraphrase that keeps
the words that decide the label (rude terms, misspellings, self-censoring,
emoji) and rewrites or replaces everything else, names and places included.

The intros were sampled from a copy of the production database in four groups:
intros the old word-list filter blocked, the next intro the same sender sent
within ten minutes of a block (often the same message, reworded to get past
the filter), a random sample of intros sent after the filter stopped blocking,
and intros the old filter flags. Targeted searches then added intros of kinds
those groups held few of: telling the recipient to harm themselves ("jump off
a bridge", "commit sudoku"), transphobic slurs and insults, rude words hidden
by spacing, leetspeak or symbols ("k y s", "g00n"), short coded requests ("do
you send?", "how big is it?", "are you on onlyfans?") and imageboard slang
("foid", "tranner", "cope and seethe"). Many of the intros they found use the
same words harmlessly, and those are labelled ok. Senders were split so that
nobody's messages are in both the benchmark and `train.jsonl`. Claude labelled
every intro against `rubric.md` as rude, ok or unsure, left the unsure ones
out, and paraphrased the rest under the rubric's paraphrasing rules. A second
pass labelled the benchmark's paraphrases without seeing the originals, and
only the paraphrases whose label matched the original's were kept.

To fix a mistake the classifier makes, add paraphrased, labelled examples of it
to `train.jsonl` (never the real message), or invented ones to
`synthetic.jsonl` when the database has too few, retrain, and check the
benchmark.

## How the model is trained

The classifier is a four-layer BERT
(`google/bert_uncased_L-4_H-256_A-4`), small enough to score an intro in a few
milliseconds on one CPU thread. It learns by distillation:

1. A large "teacher" model (`cardiffnlp/twitter-roberta-large-2022-154m`) is
   fine-tuned on `train.jsonl` and `synthetic.jsonl`. It is more accurate
   than the small model but far too slow to serve.
2. The teacher scores every intro sent in the last six months in the database
   copy, plus the intros the old filter blocked, which are kept in
   `rude_message`. Intros from the senders the benchmark was paraphrased from
   are left out, which is what the `md5('rude-' || person_id)` condition in
   `train.py` does.
3. The small model learns from the same labelled messages and the teacher's
   scores, then is exported to `model.onnx` and `tokenizer.json` beside the
   serving code.

Training and serving read text through the same
`serviceshared.antiabuse.normalize.normalize_chat_message`. It drops quoted
profile text (it is the recipient's own words, so it can't offend them),
replaces look-alike letters in words that mix alphabets, and shortens runs of
three or more repeated characters.

## Running it

You need a copy of the production database (never point this at real
production), Python 3.12+, and a CUDA GPU with 8 GB. From `backend/`, with the
torch wheel matched to your driver (on CUDA 12.4, `torch==2.6.0 --index-url
https://download.pytorch.org/whl/cu124`):

    python3 -m venv antirudechat/venv
    antirudechat/venv/bin/pip install -r antirudechat/requirements.txt
    antirudechat/venv/bin/python -m antirudechat.train

`DUO_DB_DSN` says where the database copy lives (default
`host=localhost port=5432 dbname=duo_api user=postgres password=password`).
The virtualenv lives here, and the directory is excluded from the api and cron
images (`backend/.dockerignore`).

Training overwrites `model.onnx` and `tokenizer.json`. Run the unit tests
(`test/unit/unit.sh`), put the precision and recall that
`serviceshared/antiabuse/antirude/chat/test_init.py` reports into its
snapshot, and commit the model with the snapshot so that review sees both.
