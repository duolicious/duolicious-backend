from collections.abc import Mapping, Sequence


def number(value: object) -> int | float:
    if not isinstance(value, (int, float)):
        return 0
    return value


def optional_str(value: object) -> str | None:
    return value if isinstance(value, str) else None


def mapping(value: object) -> Mapping[str, object]:
    if not isinstance(value, dict):
        return {}
    return value


def mapping_sequence(value: object) -> Sequence[Mapping[str, object]] | None:
    if not isinstance(value, list):
        return None
    if not all(isinstance(item, dict) for item in value):
        return None
    return value


def sequence(value: object) -> Sequence[object]:
    return value if isinstance(value, list) else []
