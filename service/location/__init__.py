from database import transaction
import json
import os

_locations_json_file = os.path.join(
        os.path.dirname(__file__), '..', '..',
        'locations', 'locations.json')

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
                friendly,
                city,
                subdivision,
                country,
                coordinates
            ) VALUES (
                %(friendly)s,
                %(city)s,
                %(subdivision)s,
                %(country)s,
                ST_SetSRID(ST_MakePoint(%(lon)s, %(lat)s), 4326)
            ) ON CONFLICT (friendly) DO NOTHING
            """,
            locations
        )

