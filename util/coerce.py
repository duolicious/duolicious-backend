from collections.abc import Mapping, Sequence


def number(value: object) -> int | float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise RuntimeError('expected number')
    return value


def optional_str(value: object) -> str | None:
    if value is None or isinstance(value, str):
        return value
    raise RuntimeError('expected string or None')


def mapping(value: object) -> Mapping[str, object]:
    if not isinstance(value, dict):
        raise RuntimeError('expected mapping')
    return value


def mapping_sequence(value: object) -> Sequence[Mapping[str, object]]:
    if not isinstance(value, list):
        raise RuntimeError('expected sequence of mappings')
    if not all(isinstance(item, dict) for item in value):
        raise RuntimeError('expected sequence of mappings')
    return value


def sequence(value: object) -> Sequence[object]:
    if not isinstance(value, list):
        raise RuntimeError('expected sequence')
    return value
