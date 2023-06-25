import os
from database import transaction
import duotypes as t
from questions.archetypeise_questions import load_questions
from typing import List, Optional
import json

_categorised_question_json_file = os.path.join(
        os.path.dirname(__file__), '..', '..',
        'questions', 'questions-categorised.txt')

_archetypeised_question_json_file = os.path.join(
        os.path.dirname(__file__), '..', '..',
        'questions', 'questions-archetypeised.txt')

_questions_text_file = os.path.join(
        os.path.dirname(__file__), '..', '..',
        'questions', 'questions.txt')

Q_GET_NEXT_QUESTIONS = """
WITH
personal_question_order AS (
    SELECT
        question_id,
        position
    FROM question_order
    WHERE person_id = %(person_id)s
),
answered_questions AS (
    SELECT question_id
    FROM answer
    WHERE person_id = %(person_id)s
)
SELECT
    id,
    question,
    topic,
    count_yes,
    count_no
FROM question
JOIN personal_question_order
ON question.id = personal_question_order.question_id
WHERE
    question.visible = TRUE AND
    question_id NOT IN (SELECT question_id FROM answered_questions)
ORDER BY personal_question_order.position
LIMIT %(n)s
OFFSET %(o)s
"""

Q_INCREMENT_VIEWS = """
UPDATE question
SET count_views = count_views + 1
WHERE id = %(question_id)s
"""

def init_db():
    with open(_categorised_question_json_file) as f:
        categorised_questions = json.load(f)

    with open(_questions_text_file) as f:
        question_to_index = {l.strip(): i for i, l in enumerate(f.readlines())}

    categorised_questions["categorised"].sort(
        key=lambda q: question_to_index[q["question"]])

    with transaction() as tx:
        tx.execute('SELECT COUNT(*) FROM question')
        if tx.fetchone()['count'] == 0:
            tx.executemany(
                """
                INSERT INTO question (
                    question,
                    topic
                ) VALUES (
                    %(question)s,
                    %(topic)s
                )
                """,
                [
                    dict(
                        question=question["question"],
                        topic=question["category"].capitalize(),
                    )
                    for question in categorised_questions["categorised"]
                ]
            )

    archetypeised_questions = load_questions(_archetypeised_question_json_file)

    with transaction() as tx:
        tx.execute('SELECT COUNT(*) FROM trait')
        if tx.fetchone()['count'] == 0:
            tx.executemany(
                """
                INSERT INTO trait (trait)
                VALUES (%s)
                ON CONFLICT DO NOTHING;
                """,
                list(
                    set(
                        (question.trait,)
                        for question in archetypeised_questions.archetypeised
                    )
                )
            )

    with transaction() as tx:
        tx.execute('SELECT COUNT(*) FROM question_trait_pair')
        if tx.fetchone()['count'] == 0:
            tx.executemany(
                """
                INSERT INTO question_trait_pair (
                    question_id,
                    trait_id,
                    presence_given_yes,
                    presence_given_no,
                    absence_given_yes,
                    absence_given_no
                )
                VALUES (
                    (SELECT id FROM question WHERE question = %(question)s),
                    (SELECT id FROM trait WHERE trait = %(trait)s),
                    %(presence_given_yes)s,
                    %(presence_given_no)s,
                    %(absence_given_yes)s,
                    %(absence_given_no)s
                );
                """,
                [
                    dict(
                        question=question.question,
                        trait=question.trait,
                        presence_given_yes=round(1000 * question.presence_given_yes() ** 2),
                        presence_given_no=round(1000 * question.presence_given_no() ** 2),
                        absence_given_yes=round(1000 * question.absence_given_yes() ** 2),
                        absence_given_no=round(1000 * question.absence_given_no() ** 2),
                    )
                    for question in archetypeised_questions.archetypeised
                    if question.information() > 0.25
                ]
            )

def get_next_questions(s: t.SessionInfo, n: int, o: int):
    params = dict(person_id=s.person_id, n=n, o=o)
    with transaction() as tx:
        tx.execute(Q_GET_NEXT_QUESTIONS, params)
        return tx.fetchall()

def post_view_question(req: t.PostViewQuestion):
    params = dict(question_id=req.question_id)
    with transaction('READ COMMITTED') as tx:
        tx.execute(Q_INCREMENT_VIEWS, params)
