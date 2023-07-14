#!/usr/bin/env python3

import statistics
import openai
import sys
from typing import List, NamedTuple, Optional
import json
from random import shuffle
import re
from multiprocessing import Pool
import itertools
import functools
from dataclasses import dataclass
import time

class Props(NamedTuple):
    ppgy: float
    pagy: float
    ppgn: float
    pagn: float

@dataclass
class QuestionTraitPair:
    question: str
    trait: str

    responses: List[int]
    anti_responses: List[int]

    def json(self):
        return dict(
            question=self.question,
            trait=self.trait,
            responses=self.responses,
            anti_responses=self.anti_responses,
            presence_given_yes=self.presence_given_yes(),
            absence_given_yes=self.absence_given_yes(),
            presence_given_no=self.presence_given_no(),
            absence_given_no=self.absence_given_no(),
            information=self.information()
        )

    def props(self) -> Props:
        try:
            return self._props # type: ignore
        except AttributeError:
            pass

        m1 = statistics.mean(self.responses)
        m2 = statistics.mean(self.anti_responses)

        if abs(m1 - m2) < 1e-5:
            self._props = Props(
                ppgy=0.5,
                pagy=0.5,
                ppgn=0.5,
                pagn=0.5,
            )
            return self._props

        s1 = statistics.stdev(self.responses) + 2
        s2 = statistics.stdev(self.anti_responses) + 2

        cut_off = statistics.mean(self.responses + self.anti_responses)

        p1 = (
                statistics.NormalDist(mu=m1, sigma=s1).cdf(10) -
                statistics.NormalDist(mu=m1, sigma=s1).cdf(cut_off))
        p2 = (
                statistics.NormalDist(mu=m2, sigma=s2).cdf(10) -
                statistics.NormalDist(mu=m2, sigma=s2).cdf(cut_off))
        q1 = (
                statistics.NormalDist(mu=m1, sigma=s1).cdf(cut_off) -
                statistics.NormalDist(mu=m1, sigma=s1).cdf(0))
        q2 = (
                statistics.NormalDist(mu=m2, sigma=s2).cdf(cut_off) -
                statistics.NormalDist(mu=m2, sigma=s2).cdf(0))

        self._props = Props(
            ppgy=p1 / (p1 + p2),
            pagy=p2 / (p1 + p2),
            ppgn=q1 / (q1 + q2),
            pagn=q2 / (q1 + q2),
        )

        return self._props

    def presence_given_yes(self):
        return self.props().ppgy

    def absence_given_yes(self):
        return self.props().pagy

    def presence_given_no(self):
        return self.props().ppgn

    def absence_given_no(self):
        return self.props().pagn

    def information(self):
        return 0.5 * (
                abs(self.presence_given_yes() - 0.5) +
                abs(self.absence_given_yes() - 0.5) +
                abs(self.presence_given_no() - 0.5) +
                abs(self.absence_given_no() - 0.5))

class Questions(NamedTuple):
    archetypeised: List[QuestionTraitPair]
    unarchetypeised: List[str]

    def json(self):
        return dict(
            archetypeised=list_json(self.archetypeised),
            unarchetypeised=self.unarchetypeised
        )

    def save(self, path):
        j_str = json.dumps(self.json(), indent=2)
        with open(path, 'w', encoding="utf-8") as f:
            f.write(j_str)

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

def list_json(xs: List):
    return [x.json() for x in xs]

def load_question_trait_pair(j):
    return QuestionTraitPair(
        question=j["question"],
        trait=j["trait"],
        responses=j["responses"],
        anti_responses=j["anti_responses"],
    )

def load_questions(path: str) -> Questions:
    with open(path, encoding="utf-8") as f:
        try:
            j = json.load(f)
            return Questions(
                archetypeised=[
                    load_question_trait_pair(question)
                    for question in j["archetypeised"]],
                unarchetypeised=j["unarchetypeised"]
            )
        except (json.decoder.JSONDecodeError, KeyError):
            f.seek(0)
            j = [l.strip() for l in f.readlines()]
            return Questions(archetypeised=[], unarchetypeised=j)

class Trait(NamedTuple):
    trait: str

    prompt_phrase: str
    anti_prompt_phrase: str

