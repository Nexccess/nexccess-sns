import test from 'node:test';
import assert from 'node:assert/strict';
import { selectPost, main, verifyPublication } from '../scripts/post-x-extra.js';

test('JST campaign boundaries and invalid slots fail closed', () => {
  assert.equal(selectPost(new Date('2026-11-17T14:59:59Z'), 1), null);
  assert.equal(selectPost(new Date('2026-11-17T15:00:00Z'), 1).date, '2026-11-18');
  assert.equal(selectPost(new Date('2026-12-31T14:59:59Z'), 3).date, '2026-12-31');
  assert.equal(selectPost(new Date('2026-12-31T15:00:00Z'), 3), null);
  for (const slot of [0, 4, NaN]) assert.throws(() => selectPost(new Date(), slot));
});

test('132 unique posts keep topic, one image and destination aligned', () => {
  const bodies = new Set();
  const images = ['tanpo-card', 'tanpo-equity-diagram', 'tanpo-consolidation-diagram'];
  for (let day = 0; day < 44; day++) {
    for (let slot = 1; slot <= 3; slot++) {
      const post = selectPost(new Date(Date.parse('2026-11-18T00:00:00Z') + day * 86400000), slot);
      assert.equal(post.image, images[slot - 1]);
      const url = new URL(post.url);
      assert.equal(url.origin + url.pathname, 'https://fudousan-tanpo.tokyo/');
      assert.equal(url.searchParams.get('utm_source'), 'x');
      assert.equal(url.searchParams.get('utm_content'), `${post.topic}_${post.date}`);
      assert.ok([...post.body].length * 2 + 25 <= 280);
      assert.ok(!bodies.has(post.body));
      bodies.add(post.body);
    }
  }
  assert.equal(bodies.size, 132);
});

test('untrusted local live execution cannot access publishing', async () => {
  const saved = { ...process.env };
  const oldLog = console.log;
  try {
    process.env.X_EVENT_CREATED_AT = '2026-11-23T02:00:00Z';
    process.env.X_SLOT = '2';
    delete process.env.DRY_RUN;
    delete process.env.GITHUB_ACTIONS;
    console.log = () => {};
    await main(new Date('2026-11-23T02:00:00Z'));
    assert.equal(process.exitCode, 1);
  } finally {
    process.env = saved;
    process.exitCode = 0;
    console.log = oldLog;
  }
});

test('public verification rejects wrong copy, destination, image count and alt text', () => {
  const post = selectPost(new Date('2026-11-23T02:00:00Z'), 2);
  const good = {
    data: { text: post.body + "\n\nhttps://t.co/example", entities: { urls: [{ expanded_url: post.url }] }, attachments: { media_keys: ['photo'] } },
    includes: { media: [{ type: 'photo', alt_text: post.alt, url: 'https://pbs.twimg.com/media/example.jpg' }] },
  };
  assert.equal(verifyPublication(post, good).length, 1);
  for (const mutate of [
    value => { value.data.text = 'wrong'; },
    value => { value.data.entities.urls[0].expanded_url = 'https://example.com/'; },
    value => { value.data.attachments.media_keys.push('another'); },
    value => { value.includes.media[0].alt_text = 'wrong'; },
    value => { value.includes.media[0].type = 'video'; },
  ]) {
    const bad = structuredClone(good);
    mutate(bad);
    assert.throws(() => verifyPublication(post, bad));
  }
});
