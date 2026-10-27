const express = require('express');
const { twiml } = require('twilio');
const dotenv = require('dotenv');
dotenv.config();
const { createLink, verifyLink, presignRecording } = require('./lib/recording-link');
const app = express();
app.use(express.urlencoded({ extended: false }));

app.get('/', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send('HamePhone Server powered by Twilio');
});

/**
 * IVRメニューを提供するエンドポイント
 * @route POST /ivr
 * @description 着信時に営業/返品/注文の振り分けメニューを音声で案内
 * @returns {string} TwiML形式のXMLレスポンス
 */
app.post('/ivr', (req, res) => {
  const response = new twiml.VoiceResponse();
  const gather = response.gather({
    numDigits: 1,
    action: '/handle-gather',
    method: 'POST'
  });
  const message = 'お電話ありがとうございます。破滅派です。営業またはサービスのご紹介の方は1を、書籍の返品希望の書店様は2を、その他、破滅派への書籍注文やサービスに関するお問い合わせについては3を押してください。';
  gather.say({
    voice: 'Polly.Takumi-Neural',
    language: 'ja-JP',
  }, message);
  res.type('text/xml');
  res.send(response.toString());
});

/**
 * キーパッド入力に基づいて通話を振り分ける
 * @route POST /handle-gather
 * @param {string} req.body.Digits - ユーザーが押したキー（1: 営業, 2: 返品, 3: 注文）
 * @description 営業と返品は2段階転送、注文は直接転送
 * @returns {string} TwiML形式のXMLレスポンス
 */
app.post('/handle-gather', async (req, res) => {
  const digit = req.body.Digits;
  const response = new twiml.VoiceResponse();

  if (digit === '1') {
    // 営業：お問い合わせフォーム案内 → 確認
    const gather = response.gather({
      numDigits: 1,
      action: '/confirm-sales',
      method: 'POST'
    });
    // 営業のメッセージ
    const message = '営業やサービスのご紹介はお問い合わせフォームをご利用ください。通話をご希望の場合は1を押してください。';
    // メッセージを再生
    gather.say({
      voice: 'Polly.Takumi-Neural',
      language: 'ja-JP',
    }, message);
  } else if (digit === '2') {
    // 返品依頼：メッセージ案内 → 確認
    const gather = response.gather({
      numDigits: 1,
      action: '/confirm-return',
      method: 'POST'
    });
    // 返品のメッセージ
    const message = '返品条件付き注文品は返品了解者「タカハシ」で取次にお戻しください。通話をご希望の方は1を押してください。';
    // メッセージを再生
    gather.say({
      voice: 'Polly.Takumi-Neural',
      language: 'ja-JP',
    }, message);
  } else if (digit === '3') {
    // 注文・サービス：直接転送
    response.dial({
      record: 'record-from-answer',
      recordingStatusCallback: '/recording-status',
      callerId: process.env.TWILIO_PHONE_NUMBER,
      timeout: 30
    }, process.env.FORWARD_TO);
  } else {
    response.say({
      voice: 'Polly.Takumi-Neural',
      language: 'ja-JP',
    }, '正しい番号を押してください。');
    response.hangup();
  }
  res.type('text/xml');
  res.send(response.toString());
});

/**
 * 営業の確認処理
 * @route POST /confirm-sales
 * @param {string} req.body.Digits - ユーザーが押したキー
 * @description 1を押した場合のみ転送、それ以外は終了
 */
app.post('/confirm-sales', (req, res) => {
  const digit = req.body.Digits;
  const response = new twiml.VoiceResponse();

  if (digit === '1') {
    response.dial({
      record: 'record-from-answer',
      recordingStatusCallback: '/recording-status',
      timeout: 30,
      callerId: process.env.TWILIO_PHONE_NUMBER,
    }, process.env.FORWARD_TO);
  } else {
    response.say({
      voice: 'Polly.Takumi-Neural',
      language: 'ja-JP',
    }, 'お問い合わせフォームをご利用ください。ありがとうございました。');
    response.hangup();
  }
  res.type('text/xml');
  res.send(response.toString());
});

