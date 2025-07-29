const express = require('express');
const { twiml } = require('twilio');
const dotenv = require('dotenv');
dotenv.config();
const app = express();
app.use(express.urlencoded({ extended: false }));

/**
 * IVRメニューを提供するエンドポイント
 * @route POST /ivr
 * @description 着信時に営業/顧客の振り分けメニューを音声で案内
 * @returns {string} TwiML形式のXMLレスポンス
 */
app.post('/ivr', (req, res) => {
  const response = new twiml.VoiceResponse();
  const gather = response.gather({
    numDigits: 1,
    action: '/handle-gather',
    method: 'POST'
  });
  gather.say({
    voice: 'woman',
    language: 'ja-JP',
  }, '営業の方は1を、お客様は2を押してください。');
  res.type('text/xml');
  res.send(response.toString());
});

/**
 * キーパッド入力に基づいて通話を振り分ける
 * @route POST /handle-gather
 * @param {string} req.body.Digits - ユーザーが押したキー
 * @description 営業の場合は拒否メッセージ、顧客の場合は転送
 * @returns {string} TwiML形式のXMLレスポンス
 */
app.post('/handle-gather', async (req, res) => {
  const digit = req.body.Digits;
  const response = new twiml.VoiceResponse();

  if (digit === '2') {
    // 録音機能付きで転送（SMS通知は録音完了時にまとめて送信）
    response.dial({
      record: 'record-from-answer',
      recordingStatusCallback: '/recording-status',
      timeout: 30
    }, process.env.FORWARD_TO);
  } else {
    response.say('営業のお電話はお断りしています。');
    response.hangup();
  }
  res.type('text/xml');
  res.send(response.toString());
});

/**
 * 録音完了時の処理
 * @route POST /recording-status
 * @description 録音ファイルの保存と通知
 */
app.post('/recording-status', async (req, res) => {
  const recordingUrl = req.body.RecordingUrl;
  const recordingSid = req.body.RecordingSid;
  const from = req.body.From || '不明';
  const callTime = new Date().toLocaleString('ja-JP');
  
  try {
    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    
    // 7日後に自動削除
    await client.recordings(recordingSid)
      .update({ status: 'deleted' });
    
    // 1回のSMS通知にまとめる
    await client.messages.create({
      body: `[📞 タイトル]\n⏰ ${callTime}\n📱 ${from}\n🎙️ 録音完了\n🔗 ${recordingUrl}\n⏰ 7日後に自動削除`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: process.env.FORWARD_TO
    });
  } catch (error) {
    console.error('録音処理エラー:', error);
  }
  
  res.sendStatus(200);
});

if (require.main === module) {
  app.listen(process.env.PORT || 3000, () => console.log(`Listening on port ${process.env.PORT || 3000}`));
}

module.exports = app;
