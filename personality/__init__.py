import numpy

# A person's answers are reduced to per-trait `presence`/`absence` scores, which
# in turn produce their personality vector. The stored vector has one extra
# constant dimension appended to the 46 trait dimensions (giving 47) so that it
# is never the zero vector.
TRAIT_COUNT = 46

_CONSTANT_DIMENSION = 1e-5


def given_score_vectors(question, answer):
    """The (presence, absence) score vectors contributed by answering
    `question` (a row with the `*_given_yes`/`*_given_no` arrays) with `answer`.
    A skipped answer (None) contributes nothing."""
    if answer is True:
        return question['presence_given_yes'], question['absence_given_yes']
    if answer is False:
        return question['presence_given_no'], question['absence_given_no']
    return None, None


def fold(presence, absence, count, given_presence, given_absence, sign):
    """Add (sign=+1) or remove (sign=-1) one answer's contribution from the
    accumulated scores. Returns the updated (presence, absence, count)."""
    if given_presence is None or given_absence is None:
        return presence, absence, count

    given_presence = numpy.array(given_presence, dtype=numpy.int64)
    given_absence = numpy.array(given_absence, dtype=numpy.int64)
    excess = numpy.minimum(given_presence, given_absence)

    return (
        presence + sign * (given_presence - excess),
        absence + sign * (given_absence - excess),
        count + sign,
    )


def accumulate(answered_questions):
    """Accumulate scores over a batch of (question, answer) pairs, starting from
    zero. Returns (presence, absence, count) as numpy arrays / int."""
    presence = numpy.zeros(TRAIT_COUNT, dtype=numpy.int64)
    absence = numpy.zeros(TRAIT_COUNT, dtype=numpy.int64)
    count = 0

    for question, answer in answered_questions:
        given_presence, given_absence = given_score_vectors(question, answer)
        presence, absence, count = fold(
            presence, absence, count, given_presence, given_absence, +1)

    return presence, absence, count


def personality_vector(presence_score, absence_score, count_answers):
    """The 47-dim personality vector for the given accumulated scores."""
    presence = numpy.array(presence_score, dtype=numpy.int64)
    absence = numpy.array(absence_score, dtype=numpy.int64)

    denominator = presence + absence
    trait_percentages = numpy.divide(
        presence,
        denominator,
        out=numpy.full(TRAIT_COUNT, 0.5, dtype=numpy.float64),
        where=denominator != 0,
    )

    ll = lambda x: numpy.log(numpy.log(x + 1) + 1)
    weight = numpy.clip(ll(count_answers) / ll(250), 0, 1)

    personality = 2 * trait_percentages - 1
    personality = numpy.concatenate([personality, [_CONSTANT_DIMENSION]])
    personality /= numpy.linalg.norm(personality)
    personality *= weight

    return personality


def to_pgvector(personality):
    """Format a personality vector as a pgvector text literal for `::vector`."""
    return '[' + ','.join(repr(float(x)) for x in personality) + ']'
