Q_SELECT_REVENUECAT_AUTHORIZED = """
SELECT
    1
FROM
    funding
WHERE
    token_hash_revenuecat = %(token_hash_revenuecat)s
"""

Q_LIVE_PAYPAL_SUBSCRIPTION_IDS = """
SELECT
    provider_subscription_id
FROM
    gold_subscription
WHERE
    person_id = ANY(%(person_ids)s)
AND
    provider = 'paypal'
AND
    expires_at = 'infinity'
"""

Q_HAS_LIVE_SUBSCRIPTION = """
SELECT EXISTS (
    SELECT 1 FROM gold_subscription
    WHERE person_id = %(person_id)s AND expires_at = 'infinity'
) AS has_live_subscription
"""

Q_INSERT_REF_PAYMENT = """
INSERT INTO ref_payment (
    provider,
    provider_payment_id,
    provider_subscription_id,
    ref,
    plan,
    amount,
    currency,
    paid_at
)
SELECT
    %(provider)s,
    %(provider_payment_id)s,
    %(provider_subscription_id)s,
    ref,
    %(plan)s,
    %(amount)s,
    %(currency)s,
    %(paid_at)s
FROM (
    SELECT COALESCE(
        (
            SELECT
                ref
            FROM
                ref_payment
            WHERE
                provider = %(provider)s
            AND
                provider_subscription_id = %(provider_subscription_id)s
            LIMIT 1
        ),
        (
            SELECT
                person_ref.ref
            FROM
                person_ref
            JOIN
                person
            ON
                person.id = person_ref.person_id
            WHERE
                person.uuid = uuid_or_null(%(person_uuid)s::TEXT)
        )
    ) AS ref
) AS attribution
WHERE
    ref IS NOT NULL
ON CONFLICT DO NOTHING
"""