TRAITS = [
    Trait(
        trait="Introversion/Extraversion",
        prompt_phrase="Pretend you're an extraverted person",
        anti_prompt_phrase="Pretend you're an introverted person",
    ),
    Trait(
        trait="Thinking/Feeling",
        prompt_phrase="Pretend your MBTI says you are more of a feeling type than a thinking type",
        anti_prompt_phrase="Pretend your MBTI says are more of a thinking type than a feeling type",
    ),
    Trait(
        trait="Sensing/Intuition",
        prompt_phrase="Pretend your MBTI says you are more of an intuitive type than a sensing type",
        anti_prompt_phrase="Pretend your MBTI says you are more of a sensing type than an intuitive type",
    ),
    Trait(
        trait="Judging/Perceiving",
        prompt_phrase="Pretend your MBTI says you are more of a perceiving type than a judging type",
        anti_prompt_phrase="Pretend your MBTI says you are more of a judging type than a perceiving type",
    ),
    Trait(
        trait="Conscientiousness",
        prompt_phrase="Pretend your Big Five personality traits say you're high in conscientiousness",
        anti_prompt_phrase="Pretend your Big Five personality traits say you're low in conscientiousness",
    ),
    Trait(
        trait="Agreeableness",
        prompt_phrase="Pretend your Big Five personality traits say you're high in agreeableness",
        anti_prompt_phrase="Pretend your Big Five personality traits say you're low in agreeableness",
    ),
    Trait(
        trait="Neuroticism",
        prompt_phrase="Pretend your Big Five personality traits say you're high in neuroticism",
        anti_prompt_phrase="Pretend your Big Five personality traits say you're low in neuroticism",
    ),
    Trait(
        trait="Individualism/Collectivism",
        prompt_phrase="Pretend that you prefer collectivism over individualism. In other words, pretend you prioritize collective good and social cohesion over individual rights and freedoms",
        anti_prompt_phrase="Pretend you prefer individualism over collectivism. In other words, pretend you prioritize individual rights and freedoms over collective good and social cohesion",
    ),
    Trait(
        trait="Libertarianism/Authoritarianism",
        prompt_phrase="Pretend you lean more towards authoritarianism than libertarianism",
        anti_prompt_phrase="Pretend you lean more towards libertarianism than authoritarianism",
    ),
    Trait(
        trait="Environmentalism/Anthropocentrism",
        prompt_phrase="Pretend you prefer anthropocentrism over environmentalism. In other words, pretend you prioritize human-centered resource utilization and economic development (over preserving the environment and non-human species)",
        anti_prompt_phrase="Pretend you prefer environmentalism over anthropocentrism. In other words, pretend you prioritize preserving the environment and non-human species (over human-centered resource utilization and economic development)",
    ),
    Trait(
        trait="Isolationism/Internationalism",
        prompt_phrase="Pretend you lean more towards internationalism than isolationism. In other words, pretend your political stance favors global engagement and active participation in international affairs (over national self-reliance)",
        anti_prompt_phrase="Pretend you lean more towards isolationism than internationalism. In other words, pretend your political stance favors national self-reliance and limited global engagement (over active participation in international affairs)",
    ),
    Trait(
        trait="Security/Freedom",
        prompt_phrase="Pretend you prioritize individual freedoms and civil liberties over national security and public safety",
        anti_prompt_phrase="Pretend you prioritize national security and public safety over individual freedoms and civil liberties",
    ),
    Trait(
        trait="Non-interventionism/Interventionism",
        prompt_phrase="Pretend you have a preference for an active foreign policy with military and diplomatic interventions (versus a non-interventionist approach that emphasizes diplomacy and trade). That is, pretend you prefer interventionism over non-interventionism",
        anti_prompt_phrase="Pretend you have a preference for a non-interventionist approach that emphasizes diplomacy and trade (versus an active foreign policy with military and diplomatic interventions). That is, pretend you prefer non-interventionism over interventionism",
    ),
    Trait(
        trait="Equity/Meritocracy",
        prompt_phrase="Pretend you value meritocracy more than equity",
        anti_prompt_phrase="Pretend you value equity more than meritocracy",
    ),
    Trait(
        trait="Empathy",
        prompt_phrase="Pretend you're highly empathetic",
        anti_prompt_phrase="Pretend you're not particularly empathetic",
    ),
    Trait(
        trait="Honesty",
        prompt_phrase="Pretend you are a particularly honest person",
        anti_prompt_phrase="Pretend you're somebody who isn't particularly honest. Your default behavior isn't necessarily to lie. You're just not an especially honest person",
    ),
    Trait(
        trait="Humility",
        prompt_phrase="Pretend you are particularly humble",
        anti_prompt_phrase="Pretend you are not particularly humble",
    ),
    Trait(
        trait="Independence",
        prompt_phrase="Pretend you are particularly independent",
        anti_prompt_phrase="Pretend you do not particularly value your independence",
    ),
    Trait(
        trait="Patience",
        prompt_phrase="Pretend you are particularly patient",
        anti_prompt_phrase="Pretend you are not particularly patient",
    ),
    Trait(
        trait="Persistence",
        prompt_phrase="Pretend you are a person who scored highly on a psychometric test for persistence",
        anti_prompt_phrase="Pretend you are a person who scored low on a psychometric test for persistence",
    ),
    Trait(
        trait="Playfulness",
        prompt_phrase="Pretend you are particularly playful",
        anti_prompt_phrase="Pretend you are a serious person",
    ),
    Trait(
        trait="Rationality",
        prompt_phrase="Pretend you are a particularly rational person",
        anti_prompt_phrase="Pretend you are not a particularly rational person",
    ),
    Trait(
        trait="Religiosity",
        prompt_phrase="Pretend you are particularly religious",
        anti_prompt_phrase="Pretend you are non-religious",
    ),
    Trait(
        trait="Self-acceptance",
        prompt_phrase="Pretend you have high self-acceptance",
        anti_prompt_phrase="Pretend you struggle with self-acceptance",
    ),
    Trait(
        trait="Sex Focus",
        prompt_phrase="Pretend you are particularly interested in sex",
        anti_prompt_phrase="Pretend not particularly interested in sex",
    ),
    Trait(
        trait="Thriftiness",
        prompt_phrase="Pretend you are particularly thrifty",
        anti_prompt_phrase="Pretend you do not particularly value thriftiness",
    ),
    Trait(
        trait="Thrill-seeking",
        prompt_phrase="Pretend you are particularly thrill-seeking",
        anti_prompt_phrase="Pretend you are cautious/consistent person",
    ),
    Trait(
        trait="Drug Friendliness",
        prompt_phrase="Pretend you use recreational drugs and that you're okay with others using them too. Your liberal stance on drug use has little to no influence on any other area of your life, such as sex or politics. Aside from your stance on drugs, you are no more or less \"fun\" or \"boring\" than the average person. For example, when asked, \"Do you like to attend parties?\" you will answer as a completely average person would. But when asked, \"Do you think weed should be legal?\" you will emphatically answer \"yes\"",
        anti_prompt_phrase="Pretend you dislike drug use, including recreational drugs, alcohol and even prescription drugs. Your hard-line stance on drugs has no influence on any other area of your life, such as sex or politics. Aside from your stance on drugs, you are no more or less \"fun\" or \"boring\" than the average person. For example, when asked, \"Do you like to attend parties?\" you will answer as a completely average person would. But when asked, \"Do you think weed should be legal?\" you will emphatically answer \"no\"",
    ),
    Trait(
        trait="Emotional Openness in Relationships",
        prompt_phrase="Pretend you are very open and expressive with your feelings in relationships",
        anti_prompt_phrase="Pretend you struggle with expressing your emotions in relationships",
    ),
    Trait(
        trait="Equanimity",
        prompt_phrase="Pretend you maintain calmness and composure, especially in difficult situations",
        anti_prompt_phrase="Pretend you easily lose your calmness and composure in difficult situations",
    ),
    Trait(
        trait="Family Focus",
        prompt_phrase="Pretend you place the utmost importance on family",
        anti_prompt_phrase="Pretend you do not place a strong emphasis on family in your life",
    ),
    Trait(
        trait="Loyalty",
        prompt_phrase="Pretend you are extremely loyal to those close to you",
        anti_prompt_phrase="Pretend you struggle with maintaining loyalty to others",
    ),
    Trait(
        trait="Preference for Monogamy",
        prompt_phrase="Pretend you strongly prefer monogamous relationships",
        anti_prompt_phrase="Pretend you do not prioritize monogamy in your relationships",
    ),
    Trait(
        trait="Trust",
        prompt_phrase="Pretend you easily trust others and believe in their goodness",
        anti_prompt_phrase="Pretend you struggle to trust others and are often suspicious of their intentions",
    ),
    Trait(
        trait="Self-esteem",
        prompt_phrase="Pretend you have high self-esteem",
        anti_prompt_phrase="Pretend you have low self-esteem",
    ),
    Trait(
        trait="Anxious Attachment",
        prompt_phrase="Pretend to have an anxious attachment style. Those with an anxious attachment style often worry about their relationships. They may feel insecure about their partner's feelings for them and fear rejection or abandonment. These individuals may require constant reassurance and can exhibit 'clingy' behaviors. An anxious attachment style often stems from inconsistent caregiving in childhood, where the caregiver sometimes responded to the child's needs and sometimes didn't, resulting in confusion and anxiety about whether they could rely on their caregiver or not. Your age is between 18 and 30",
        anti_prompt_phrase="Pretend to be a normal person aged between 18 and 30"
    ),
    Trait(
        trait="Avoidant Attachment",
        prompt_phrase="Pretend to have an avoidant attachment style. Individuals with an avoidant attachment style tend to be emotionally distant in relationships. They may seem independent and self-reliant, preferring not to rely on others or show their vulnerability. They might find it difficult to show their feelings and often do not seek comfort from others when they're upset. This pattern often stems from a childhood where emotional needs were not met or outright ignored",
        anti_prompt_phrase="Pretend to be a normal person aged between 18 and 30"
    ),
    Trait(
        trait="Career Focus",
        prompt_phrase="Pretend you value your career more than other aspects of your life, such as leisure, recreation, socialising, and so forth. You are not a caricature of such a person; You would not kick puppies for the mere sake of advancing your career. You represent a real person, perhaps in their late 20s or early 30s, who I might meet in the central business district of a big city, who takes their career seriously",
        anti_prompt_phrase="Pretend to be a normal person aged between 18 and 30",
    ),
    Trait(
        trait="Emphasis on Boundaries",
        prompt_phrase="Pretend that you value PERSONAL BOUNDARIES somewhat more than most people do. You're good at asserting your personal boundaries in a healthy way and you respect other people's boundaries too. Aside from your healthy boundaries, you are no more or less \"fun\" or \"boring\" than the average person. For example, when asked, \"Do you like to attend parties?\" you will answer as a completely average person would. But when asked, \"Is it okay for your partner to snoop through your phone?\" you will emphatically answer \"no\"",
        anti_prompt_phrase="Pretend that you value PERSONAL BOUNDARIES somewhat less than most people do. You have boundaries, like everyone does, but you're not especially eager to assert them, and you're somewhat less respectful of others' boundaries too. Aside from your healthy boundaries, you are no more or less \"fun\" or \"boring\" than the average person. For example, when asked, \"Do you like to attend parties?\" you will answer as a completely average person would. But when asked, \"Is it okay for your partner to snoop through your phone?\" you'll lean more towards \"yes\" than most people would"
    ),
    Trait(
        trait="Fitness Focus",
        prompt_phrase="Pretend that physical fitness and maintaining an active lifestyle are important to you. It doesn't affect other aspects of your life. Health and fitness are just more important to you than they are to most people",
        anti_prompt_phrase="Pretend you don't emphasize physical fitness and an active lifestyle. You're not the world's most sedentary person or totally lazy. In fact, you're quite normal. You just have other priorities",
    ),
    Trait(
        trait="Stability of Self-image",
        prompt_phrase="Pretend you are someone who, if formally tested by a psychologist, would be found to have an UNSTABLE SELF-IMAGE",
        anti_prompt_phrase="Pretend you are someone who, if formally tested by a psychologist, would be found to have a particularly STABLE SELF-IMAGE",
    ),
    Trait(
        trait="Love Focus",
        prompt_phrase="Pretend you are someone who is single and wants to find love (as opposed to sex or a short-term relationship)",
        anti_prompt_phrase="Pretend you are someone on a dating site who isn't particularly interested in finding a long-term relationship. You might be more interested in sex or short-term relationships"
    ),
    Trait(
        trait="Maturity",
        prompt_phrase="Pretend you are a grown-up. You might have a full-time job, a mortgage, kids, and so forth",
        anti_prompt_phrase="Pretend you are in your late teens or early 20's",
    ),
    Trait(
        trait="Wholesomeness",
        prompt_phrase="Pretend you are wholesome. For example, you avoid swearing, you do not have any tattoos, and you do not do drugs. You are not distinctly boring or exciting; But when you have fun it's in a wholesome way",
        anti_prompt_phrase="Pretend you are not particularly wholesome. For example, you have a bit of a potty mouth, you like tattoos, and you do not see anything wrong with drugs. Despite how unwholesome you are, you are about as boring/exciting as everyone else; You are just not especially proper"
    ),
    Trait(
        trait="Traditionalism about Love",
        prompt_phrase="Pretend you are someone who is old-fashioned when it comes to love and romance. Your political views are entirely normal though",
        anti_prompt_phrase="Pretend you are someone who is not old-fashioned when it comes to love and romance. Your political views are entirely normal though",
    ),
    Trait(
        trait="Openness to Experience",
        prompt_phrase="Pretend your Big Five personality traits say you're high in openness to experience",
        anti_prompt_phrase="Pretend your Big Five personality traits say you're low in openness to experience",
    ),
]

