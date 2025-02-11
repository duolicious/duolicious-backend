from antiabuse.normalize import normalize_string
from antiabuse.antirude.clubname import is_allowed_club_name

def is_rude(name: str) -> bool:
    normalized_name = normalize_string(name)

    return not is_allowed_club_name(normalized_name)
