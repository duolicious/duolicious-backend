--------------------------------------------------------------------------------
-- EXTENSIONS
--------------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS postgis;

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

-- TODO: SELECT friendly FROM location ILIKE 'p%' ORDER BY friendly <-> 'Población' LIMIT 5;
-- TODO: SELECT * FROM location WHERE ST_DWithin(coordinates, ST_SetSRID(ST_MakePoint(151.21, -33.867778), 4326)::geography, 10000) LIMIT 1;
CREATE TABLE IF NOT EXISTS location (
    id SERIAL PRIMARY KEY,
    friendly TEXT NOT NULL,
    city TEXT NOT NULL,
    subdivision TEXT NOT NULL,
    country TEXT NOT NULL,
    coordinates GEOGRAPHY(Point, 4326),
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
    id BIGSERIAL PRIMARY KEY,

    -- Required during sign-up
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    date_of_birth DATE NOT NULL,
    location_id INT NOT NULL REFERENCES location(id),
    gender_id SMALLINT NOT NULL REFERENCES gender(id),
    about TEXT NOT NULL,

    -- Verification
    verified SMALLINT NOT NULL REFERENCES yes_no(id),

    -- Basics
    orientation_id SMALLINT REFERENCES orientation(id),
    occupation TEXT,
    height_cm SMALLINT,
    looking_for_id SMALLINT REFERENCES looking_for(id),
    smoking_id SMALLINT REFERENCES yes_no(id),
    drinking_id SMALLINT REFERENCES frequency(id),
    drugs_id SMALLINT REFERENCES yes_no(id),
    long_distance SMALLINT REFERENCES yes_no(id),
    relationship_status_id SMALLINT REFERENCES relationship_status(id),
    has_kids_id SMALLINT REFERENCES yes_no(id),
    wants_kids_id SMALLINT REFERENCES yes_no(id),
    exercise_id SMALLINT REFERENCES frequency(id),
    religion_id SMALLINT REFERENCES religion(id),
    star_sign_id SMALLINT REFERENCES star_sign(id),

    -- General Settings
    unit_id SMALLINT REFERENCES unit(id) NOT NULL,

    -- Notification Settings
    chats_notification SMALLINT REFERENCES immediacy(id) NOT NULL,
    intros_notification SMALLINT REFERENCES immediacy(id) NOT NULL,
    visitors_notification SMALLINT REFERENCES immediacy(id) NOT NULL,

    -- Privacy Settings
    show_my_location BOOLEAN NOT NULL DEFAULT TRUE,
    show_my_age BOOLEAN NOT NULL DEFAULT TRUE,
    private_browsing BOOLEAN NOT NULL DEFAULT FALSE,
    hide_me_from_strangers BOOLEAN NOT NULL DEFAULT FALSE,
    two_way_filters BOOLEAN NOT NULL DEFAULT FALSE,

    -- Bookkeeping
    sign_up_time TIMESTAMP NOT NULL DEFAULT NOW(),
    sign_in_time TIMESTAMP NOT NULL DEFAULT NOW(),
    sign_in_count INT NOT NULL DEFAULT 1,

    -- Constraints
    UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS onboardee (
    email TEXT NOT NULL,

    name TEXT,
    date_of_birth DATE,
    location_id INT REFERENCES location(id),
    gender_id SMALLINT REFERENCES gender(id),
    about TEXT,

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
    person_id BIGINT REFERENCES person(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    otp TEXT NOT NULL,
    signed_in BOOLEAN NOT NULL DEFAULT FALSE,
    session_expiry TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '6 months'),
    otp_expiry TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '1 minute'),
    PRIMARY KEY (session_token_hash)
);

CREATE TABLE IF NOT EXISTS photo (
    person_id BIGSERIAL NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    position SMALLINT NOT NULL,
    uuid TEXT NOT NULL,
    PRIMARY KEY (person_id, position)
);

CREATE TABLE IF NOT EXISTS question (
    id SMALLSERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    topic TEXT NOT NULL,
    count_yes BIGINT NOT NULL DEFAULT 0,
    count_no BIGINT NOT NULL DEFAULT 0,
    count_views BIGINT NOT NULL DEFAULT 0,
    visible BOOLEAN DEFAULT TRUE,
    UNIQUE(question)
);