batch_prompt_fmt = """
{prompt_phrase}. You are otherwise completely average. Now, on a scale from 0 to 10, how strongly would you say you "yes" to the questions listed below? Express your answer as a JSON object in the format {{ "q1": number, "q2": number, ... "qN": number }}. Do not explain your answer. The list of questions is as follows:

{questions}
""".strip()

def batch_question_str(questions: List[str]) -> str:
    return '\n'.join(f'q{i+1}. {q}' for i, q in enumerate(questions))

def batch_prompt(prompt_phrase: str, questions: List[str]) -> str:
    return batch_prompt_fmt.format(
        prompt_phrase=prompt_phrase,
        questions=batch_question_str(questions),
    )

def chunker(seq, size):
    reversed_seq = list(reversed(seq))
    return [reversed_seq[pos:pos + size] for pos in range(0, len(reversed_seq), size)]

def pop_n(l, n):
    for _ in range(n):
        l.pop()

def archetypeise_batch_for_one_trait_once(
    trait: Trait,
    questions: List[str],
    anti_trait: bool
) -> List[int]:
    if anti_trait:
        prompt = batch_prompt(trait.anti_prompt_phrase, questions)
    else:
        prompt = batch_prompt(trait.prompt_phrase, questions)

    completion = None
    while not completion:
        try:
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
        except openai.error.RateLimitError as e:
            time.sleep(1)
        except Exception as e:
            print(str(e))

    raw_batch_response = completion.choices[0].message["content"]
    print('\n')
    print('\n')
    print(
f"""
{prompt}
raw_batch_response: {raw_batch_response}
""".strip()
    )

    parsed_batch_response = re.sub('[^q,:0-9]', '', raw_batch_response).split(',')
    parsed_batch_response = [int(nc.split(':')[1]) for nc in parsed_batch_response]

    return parsed_batch_response

