Q_UNUSED_PHOTOS = """
       SELECT uuid FROM undeleted_photo

-- TODO: Delete these
EXCEPT SELECT uuid FROM photo
EXCEPT SELECT uuid FROM onboardee_photo
"""

Q_MARK_PHOTO_DELETED = """
DELETE FROM undeleted_photo WHERE uuid = ANY(%(uuids)s::TEXT[])
"""
