Q_50_UNCHECKED_PHOTOS = """
SELECT
    uuid
FROM
    photo
WHERE
    NOT nsfw_checked
LIMIT
    50
"""

Q_SET_NSFW_CHECKED = """
UPDATE
    photo
SET
    nsfw_checked = TRUE
WHERE
    uuid = ANY(%(uuids)s::TEXT[])
"""
