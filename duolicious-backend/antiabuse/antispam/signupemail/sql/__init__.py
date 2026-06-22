Q_EMAIL_INFO = """
SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM person WHERE email = %(email)s)
        THEN 'registered'

        WHEN EXISTS (SELECT 1 FROM good_email_domain WHERE domain = %(domain)s)
        THEN 'unregistered-good'

        WHEN EXISTS (SELECT 1 FROM bad_email_domain  WHERE domain = %(domain)s)
        THEN 'unregistered-bad'

        ELSE 'unregistered-unknown'
    END AS domain_status
"""
