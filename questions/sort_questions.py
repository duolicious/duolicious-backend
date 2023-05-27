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

prompt_path = sys.argv[1]
question_path = sys.argv[2]

if not prompt_path:
    print('invalid prompt path', file=sys.stderr)
    exit()

if not question_path:
    print('invalid question path', file=sys.stderr)
    exit()

# openai.organization = "YOUR_ORG_ID"
openai.api_key = open('/home/christian/.openai-key').read().strip()
prompt_fmt = open(prompt_path).read().strip()

class Questions(NamedTuple):
    sorted: List[str]
    unsorted: List[str]

comparison_number = 0
def cmp(a, b):
    global comparison_number
    comparison_number += 1

    prompt = prompt_fmt.format(a=a, b=b).strip()

    # completion = openai.Completion.create(
    #     model="text-curie-001",
    #     prompt=prompt,
    #     temperature=0,
    #     max_tokens=4
    # )

    # response = completion["choices"][0]["text"].strip()

    completion = None
    while not completion:
        try:
            completion = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.0,
                max_tokens=1,
            )
        except Exception as e:
            print(str(e))

    response = completion.choices[0].message["content"]

    print(
        f"""
{prompt}
response: {response}
response is valid: {response in ["1", "2"]}
comparison number: {comparison_number}
        """.strip(),
        file=sys.stderr,
    )
    print("", file=sys.stderr)

    if response == "1": return -1
    if response == "2": return +1
    return 0

# def cmp(a, b):
#     time.sleep(1)
#     if len(a) < len(b): return -1
#     if len(a) > len(b): return +1
#     return 0

def load_questions(path: str) -> Questions:
    with open(path, encoding="utf-8") as f:
        try:
            j = json.load(f)
            return Questions(
                sorted=j["sorted"],
                unsorted=j["unsorted"],
            )
        except:
            f.seek(0)
            j = [l.strip() for l in f.readlines()]
            return Questions(sorted=[], unsorted=j)

def save_questions(path: str, questions: Questions):
    j = {
        'sorted': questions.sorted,
        'unsorted': questions.unsorted,
    }
    j_str = json.dumps(j, indent=2)

    with open(path, 'w', encoding="utf-8") as f:
        f.write(j_str)

def binary_search(sorted_list, x, cmp):
    left, right = 0, len(sorted_list)

    while left < right:
        mid = (left + right) // 2
        if cmp(sorted_list[mid], x) < 0:
            left = mid + 1
        else:
            right = mid

    return left

def insert_into_sorted_in_place(sorted_list, x, cmp):
    idx = binary_search(sorted_list, x, cmp)
    sorted_list.insert(idx, x)

def sort_next_in_place(questions: Questions, cmp):
    if len(questions.unsorted) == 0:
        return False

    next_question = questions.unsorted.pop()
    insert_into_sorted_in_place(questions.sorted, next_question, cmp)
    return True

def sort_all_in_place(questions: Questions, cmp, checkpoint_func):
    while sort_next_in_place(questions, cmp):
        print(
            f"Checkpointing with #sorted={len(questions.sorted)}, #unsorted={len(questions.unsorted)}",
            file=sys.stderr,
        )
        checkpoint_func(questions)
    print("Finished sorting", file=sys.stderr)

def checkpoint_func(questions: Questions):
    save_questions(question_path, questions)

def main():
    questions = load_questions(question_path)
    sort_all_in_place(questions, cmp, checkpoint_func)

main()