def archetypeise_questions_for_trait(
    trait: Trait,
    questions: List[str],
) -> List[QuestionTraitPair]:
    question_trait_pairs = [
        QuestionTraitPair(
            question=question,
            trait=trait.trait,
            responses=[],
            anti_responses=[]
        )
        for question in questions]

    for _ in range(5):
        s, u = reversible_shuffle(len(questions))
        responses = u(archetypeise_batch_for_one_trait_once(
            trait=trait, questions=s(questions), anti_trait=False))

        s, u = reversible_shuffle(len(questions))
        anti_responses = u(archetypeise_batch_for_one_trait_once(
            trait=trait, questions=s(questions), anti_trait=True))

        for question_trait_pair, response, anti_response in zip(
                question_trait_pairs, responses, anti_responses):
            question_trait_pair.responses.append(response)
            question_trait_pair.anti_responses.append(anti_response)

    return question_trait_pairs

class Archetypeise_questions_for_trait:
    def __init__(self, questions: List[str]):
        self.questions = questions

    def archetypeise_questions_for_trait(self, trait: Trait):
        return archetypeise_questions_for_trait(trait, self.questions)

def archetypeise_batch(questions: List[str]) -> List[QuestionTraitPair]:
    a = Archetypeise_questions_for_trait(questions)
    with Pool(12) as p:
        return list(itertools.chain.from_iterable(
            p.map(a.archetypeise_questions_for_trait, TRAITS)
        ))