/**
 * 返品依頼の確認処理
 * @route POST /confirm-return
 * @param {string} req.body.Digits - ユーザーが押したキー
 * @description 1を押した場合のみ転送、それ以外は終了
 */
app.post('/confirm-return', (req, res) => {
  const digit = req.body.Digits;
  const response = new twiml.VoiceResponse();

  if (digit === '1') {
    response.dial({
      record: 'record-from-answer',
      recordingStatusCallback: '/recording-status',
      callerId: process.env.TWILIO_PHONE_NUMBER,
      timeout: 30
    }, process.env.FORWARD_TO);
  } else {
    response.say({
      voice: 'Polly.Takumi-Neural',
      language: 'ja-JP',
    }, '返品についてメッセージでご案内いたしました。ありがとうございました。');
    response.hangup();
  }
  res.type('text/xml');
  res.send(response.toString());
});

/**
 * 録音完了時の処理
 * @route POST /recording-status
 * @description 録音ファイルのS3保存と通知
 */
app.post('/recording-status', async (req, res) => {
  const recordingUrl = req.body.RecordingUrl;
  const recordingSid = req.body.RecordingSid;
  const callTime = new Date().toLocaleString('ja-JP');
  try {
    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    // 発信者番号を特定
    const callSid = req.body.CallSid;
    let from = '不明';
    try {
      const call = await client.calls(callSid).fetch();
      from = call.from || '不明';
    } catch (err) {
      console.error('発信者情報の取得に失敗:', err);
    }
    // 録音情報を取得（S3に保存されている場合のURLも含む）
    const recording = await client.recordings(recordingSid).fetch();
    const mediaUrl = recording.mediaUrl || recordingUrl;
    console.log('録音完了:', {
      sid: recordingSid,
      url: mediaUrl,
      duration: recording.duration,
      from: from,
      time: callTime
    });
    // SMS用番号がある場合はSMS送信
    const smsNumber = process.env.TWILIO_SMS_NUMBER;
    if (smsNumber) {
      const baseUrl = process.env.PUBLIC_URL || `https://${req.get('host')}`;
      let listenUrl = mediaUrl;
      try {
        listenUrl = createLink(baseUrl, recordingSid);
      } catch (err) {
        console.error('再生用URLの生成に失敗:', err.message);
      }
      await client.messages.create({
        body: `[📞 タイトル]\n⏰ ${callTime}\n📱 ${from}\n🎙️ 録音完了\n🔗 ${listenUrl}`,
        from: smsNumber,
        to: process.env.FORWARD_TO
      });
      console.log('SMS通知を送信しました');
    } else {
      console.log('SMS用番号が設定されていないため、SMS通知をスキップしました');
    }
  } catch (error) {
    console.error('録音処理エラー:', error);
  }

  res.sendStatus(200);
});

/**
 * SMSのリンクから録音を再生する
 * @route GET /r/:sid
 * @param {string} req.query.e - 有効期限（UNIX秒）
 * @param {string} req.query.t - HMAC署名
 * @description 署名を検証し、S3の署名付きURLへリダイレクト
 */
app.get('/r/:sid', async (req, res) => {
  const { sid } = req.params;
  if (!verifyLink(sid, req.query.e, req.query.t)) {
    res.status(403).type('text/plain').send('リンクが無効か、有効期限が切れています。');
    return;
  }
  try {
    res.redirect(302, await presignRecording(sid));
  } catch (error) {
    console.error('署名付きURLの生成に失敗:', error);
    res.status(500).type('text/plain').send('録音を取得できませんでした。');
  }
});

if (require.main === module) {
  app.listen(process.env.PORT || 3000, () => console.log(`Listening on port ${process.env.PORT || 3000}`));
}

module.exports = app;
