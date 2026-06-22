const express = require('express');
const bodyParser = require('body-parser');

// In-memory record of every push notification the cron has sent us.
let received = [];

const app = express();
app.use(bodyParser.json());

// The cron POSTs an array of Expo-style notifications. Record each one and reply
// in the shape the cron expects: a `data` array with one {status: 'ok'} per
// notification.
app.post('/', (req, res) => {
  const notifications = Array.isArray(req.body) ? req.body : [req.body];
  received.push(...notifications);
  res.status(200).json({ data: notifications.map(() => ({ status: 'ok' })) });
});

// List everything received so far (without clearing), so tests can assert.
app.get('/messages', (req, res) => {
  res.status(200).json(received);
});

// Clear the record.
app.delete('/messages', (req, res) => {
  received = [];
  res.status(200).send();
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Push mock running on port ${PORT}`);
});
