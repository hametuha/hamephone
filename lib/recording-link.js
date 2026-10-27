const crypto = require('crypto');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// S3のライフサイクル（90日で削除）に合わせる
const DEFAULT_LINK_TTL_DAYS = 90;
// リダイレクト先のS3署名付きURLの有効期限（秒）
const PRESIGN_EXPIRES = 300;
const RECORDING_SID_PATTERN = /^RE[0-9a-f]{32}$/;

/**
 * 録音SIDと有効期限からHMAC署名を生成する
 * @param {string} sid - 録音SID
 * @param {number} expires - 有効期限（UNIX秒）
 * @param {string} secret - 署名用シークレット
 * @returns {string} base64url形式の署名
 */
function sign(sid, expires, secret) {
  return crypto.createHmac('sha256', secret).update(`${sid}.${expires}`).digest('base64url');
}

/**
 * SMSに載せる録音再生用の短いURLを生成する
 * @param {string} baseUrl - サービスのベースURL
 * @param {string} sid - 録音SID
 * @param {object} [options]
 * @param {string} [options.secret] - 署名用シークレット
 * @param {number} [options.now] - 現在時刻（UNIX秒）
 * @returns {string} 再生用URL
 */
function createLink(baseUrl, sid, { secret = process.env.LINK_SECRET, now = Math.floor(Date.now() / 1000) } = {}) {
  if (!secret) {
    throw new Error('LINK_SECRET is not set');
  }
  const ttlDays = Number(process.env.LINK_TTL_DAYS) || DEFAULT_LINK_TTL_DAYS;
  const expires = now + ttlDays * 86400;
  return `${baseUrl.replace(/\/$/, '')}/r/${sid}?e=${expires}&t=${sign(sid, expires, secret)}`;
}

/**
 * 再生用URLの署名と有効期限を検証する
 * @param {string} sid - 録音SID
 * @param {string} expires - 有効期限（UNIX秒）
 * @param {string} token - 署名
 * @param {object} [options]
 * @param {string} [options.secret] - 署名用シークレット
 * @param {number} [options.now] - 現在時刻（UNIX秒）
 * @returns {boolean} 有効ならtrue
 */
function verifyLink(sid, expires, token, { secret = process.env.LINK_SECRET, now = Math.floor(Date.now() / 1000) } = {}) {
  if (!secret || !RECORDING_SID_PATTERN.test(sid || '') || !/^\d+$/.test(expires || '') || typeof token !== 'string') {
    return false;
  }
  if (Number(expires) < now) {
    return false;
  }
  const expected = Buffer.from(sign(sid, expires, secret));
  const actual = Buffer.from(token);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

/**
 * S3上の録音ファイルの署名付きURLを生成する
 * Twilioの外部ストレージは {AccountSid}/{RecordingSid} のキーで保存する
 * @param {string} sid - 録音SID
 * @returns {Promise<string>} S3署名付きURL
 */
function presignRecording(sid) {
  const client = new S3Client({ region: process.env.AWS_REGION || 'ap-northeast-1' });
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET || 'hamephone-recordings',
    Key: `${process.env.TWILIO_ACCOUNT_SID}/${sid}`,
  });
  return getSignedUrl(client, command, { expiresIn: PRESIGN_EXPIRES });
}

module.exports = { createLink, verifyLink, presignRecording };
