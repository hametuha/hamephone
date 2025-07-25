const express = require('express');
const { twiml } = require('twilio');
const dotenv = require('dotenv');
dotenv.config();
const app = express();
app.use(express.urlencoded({ extended: false }));

app.post('/ivr', (req, res) => {
  const response = new twiml.VoiceResponse();
  const gather = response.gather({
    numDigits: 1,
    action: '/handle-gather',
    method: 'POST'
  });
  gather.say('営業の方は1を、お客様は2を押してください。');
  res.type('text/xml');
  res.send(response.toString());
});

app.post('/handle-gather', (req, res) => {
  const digit = req.body.Digits;
  const response = new twiml.VoiceResponse();

  if (digit === '2') {
    response.dial(process.env.FORWARD_TO);
  } else {
    response.say('営業のお電話はお断りしています。');
    response.hangup();
  }
  res.type('text/xml');
  res.send(response.toString());
});

if (require.main === module) {
  app.listen(process.env.PORT || 3000, () => console.log(`Listening on port ${process.env.PORT || 3000}`));
}

module.exports = app;
