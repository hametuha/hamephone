# Hamephone 開発計画（Plan.md）

## 🎯 プロジェクト概要
**Hamephone** は、Twilio と GCP を活用した、スマホ転送対応・IVRルーティング機能付きのクラウド電話サービスです。営業電話を自動判別し、顧客からの電話だけをスマホに転送します。

- 技術的興味に応じた実装：Twilio を中心にコードで制御
- ローカル開発環境：Docker + Node.js による再現性の高い環境
- 将来的に GCP（Cloud Run）へ本番展開

---

## ✅ 要件一覧
| 機能             | 内容                                         |
| ---------------- | -------------------------------------------- |
| 着信受付         | Twilio 番号で着信受付                        |
| IVRルーティング  | キーパッドで振り分け（営業 or 顧客）         |
| スマホ転送       | 顧客の場合のみ、事前に登録した携帯番号へ転送 |
| 営業ブロック     | 営業と判断した場合は自動でお断りアナウンス   |
| ローカル開発     | Docker 上で Express アプリを開発             |
| デプロイ（将来） | Cloud Run 上でコンテナ実行を想定             |

---

## 🐳 ローカル開発環境テンプレート

### ディレクトリ構成
```
hamephone/
├── docker-compose.yml
├── Dockerfile
├── server.js
├── .env.example
└── README.md
```

### `Dockerfile`
```Dockerfile
FROM node:20
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["node", "server.js"]
```

### `docker-compose.yml`
```yaml
version: '3.9'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - FORWARD_TO=+819012345678 # あなたの携帯番号
```

### `server.js`
```js
const express = require('express');
const { twiml } = require('twilio');
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

app.listen(3000, () => console.log('Listening on port 3000'));
```

---

## 🌐 ngrok でローカル公開
```bash
npx ngrok http 3000
```
- 出てきたURLをTwilio番号の "A Call Comes In" に設定

---

## ☁️ 今後の展開（Cloud Run想定）
- `Dockerfile`そのままで `gcloud run deploy` 可能
- Cloud Build + GitHub Actions でCI/CD連携
- Secret Manager 統合で電話番号などを管理

---

## 🔖 メモ
- Twilio着信 → Webhook → IVRルーティング → スマホ転送
- 転送にはTwilio発信料金が発生（2〜3円/分）
- コストを抑えたければ WebRTC や SIP にも今後対応検討

---

## ✨ ToDo（今後）
- [ ] `.env` による設定管理
- [ ] 着信ログ保存（Cloud Firestore or SQLite）
- [ ] 簡易通話履歴UI
- [ ] Cloud Run への本番デプロイ
- [ ] 営業電話データベースとの連携（営業番号の自動ブロック）

---

以上が初期テンプレートと開発方針のまとめです。