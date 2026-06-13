import psycopg
import random
import re

# Profiles live at the top level of the web app (/<url_slug>), so a slug must
# never equal one of the app's own routes or it would shadow it. This set must
# mirror the frontend's top-level paths (see App.tsx's linking config) plus the
# legacy URLs the web client normalizes away.
RESERVED_SLUGS = {
    # Top-level static routes.
    'email', 'sign-in', 'qa', 'search', 'feed', 'inbox', 'visitors', 'profile',
    # Prefixes of multi-segment routes.
    'chat', 'gallery', 'in-depth', 'invite',
    # Nested routes under /profile and /search.
    'settings', 'clubs', 'invites', 'filters', 'edit',
    # Legacy URLs the web client rewrites to the root.
    'me', 'welcome',
}

# Number of randomly-suffixed candidates to try before giving up. Each attempt
# draws from one more digit than the last (single digit, then two, ...), so the
# suffix stays short when there's little contention but the space grows fast
# enough that a collision on every attempt is astronomically unlikely. The last
# attempt draws a 10-digit number, which is where the spec says to give up.
_MAX_RANDOM_ATTEMPTS = 10

# A slug must never be UUID-shaped: profiles are also served by uuid, so a
# UUID-shaped slug would collide with a real person's uuid in the profile
# resolver. Such a base is treated as unusable (it gets a numeric suffix, which
# breaks the shape).
_UUID_RE = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')

Q_SELECT_NAME = 'SELECT name FROM person WHERE id = %(person_id)s'
Q_UPDATE_SLUG = 'UPDATE person SET url_slug = %(slug)s WHERE id = %(person_id)s'
Q_SLUG_EXISTS = 'SELECT EXISTS (SELECT 1 FROM person WHERE url_slug = %(slug)s)'

def slug_base(name: str) -> str:
    """Lowercase the name, turn spaces into underscores, and keep only
    [a-z0-9_-]. May return ''."""
    return re.sub(r'[^a-z0-9_-]', '', name.lower().replace(' ', '_'))

def is_base_usable(base: str) -> bool:
    """Whether `base` can be minted as the bare slug, rather than needing a
    numeric suffix. Empty, reserved and UUID-shaped bases are unusable."""
    return (
        bool(base)
        and base not in RESERVED_SLUGS
        and not _UUID_RE.match(base))

def _candidates(base: str):
    """Yields (slug, is_random). The bare base first (when usable), then random
    numeric suffixes that grow by a digit each attempt. Dumb-and-fast: no
    scanning for the next free number."""
    if is_base_usable(base):
        yield base, False

    for digits in range(_MAX_RANDOM_ATTEMPTS):
        lo = 10 ** digits
        hi = 10 ** (digits + 1) - 1
        n = random.randint(lo, hi)
        yield (f'{base}{n}' if base else str(n)), True

def preview_url_slug(tx, base: str) -> dict:
    """Read-only preview of the slug `assign_url_slug` would mint for `base`:
    the first candidate not already taken. Returns {'url_slug', 'is_random'}.
    Doesn't reserve anything, so the eventually-assigned slug can differ (a
    concurrent sign-up takes it first, or the random suffix differs); it's only
    meant to show the user the shape of their URL."""
    for slug, is_random in _candidates(base):
        taken = tx.execute(Q_SLUG_EXISTS, dict(slug=slug)).fetchone()['exists']
        if not taken:
            return dict(url_slug=slug, is_random=is_random)

    raise RuntimeError(f'could not preview url_slug for base {base!r}')

def assign_url_slug(tx, person_id: int) -> dict:
    """Assigns person.url_slug from the display name. Tries the bare slug, then
    random suffixes, relying on the unique index to reject collisions. Each
    attempt runs in a savepoint so a rejection doesn't abort the caller's
    transaction. Returns {'url_slug', 'is_random'}."""
    base = slug_base(
        tx.execute(Q_SELECT_NAME, dict(person_id=person_id)).fetchone()['name'])

    for slug, is_random in _candidates(base):
        try:
            with tx.connection.transaction():
                tx.execute(Q_UPDATE_SLUG, dict(slug=slug, person_id=person_id))
        except psycopg.errors.UniqueViolation:
            continue
        return dict(url_slug=slug, is_random=is_random)

    raise RuntimeError(f'could not assign url_slug for person {person_id}')

async def assign_url_slug_async(tx, person_id: int) -> dict:
    """Async counterpart of `assign_url_slug` for the backfill cron."""
    cur = await tx.execute(Q_SELECT_NAME, dict(person_id=person_id))
    base = slug_base((await cur.fetchone())['name'])

    for slug, is_random in _candidates(base):
        try:
            async with tx.connection.transaction():
                await tx.execute(Q_UPDATE_SLUG, dict(slug=slug, person_id=person_id))
        except psycopg.errors.UniqueViolation:
            continue
        return dict(url_slug=slug, is_random=is_random)

    raise RuntimeError(f'could not assign url_slug for person {person_id}')
