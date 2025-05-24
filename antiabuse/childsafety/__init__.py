import re

_re_adult_ages_as_numbers = r'([1-9][0-9][mfy]?)'

_re_adult_ages_as_words = r'(eighteen|nineteen|twenty)'

_re_adult_ages = rf'({_re_adult_ages_as_numbers}|{_re_adult_ages_as_words})'

_re_minor_ages_as_numbers = r'(1[0-7][mfy]?)'

_re_minor_ages_as_words = (
    '(ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen)')

_re_minor_ages = rf'({_re_minor_ages_as_numbers}|{_re_minor_ages_as_words})'

_re_palindomic_minor_ages = rf'([1-7]1)'

_re_palindome_assertion = rf'(backwards|backward|🔄)'

_re_minor_declarations = (
        rf'((underage)|'
        rf'(under\s+{_re_adult_ages})|'
        rf'(not\s+{_re_adult_ages})|'
        rf'(minor)|'
        rf'(turn\s+{_re_adult_ages})|'
        rf'(turning\s+{_re_adult_ages})|'
        rf'({_re_palindomic_minor_ages}\s*{_re_palindome_assertion}))')

_re_minor = rf'\b(({_re_minor_ages}|{_re_minor_declarations})\b)'

_re_neg_prev = {
    'for',
    'since',
    'when',
    'was',
    'over',
    'about',
    'around',
    'approximately',
    'after',
    'than',
    'past',
    'last',
    'in',
    'before',

    # Misc patterns
    '\d+[-:.,/]',
    '\s+\$',
}

_re_neg_next = {
    # Measure words
    "lb", "lbs", "pound", "pounds", "kg", "kilo", "kilos", "kilogram", "kilograms",
    "km", "kilometer", "kilometers", "kilometre", "kilometres", "mile", "miles", "mi",
    "ft", "feet", "inch", "inches", "cm", "mm", "meter", "meters", "metre", "metres",
    "oz", "ounces", "g", "grams", "bmi", "%", "percent", "reps", "rep", "sets", "set",
    "hour", "hours", "hr", "hrs", "minute", "minutes", "min", "mins",
    "second", "seconds", "sec", "secs", "times", "dollar", "dollars",

    # Months
    "january","february","march","april","may","june","july",
    "august","september","october","november","december",
    "jan","feb","mar","apr","jun","jul","aug","sept","sep","oct","nov","dec",

    # Misc patterns
    'years\s+ago',
    '%\s+',
    'percent',
    'more',
    '[-:.,/]\d+',
    '\$\s+',
}


def excludable(text: str, match) -> bool:
    left_context = text[:match.start()]
    match_text = match.group()
    right_context = text[match.end():]

    for r in _re_neg_prev:
        if re.search(rf'\b{r}$', left_context.strip(), re.IGNORECASE):
            return True

    for r in _re_neg_next:
        if re.search(rf'^{r}\b', right_context.strip(), re.IGNORECASE):
            return True

    return False


# Deliberately designed to be high-recall, low-precision. Later stages of the
# pipeline will filter false positives.
def potential_minor(text: str) -> bool:
    matches = list(re.finditer(_re_minor, text, re.IGNORECASE | re.MULTILINE))

    filtered_matches = [m for m in matches if not excludable(text, m)]

    return bool(filtered_matches)
