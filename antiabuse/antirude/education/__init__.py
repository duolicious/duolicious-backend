from antiabuse.normalize import normalize_string
from antiabuse.antirude.clubname import is_allowed_club_name
from antiabuse.normalize.normalizationlists import education

def is_rude(name: str) -> bool:
    normalized_name = normalize_string(name, education)

    return not is_allowed_club_name(normalized_name)
