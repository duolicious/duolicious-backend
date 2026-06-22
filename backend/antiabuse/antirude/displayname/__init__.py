from antiabuse.normalize import normalize_string
from antiabuse.antirude.clubname import is_allowed_club_name
from antiabuse.normalize.normalizationlists import display_name

def is_rude(name: str) -> bool:
    normalized_name = normalize_string(name, display_name)

    return not is_allowed_club_name(normalized_name)
