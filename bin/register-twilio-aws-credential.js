#!/usr/bin/env node
/**
 * .env の AWS キーを Twilio の AWS Credential として登録する
 *
 * 録音の外部ストレージ（S3）用キーをローテーションするときに使う。
 * 登録後、Twilio コンソールで録音の保存先をこの Credential に切り替えること。
 *
 * Usage: node bin/register-twilio-aws-credential.js ["表示名"]
 */
const dotenv = require('dotenv');
dotenv.config({ quiet: true });
const twilio = require('twilio');

const name = process.argv[2] || 'S3 hamephone-recordings (hamephone-twilio)';
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } = process.env;
if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
  console.error('.env に AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY がありません');
  process.exit(1);
}

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
client.accounts.v1.credentials.aws.create({
  friendlyName: name,
  credentials: `${AWS_ACCESS_KEY_ID}:${AWS_SECRET_ACCESS_KEY}`
}).then((cred) => {
  console.log(`登録しました: ${cred.sid} (${cred.friendlyName})`);
}).catch((err) => {
  console.error('登録に失敗:', err.message);
  process.exit(1);
});
