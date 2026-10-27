const { createLink, verifyLink, presignRecording } = require('./recording-link');

const SID = 'REa4fa8882c31dc00f6defa77522bce790';
const SECRET = 'test-secret';
const NOW = 1_800_000_000;

function parse(link) {
  const url = new URL(link);
  return { sid: url.pathname.split('/').pop(), e: url.searchParams.get('e'), t: url.searchParams.get('t'), url };
}

describe('createLink', () => {
  test('builds a short /r/ link that expires in 90 days by default', () => {
    const { url, sid, e } = parse(createLink('https://example.com/', SID, { secret: SECRET, now: NOW }));
    expect(url.origin + url.pathname).toBe(`https://example.com/r/${SID}`);
    expect(sid).toBe(SID);
    expect(Number(e)).toBe(NOW + 90 * 86400);
  });

  test('respects LINK_TTL_DAYS', () => {
    process.env.LINK_TTL_DAYS = '7';
    const { e } = parse(createLink('https://example.com', SID, { secret: SECRET, now: NOW }));
    delete process.env.LINK_TTL_DAYS;
    expect(Number(e)).toBe(NOW + 7 * 86400);
  });

  test('throws without a secret', () => {
    expect(() => createLink('https://example.com', SID, { secret: '' })).toThrow('LINK_SECRET');
  });
});

describe('verifyLink', () => {
  const { e, t } = parse(createLink('https://example.com', SID, { secret: SECRET, now: NOW }));

  test('accepts a valid link', () => {
    expect(verifyLink(SID, e, t, { secret: SECRET, now: NOW })).toBe(true);
  });

  test('rejects an expired link', () => {
    expect(verifyLink(SID, e, t, { secret: SECRET, now: Number(e) + 1 })).toBe(false);
  });

  test('rejects a tampered expiry', () => {
    expect(verifyLink(SID, String(Number(e) + 86400), t, { secret: SECRET, now: NOW })).toBe(false);
  });

  test('rejects a different recording', () => {
    const other = 'RE00000000000000000000000000000000';
    expect(verifyLink(other, e, t, { secret: SECRET, now: NOW })).toBe(false);
  });

  test('rejects a wrong secret', () => {
    expect(verifyLink(SID, e, t, { secret: 'other', now: NOW })).toBe(false);
  });

  test('rejects malformed input', () => {
    expect(verifyLink('../etc/passwd', e, t, { secret: SECRET, now: NOW })).toBe(false);
    expect(verifyLink(SID, 'abc', t, { secret: SECRET, now: NOW })).toBe(false);
    expect(verifyLink(SID, e, undefined, { secret: SECRET, now: NOW })).toBe(false);
    expect(verifyLink(SID, e, 'short', { secret: SECRET, now: NOW })).toBe(false);
  });
});

describe('presignRecording', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.AWS_ACCESS_KEY_ID = 'AKIATEST';
    process.env.AWS_SECRET_ACCESS_KEY = 'secret';
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    delete process.env.AWS_PROFILE;
    delete process.env.S3_BUCKET;
    delete process.env.AWS_REGION;
  });
  afterEach(() => {
    process.env = { ...env };
  });

  test('signs {AccountSid}/{RecordingSid} in hamephone-recordings for 5 minutes', async () => {
    const url = new URL(await presignRecording(SID));
    expect(url.host).toBe('hamephone-recordings.s3.ap-northeast-1.amazonaws.com');
    expect(url.pathname).toBe(`/AC123/${SID}`);
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(url.searchParams.get('X-Amz-Signature')).toBeTruthy();
  });
});