CREATE TABLE IF NOT EXISTS question_order (
    person_id BIGINT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    question_id SMALLINT NOT NULL REFERENCES question(id) ON DELETE CASCADE,
    position SMALLINT NOT NULL,
    PRIMARY KEY (person_id, question_id)
);

CREATE TABLE IF NOT EXISTS answer (
    person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    question_id SMALLINT NOT NULL REFERENCES question(id) ON DELETE CASCADE,
    answer BOOLEAN NOT NULL,
    public_ BOOLEAN NOT NULL,
    PRIMARY KEY (person_id, question_id)
);

CREATE TABLE IF NOT EXISTS trait (
    id SMALLSERIAL PRIMARY KEY,
    trait TEXT NOT NULL,
    UNIQUE (trait)
);

CREATE TABLE IF NOT EXISTS person_trait_statistic (
    person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    trait_id SMALLINT NOT NULL REFERENCES trait(id) ON DELETE CASCADE,
    presence_score INT NOT NULL,
    absence_score INT NOT NULL,
    CHECK (presence_score >= 0),
    CHECK (absence_score >= 0),
    PRIMARY KEY (person_id, trait_id)
);

CREATE TABLE IF NOT EXISTS question_trait_pair (
    question_id SMALLSERIAL NOT NULL REFERENCES question(id) ON DELETE CASCADE,
    trait_id SMALLSERIAL NOT NULL REFERENCES trait(id) ON DELETE CASCADE,
    presence_given_yes SMALLINT NOT NULL,
    presence_given_no SMALLINT NOT NULL,
    absence_given_yes SMALLINT NOT NULL,
    absence_given_no SMALLINT NOT NULL,
    CHECK (presence_given_yes >= 0),
    CHECK (presence_given_no >= 0),
    CHECK (absence_given_yes >= 0),
    CHECK (absence_given_no >= 0),
    PRIMARY KEY (question_id, trait_id)
);

--------------------------------------------------------------------------------
-- TABLES TO CONNECT PEOPLE TO THEIR SEARCH PREFERENCES
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS search_preference_question (
    person_id INT REFERENCES person(id) ON DELETE CASCADE,
    question_id SMALLINT REFERENCES question(id) ON DELETE CASCADE,
    answer BOOLEAN NOT NULL,
    accept_unanswered BOOLEAN NOT NULL,
    PRIMARY KEY (person_id, question_id)
);

CREATE TABLE IF NOT EXISTS search_preference_gender (
    person_id INT REFERENCES person(id) ON DELETE CASCADE,
    gender_id SMALLINT REFERENCES gender(id) ON DELETE CASCADE,
    PRIMARY KEY (person_id, gender_id)
);

CREATE TABLE IF NOT EXISTS search_preference_orientation (
    person_id INT REFERENCES person(id) ON DELETE CASCADE,
    orientation_id SMALLINT REFERENCES gender(id) ON DELETE CASCADE,
    PRIMARY KEY (person_id, orientation_id)
);

CREATE TABLE IF NOT EXISTS search_preference_age (
    person_id INT REFERENCES person(id) ON DELETE CASCADE,
    min_age SMALLINT NOT NULL,
    max_age SMALLINT NOT NULL,
    PRIMARY KEY (person_id)
);

CREATE TABLE IF NOT EXISTS search_preference_distance (
    person_id INT REFERENCES person(id) ON DELETE CASCADE,
    distance SMALLINT NOT NULL,
    PRIMARY KEY (person_id)
);

CREATE TABLE IF NOT EXISTS search_preference_height (
    person_id INT REFERENCES person(id) ON DELETE CASCADE,
    min_height SMALLINT NOT NULL,
    max_height SMALLINT NOT NULL,
    PRIMARY KEY (person_id)
);

CREATE TABLE IF NOT EXISTS search_preference_verified (
    id BIGINT PRIMARY KEY,
    person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    yes_no_id SMALLINT REFERENCES yes_no(id) ON DELETE CASCADE,
    UNIQUE NULLS NOT DISTINCT (person_id, yes_no_id)
);

