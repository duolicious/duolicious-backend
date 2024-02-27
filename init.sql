--------------------------------------------------------------------------------
-- EXTENSIONS
--------------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS plpython3u;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS btree_gist;

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

CREATE OR REPLACE FUNCTION base62_encode(num bigint) RETURNS text AS $$
DECLARE
    characters text := '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    result text := '';
    current int;
BEGIN
    IF num = 0 THEN
        RETURN '0';
    END IF;

    WHILE num > 0 LOOP
        current := num % 62;
        result := substr(characters, current + 1, 1) || result;
        num := num / 62;
    END LOOP;

    RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

--------------------------------------------------------------------------------
-- BLOCKED EMAIL DOMAINS
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bad_email_domain (
    domain TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS good_email_domain (
    domain TEXT PRIMARY KEY
);

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
    short_friendly TEXT NOT NULL,
    long_friendly TEXT NOT NULL,
    city TEXT NOT NULL,
    subdivision TEXT NOT NULL,
    country TEXT NOT NULL,
    coordinates GEOGRAPHY(Point, 4326) NOT NULL,
    UNIQUE (short_friendly),
    UNIQUE (long_friendly)
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

    id_salt INT DEFAULT FLOOR(RANDOM() * 1000000),
    tiny_id TEXT GENERATED ALWAYS AS (base62_encode(id::BIGINT * 1000000 + id_salt)) STORED,

    -- Required during sign-up
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    date_of_birth DATE NOT NULL,
    coordinates GEOGRAPHY(Point, 4326) NOT NULL,
    gender_id SMALLINT REFERENCES gender(id) NOT NULL,
    about TEXT NOT NULL,

    -- TODO: CREATE INDEX ON person USING ivfflat (personality2 vector_ip_ops) WITH (lists = 100);
    -- There's 46 `trait`s. In principle, it's possible for someone to have a
    -- score of 0 for each trait. We add an extra, constant, non-zero dimension
    -- to avoid that.
    personality VECTOR(47) NOT NULL DEFAULT array_full(47, 0),
    presence_score INT[] NOT NULL DEFAULT array_full(46, 0),
    absence_score INT[] NOT NULL DEFAULT array_full(46, 0),
    count_answers SMALLINT NOT NULL DEFAULT 0,

    -- Verification
    has_profile_picture_id SMALLINT REFERENCES yes_no(id) NOT NULL DEFAULT 2,

    -- Basics
    orientation_id SMALLINT REFERENCES orientation(id) NOT NULL DEFAULT 1,
    occupation TEXT,
    education TEXT,
    height_cm SMALLINT,
    looking_for_id SMALLINT REFERENCES looking_for(id) NOT NULL DEFAULT 1,
    smoking_id SMALLINT REFERENCES yes_no_optional(id) NOT NULL DEFAULT 1,
    drinking_id SMALLINT REFERENCES frequency(id) NOT NULL DEFAULT 1,
    drugs_id SMALLINT REFERENCES yes_no_optional(id) NOT NULL DEFAULT 1,
    long_distance_id SMALLINT REFERENCES yes_no_optional(id) NOT NULL DEFAULT 1,
    relationship_status_id SMALLINT REFERENCES relationship_status(id) NOT NULL DEFAULT 1,
    has_kids_id SMALLINT REFERENCES yes_no_optional(id) NOT NULL DEFAULT 1,
    wants_kids_id SMALLINT REFERENCES yes_no_maybe(id) NOT NULL DEFAULT 1,
    exercise_id SMALLINT REFERENCES frequency(id) NOT NULL DEFAULT 1,
    religion_id SMALLINT REFERENCES religion(id) NOT NULL DEFAULT 1,
    star_sign_id SMALLINT REFERENCES star_sign(id) NOT NULL DEFAULT 1,

    -- General Settings
    unit_id SMALLINT REFERENCES unit(id) NOT NULL,

    -- Notification Settings
    chats_notification SMALLINT REFERENCES immediacy(id) NOT NULL DEFAULT 1,
    intros_notification SMALLINT REFERENCES immediacy(id) NOT NULL DEFAULT 2,

    -- Privacy Settings
    show_my_location BOOLEAN NOT NULL DEFAULT TRUE,
    show_my_age BOOLEAN NOT NULL DEFAULT TRUE,
    hide_me_from_strangers BOOLEAN NOT NULL DEFAULT FALSE,

    -- Bookkeeping
    sign_up_time TIMESTAMP NOT NULL DEFAULT NOW(),
    sign_in_count INT NOT NULL DEFAULT 1,
    sign_in_time TIMESTAMP NOT NULL DEFAULT NOW(),

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
    ip_address inet,
    signed_in BOOLEAN NOT NULL DEFAULT FALSE,
    session_expiry TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '6 months'),
    otp_expiry TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
    PRIMARY KEY (session_token_hash)
);

