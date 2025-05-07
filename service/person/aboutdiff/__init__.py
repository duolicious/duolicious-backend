import difflib
import re
from typing import Tuple
from util.timeout import run_with_timeout


def get_last_addition(old: str, new: str) -> Tuple[int, int] | None:
    try:
        sm = run_with_timeout(
            0.5,
            difflib.SequenceMatcher,
            None,
            old,
            new
        )
    except TimeoutError:
        return None

    additions = [
        (j1, j2)
        for tag, i1, i2, j1, j2 in sm.get_opcodes()
        if tag in ('insert', 'replace') and j2 > j1
    ]

    return additions[-1] if additions else None


def diff_addition_with_context(
    old: str,
    new: str,
    window_size: int = 250
) -> str | None:
    stripped_new = new.strip()

    last = get_last_addition(old, stripped_new)
    if not last:
        return None

    start_addition, end_addition = last

    # Try to pick a sentence/line boundary that both precedes the insertion and
    # still lets us cover it.
    boundary_pattern = re.compile(r'[.!?\n]')
    boundaries = [0] + [m.end() + 1 for m in boundary_pattern.finditer(stripped_new)]

    # Target for centering: half a window before the insertion
    target = start_addition - window_size // 2

    # Find all boundaries such that `boundary <= start_addition`
    # (i.e. the boundary starts before the insertion)
    left_boundaries = [
        boundary for boundary in boundaries
        if boundary <= start_addition
    ]

    best_boundary = min(left_boundaries, key=lambda b: abs(b - target))

    snippet = stripped_new[best_boundary:best_boundary + window_size]

    stripped_snippet = snippet.strip()

    if not stripped_snippet:
        return None

    insertion_length = end_addition - start_addition

    if insertion_length > window_size:
        return stripped_snippet + '…'
    else:
        return stripped_snippet