CREATE TABLE IF NOT EXISTS search_preference_has_profile_picture (
    id BIGINT PRIMARY KEY,
    person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    yes_no_id SMALLINT REFERENCES yes_no(id) ON DELETE CASCADE,
    UNIQUE NULLS NOT DISTINCT (person_id, yes_no_id)
);

CREATE TABLE IF NOT EXISTS search_preference_looking_for (
    id BIGINT PRIMARY KEY,
    person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    looking_for_id SMALLINT REFERENCES looking_for(id) ON DELETE CASCADE,
    UNIQUE NULLS NOT DISTINCT (person_id, looking_for_id)
);

CREATE TABLE IF NOT EXISTS search_preference_smoking (
    id BIGINT PRIMARY KEY,
    person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    yes_no_id SMALLINT REFERENCES yes_no(id) ON DELETE CASCADE,
    UNIQUE NULLS NOT DISTINCT (person_id, yes_no_id)
);

CREATE TABLE IF NOT EXISTS search_preference_drinking (
    id BIGINT PRIMARY KEY,
    person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    frequency_id SMALLINT REFERENCES frequency(id) ON DELETE CASCADE,
    UNIQUE NULLS NOT DISTINCT (person_id, frequency_id)
);

CREATE TABLE IF NOT EXISTS search_preference_drugs (
    id BIGINT PRIMARY KEY,
    person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    yes_no_id SMALLINT REFERENCES yes_no(id) ON DELETE CASCADE,
    UNIQUE NULLS NOT DISTINCT (person_id, yes_no_id)
);

CREATE TABLE IF NOT EXISTS search_preference_long_distance (
    id BIGINT PRIMARY KEY,
    person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    yes_no_id SMALLINT REFERENCES yes_no(id) ON DELETE CASCADE,
    UNIQUE NULLS NOT DISTINCT (person_id, yes_no_id)
);

CREATE TABLE IF NOT EXISTS search_preference_relationship_status (
    id BIGINT PRIMARY KEY,
    person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    relationship_status_id SMALLINT REFERENCES relationship_status(id) ON DELETE CASCADE,
    UNIQUE NULLS NOT DISTINCT (person_id, relationship_status_id)
);

CREATE TABLE IF NOT EXISTS search_preference_has_kids (
    id BIGINT PRIMARY KEY,
    person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    yes_no_id SMALLINT REFERENCES yes_no(id) ON DELETE CASCADE,
    UNIQUE NULLS NOT DISTINCT (person_id, yes_no_id)
);

CREATE TABLE IF NOT EXISTS search_preference_wants_kids (
    id BIGINT PRIMARY KEY,
    person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    yes_no_id SMALLINT REFERENCES yes_no(id) ON DELETE CASCADE,
    UNIQUE NULLS NOT DISTINCT (person_id, yes_no_id)
);

CREATE TABLE IF NOT EXISTS search_preference_exercise (
    id BIGINT PRIMARY KEY,
    person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    frequency_id SMALLINT REFERENCES frequency(id) ON DELETE CASCADE,
    UNIQUE NULLS NOT DISTINCT (person_id, frequency_id)
);

CREATE TABLE IF NOT EXISTS search_preference_religion (
    id BIGINT PRIMARY KEY,
    person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    religion_id SMALLINT REFERENCES religion(id) ON DELETE CASCADE,
    UNIQUE NULLS NOT DISTINCT (person_id, religion_id)
);

CREATE TABLE IF NOT EXISTS search_preference_star_sign (
    id BIGINT PRIMARY KEY,
    person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    star_sign_id SMALLINT REFERENCES star_sign(id) ON DELETE CASCADE,
    UNIQUE NULLS NOT DISTINCT (person_id, star_sign_id)
);

--------------------------------------------------------------------------------
-- SEARCH RESULT CACHE
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS search_result (
    searcher_person_id INT REFERENCES person(id) ON DELETE CASCADE,
    prospect_person_id INT REFERENCES person(id) ON DELETE CASCADE,
    PRIMARY KEY (searcher_person_id, prospect_person_id)
);

--------------------------------------------------------------------------------
-- INDEXES
--------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx__question_id__answer ON answer(question_id);

CREATE INDEX IF NOT EXISTS idx__email__duo_session ON duo_session(email);

