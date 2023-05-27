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
    SELECT
        *
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
WHERE question.visible = TRUE
ORDER BY personal_question_order.position
LIMIT %(n)s
OFFSET (SELECT COUNT(*) FROM answered_questions)
"""

def init_db():
    with open(_categorised_question_json_file) as f:
        categorised_questions = json.load(f)

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
                ON CONFLICT DO NOTHING
                """,
                [
                    dict(
                        question=question["question"],
                        topic=question["category"],
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
                        presence_given_yes=round(1000 * question.presence_given_yes()),
                        presence_given_no=round(1000 * question.presence_given_no()),
                        absence_given_yes=round(1000 * question.absence_given_yes()),
                        absence_given_no=round(1000 * question.absence_given_no()),
                    )
                    for question in archetypeised_questions.archetypeised
                    if question.information() > 0.4
                ]
            )

def get_next_questions(s: t.SessionInfo, n):
    params = dict(person_id=s.person_id, n=n)
    with transaction() as tx:
        tx.execute(Q_GET_NEXT_QUESTIONS, params)
        return tx.fetchall()