def archetypeise_questions_in_place(questions: Questions, checkpoint_func):
    batch_size = 49
    for i, batch in enumerate(chunker(questions.unarchetypeised, batch_size)):
        chunk_size = len(batch)

        archetypeised_batch = archetypeise_batch(batch)

        pop_n(l=questions.unarchetypeised, n=chunk_size)
        questions.archetypeised.extend(archetypeised_batch)

        checkpoint_func()
        print(
            f'#archetypeised={len(questions.archetypeised)} '
            f'#unarchetypeised={len(questions.unarchetypeised)}'
        )

def main():
    questions = load_questions(QUESTION_PATH)
    def checkpoint_func():
        print('Checkpointing...')
        questions.archetypeised.sort(
            key=lambda q: (q.trait, q.information()),
            reverse=True
        )
        questions.save(QUESTION_PATH)
        print('Done checkpointing')
    archetypeise_questions_in_place(questions, checkpoint_func)
    checkpoint_func()

if __name__ == '__main__':
    QUESTION_PATH = sys.argv[1]

    if not QUESTION_PATH:
        print('invalid question path', file=sys.stderr)
        exit()

    openai.organization = open('/home/christian/.openai-org-id').read().strip()
    openai.api_key = open('/home/christian/.openai-key').read().strip()

    main()
