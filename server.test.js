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
    expect(res.text).toContain('営業の方は1を、返品依頼の方は2を、注文やサービスについての方は3を押してください。');
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
    expect(res.text).toContain('返品についての詳細はメッセージでご案内いたします');
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
    expect(res.text).toContain('返品についてメッセージでご案内いたします');
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