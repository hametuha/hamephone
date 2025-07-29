const request = require('supertest');
const express = require('express');
const { twiml } = require('twilio');

let app;

beforeAll(() => {
  app = require('./server');
});

describe('IVR Routing', () => {
  test('POST /ivr returns TwiML with gather', async () => {
    const res = await request(app)
      .post('/ivr')
      .type('form')
      .send();
    expect(res.status).toBe(200);
    expect(res.type).toBe('text/xml');
    expect(res.text).toContain('<Gather');
    expect(res.text).toContain('営業の方は1を、お客様は2を押してください。');
  });

  test('POST /handle-gather with 2 (customer) dials out with recording', async () => {
    process.env.FORWARD_TO = '+819012345678';
    const res = await request(app)
      .post('/handle-gather')
      .type('form')
      .send({ 
        Digits: '2',
        From: '+819012345678',
        CallSid: 'test-call-sid'
      });
    expect(res.status).toBe(200);
    expect(res.type).toBe('text/xml');
    expect(res.text).toContain('<Dial');
    expect(res.text).toContain(process.env.FORWARD_TO);
    expect(res.text).toContain('record="record-from-answer"');
  });

  test('POST /handle-gather with 1 (sales) says block message', async () => {
    const res = await request(app)
      .post('/handle-gather')
      .type('form')
      .send({ Digits: '1' });
    expect(res.status).toBe(200);
    expect(res.type).toBe('text/xml');
    expect(res.text).toContain('営業のお電話はお断りしています。');
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