from antiabuse.normalize import normalize_string
from antiabuse.antirude.clubname import is_allowed_club_name
from antiabuse.normalize.normalizationlists import occupation

def is_rude(name: str) -> bool:
    normalized_name = normalize_string(name, occupation)

    return not is_allowed_club_name(normalized_name)
