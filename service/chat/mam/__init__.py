Q_INSERT = """
"""

Q_SELECT = """
"""


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
