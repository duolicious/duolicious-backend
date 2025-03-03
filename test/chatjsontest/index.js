const WebSocket = require('ws');
const express = require('express');
const bodyParser = require('body-parser');

let wsClient = null;
let receivedMessages = [];

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.text({ type: '*/*' }));

// /config accepts a JSON payload like { "server": "ws://example.com:port" }
app.post('/config', (req, res) => {
  const { server } = req.body;
  if (!server) {
    return res.status(400).send('Missing required "server" parameter');
  }

  // If already connected, close the previous connection
  if (wsClient) {
    wsClient.close();
    receivedMessages = [];
  }

  wsClient = new WebSocket(server, ['json']);

  wsClient.on('open', () => {
    console.log(`Connected to ${server}`);
  });

  wsClient.on('message', (message) => {
    let decodedMessage = message.toString();

    console.log('⮈', decodedMessage);

    try {
      pretty = JSON.stringify(JSON.parse(decodedMessage), undefined, 2);
    } catch { }

    receivedMessages.push(pretty);
  });

  wsClient.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  wsClient.on('close', () => {
    console.log('WebSocket connection closed');
  });

  res.status(200).send();
});

// /send accepts raw message text and sends it over the WebSocket connection
app.post('/send', (req, res) => {
  if (!wsClient || wsClient.readyState !== WebSocket.OPEN) {
    return res.status(500).send('WebSocket is not connected');
  }
  try {
    const payload = JSON.stringify(req.body);
    console.log('⮊', payload);
    wsClient.send(payload, (error) => {
      if (error) {
        return res.status(500).send('Error sending message: ' + error.toString());
      }
      res.status(200).send();
    });
  } catch (error) {
    res.status(500).send('Error sending message: ' + error.toString());
  }
});

// /pop returns and clears the list of received messages
app.get('/pop', (req, res) => {
  res.status(200).send(receivedMessages.join('\n'));
  receivedMessages = [];
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