CREATE TABLE IF NOT EXISTS photo (
    person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    position SMALLINT NOT NULL,
    uuid TEXT NOT NULL,
    PRIMARY KEY (person_id, position)
);

CREATE TABLE IF NOT EXISTS undeleted_photo (
    uuid TEXT PRIMARY KEY
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
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    min_label TEXT,
    max_label TEXT,
    UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS trait_topic (
    trait_id SMALLINT NOT NULL REFERENCES trait(id) ON DELETE CASCADE ON UPDATE CASCADE,
    name TEXT,
    PRIMARY KEY (trait_id, name)
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
    has_kids_id SMALLINT REFERENCES yes_no_optional(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS search_preference_skipped (
    person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    skipped_id SMALLINT REFERENCES yes_no(id) ON DELETE CASCADE,
    PRIMARY KEY (person_id)
);

CREATE TABLE IF NOT EXISTS messaged (
    subject_person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    object_person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY (subject_person_id, object_person_id)
);

CREATE TABLE IF NOT EXISTS skipped (
    subject_person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    object_person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    reported BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (subject_person_id, object_person_id)
);

CREATE TABLE IF NOT EXISTS club (
    name TEXT NOT NULL,
    count_members INT NOT NULL DEFAULT 0,

    PRIMARY KEY (name)
);

CREATE TABLE IF NOT EXISTS person_club (
    person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    club_name TEXT NOT NULL REFERENCES club(name) ON DELETE CASCADE ON UPDATE CASCADE,

    PRIMARY KEY (person_id, club_name)
);

CREATE TABLE IF NOT EXISTS deleted_photo_admin_token (
    token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    photo_uuid TEXT NOT NULL,
    generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '1 month')
);

CREATE TABLE IF NOT EXISTS banned_person_admin_token (
    token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id INT REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '1 month')
);

CREATE TABLE IF NOT EXISTS banned_person (
    email TEXT NOT NULL,
    ip_address inet NOT NULL DEFAULT '127.0.0.1',
    banned_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '1 month'),
    PRIMARY KEY (email, ip_address)
);

--------------------------------------------------------------------------------
-- TABLES TO SPEED UP SEARCHING
--------------------------------------------------------------------------------

CREATE UNLOGGED TABLE IF NOT EXISTS search_cache (
    searcher_person_id INT REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    position SMALLINT,
    prospect_person_id INT REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    has_mutual_club BOOLEAN NOT NULL DEFAULT FALSE,
    profile_photo_uuid TEXT,
    name TEXT NOT NULL,
    age SMALLINT,
    match_percentage SMALLINT NOT NULL,
    personality VECTOR(47) NOT NULL,
    PRIMARY KEY (searcher_person_id, position)
);

--------------------------------------------------------------------------------
-- INDEXES
--------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx__person__activated__coordinates__gender_id
    ON person
    USING GIST(coordinates, gender_id)
    WHERE activated;

CREATE INDEX IF NOT EXISTS idx__search_cache__searcher_person_id__position ON search_cache(searcher_person_id, position);

CREATE INDEX IF NOT EXISTS idx__answer__question_id ON answer(question_id);
CREATE INDEX IF NOT EXISTS idx__answer__person_id_public_answer ON answer(person_id, public_, answer);

CREATE INDEX IF NOT EXISTS idx__duo_session__email
    ON duo_session(email);
CREATE INDEX IF NOT EXISTS idx__duo_session__session_expiry
    ON duo_session(session_expiry);

CREATE INDEX IF NOT EXISTS idx__location__coordinates ON location USING GIST(coordinates);
CREATE INDEX IF NOT EXISTS idx__location__long_friendly ON location USING GIST(long_friendly gist_trgm_ops);

CREATE INDEX IF NOT EXISTS idx__question__question ON question USING GIST(question gist_trgm_ops);

