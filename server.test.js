const request = require('supertest');
const express = require('express');
const { twiml } = require('twilio');

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
  test('POST /recording-status returns 200', async () => {
    const res = await request(app)
      .post('/recording-status')
      .type('form')
      .send({
        RecordingUrl: 'https://api.twilio.com/2010-04-01/Accounts/AC123/Recordings/RE123',
        RecordingSid: 'RE123'
      });
    expect(res.status).toBe(200);
  });
});

describe('Recording Link', () => {
  const { createLink } = require('./lib/recording-link');
  const SID = 'REa4fa8882c31dc00f6defa77522bce790';

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