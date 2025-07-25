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

  test('POST /handle-gather with 2 (customer) dials out', async () => {
    process.env.FORWARD_TO = '+819012345678';
    const res = await request(app)
      .post('/handle-gather')
      .type('form')
      .send({ Digits: '2' });
    expect(res.status).toBe(200);
    expect(res.type).toBe('text/xml');
    expect(res.text).toContain('<Dial');
    expect(res.text).toContain(process.env.FORWARD_TO);
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