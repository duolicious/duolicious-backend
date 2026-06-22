const { client } = require('@xmpp/client');
const { websocket } = require('@xmpp/websocket');
const express = require('express');
const bodyParser = require('body-parser');
const ltx = require('ltx');

// In-memory storage for XMPP connection parameters and received messages
let xmppConfig = {
  service: '',
  domain: '',
  resource: '',
  username: '',
  password: ''
};

let receivedMessages = [];
let xmpp;

process.on('uncaughtException', (err) => {
  console.error('Caught unhandled exception:', err);
});

const setupXMPPClient = async () => {
  if (xmpp) {
    await xmpp.stop().catch(console.error);
    receivedMessages = [];
  }

  xmpp = client({
    service: xmppConfig.service,
    domain: xmppConfig.domain,
    resource: xmppConfig.resource,
    username: xmppConfig.username,
    password: xmppConfig.password,
  });

  xmpp.on('error', err => {
    console.error('❌', err.toString());
  });

  xmpp.on('status', status => {
    console.log('🛈', status);
  });

  xmpp.on('input', input => {
    console.log('⮈', input);
    receivedMessages.push(input);
  });

  await xmpp.start().catch(console.error);
};

// REST API setup
const app = express();

app.use(bodyParser.json());
app.post('/config', async (req, res) => {
  const { service, domain, resource, username, password } = req.body;
  if (!service || !domain || !username || !password) {
    return res.status(400).send('Missing required parameters');
  }

  xmppConfig = { service, domain, resource, username, password };

  try {
    await setupXMPPClient();
    res.status(200).send();
  } catch (error) {
    res.status(500).send('Error configuring XMPP client: ' + error.toString());
  }
});

app.use(bodyParser.text({ type: 'application/xml' }));
app.post('/send', (req, res) => {
  try {
    const parsedStanza = ltx.parse(req.body);
    console.log('⮊', req.body);
    xmpp.send(parsedStanza).then(() => {
      res.status(200).send();
    }).catch(err => {
      res.status(500).send('Error sending raw stanza: ' + err.toString());
    });
  } catch (err) {
    res.status(400).send('Invalid stanza: ' + err.toString());
  }
});

app.get('/pop', (req, res) => {
  res.status(200).send(receivedMessages.join('\n'));
  // Clear received messages after sending to the client
  receivedMessages = [];
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
