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

Q_INSERT_BAD_DOMAIN = """
INSERT INTO bad_email_domain (domain) VALUES (
    %(domain)s
) ON CONFLICT (domain) DO NOTHING;
"""

Q_INSERT_GOOD_DOMAIN = """
INSERT INTO good_email_domain (domain) VALUES (
    %(domain)s
) ON CONFLICT (domain) DO NOTHING;
"""
