from collections.abc import Mapping
from typing import TypeVar, cast


RowT = TypeVar('RowT')


def require_row(row: RowT | None) -> RowT:
    if row is None:
        raise RuntimeError('query returned no row')
    return row


def row_value(row: Mapping[str, object], key: str) -> object:
    return row[key]


def row_bool(row: Mapping[str, object], key: str) -> bool:
    value = row_value(row, key)
    if not isinstance(value, bool):
        raise RuntimeError(f'{key} must be a boolean')
    return value


def row_int(row: Mapping[str, object], key: str) -> int:
    value = row_value(row, key)
    if not isinstance(value, int):
        raise RuntimeError(f'{key} must be an integer')
    return value


def row_str(row: Mapping[str, object], key: str) -> str:
    value = row_value(row, key)
    if not isinstance(value, str):
        raise RuntimeError(f'{key} must be a string')
    return value


def row_str_or_none(row: Mapping[str, object], key: str) -> str | None:
    value = row_value(row, key)
    if value is None or isinstance(value, str):
        return value
    raise RuntimeError(f'{key} must be a string or None')


def row_str_list(row: Mapping[str, object], key: str) -> list[str]:
    value = row_value(row, key)
    if not isinstance(value, list) or not all(isinstance(x, str) for x in value):
        raise RuntimeError(f'{key} must be a list of strings')
    return cast(list[str], value)