CREATE INDEX IF NOT EXISTS idx__coordinates__location ON location USING GIST(coordinates);
CREATE INDEX IF NOT EXISTS idx__friendly__location ON location USING GIST(friendly gist_trgm_ops);

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

INSERT INTO orientation (name) VALUES ('Straight') ON CONFLICT (name) DO NOTHING;
INSERT INTO orientation (name) VALUES ('Gay') ON CONFLICT (name) DO NOTHING;
INSERT INTO orientation (name) VALUES ('Lesbian') ON CONFLICT (name) DO NOTHING;
INSERT INTO orientation (name) VALUES ('Bisexual') ON CONFLICT (name) DO NOTHING;
INSERT INTO orientation (name) VALUES ('Asexual') ON CONFLICT (name) DO NOTHING;
INSERT INTO orientation (name) VALUES ('Demisexual') ON CONFLICT (name) DO NOTHING;
INSERT INTO orientation (name) VALUES ('Pansexual') ON CONFLICT (name) DO NOTHING;
INSERT INTO orientation (name) VALUES ('Queer') ON CONFLICT (name) DO NOTHING;
INSERT INTO orientation (name) VALUES ('Other') ON CONFLICT (name) DO NOTHING;

INSERT INTO looking_for (name) VALUES ('Long-term dating') ON CONFLICT (name) DO NOTHING;
INSERT INTO looking_for (name) VALUES ('Short-term dating') ON CONFLICT (name) DO NOTHING;
INSERT INTO looking_for (name) VALUES ('Friends') ON CONFLICT (name) DO NOTHING;

INSERT INTO relationship_status (name) VALUES ('Single') ON CONFLICT (name) DO NOTHING;
INSERT INTO relationship_status (name) VALUES ('Seeing someone') ON CONFLICT (name) DO NOTHING;
INSERT INTO relationship_status (name) VALUES ('Engaged') ON CONFLICT (name) DO NOTHING;
INSERT INTO relationship_status (name) VALUES ('Married') ON CONFLICT (name) DO NOTHING;
INSERT INTO relationship_status (name) VALUES ('Divorced') ON CONFLICT (name) DO NOTHING;
INSERT INTO relationship_status (name) VALUES ('Widowed') ON CONFLICT (name) DO NOTHING;
INSERT INTO relationship_status (name) VALUES ('Other') ON CONFLICT (name) DO NOTHING;

INSERT INTO religion (name) VALUES ('Agnostic') ON CONFLICT (name) DO NOTHING;
INSERT INTO religion (name) VALUES ('Atheist') ON CONFLICT (name) DO NOTHING;
INSERT INTO religion (name) VALUES ('Buddhist') ON CONFLICT (name) DO NOTHING;
INSERT INTO religion (name) VALUES ('Christian') ON CONFLICT (name) DO NOTHING;
INSERT INTO religion (name) VALUES ('Hindu') ON CONFLICT (name) DO NOTHING;
INSERT INTO religion (name) VALUES ('Jewish') ON CONFLICT (name) DO NOTHING;
INSERT INTO religion (name) VALUES ('Muslim') ON CONFLICT (name) DO NOTHING;
INSERT INTO religion (name) VALUES ('Zoroastrianism') ON CONFLICT (name) DO NOTHING;
INSERT INTO religion (name) VALUES ('Other') ON CONFLICT (name) DO NOTHING;

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

INSERT INTO frequency (name) VALUES ('Often') ON CONFLICT (name) DO NOTHING;
INSERT INTO frequency (name) VALUES ('Sometimes') ON CONFLICT (name) DO NOTHING;
INSERT INTO frequency (name) VALUES ('Never') ON CONFLICT (name) DO NOTHING;

INSERT INTO yes_no (name) VALUES ('Yes') ON CONFLICT (name) DO NOTHING;
INSERT INTO yes_no (name) VALUES ('No') ON CONFLICT (name) DO NOTHING;

-- TODO: INDEXES FOR SEARCH PREFERENCES
-- TODO: SEARCH PREFERENCE DATA
-- TODO: make primary and foreign keys non-null where possible
-- TODO: Store trait descriptions
-- TODO: Answers should have an individualised order
-- TODO: Trait descriptions should be in the database
-- TODO: Periodically delete expired tokens
-- TODO: Periodically move inactive accounts
