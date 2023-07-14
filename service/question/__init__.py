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
    question_id NOT IN (SELECT question_id FROM answered_questions)
ORDER BY personal_question_order.position
LIMIT %(n)s
OFFSET %(o)s
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
                    topic,
                    presence_given_yes,
                    presence_given_no,
                    absence_given_yes,
                    absence_given_no
                ) VALUES (
                    %(question)s,
                    %(topic)s,
                    ARRAY[]::INT[],
                    ARRAY[]::INT[],
                    ARRAY[]::INT[],
                    ARRAY[]::INT[]
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
        tx.execute(
            """
            SELECT COUNT(*)
            FROM question
            WHERE presence_given_yes = ARRAY[]::INT[]
            """
        )
        if tx.fetchone()['count'] > 0:
            tx.execute(
                """
                CREATE TEMPORARY TABLE question_trait_pair (
                    question_id SMALLSERIAL NOT NULL,
                    trait_id SMALLSERIAL NOT NULL,
                    presence_given_yes SMALLINT NOT NULL,
                    presence_given_no SMALLINT NOT NULL,
                    absence_given_yes SMALLINT NOT NULL,
                    absence_given_no SMALLINT NOT NULL,
                    CHECK (presence_given_yes >= 0),
                    CHECK (presence_given_no >= 0),
                    CHECK (absence_given_yes >= 0),
                    CHECK (absence_given_no >= 0),
                    PRIMARY KEY (question_id, trait_id)
                )
                """
            )
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
                    (SELECT id FROM trait WHERE name = %(trait)s),
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
                        presence_given_yes=round(
                            1000 * question.presence_given_yes()),
                        presence_given_no=round(
                            1000 * question.presence_given_no()),
                        absence_given_yes=round(
                            1000 * question.absence_given_yes()),
                        absence_given_no=round(
                            1000 * question.absence_given_no()),
                    )
                    for question in archetypeised_questions.archetypeised
                ]
            )
            tx.execute(
                """
                UPDATE question
                SET
                    presence_given_yes = vector.pgy,
                    presence_given_no  = vector.pgn,
                    absence_given_yes  = vector.agy,
                    absence_given_no   = vector.agn
                FROM (
                    SELECT
                        question_id,
                        ARRAY_AGG(presence_given_yes ORDER BY trait_id) AS pgy,
                        ARRAY_AGG(presence_given_no  ORDER BY trait_id) AS pgn,
                        ARRAY_AGG(absence_given_yes  ORDER BY trait_id) AS agy,
                        ARRAY_AGG(absence_given_no   ORDER BY trait_id) AS agn
                    FROM question_trait_pair
                    GROUP BY question_id
                ) AS vector
                WHERE vector.question_id = question.id
                """
            )

def get_next_questions(s: t.SessionInfo, n: str, o: str):
    params = dict(
        person_id=s.person_id,
        n=int(n),
        o=int(o)
    )

    with transaction('READ COMMITTED') as tx:
        tx.execute(Q_GET_NEXT_QUESTIONS, params)
        return tx.fetchall()