CREATE INDEX IF NOT EXISTS idx__person__sign_up_time ON person(sign_up_time);
CREATE INDEX IF NOT EXISTS idx__person__tiny_id ON person(tiny_id);
CREATE INDEX IF NOT EXISTS idx__person__email ON person(email);

CREATE INDEX IF NOT EXISTS idx__club__name ON club USING GIST(name gist_trgm_ops);

CREATE INDEX IF NOT EXISTS idx__banned_person__ip_address ON banned_person(ip_address);
CREATE INDEX IF NOT EXISTS idx__banned_person__expires_at ON banned_person(expires_at);

CREATE INDEX IF NOT EXISTS idx__banned_person_admin_token__expires_at
    ON banned_person_admin_token(expires_at);

CREATE INDEX IF NOT EXISTS idx__photo__uuid
    ON photo(uuid);

CREATE INDEX IF NOT EXISTS idx__onboardee__created_at
    ON onboardee(created_at);

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
INSERT INTO looking_for (name) VALUES ('Friends') ON CONFLICT (name) DO NOTHING;
INSERT INTO looking_for (name) VALUES ('Short-term dating') ON CONFLICT (name) DO NOTHING;
INSERT INTO looking_for (name) VALUES ('Long-term dating') ON CONFLICT (name) DO NOTHING;
INSERT INTO looking_for (name) VALUES ('Marriage') ON CONFLICT (name) DO NOTHING;

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
INSERT INTO religion (name) VALUES ('Zoroastrian') ON CONFLICT (name) DO NOTHING;
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
INSERT INTO immediacy (name) VALUES ('Every 3 days') ON CONFLICT (name) DO NOTHING;
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

INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Agreeableness',
    'Captures an individual''s range of social behaviors, from demonstrating empathy, cooperation, and consideration for others to expressing assertiveness and independence in social situations.',
    NULL,
    NULL
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Anxious Attachment',
    'Measures the extent to which a person seeks reassurance and fears abandonment in close relationships. If a person scores low on this and the "Avoidant Attachment" scale, they''re said to be "securely" attached. Secure attachment is associated with longer, more stable relationships.',
    NULL,
    NULL
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Avoidant Attachment',
    'Measures the preference for emotional distance and self-reliance in relationships. If a person scores low on this and the "Anxious Attachment" scale, they''re said to be "securely" attached. Secure attachment is associated with longer, more stable relationships.',
    NULL,
    NULL
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Conscientiousness',
    'Represents an individual''s approach to organization, reliability, and goal-setting, encompassing both highly structured and responsible behavior as well as a more flexible and spontaneous approach.',
    NULL,
    NULL
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Neuroticism',
    'Depicts the diversity in how people experience and cope with emotions, spanning the range from calmness and emotional steadiness to sensitivity and emotional responsiveness.',
    NULL,
    NULL
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Career Focus',
    'This trait reflects the importance you place on your career. Those scoring high value their career and tend to prioritize it, while those scoring low might prioritize other aspects of life over their career.',
    NULL,
    NULL
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Drug Friendliness',
    'This trait measures your openness to drug use. High scores could indicate a liberal attitude towards drugs or personal use, while low scores may represent a more conservative view or no personal use of drugs.',
    NULL,
    NULL
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Emotional Openness in Relationships',
    'This trait measures how comfortable you are with expressing emotions in a relationship. High scores mean you are open to discussing your feelings, while low scores might indicate a more reserved emotional style.',
    NULL,
    NULL
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Empathy',
    'This trait indicates how well you understand and share the feelings of others. High empathy means you easily connect with others'' emotions, while low empathy might indicate a more logical, detached approach.',
    NULL,
    NULL
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Emphasis on Boundaries',
    'This trait signifies a person''s tendency to define, communicate, and respect personal limits and spaces. People who score high on this trait believe in the importance of setting clear personal boundaries in their relationships.',
    NULL,
    NULL
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Environmentalism/Anthropocentrism',
    'Measures prioritization of preserving the environment and non-human species versus human-centered resource utilization and economic development.',
    'Environmentalism',
    'Anthropocentrism'
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Equanimity',
    'This trait pertains to a person''s ability to maintain calm and composure, especially during stressful situations. Individuals who score high on this trait are able to keep their cool and think clearly, regardless of the circumstances.',
    NULL,
    NULL
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Equity/Meritocracy',
    'Measures a person''s preference for a system that rewards individuals based on their abilities and achievements versus a system that prioritizes fairness and equal opportunities for everyone.',
    'Equity',
    'Meritocracy'
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Family Focus',
    'This trait is about how much a person values family relationships and commitments. Individuals who score high on this trait often place their family as a top priority and enjoy spending quality time with their loved ones.',
    NULL,
    NULL
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Fitness Focus',
    'This trait indicates the importance a person places on maintaining physical fitness and living a healthy lifestyle. Those with high scores for this trait are likely to enjoy activities like regular exercise, eating balanced meals, and living an overall active lifestyle.',
    NULL,
    NULL
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Honesty',
    'This trait describes a person''s tendency to speak the truth, behave transparently, and avoid deception. Individuals who score high on this trait value truthfulness and believe in being straightforward in their communications.',
    NULL,
    NULL
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Humility',
    'This trait reflects a person''s ability to remain modest and unpretentious, even in the face of success. Those who score high on this trait believe in acknowledging the role of others in their achievements and avoiding arrogance.',
    NULL,
    NULL
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Independence',
    'Do you take charge of your own life and make decisions without leaning on others? This trait measures your self-reliance and ability to handle things on your own.',
    NULL,
    NULL
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Individualism/Collectivism',
    'This trait measures a person''s preference for individual rights and freedoms versus collective good and social cohesion.',
    'Individualism',
    'Collectivism'
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Introversion/Extraversion',
    'Measures a person''s preference for engaging with the world, ranging from drawing energy from social interactions and being action-oriented (Extraversion) to finding energy in solitude and focusing on thoughts and feelings (Introversion).',
    'Introversion',
    'Extraversion'
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Isolationism/Internationalism',
    'This trait measures preference for national self-reliance and limited global engagement versus active participation in international affairs and cooperation.',
    'Isolationism',
    'Internationalism'
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Judging/Perceiving',
    'This trait captures someone''s approach to organizing and structuring their life, ranging from preferring a planned, orderly, and decisive lifestyle (Judging), to embracing spontaneity, flexibility, and adaptability (Perceiving).',
    'Judging',
    'Perceiving'
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Libertarianism/Authoritarianism',
    'This trait measures the preference for individual liberties and minimal government intervention, versus strong central authority and extensive government control.',
    'Libertarianism',
    'Authoritarianism'
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Love Focus',
    'How central is love in your life? This trait captures the importance you place on romantic relationships and the effort you''re willing to put into finding and maintaining them.',
    NULL,
    NULL
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Loyalty',
    'This trait shows us how committed you are. When you make a promise, do you keep it?',
    NULL,
    NULL
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Maturity',
    'A measure of how much a person takes responsibility for their actions, understands the world around them, and is ready to deal with complex issues. It is not about age, but about mindset and experience.',
    NULL,
    NULL
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Non-interventionism/Interventionism',
    'Measures a person''s preference for an active foreign policy with military and diplomatic interventions versus a non-interventionist approach that emphasizes diplomacy and trade.',
    'Non-interventionism',
    'Interventionism'
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Openness to Experience',
    'Represents a person''s willingness to explore new ideas, activities, and experiences. People high in this trait tend to be imaginative, creative, and curious. Those lower might appreciate routine, predictability, and familiar surroundings.',
    NULL,
    NULL
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Patience',
    'Measures your ability to stay calm and tolerant when facing challenges.',
    NULL,
    NULL
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Persistence',
    'Indicates how much you''re willing to stick with tasks, goals or beliefs, even in the face of adversity. Those lower in this trait might be more flexible, adaptive, and ready to pivot when needed.',
    NULL,
    NULL
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Playfulness',
    'This trait measures your tendency to seek joy, humor, and fun in life. High scores often enjoy spontaneity, games, and laughter. Those scoring lower might appreciate seriousness, focus, and quiet reflection.',
    NULL,
    NULL
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Preference for Monogamy',
    'This trait measures your inclination towards having one partner at a time. A low score doesn''t necessarily mean a preference for multiple partners simultaneously, but might reflect a desire for serial monogamy, or simply being open to different relationship structures.',
    NULL,
    NULL
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Rationality',
    'This trait determines the extent to which you prefer using logical reasoning and objective analysis over emotional intuition. Both approaches have their advantages, and neither is inherently better or worse than the other.',
    NULL,
    NULL
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Religiosity',
    'This trait measures the extent to which religious beliefs influence your life. It doesn''t indicate which religion you follow, or how devout you are, just the importance religion holds for you. It includes both traditionally religious and spiritual orientations.',
    NULL,
    NULL
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Security/Freedom',
    'Measures how much a person values national security and public safety versus individual freedoms and civil liberties.',
    'Security',
    'Freedom'
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Self-acceptance',
    'This trait measures your level of acceptance and appreciation for who you are as an individual. It doesn''t mean being complacent or avoiding personal growth, but rather denotes a healthy self-perception and an acceptance of one''s strengths and weaknesses.',
    NULL,
    NULL
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Self-esteem',
    'This trait signifies your overall subjective emotional evaluation of your own worth. High self-esteem doesn''t mean arrogance but refers to a positive, balanced view of oneself. Low self-esteem doesn''t necessarily indicate lack of confidence but may reflect humility or a more critical self-view.',
    NULL,
    NULL
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Sensing/Intuition',
    'This trait represents someone''s preferred way of processing information, covering the spectrum from focusing on concrete, tangible details and experiences (Sensing), to exploring abstract concepts, patterns, and possibilities (Intuition).',
    'Sensing',
    'Intuition'
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Sex Focus',
    'This trait measures how much a person prioritises sex over love',
    NULL,
    NULL
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Stability of Self-image',
    'This trait assesses how consistent a person''s self-perception is. If you score high, you typically have a strong and steady sense of who you are, while a low score indicates that your self-image may change based on circumstances, moods, or new experiences.',
    NULL,
    NULL
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Thinking/Feeling',
    'This trait reflects a person''s decision-making style, encompassing both logical, objective analysis and rationality (Thinking), as well as empathy, values, and consideration for others'' emotions (Feeling).',
    'Thinking',
    'Feeling'
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Thriftiness',
    'This trait reflects how careful you are with your resources, especially financial ones. High scorers tend to be frugal and prioritize saving, while low scorers may be more inclined to spend on experiences or items that bring them joy or satisfaction.',
    NULL,
    NULL
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Thrill-seeking',
    'This trait measures a person''s desire for excitement and adventure. If you score high, you''re likely to enjoy taking risks and exploring new experiences. A lower score indicates a preference for routine, comfort, and safety.',
    NULL,
    NULL
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Traditionalism about Love',
    'This trait gauges how much a person values traditional beliefs and practices about love and relationships. A high score indicates a preference for traditional courtship and relationship roles, while a low score might suggest an openness to modern or non-traditional expressions of love.',
    NULL,
    NULL
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Trust',
    'This trait represents a person''s propensity to trust others. A high scorer generally assumes that people are well-intentioned and reliable, while a low scorer tends to be more cautious and requires more evidence to trust others.',
    NULL,
    NULL
) ON CONFLICT (name) DO NOTHING;
INSERT INTO trait (name, description, min_label, max_label) VALUES (
    'Wholesomeness',
    'This trait measures a person''s inclination towards innocence, kindness, and a general appreciation for the simple things in life. High scorers are typically viewed as pure-hearted and genuine.',
    NULL,
    NULL
) ON CONFLICT (name) DO NOTHING;



