--------------------------------------------------------------------------------
-- EXTENSIONS
--------------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS plpython3u;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;

--------------------------------------------------------------------------------
-- FUNCTIONS (1)
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION array_full(dimensions INT, fill_value FLOAT4)
RETURNS FLOAT4[] AS $$
    SELECT ARRAY(SELECT fill_value FROM generate_series(1, dimensions));
$$ LANGUAGE sql IMMUTABLE LEAKPROOF PARALLEL SAFE;

CREATE OR REPLACE FUNCTION array_full(dimensions INT, fill_value INT)
RETURNS INT[] AS $$
    SELECT ARRAY(SELECT fill_value FROM generate_series(1, dimensions));
$$ LANGUAGE sql IMMUTABLE LEAKPROOF PARALLEL SAFE;

CREATE OR REPLACE FUNCTION clamp(lo FLOAT, hi FLOAT, val FLOAT)
RETURNS FLOAT AS $$
    SELECT LEAST(hi, GREATEST(lo, val));
$$ LANGUAGE sql IMMUTABLE LEAKPROOF PARALLEL SAFE;

--------------------------------------------------------------------------------
-- BASICS
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS gender (
    id SMALLSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS orientation (
    id SMALLSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS location (
    id SERIAL PRIMARY KEY,
    friendly TEXT NOT NULL,
    city TEXT NOT NULL,
    subdivision TEXT NOT NULL,
    country TEXT NOT NULL,
    coordinates GEOGRAPHY(Point, 4326) NOT NULL,
    UNIQUE (friendly)
);

CREATE TABLE IF NOT EXISTS looking_for (
    id SMALLSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS yes_no (
    id SMALLSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS yes_no_optional (
    id SMALLSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS yes_no_maybe (
    id SMALLSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS frequency (
    id SMALLSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS relationship_status (
    id SMALLSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS religion (
    id SMALLSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS star_sign (
    id SMALLSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS unit (
    id SMALLSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS immediacy (
    id SMALLSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    UNIQUE (name)
);

--------------------------------------------------------------------------------
-- MAIN TABLES
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS person (
    id SERIAL,

    -- Required during sign-up
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    date_of_birth DATE NOT NULL,
    coordinates GEOGRAPHY(Point, 4326) NOT NULL,
    gender_id SMALLINT REFERENCES gender(id) NOT NULL,
    about TEXT NOT NULL,

    -- TODO: CREATE INDEX ON person USING ivfflat (personality2 vector_ip_ops) WITH (lists = 100);
    -- There's 47 `trait`s. In principle, it's possible for someone to have a
    -- score of 0 for each trait. We add an extra, constant, non-zero dimension
    -- to avoid that.
    personality VECTOR(48) NOT NULL DEFAULT array_full(48, 0),
    presence_score INT[] NOT NULL DEFAULT array_full(47, 0),
    absence_score INT[] NOT NULL DEFAULT array_full(47, 0),
    count_answers SMALLINT NOT NULL DEFAULT 0,

    -- Verification
    verified_id SMALLINT REFERENCES yes_no(id) NOT NULL DEFAULT 2,
    has_profile_picture_id SMALLINT REFERENCES yes_no(id) NOT NULL DEFAULT 2,

    -- Basics
    orientation_id SMALLINT REFERENCES orientation(id) NOT NULL DEFAULT 1,
    occupation TEXT,
    height_cm SMALLINT,
    looking_for_id SMALLINT REFERENCES looking_for(id) NOT NULL DEFAULT 1,
    smoking_id SMALLINT REFERENCES yes_no_optional(id) NOT NULL DEFAULT 1,
    drinking_id SMALLINT REFERENCES frequency(id) NOT NULL DEFAULT 1,
    drugs_id SMALLINT REFERENCES yes_no_optional(id) NOT NULL DEFAULT 1,
    long_distance_id SMALLINT REFERENCES yes_no_optional(id) NOT NULL DEFAULT 1,
    relationship_status_id SMALLINT REFERENCES relationship_status(id) NOT NULL DEFAULT 1,
    has_kids_id SMALLINT REFERENCES yes_no_maybe(id) NOT NULL DEFAULT 1,
    wants_kids_id SMALLINT REFERENCES yes_no_maybe(id) NOT NULL DEFAULT 1,
    exercise_id SMALLINT REFERENCES frequency(id) NOT NULL DEFAULT 1,
    religion_id SMALLINT REFERENCES religion(id) NOT NULL DEFAULT 1,
    star_sign_id SMALLINT REFERENCES star_sign(id) NOT NULL DEFAULT 1,

    -- General Settings
    unit_id SMALLINT REFERENCES unit(id) NOT NULL,

    -- Notification Settings
    chats_notification SMALLINT REFERENCES immediacy(id) NOT NULL DEFAULT 1,
    intros_notification SMALLINT REFERENCES immediacy(id) NOT NULL DEFAULT 2,
    visitors_notification SMALLINT REFERENCES immediacy(id) NOT NULL DEFAULT 3,

    -- Privacy Settings
    show_my_location BOOLEAN NOT NULL DEFAULT TRUE,
    show_my_age BOOLEAN NOT NULL DEFAULT TRUE,
    private_browsing BOOLEAN NOT NULL DEFAULT FALSE,
    hide_me_from_strangers BOOLEAN NOT NULL DEFAULT FALSE,

    -- Bookkeeping
    sign_up_time TIMESTAMP NOT NULL DEFAULT NOW(),
    sign_in_count INT NOT NULL DEFAULT 1,
    last_active_time TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Whether the user deactivated their account via the settings
    activated BOOLEAN NOT NULL DEFAULT TRUE,

    -- Primary keys and constraints
    UNIQUE (email),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS onboardee (
    email TEXT NOT NULL,

    name TEXT,
    date_of_birth DATE,
    coordinates GEOGRAPHY(Point, 4326),
    gender_id SMALLINT REFERENCES gender(id),
    about TEXT,

    -- Bookkeeping
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    PRIMARY KEY (email)
);

CREATE TABLE IF NOT EXISTS onboardee_search_preference_gender (
    email TEXT REFERENCES onboardee(email) ON DELETE CASCADE,
    gender_id SMALLINT REFERENCES gender(id) ON DELETE CASCADE,
    PRIMARY KEY (email, gender_id)
);

CREATE TABLE IF NOT EXISTS onboardee_photo (
    email TEXT NOT NULL REFERENCES onboardee(email) ON DELETE CASCADE,
    position SMALLINT NOT NULL,
    uuid TEXT NOT NULL,
    PRIMARY KEY (email, position)
);

CREATE TABLE IF NOT EXISTS duo_session (
    session_token_hash TEXT NOT NULL,
    person_id INT REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    email TEXT NOT NULL,
    otp TEXT NOT NULL,
    signed_in BOOLEAN NOT NULL DEFAULT FALSE,
    session_expiry TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '6 months'),
    otp_expiry TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '3 minutes'),
    PRIMARY KEY (session_token_hash)
);

CREATE TABLE IF NOT EXISTS photo (
    person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    position SMALLINT NOT NULL,
    uuid TEXT NOT NULL,
    PRIMARY KEY (person_id, position)
);

CREATE TABLE IF NOT EXISTS question (
    id SMALLSERIAL,
    question TEXT NOT NULL,
    topic TEXT NOT NULL,
    presence_given_yes INT[] NOT NULL,
    presence_given_no INT[] NOT NULL,
    absence_given_yes INT[] NOT NULL,
    absence_given_no INT[] NOT NULL,
    count_yes BIGINT NOT NULL DEFAULT 0,
    count_no BIGINT NOT NULL DEFAULT 0,
    count_views BIGINT NOT NULL DEFAULT 0,
    visible BOOLEAN DEFAULT TRUE,
    UNIQUE (question),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS question_order (
    person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    question_id SMALLINT NOT NULL REFERENCES question(id) ON DELETE CASCADE ON UPDATE CASCADE,
    position SMALLINT NOT NULL,
    PRIMARY KEY (person_id, question_id)
);

CREATE TABLE IF NOT EXISTS answer (
    person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    question_id SMALLINT NOT NULL REFERENCES question(id) ON DELETE CASCADE ON UPDATE CASCADE,
    answer BOOLEAN,
    public_ BOOLEAN NOT NULL,
    PRIMARY KEY (person_id, question_id)
);

CREATE TABLE IF NOT EXISTS trait (
    id SMALLSERIAL PRIMARY KEY,
    trait TEXT NOT NULL,
    UNIQUE (trait)
);

--------------------------------------------------------------------------------
-- TABLES TO CONNECT PEOPLE TO THEIR SEARCH PREFERENCES
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS search_preference_answer (
    person_id INT REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    question_id SMALLINT REFERENCES question(id) ON DELETE CASCADE,
    answer BOOLEAN NOT NULL,
    accept_unanswered BOOLEAN NOT NULL,
    PRIMARY KEY (person_id, question_id)
);

CREATE TABLE IF NOT EXISTS search_preference_gender (
    person_id INT REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    gender_id SMALLINT REFERENCES gender(id) ON DELETE CASCADE,
    PRIMARY KEY (person_id, gender_id)
);

CREATE TABLE IF NOT EXISTS search_preference_orientation (
    person_id INT REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    orientation_id SMALLINT REFERENCES orientation(id) ON DELETE CASCADE,
    PRIMARY KEY (person_id, orientation_id)
);

CREATE TABLE IF NOT EXISTS search_preference_age (
    person_id INT REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    min_age SMALLINT,
    max_age SMALLINT,
    PRIMARY KEY (person_id)
);

CREATE TABLE IF NOT EXISTS search_preference_distance (
    person_id INT REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    distance SMALLINT,
    PRIMARY KEY (person_id)
);

CREATE TABLE IF NOT EXISTS search_preference_height_cm (
    person_id INT REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    min_height_cm SMALLINT,
    max_height_cm SMALLINT,
    PRIMARY KEY (person_id)
);

CREATE TABLE IF NOT EXISTS search_preference_verified (
    person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    verified_id SMALLINT REFERENCES yes_no(id) ON DELETE CASCADE,
    PRIMARY KEY (person_id, verified_id)
);

CREATE TABLE IF NOT EXISTS search_preference_has_profile_picture (
    person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    has_profile_picture_id SMALLINT REFERENCES yes_no(id) ON DELETE CASCADE,
    PRIMARY KEY (person_id, has_profile_picture_id)
);

CREATE TABLE IF NOT EXISTS search_preference_looking_for (
    person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    looking_for_id SMALLINT REFERENCES looking_for(id) ON DELETE CASCADE,
    PRIMARY KEY (person_id, looking_for_id)
);

CREATE TABLE IF NOT EXISTS search_preference_smoking (
    person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    smoking_id SMALLINT REFERENCES yes_no_optional(id) ON DELETE CASCADE,
    PRIMARY KEY (person_id, smoking_id)
);

CREATE TABLE IF NOT EXISTS search_preference_drinking (
    person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    drinking_id SMALLINT REFERENCES frequency(id) ON DELETE CASCADE,
    PRIMARY KEY (person_id, drinking_id)
);

CREATE TABLE IF NOT EXISTS search_preference_drugs (
    person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    drugs_id SMALLINT REFERENCES yes_no_optional(id) ON DELETE CASCADE,
    PRIMARY KEY (person_id, drugs_id)
);

CREATE TABLE IF NOT EXISTS search_preference_long_distance (
    person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    long_distance_id SMALLINT REFERENCES yes_no_optional(id) ON DELETE CASCADE,
    PRIMARY KEY (person_id, long_distance_id)
);

CREATE TABLE IF NOT EXISTS search_preference_relationship_status (
    person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    relationship_status_id SMALLINT REFERENCES relationship_status(id) ON DELETE CASCADE,
    PRIMARY KEY (person_id, relationship_status_id)
);

CREATE TABLE IF NOT EXISTS search_preference_has_kids (
    person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    has_kids_id SMALLINT REFERENCES yes_no_maybe(id) ON DELETE CASCADE,
    PRIMARY KEY (person_id, has_kids_id)
);

CREATE TABLE IF NOT EXISTS search_preference_wants_kids (
    person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    wants_kids_id SMALLINT REFERENCES yes_no_maybe(id) ON DELETE CASCADE,
    PRIMARY KEY (person_id, wants_kids_id)
);

CREATE TABLE IF NOT EXISTS search_preference_exercise (
    person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    exercise_id SMALLINT REFERENCES frequency(id) ON DELETE CASCADE,
    PRIMARY KEY (person_id, exercise_id)
);

CREATE TABLE IF NOT EXISTS search_preference_religion (
    person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    religion_id SMALLINT REFERENCES religion(id) ON DELETE CASCADE,
    PRIMARY KEY (person_id, religion_id)
);

CREATE TABLE IF NOT EXISTS search_preference_star_sign (
    person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    star_sign_id SMALLINT REFERENCES star_sign(id) ON DELETE CASCADE,
    PRIMARY KEY (person_id, star_sign_id)
);

CREATE TABLE IF NOT EXISTS search_preference_messaged (
    person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    messaged_id SMALLINT REFERENCES yes_no(id) ON DELETE CASCADE,
    PRIMARY KEY (person_id)
);

CREATE TABLE IF NOT EXISTS search_preference_hidden (
    person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    hidden_id SMALLINT REFERENCES yes_no(id) ON DELETE CASCADE,
    PRIMARY KEY (person_id)
);

CREATE TABLE IF NOT EXISTS search_preference_blocked (
    person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    blocked_id SMALLINT REFERENCES yes_no(id) ON DELETE CASCADE,
    PRIMARY KEY (person_id)
);

CREATE TABLE IF NOT EXISTS messaged (
    subject_person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    object_person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY (subject_person_id, object_person_id)
);

CREATE TABLE IF NOT EXISTS hidden (
    subject_person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    object_person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY (subject_person_id, object_person_id)
);

CREATE TABLE IF NOT EXISTS blocked (
    subject_person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    object_person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY (subject_person_id, object_person_id)
);

--------------------------------------------------------------------------------
-- TABLES TO SPEED UP SEARCHING
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS search_for_quiz_prospects (
    person_id INT REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    coordinates GEOGRAPHY(Point, 4326) NOT NULL,
    personality VECTOR(48) NOT NULL,

    PRIMARY KEY (person_id)
);

CREATE TABLE IF NOT EXISTS search_for_standard_prospects (
    person_id INT REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    coordinates GEOGRAPHY(Point, 4326) NOT NULL,
    personality VECTOR(48) NOT NULL,

    PRIMARY KEY (person_id)
);

CREATE UNLOGGED TABLE IF NOT EXISTS search_cache (
    searcher_person_id INT REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    position SMALLINT,
    prospect_person_id INT REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    profile_photo_uuid TEXT,
    name TEXT NOT NULL,
    age SMALLINT,
    match_percentage SMALLINT NOT NULL,
    PRIMARY KEY (searcher_person_id, position)
);

--------------------------------------------------------------------------------
-- INDEXES
--------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx__search_for_quiz_prospects__coordinates ON search_for_quiz_prospects USING GIST(coordinates);
CREATE INDEX IF NOT EXISTS idx__search_for_standard_prospects__coordinates ON search_for_standard_prospects USING GIST(coordinates);

CREATE INDEX IF NOT EXISTS idx__answer__question_id ON answer(question_id);

CREATE INDEX IF NOT EXISTS idx__duo_session__email ON duo_session(email);

CREATE INDEX IF NOT EXISTS idx__location__friendly ON location USING GIST(friendly gist_trgm_ops);

--------------------------------------------------------------------------------
-- DATA
--------------------------------------------------------------------------------

INSERT INTO gender (name) VALUES ('Man') ON CONFLICT (name) DO NOTHING;
INSERT INTO gender (name) VALUES ('Woman') ON CONFLICT (name) DO NOTHING;
INSERT INTO gender (name) VALUES ('Agender') ON CONFLICT (name) DO NOTHING;
INSERT INTO gender (name) VALUES ('Intersex') ON CONFLICT (name) DO NOTHING;
INSERT INTO gender (name) VALUES ('Non-binary') ON CONFLICT (name) DO NOTHING;
INSERT INTO gender (name) VALUES ('Transgender') ON CONFLICT (name) DO NOTHING;
INSERT INTO gender (name) VALUES ('Trans woman') ON CONFLICT (name) DO NOTHING;
INSERT INTO gender (name) VALUES ('Trans man') ON CONFLICT (name) DO NOTHING;
INSERT INTO gender (name) VALUES ('Other') ON CONFLICT (name) DO NOTHING;

INSERT INTO orientation (name) VALUES ('Unanswered') ON CONFLICT (name) DO NOTHING;
INSERT INTO orientation (name) VALUES ('Straight') ON CONFLICT (name) DO NOTHING;
INSERT INTO orientation (name) VALUES ('Gay') ON CONFLICT (name) DO NOTHING;
INSERT INTO orientation (name) VALUES ('Lesbian') ON CONFLICT (name) DO NOTHING;
INSERT INTO orientation (name) VALUES ('Bisexual') ON CONFLICT (name) DO NOTHING;
INSERT INTO orientation (name) VALUES ('Asexual') ON CONFLICT (name) DO NOTHING;
INSERT INTO orientation (name) VALUES ('Demisexual') ON CONFLICT (name) DO NOTHING;
INSERT INTO orientation (name) VALUES ('Pansexual') ON CONFLICT (name) DO NOTHING;
INSERT INTO orientation (name) VALUES ('Queer') ON CONFLICT (name) DO NOTHING;
INSERT INTO orientation (name) VALUES ('Other') ON CONFLICT (name) DO NOTHING;

INSERT INTO looking_for (name) VALUES ('Unanswered') ON CONFLICT (name) DO NOTHING;
INSERT INTO looking_for (name) VALUES ('Long-term dating') ON CONFLICT (name) DO NOTHING;
INSERT INTO looking_for (name) VALUES ('Short-term dating') ON CONFLICT (name) DO NOTHING;
INSERT INTO looking_for (name) VALUES ('Friends') ON CONFLICT (name) DO NOTHING;

INSERT INTO relationship_status (name) VALUES ('Unanswered') ON CONFLICT (name) DO NOTHING;
INSERT INTO relationship_status (name) VALUES ('Single') ON CONFLICT (name) DO NOTHING;
INSERT INTO relationship_status (name) VALUES ('Seeing someone') ON CONFLICT (name) DO NOTHING;
INSERT INTO relationship_status (name) VALUES ('Engaged') ON CONFLICT (name) DO NOTHING;
INSERT INTO relationship_status (name) VALUES ('Married') ON CONFLICT (name) DO NOTHING;
INSERT INTO relationship_status (name) VALUES ('Divorced') ON CONFLICT (name) DO NOTHING;
INSERT INTO relationship_status (name) VALUES ('Widowed') ON CONFLICT (name) DO NOTHING;
INSERT INTO relationship_status (name) VALUES ('Other') ON CONFLICT (name) DO NOTHING;

INSERT INTO religion (name) VALUES ('Unanswered') ON CONFLICT (name) DO NOTHING;
INSERT INTO religion (name) VALUES ('Agnostic') ON CONFLICT (name) DO NOTHING;
INSERT INTO religion (name) VALUES ('Atheist') ON CONFLICT (name) DO NOTHING;
INSERT INTO religion (name) VALUES ('Buddhist') ON CONFLICT (name) DO NOTHING;
INSERT INTO religion (name) VALUES ('Christian') ON CONFLICT (name) DO NOTHING;
INSERT INTO religion (name) VALUES ('Hindu') ON CONFLICT (name) DO NOTHING;
INSERT INTO religion (name) VALUES ('Jewish') ON CONFLICT (name) DO NOTHING;
INSERT INTO religion (name) VALUES ('Muslim') ON CONFLICT (name) DO NOTHING;
INSERT INTO religion (name) VALUES ('Zoroastrianism') ON CONFLICT (name) DO NOTHING;
INSERT INTO religion (name) VALUES ('Other') ON CONFLICT (name) DO NOTHING;

INSERT INTO star_sign (name) VALUES ('Unanswered') ON CONFLICT (name) DO NOTHING;
INSERT INTO star_sign (name) VALUES ('Aquarius') ON CONFLICT (name) DO NOTHING;
INSERT INTO star_sign (name) VALUES ('Aries') ON CONFLICT (name) DO NOTHING;
INSERT INTO star_sign (name) VALUES ('Cancer') ON CONFLICT (name) DO NOTHING;
INSERT INTO star_sign (name) VALUES ('Capricorn') ON CONFLICT (name) DO NOTHING;
INSERT INTO star_sign (name) VALUES ('Gemini') ON CONFLICT (name) DO NOTHING;
INSERT INTO star_sign (name) VALUES ('Leo') ON CONFLICT (name) DO NOTHING;
INSERT INTO star_sign (name) VALUES ('Libra') ON CONFLICT (name) DO NOTHING;
INSERT INTO star_sign (name) VALUES ('Pisces') ON CONFLICT (name) DO NOTHING;
INSERT INTO star_sign (name) VALUES ('Sagittarius') ON CONFLICT (name) DO NOTHING;
INSERT INTO star_sign (name) VALUES ('Scorpio') ON CONFLICT (name) DO NOTHING;
INSERT INTO star_sign (name) VALUES ('Taurus') ON CONFLICT (name) DO NOTHING;
INSERT INTO star_sign (name) VALUES ('Virgo') ON CONFLICT (name) DO NOTHING;

INSERT INTO unit (name) VALUES ('Imperial') ON CONFLICT (name) DO NOTHING;
INSERT INTO unit (name) VALUES ('Metric') ON CONFLICT (name) DO NOTHING;

INSERT INTO immediacy (name) VALUES ('Immediately') ON CONFLICT (name) DO NOTHING;
INSERT INTO immediacy (name) VALUES ('Daily') ON CONFLICT (name) DO NOTHING;
INSERT INTO immediacy (name) VALUES ('Every 3 Days') ON CONFLICT (name) DO NOTHING;
INSERT INTO immediacy (name) VALUES ('Weekly') ON CONFLICT (name) DO NOTHING;
INSERT INTO immediacy (name) VALUES ('Never') ON CONFLICT (name) DO NOTHING;

INSERT INTO frequency (name) VALUES ('Unanswered') ON CONFLICT (name) DO NOTHING;
INSERT INTO frequency (name) VALUES ('Often') ON CONFLICT (name) DO NOTHING;
INSERT INTO frequency (name) VALUES ('Sometimes') ON CONFLICT (name) DO NOTHING;
INSERT INTO frequency (name) VALUES ('Never') ON CONFLICT (name) DO NOTHING;

INSERT INTO yes_no (name) VALUES ('Yes') ON CONFLICT (name) DO NOTHING;
INSERT INTO yes_no (name) VALUES ('No') ON CONFLICT (name) DO NOTHING;

INSERT INTO yes_no_optional (name) VALUES ('Unanswered') ON CONFLICT (name) DO NOTHING;
INSERT INTO yes_no_optional (name) VALUES ('Yes') ON CONFLICT (name) DO NOTHING;
INSERT INTO yes_no_optional (name) VALUES ('No') ON CONFLICT (name) DO NOTHING;

INSERT INTO yes_no_maybe (name) VALUES ('Unanswered') ON CONFLICT (name) DO NOTHING;
INSERT INTO yes_no_maybe (name) VALUES ('Yes') ON CONFLICT (name) DO NOTHING;
INSERT INTO yes_no_maybe (name) VALUES ('No') ON CONFLICT (name) DO NOTHING;
INSERT INTO yes_no_maybe (name) VALUES ('Maybe') ON CONFLICT (name) DO NOTHING;

--------------------------------------------------------------------------------
-- FUNCTIONS (2)
--------------------------------------------------------------------------------

DROP TYPE IF EXISTS answer_score_vectors CASCADE;
CREATE TYPE answer_score_vectors AS (
    presence_score INT[],
    absence_score INT[]
);

CREATE OR REPLACE FUNCTION answer_score_vectors(
    question_id INT,
    answer BOOLEAN
)
RETURNS answer_score_vectors AS $$
    SELECT
        CASE
            WHEN answer = TRUE  THEN presence_given_yes
            WHEN answer = FALSE THEN presence_given_no
            ELSE NULL
        END AS presence_score,
        CASE
            WHEN answer = TRUE  THEN absence_given_yes
            WHEN answer = FALSE THEN absence_given_no
            ELSE NULL
        END AS absence_score
    FROM question
    WHERE id = question_id
$$ LANGUAGE sql IMMUTABLE LEAKPROOF PARALLEL SAFE;


DROP TYPE IF EXISTS personality_vectors CASCADE;
CREATE TYPE personality_vectors AS (
    personality FLOAT4[],
    presence_score INT[],
    absence_score INT[],
    count_answers SMALLINT
);

CREATE OR REPLACE FUNCTION compute_personality_vectors(
    new_presence_score INT[],
    new_absence_score INT[],
    old_presence_score INT[],
    old_absence_score INT[],
    cur_presence_score INT[],
    cur_absence_score INT[],
    cur_count_answers SMALLINT
)
RETURNS personality_vectors AS $$
    import numpy

    presence_score = numpy.array(cur_presence_score)
    absence_score  = numpy.array(cur_absence_score)
    count_answers  = cur_count_answers

    if new_presence_score and new_absence_score:
        excess = numpy.minimum(new_presence_score, new_absence_score)

        presence_score += new_presence_score - excess
        absence_score  += new_absence_score  - excess
        count_answers  += 1

    if old_presence_score and old_absence_score:
        excess = numpy.minimum(old_presence_score, old_absence_score)

        presence_score -= old_presence_score - excess
        absence_score  -= old_absence_score  - excess
        count_answers  -= 1

    numerator = presence_score
    denominator = presence_score + absence_score
    trait_percentages = numpy.divide(
        numerator,
        denominator,
        out=numpy.full_like(numerator, 0.5, dtype=numpy.float64),
        where=denominator != 0
    )

    personality_weight = (numpy.log(count_answers + 1) / numpy.log(501)) ** 0.25
    personality_weight = personality_weight.clip(0, 1)

    personality = 2 * trait_percentages - 1
    personality = numpy.concatenate([personality, [1e-5]])
    personality /= numpy.linalg.norm(personality)
    personality *= personality_weight

    return (
        personality,
        presence_score,
        absence_score,
        count_answers,
    )
$$ LANGUAGE plpython3u IMMUTABLE LEAKPROOF PARALLEL SAFE;

-- TODO: SELECT t2.id, t2.trait_id, 100 * t2.ratio
--       FROM (SELECT id, (trait_ratio(presence_score, absence_score, 0)).* FROM person AS t1) AS t2;
CREATE OR REPLACE FUNCTION trait_ratio(
    presence_score INT[],
    absence_score INT[],
    score_threshold INT DEFAULT 1000
)
RETURNS TABLE(trait_id SMALLINT, ratio FLOAT4) AS $$
    SELECT
        ROW_NUMBER() OVER() AS trait_id,
        CASE
            WHEN (a + b) >= GREATEST(1, score_threshold)
            THEN a::FLOAT4 / (a + b)
            ELSE NULL
        END AS percentage
    FROM UNNEST(presence_score, absence_score) as t(a, b);
$$ LANGUAGE sql IMMUTABLE LEAKPROOF PARALLEL SAFE;

--------------------------------------------------------------------------------
-- TRIGGERS
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION insert_update_search_tables()
RETURNS TRIGGER AS $$
DECLARE
    visible_in_search BOOLEAN;
    visible_in_quiz_search BOOLEAN;
BEGIN
    visible_in_search := NEW.activated;
    visible_in_quiz_search := (
        NEW.has_profile_picture_id = 1 AND
        NEW.hide_me_from_strangers = FALSE);

    IF (visible_in_search = TRUE) THEN
        IF (visible_in_quiz_search) THEN
            INSERT INTO search_for_quiz_prospects (person_id, coordinates, personality)
            VALUES (NEW.id, NEW.coordinates, NEW.personality)
            ON CONFLICT (person_id)
            DO UPDATE SET
                coordinates = EXCLUDED.coordinates,
                personality = EXCLUDED.personality;
        END IF;

        INSERT INTO search_for_standard_prospects (person_id, coordinates, personality)
        VALUES (NEW.id, NEW.coordinates, NEW.personality)
        ON CONFLICT (person_id)
        DO UPDATE SET
            coordinates = EXCLUDED.coordinates,
            personality = EXCLUDED.personality;
    ELSE
        DELETE FROM search_for_quiz_prospects
        WHERE person_id = NEW.id;

        DELETE FROM search_for_standard_prospects
        WHERE person_id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER insert_update_search_tables
AFTER INSERT OR UPDATE
ON person
FOR EACH ROW
EXECUTE FUNCTION insert_update_search_tables();

-- TODO: Trait descriptions should be in the database
-- TODO: Periodically delete expired tokens
-- TODO: Periodically move inactive accounts
