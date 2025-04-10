Q_MARK_PHOTO_DELETED = """
DELETE FROM undeleted_photo WHERE uuid = ANY(%(uuids)s::TEXT[])
"""


Q_MARK_AUDIO_DELETED = """
DELETE FROM undeleted_audio WHERE uuid = ANY(%(uuids)s::TEXT[])
"""