INSERT INTO trait_topic (trait_id, name)
SELECT id, 'MBTI' FROM trait WHERE name = 'Introversion/Extraversion'
ON CONFLICT DO NOTHING;

INSERT INTO trait_topic (trait_id, name)
SELECT id, 'MBTI' FROM trait WHERE name = 'Thinking/Feeling'
ON CONFLICT DO NOTHING;

INSERT INTO trait_topic (trait_id, name)
SELECT id, 'MBTI' FROM trait WHERE name = 'Sensing/Intuition'
ON CONFLICT DO NOTHING;

INSERT INTO trait_topic (trait_id, name)
SELECT id, 'MBTI' FROM trait WHERE name = 'Judging/Perceiving'
ON CONFLICT DO NOTHING;



INSERT INTO trait_topic (trait_id, name)
SELECT id, 'Big 5' FROM trait WHERE name = 'Openness to Experience'
ON CONFLICT DO NOTHING;

INSERT INTO trait_topic (trait_id, name)
SELECT id, 'Big 5' FROM trait WHERE name = 'Conscientiousness'
ON CONFLICT DO NOTHING;

INSERT INTO trait_topic (trait_id, name)
SELECT id, 'Big 5' FROM trait WHERE name = 'Introversion/Extraversion'
ON CONFLICT DO NOTHING;

