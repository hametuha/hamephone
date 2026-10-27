const request = require('supertest');

// 実際のTwilio APIを叩かないよう、REST クライアントだけをモックする（twimlは本物を使う）
const mockClient = {
  calls: jest.fn(() => ({ fetch: jest.fn().mockResolvedValue({ from: '+819011112222' }) })),
  recordings: jest.fn(() => ({ fetch: jest.fn().mockResolvedValue({ mediaUrl: 'https://example.com/media', duration: '12' }) })),
  messages: { create: jest.fn().mockResolvedValue({ sid: 'SM123' }) },
};
jest.mock('twilio', () => {
  const actual = jest.requireActual('twilio');
  return Object.assign(jest.fn(() => mockClient), actual);
});

let app;

beforeAll(() => {
  app = require('./server');
});

describe('IVR Routing', () => {
  test('POST /ivr returns TwiML with gather for 3 options', async () => {
    const res = await request(app)
      .post('/ivr')
      .type('form')
      .send();
    expect(res.status).toBe(200);
    expect(res.type).toBe('text/xml');
    expect(res.text).toContain('<Gather');
    expect(res.text).toContain('破滅派です');
  });

  test('POST /handle-gather with 1 (sales) shows form guidance', async () => {
    const res = await request(app)
      .post('/handle-gather')
      .type('form')
      .send({ Digits: '1' });
    expect(res.status).toBe(200);
    expect(res.type).toBe('text/xml');
    expect(res.text).toContain('お問い合わせフォームをご利用ください');
    expect(res.text).toContain('action="/confirm-sales"');
  });

  test('POST /handle-gather with 2 (return) shows message guidance', async () => {
    const res = await request(app)
      .post('/handle-gather')
      .type('form')
      .send({ Digits: '2' });
    expect(res.status).toBe(200);
    expect(res.type).toBe('text/xml');
    expect(res.text).toContain('返品条件付き注文品は返品了解者');
    expect(res.text).toContain('action="/confirm-return"');
  });

  test('POST /handle-gather with 3 (order) dials out directly', async () => {
    process.env.FORWARD_TO = '+819012345678';
    const res = await request(app)
      .post('/handle-gather')
      .type('form')
      .send({ 
        Digits: '3',
        From: '+819012345678',
        CallSid: 'test-call-sid'
      });
    expect(res.status).toBe(200);
    expect(res.type).toBe('text/xml');
    expect(res.text).toContain('<Dial');
    expect(res.text).toContain(process.env.FORWARD_TO);
    expect(res.text).toContain('record="record-from-answer"');
  });

  test('POST /confirm-sales with 1 dials out', async () => {
    process.env.FORWARD_TO = '+819012345678';
    const res = await request(app)
      .post('/confirm-sales')
      .type('form')
      .send({ Digits: '1' });
    expect(res.status).toBe(200);
    expect(res.type).toBe('text/xml');
    expect(res.text).toContain('<Dial');
    expect(res.text).toContain(process.env.FORWARD_TO);
  });

  test('POST /confirm-sales with other digit hangs up', async () => {
    const res = await request(app)
      .post('/confirm-sales')
      .type('form')
      .send({ Digits: '2' });
    expect(res.status).toBe(200);
    expect(res.type).toBe('text/xml');
    expect(res.text).toContain('お問い合わせフォームをご利用ください');
    expect(res.text).toContain('<Hangup');
  });

  test('POST /confirm-return with 1 dials out', async () => {
    process.env.FORWARD_TO = '+819012345678';
    const res = await request(app)
      .post('/confirm-return')
      .type('form')
      .send({ Digits: '1' });
    expect(res.status).toBe(200);
    expect(res.type).toBe('text/xml');
    expect(res.text).toContain('<Dial');
    expect(res.text).toContain(process.env.FORWARD_TO);
  });

  test('POST /confirm-return with other digit hangs up', async () => {
    const res = await request(app)
      .post('/confirm-return')
      .type('form')
      .send({ Digits: '2' });
    expect(res.status).toBe(200);
    expect(res.type).toBe('text/xml');
    expect(res.text).toContain('返品についてメッセージでご案内いたしました');
    expect(res.text).toContain('<Hangup');
  });

  test('POST /handle-gather with invalid digit shows error', async () => {
    const res = await request(app)
      .post('/handle-gather')
      .type('form')
      .send({ Digits: '4' });
    expect(res.status).toBe(200);
    expect(res.type).toBe('text/xml');
    expect(res.text).toContain('正しい番号を押してください');
    expect(res.text).toContain('<Hangup');
  });
});

