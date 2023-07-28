def create_dbs():
    # All this stuff just to run `CREATE DATABASE IF NOT EXISTS duo_api`
    import os
    import psycopg
    import time

    DB_HOST = os.environ['DUO_DB_HOST']
    DB_PORT = os.environ['DUO_DB_PORT']
    DB_USER = os.environ['DUO_DB_USER']
    DB_PASS = os.environ['DUO_DB_PASS']

    _conninfo = psycopg.conninfo.make_conninfo(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASS,
    )

    def create_db(name):
        try:
            with psycopg.connect(_conninfo, autocommit=True) as conn:
                with conn.cursor() as cur:
                    cur.execute(f"CREATE DATABASE {name}")
            print(f'Created database: {name}')
        except (psycopg.errors.DuplicateDatabase, psycopg.errors.UniqueViolation):
            print(f'Database already exists: {name}')

    for _ in range(10):
        try:
            create_db("duo_api")
            break
        except psycopg.OperationalError as e:
            print('Creating database(s) failed; waiting and trying again:', e)
            time.sleep(1)

def init_db():
    # Now duo_api exists, we do do the rest of the init.
    from service import (
        application,
        location,
        person,
        question,
    )

    init_funcs = [
        application.init_db,
        location.init_db,
        question.init_db,
        person.init_db,
    ]

    print('Initializing DB...')
    for i, init_func in enumerate(init_funcs, start=1):
        print(f'  * {i} of {len(init_funcs)}')
        init_func()
    print('Finished initializing DB')

create_dbs()
init_db()