INSERT INTO trait_topic (trait_id, name)
SELECT id, 'Big 5' FROM trait WHERE name = 'Agreeableness'
ON CONFLICT DO NOTHING;

INSERT INTO trait_topic (trait_id, name)
SELECT id, 'Big 5' FROM trait WHERE name = 'Neuroticism'
ON CONFLICT DO NOTHING;



INSERT INTO trait_topic (trait_id, name)
SELECT id, 'Attachment Style' FROM trait WHERE name = 'Anxious Attachment'
ON CONFLICT DO NOTHING;

INSERT INTO trait_topic (trait_id, name)
SELECT id, 'Attachment Style' FROM trait WHERE name = 'Avoidant Attachment'
ON CONFLICT DO NOTHING;



INSERT INTO trait_topic (trait_id, name)
SELECT id, 'Politics' FROM trait WHERE name = 'Individualism/Collectivism'
ON CONFLICT DO NOTHING;

INSERT INTO trait_topic (trait_id, name)
SELECT id, 'Politics' FROM trait WHERE name = 'Libertarianism/Authoritarianism'
ON CONFLICT DO NOTHING;

INSERT INTO trait_topic (trait_id, name)
SELECT id, 'Politics' FROM trait WHERE name = 'Environmentalism/Anthropocentrism'
ON CONFLICT DO NOTHING;

INSERT INTO trait_topic (trait_id, name)
SELECT id, 'Politics' FROM trait WHERE name = 'Isolationism/Internationalism'
ON CONFLICT DO NOTHING;

INSERT INTO trait_topic (trait_id, name)
SELECT id, 'Politics' FROM trait WHERE name = 'Security/Freedom'
ON CONFLICT DO NOTHING;

INSERT INTO trait_topic (trait_id, name)
SELECT id, 'Politics' FROM trait WHERE name = 'Non-interventionism/Interventionism'
ON CONFLICT DO NOTHING;

INSERT INTO trait_topic (trait_id, name)
SELECT id, 'Politics' FROM trait WHERE name = 'Equity/Meritocracy'
ON CONFLICT DO NOTHING;



INSERT INTO trait_topic
SELECT
    trait.id,
    'Other'
FROM
    trait
WHERE
    id NOT IN (
        SELECT
            trait_id
        FROM
            trait_topic
        WHERE
            name IN ('MBTI', 'Big 5', 'Attachment', 'Politics')
    )
ON CONFLICT DO NOTHING;

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

    ll = lambda x: numpy.log(numpy.log(x + 1) + 1)

    personality_weight = ll(count_answers) / ll(250)
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

CREATE OR REPLACE FUNCTION trait_ratio(
    presence_score INT[],
    absence_score INT[],
    score_threshold INT
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
-- TRIGGER - refresh_has_profile_picture_id
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION refresh_has_profile_picture_id(p_person_id INT)
RETURNS INTEGER AS $$
    WITH has_photo AS (
        SELECT EXISTS (
            SELECT 1 FROM photo WHERE photo.person_id = p_person_id
        ) AS has_photo
    ), has_profile_picture_id AS (
        SELECT id
        FROM yes_no
        WHERE
            (name = 'Yes' AND (SELECT has_photo FROM has_photo))
        OR
            (name = 'No'  AND (SELECT NOT has_photo FROM has_photo))
    ), update_person AS (
        UPDATE person
        SET has_profile_picture_id = has_profile_picture_id.id
        FROM has_profile_picture_id
        WHERE person.id = p_person_id
        RETURNING 1
    )
    SELECT COUNT(*) FROM update_person;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION trigger_fn_refresh_has_profile_picture_id()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM refresh_has_profile_picture_id(NEW.person_id);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM refresh_has_profile_picture_id(OLD.person_id);
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_refresh_has_profile_picture_id
AFTER INSERT OR DELETE ON photo
FOR EACH ROW
EXECUTE FUNCTION trigger_fn_refresh_has_profile_picture_id();

--------------------------------------------------------------------------------
-- Migrations
--------------------------------------------------------------------------------

-- TODO: Take duolicious down
-- TODO: Delete this line and the ones in the cron module
-- TODO: bring duolicious up
DELETE FROM undeleted_photo;

DROP INDEX IF EXISTS idx__person__activated__gender_id__coordinates;

--------------------------------------------------------------------------------

-- TODO: Periodically delete expired tokens
-- TODO: Periodically move inactive accounts
