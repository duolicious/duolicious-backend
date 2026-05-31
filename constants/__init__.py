MAX_IMAGE_BYTES = 10_000_000
MAX_NUM_IMAGES = 7;
MAX_CONTENT_LENGTH = MAX_NUM_IMAGES * MAX_IMAGE_BYTES;

MAX_AUDIO_BYTES = 10_000_000
MAX_AUDIO_SECONDS = 120 + 1

MAX_NOTIFICATION_LENGTH = 128

ONLINE_RECENTLY_SECONDS = 12 * 60 * 60  # 12 hours

# ------------------------------------------------------------------------
# Club SEO page tunables. Shared by the API's read/sitemap queries
# (service/person/sql) and the cron's batch-stats/description queries
# (service/cron/clubseo/sql). They live here, in a dependency-free module,
# so both can import them without dragging in each other's package.
#
# Aggregates are never computed in the API request path. A cron precomputes
# every eligible club's stats in a handful of grouped passes and stores the
# finished JSON in `club_stats`; the API serves it with a single-row read.
# ------------------------------------------------------------------------

# A club needs at least this many members to get its own page. Below it,
# pages would be "thin content" (sparse demographic cells, few quiz
# divergences) and Google penalises sites that flood the index with
# near-empty pages. 50 is well below the popular clubs (1000+ members) but
# rules out the long tail of tiny / single-user clubs.
MIN_CLUB_PAGE_MEMBERS = 50

# Cap on the number of members sampled when computing a club's stats. The
# biggest clubs have thousands of members with tens of millions of answers
# between them; a deterministic md5-ordered sample of this many members
# yields the same proportions for the bars and answer-divergence without
# scanning every member's answers. Displayed `member_count` is always the
# true count, not the sample size.
MAX_CLUB_SAMPLE_MEMBERS = 2000

# Privacy floor: never display a demographic/overlap category with fewer
# than this many members in it, to prevent re-identification.
MIN_CLUB_CELL_SIZE = 5

# A quiz question needs at least this many club answers before we trust
# the club's agree-rate enough to compare it against the platform.
MIN_CLUB_ANSWERS_PER_QUESTION = 10

# Only surface a question when the club's agree-rate differs from the
# platform-wide rate by at least this many percentage points.
MIN_ANSWER_DIVERGENCE_PCT = 15

# How many of the most-divergent questions / most-overlapping clubs to
# return for the page, and how many facts to feed the LLM prompt.
MAX_CLUB_TOP_ANSWERS = 8
MAX_RELATED_CLUBS = 8
MAX_LLM_PROMPT_FACTS = 6

# A trait's club mean must be at least this far from neutral (0) before
# it's worth mentioning in the LLM prompt.
MIN_NOTABLE_TRAIT_SCORE = 10

# Related clubs are ranked by lift (n*N / (|A|*|B|)): clubs whose members
# overlap with A's *disproportionately*, not just the biggest clubs. For a
# fixed A the ranking simplifies to n / |B|.
#
# The global club_overlap precompute (service/cron/clubseo) drops anyone in
# more than this many clubs, to bound the co-membership self-join's fan-out
# (quadratic per person) and because hyper-joiners are low-signal for
# relatedness. Set to the gold-tier club quota (100): the free quota is 50
# and gold lets users join up to 100, so this cap only excludes people
# operating at the upper end of the gold quota -- production p99.
MAX_CLUBS_PER_PERSON_FOR_OVERLAP = 100
