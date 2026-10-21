import { createHmac } from 'crypto';
import { describe, expect, it } from 'vitest';
import { extractMessages, verifySignature } from '../src/whatsapp';

describe('verifySignature', () => {
  const body = Buffer.from('{"a":1}');
  const sig = 'sha256=' + createHmac('sha256', 'secret').update(body).digest('hex');
  it('accepts a valid signature', () => expect(verifySignature(body, sig, 'secret')).toBe(true));
  it('rejects wrong secret or missing header', () => {
    expect(verifySignature(body, sig, 'other')).toBe(false);
    expect(verifySignature(body, undefined, 'secret')).toBe(false);
  });
});

it('extractMessages reads text, image and button replies', () => {
  const body = {
    entry: [
      {
        changes: [
          {
            value: {
              contacts: [{ wa_id: '966500000000', profile: { name: 'موسى' } }],
              messages: [
                { id: 'm1', from: '966500000000', timestamp: '1', type: 'text', text: { body: 'قبضت 100' } },
                { id: 'm2', from: '966500000000', timestamp: '2', type: 'image', image: { id: 'media1', mime_type: 'image/jpeg', caption: 'فاتورة' } },
                { id: 'm3', from: '966500000000', timestamp: '3', type: 'interactive', interactive: { type: 'button_reply', button_reply: { id: 'approve:d1', title: 'اعتماد' } } },
              ],
            },
          },
        ],
      },
    ],
  };
  const ms = extractMessages(body);
  expect(ms.map((m) => m.kind)).toEqual(['text', 'image', 'button']);
  expect(ms[0]).toMatchObject({ name: 'موسى', text: 'قبضت 100' });
  expect(ms[1]).toMatchObject({ mediaId: 'media1', text: 'فاتورة' });
  expect(ms[2].buttonId).toBe('approve:d1');
  expect(extractMessages({ entry: [{ changes: [{ value: { statuses: [{}] } }] }] })).toEqual([]);
});
