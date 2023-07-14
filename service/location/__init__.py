from database import transaction
import json
import os
from typing import Optional

_locations_json_file = os.path.join(
        os.path.dirname(__file__), '..', '..',
        'locations', 'locations.json')

Q_SEARCH_LOCATIONS = """
SELECT long_friendly
FROM location
WHERE long_friendly ILIKE %(first_character)s || '%%'
ORDER BY long_friendly <-> %(search_string)s
LIMIT 10
"""

def init_db():
    with open(_locations_json_file) as f:
        locations = json.load(f)

    with transaction() as tx:
        tx.execute("SELECT COUNT(*) FROM location")
        if tx.fetchone()['count'] != 0:
            return

        tx.executemany(
            """
            INSERT INTO Location (
                short_friendly,
                long_friendly,
                city,
                subdivision,
                country,
                coordinates
            ) VALUES (
                %(short_friendly)s,
                %(long_friendly)s,
                %(city)s,
                %(subdivision)s,
                %(country)s,
                ST_SetSRID(ST_MakePoint(%(lon)s, %(lat)s), 4326)
            ) ON CONFLICT DO NOTHING
            """,
            locations
        )

def get_search_locations(q: Optional[str]):
    if q is None:
        return []

    normalized_whitespace = ' '.join(q.split())

    if len(normalized_whitespace) < 1:
        return []

    params = dict(
        first_character=normalized_whitespace[0],
        search_string=normalized_whitespace,
    )

    with transaction('READ COMMITTED') as tx:
        tx.execute(Q_SEARCH_LOCATIONS, params)
        return [row['long_friendly'] for row in tx.fetchall()]
