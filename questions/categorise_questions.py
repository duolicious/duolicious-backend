#!/usr/bin/env python3

import os
import openai
import functools
import datetime
import random
import sys
from typing import NamedTuple, List
import json
import time
import re
from collections import Counter
from random import shuffle
from pathlib import Path

question_path = sys.argv[1]

if not question_path:
    print('invalid question path', file=sys.stderr)
    exit()

openai.organization = open(f'{Path.home()}/.openai-org-id').read().strip()
openai.api_key = open(f'{Path.home()}/.openai-key').read().strip()

valid_categories = set(['values', 'sex', 'interpersonal', 'other'])

class CategorisedQuestion(NamedTuple):
    question: str
    category: str

class Questions(NamedTuple):
    categorised: List[CategorisedQuestion]
    uncategorised: List[str]

def get_batch_prompt(questions: List[str]) -> str:
    if not len(questions):
        raise ValueError("list of questions can't be empty")

    joined_questions = '\n'.join(f'{i+1}: {q}' for i, q in enumerate(questions))

    return f"""
I have a list of questions from OkCupid. The questions need to be placed into the following categories. The questions may or may not cover all the categories:

* values - questions about enduring beliefs or principles an individual might hold
* sex - questions that are overtly sexual
* interpersonal - questions on the way a person socially interacts with familiar individuals
* other - questions which don't fall into the aforementioned categories

Express your answer as a JSON object in the format {'{'}1: "category", 2: "category", ...{'}'}. Do not explain your answer. The questions to be categorised are as follows:

{joined_questions}
""".strip()


def categorise_batch_once(questions: List[str]) -> List[CategorisedQuestion]:
    prompt = get_batch_prompt(questions)

    completion = openai.ChatCompletion.create(
        model="gpt-4",
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0.0,
        max_tokens=8 * len(questions),
        stop=['}']
    )

    response = completion.choices[0].message["content"]
    print(
f"""
{prompt}
response: {response}
""".strip()
    )

    numbered_categories = re.sub(
        '[^a-z,:0-9]',
        '',
        str(response).lower()
    ).split(',')
    print(numbered_categories) # TODO
    categories = [nc.split(':')[1] for nc in numbered_categories]

    for category in categories:
        if category not in valid_categories:
            raise Exception(f'category {category} not valid')

    return [
        CategorisedQuestion(
            question=q,
            category=c,
        )
        for q, c in zip(questions, categories)
    ]

def reversible_shuffle(n):
    shuffled_indices1 = list(range(n))
    shuffled_indices2 = list(range(n))
    shuffle(shuffled_indices1)
    shuffle(shuffled_indices2)

    forward_index_map = list(zip(shuffled_indices1, shuffled_indices2))
    backward_index_map = list(zip(shuffled_indices2, shuffled_indices1))

    def apply_index_map(index_map, l):
        d = {i1: l[i2] for i1, i2 in index_map}
        return [d[i] for i in range(len(d))]

    def shuffle_(l):
        return apply_index_map(forward_index_map, l)

    def unshuffle_(l):
        return apply_index_map(backward_index_map, l)

    return shuffle_, unshuffle_

def categorise_batch(questions: List[str]) -> List[CategorisedQuestion]:
    votes = []
    for _ in range(3):
        s, u = reversible_shuffle(len(questions))
        votes.append(u(categorise_batch_once(s(questions))))

    question_to_count = {
        q: Counter(vote[q_index].category for vote in votes)
        for q_index, q in enumerate(questions)
    }

    print(question_to_count) # TODO

    return [
        CategorisedQuestion(
            question=q,
            category=question_to_count[q].most_common(1)[0][0]
        )
        for q in questions
    ]

def load_questions(path: str) -> Questions:
    with open(path, encoding="utf-8") as f:
        try:
            j = json.load(f)
            return Questions(
                categorised=[
                    CategorisedQuestion(
                        question=c["question"],
                        category=c["category"],
                    ) for c in j["categorised"]
                ],
                uncategorised=j["uncategorised"],
            )
        except:
            f.seek(0)
            j = [l.strip() for l in f.readlines()]
            return Questions(categorised=[], uncategorised=j)

def save_questions(path: str, questions: Questions):
    j = {
        'categorised': [
            {'question': q.question, 'category': q.category}
            for q in questions.categorised
        ],
        'uncategorised': questions.uncategorised,
    }
    j_str = json.dumps(j, indent=2)

    with open(path, 'w', encoding="utf-8") as f:
        f.write(j_str)

def chunker(seq, size):
    reversed_seq = list(reversed(seq))
    return [reversed_seq[pos:pos + size] for pos in range(0, len(reversed_seq), size)]

def pop_n(l, n):
    for _ in range(n):
        l.pop()

def categorise_questions_in_place(questions: Questions, checkpoint_func):
    for batch in chunker(questions.uncategorised, 10):
        chunk_size = len(batch)

        categorised_batch = categorise_batch(batch)

        pop_n(l=questions.uncategorised, n=chunk_size)
        questions.categorised.extend(categorised_batch)

        checkpoint_func(questions)
        print(
            f'#categorised={len(questions.categorised)}, #uncategorised={len(questions.uncategorised)}'
        )

def checkpoint_func(questions: Questions):
    save_questions(question_path, questions)

def main():
    questions = load_questions(question_path)
    categorise_questions_in_place(questions, checkpoint_func)

main()
