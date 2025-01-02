import re

Q_INSERT_SERVER_USER = """
INSERT INTO
    mam_server_user (server, user_name)
VALUES
    ('duolicious.app', %(user_name)s)
"""

Q_INSERT_MESSAGE = """
INSERT INTO
    mam_message (
        id,
        user_id,
        from_jid,
        remote_bare_jid,
        remote_resource,
        direction,
        message,
        search_body,
        origin_id
    )
VALUES
    (
        %(id)s,
        (SELECT id FROM mam_server_user WHERE user_name = %(from_username)s),
        '', -- from_jid is ignored
        %(to_username)s,
        '', -- remote_resource is ignored
        'O',
        %(message)s,
        %(search_body)s,
        NULL
    ),

    (
        %(id)s,
        (SELECT id FROM mam_server_user WHERE user_name = %(to_username)s),
        '', -- from_jid is ignored
        %(from_username)s,
        '', -- remote_resource is ignored
        'I',
        %(message)s,
        %(search_body)s,
        NULL
    ),
)
"""

Q_SELECT_MESSAGE = """
SELECT
    mam_message.direction,
    mam_message.message
FROM
    mam_message
JOIN
    mam_server_user
ON
    mam_server_user.id = mam_message.user_id
WHERE
    mam_server_user.server = 'duolicious.app'
AND
    mam_server_user.user_name = '14c20615-ddb9-41c6-a44c-01747f793587'
AND
    mam_message.remote_bare_jid = '8e147149-4350-4b82-b23b-c358e5b65ed5'
ORDER BY
    mam_message.id
;
"""


 user1 | cc829b40-40d1-44db-899c-8a229851e8a8
 user2 | 14c20615-ddb9-41c6-a44c-01747f793587
 user3 | 8e147149-4350-4b82-b23b-c358e5b65ed5
 user4 | c1c2b163-2237-4c74-89ff-ed6a5bf2780c


"""
    <iq type='set' id='${queryId}'>
      <query xmlns='urn:xmpp:mam:2' queryid='${queryId}'>
        <x xmlns='jabber:x:data' type='submit'>
          <field var='FORM_TYPE'>
            <value>urn:xmpp:mam:2</value>
          </field>
          <field var='with'>
            <value>${personUuidToJid(withPersonUuid)}</value>
          </field>
        </x>
        <set xmlns='http://jabber.org/protocol/rsm'>
          <max>50</max>
          <before>${beforeId}</before>
        </set>
      </query>
    </iq>
"""

"""
<message
    type='chat'
    from='$user3uuid@duolicious.app'
    to='$user1uuid@duolicious.app'
    id='id3'
    check_uniqueness='false'
    xmlns='jabber:client'>
  <body>message will be sent with no notification</body>
  <request xmlns='urn:xmpp:receipts'/>
</message>
"""

"""
CREATE TABLE mam_message(
  -- Message UID (64 bits)
  -- A server-assigned UID that MUST be unique within the archive.
  id BIGINT NOT NULL,

  user_id INT NOT NULL,

  -- FromJID used to form a message without looking into stanza.
  -- This value will be send to the client "as is".
  from_jid varchar(250) NOT NULL,

  -- The remote JID that the stanza is to (for an outgoing message) or from (for an incoming message).
  -- This field is for sorting and filtering.
  remote_bare_jid varchar(250) NOT NULL,

  remote_resource varchar(250) NOT NULL,

  -- I - incoming, remote_jid is a value from From.
  -- O - outgoing, remote_jid is a value from To.
  -- Has no meaning for MUC-rooms.
  direction mam_direction NOT NULL,

  -- Term-encoded message packet
  message bytea NOT NULL,

  search_body text,

  origin_id varchar,

  PRIMARY KEY(user_id, id)
);
"""

def normalize_search_text(text: str | None) -> str | None:
    if text is None:
        return None

    # Convert to lowercase
    lower_body = text.lower()

    # Step 1: Replace certain punctuations with a single space
    re0 = re.sub(r"[, .:;\-?!]+", " ", lower_body, flags=re.UNICODE)

    # Step 2: Remove non-word characters at the start and end of the string, or entirely non-word characters
    re1 = re.sub(r"([^\w ]+)|(^\s+)|(\s+$)", "", re0, flags=re.UNICODE)

    # Step 3: Replace multiple spaces with the word separator
    re2 = re.sub(r"\s+", ' ', re1, flags=re.UNICODE)

    return re2
