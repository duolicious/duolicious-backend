Q_MARK_PHOTO_DELETED = """
DELETE FROM undeleted_photo WHERE uuid = ANY(%(uuids)s::TEXT[])
"""