describe('Recording Status', () => {
  const SID = 'RE0123456789abcdef0123456789abcdef';
  const env = { ...process.env };

  beforeEach(() => {
    mockClient.messages.create.mockClear();
    process.env.TWILIO_SMS_NUMBER = '+11234567890';
    process.env.FORWARD_TO = '+819012345678';
    process.env.LINK_SECRET = 'test-secret';
    delete process.env.PUBLIC_URL;
  });
  afterEach(() => {
    process.env = { ...env };
  });

  test('POST /recording-status sends SMS with a signed /r/ link', async () => {
    const res = await request(app)
      .post('/recording-status')
      .set('Host', 'hamephone.example')
      .type('form')
      .send({ RecordingUrl: 'https://api.twilio.com/recording', RecordingSid: SID, CallSid: 'CA123' });
    expect(res.status).toBe(200);
    expect(mockClient.messages.create).toHaveBeenCalledTimes(1);
    const { body, to } = mockClient.messages.create.mock.calls[0][0];
    expect(to).toBe('+819012345678');
    expect(body).toContain('+819011112222');
    expect(body).toMatch(new RegExp(`https://hamephone\\.example/r/${SID}\\?e=\\d+&t=[\\w-]+`));
  });

  test('POST /recording-status falls back to media URL without LINK_SECRET', async () => {
    delete process.env.LINK_SECRET;
    const res = await request(app)
      .post('/recording-status')
      .type('form')
      .send({ RecordingUrl: 'https://api.twilio.com/recording', RecordingSid: SID, CallSid: 'CA123' });
    expect(res.status).toBe(200);
    expect(mockClient.messages.create.mock.calls[0][0].body).toContain('https://example.com/media');
  });

  test('POST /recording-status skips SMS without TWILIO_SMS_NUMBER', async () => {
    delete process.env.TWILIO_SMS_NUMBER;
    const res = await request(app)
      .post('/recording-status')
      .type('form')
      .send({ RecordingUrl: 'https://api.twilio.com/recording', RecordingSid: SID, CallSid: 'CA123' });
    expect(res.status).toBe(200);
    expect(mockClient.messages.create).not.toHaveBeenCalled();
  });
});

describe('Recording Link', () => {
  const { createLink } = require('./lib/recording-link');
  const SID = 'RE0123456789abcdef0123456789abcdef';

  beforeEach(() => {
    process.env.LINK_SECRET = 'test-secret';
    process.env.AWS_ACCESS_KEY_ID = 'AKIATEST';
    process.env.AWS_SECRET_ACCESS_KEY = 'secret';
    delete process.env.AWS_PROFILE;
  });

  test('GET /r/:sid with a valid link redirects to S3', async () => {
    const link = new URL(createLink('https://example.com', SID));
    const res = await request(app).get(link.pathname + link.search);
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain(`hamephone-recordings.s3.ap-northeast-1.amazonaws.com/`);
    expect(res.headers.location).toContain(SID);
    expect(res.headers.location).toContain('X-Amz-Signature=');
  });

  test('GET /r/:sid with a bad token is forbidden', async () => {
    const res = await request(app).get(`/r/${SID}?e=9999999999&t=invalid`);
    expect(res.status).toBe(403);
  });
});