Q_50_UNCHECKED_PHOTOS = """
SELECT
    uuid
FROM
    photo
WHERE
    nsfw_score IS NULL
LIMIT
    50
"""

Q_SET_NSFW_SCORE = """
UPDATE
    photo
SET
    nsfw_score = %(nsfw_score)s
WHERE
    uuid = %(uuid)s
"""
