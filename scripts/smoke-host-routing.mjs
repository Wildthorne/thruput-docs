import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { createServer } from 'node:net';
import { resolve } from 'node:path';

const binary = process.argv[2];
if (!binary) throw new Error('Usage: node scripts/smoke-host-routing.mjs /path/to/caddy');
const listener = createServer();
listener.listen(0, '127.0.0.1');
await once(listener, 'listening');
const port = listener.address().port;
await new Promise(done => listener.close(done));
const env = { ...process.env, PORT: String(port), SITE_ROOT: resolve('dist'),
  BASIC_AUTH_USER: 'routing-test',
  BASIC_AUTH_HASH: execFileSync(binary, ['hash-password', '--plaintext', 'local-test-password'], { encoding: 'utf8' }).trim() };
execFileSync(binary, ['validate', '--config', 'Caddyfile', '--adapter', 'caddyfile'], { env, stdio: 'pipe' });
const server = spawn(binary, ['run', '--config', 'Caddyfile', '--adapter', 'caddyfile'], { env, stdio: 'ignore' });
const stopped = once(server, 'exit');
const origin = `http://127.0.0.1:${port}`;
const auth = `Basic ${Buffer.from('routing-test:local-test-password').toString('base64')}`;
const request = (host, path, authenticated = true) => new Promise((done, fail) => {
  const req = httpRequest(origin + path, { headers: { Host: host,
    ...(authenticated ? { Authorization: auth } : {}) } }, response => {
    let body = '';
    response.setEncoding('utf8');
    response.on('data', chunk => { body += chunk; });
    response.on('end', () => done({ status: response.statusCode,
      headers: { get: name => response.headers[name] }, text: async () => body }));
  });
  req.on('error', fail);
  req.end();
});
try {
  for (let i = 0; i < 100; i++) {
    try { if ((await request('thruput.network', '/health', false)).status === 200) break; } catch {}
    await new Promise(done => setTimeout(done, 50));
  }
  for (const host of ['thruput.network', 'www.thruput.network', 'docs.thruput.network', 'docs.groundhog.dev']) {
    assert.equal((await request(host, '/health', false)).status, 200);
    assert.equal((await request(host, '/', false)).status, 401, `${host} must retain the gate`);
  }
  for (const [host, path, destination] of [
    ['www.thruput.network', '/docs/cli/install/?via=www', '/docs/cli/install/?via=www'],
    ['docs.thruput.network', '/?via=old', '/docs/?via=old'],
    ['docs.thruput.network', '/cli/install/?via=old', '/docs/cli/install/?via=old'],
    ['docs.groundhog.dev', '/programming-model/advanced/?via=old', '/docs/programming-model/advanced/?via=old'],
    ['docs.thruput.network', '/docs/get-started/', '/docs/get-started/'],
    ['docs.thruput.network', '/markdown/pages/cli/install.md', '/markdown/pages/cli/install.md'],
    ['docs.thruput.network', '/agents/historical.json', '/agents/historical.json'],
  ]) {
    const response = await request(host, path);
    assert.equal(response.status, 308, `${host}${path}`);
    assert.equal(response.headers.get('location'), 'https://thruput.network' + destination);
  }
  const home = await request('thruput.network', '/');
  assert.equal(home.status, 200);
  assert.match(await home.text(), /href="https:\/\/thruput.network\/"/);
  const docs = await request('thruput.network', '/docs/cli/install/');
  assert.equal(docs.status, 200);
  assert.match(await docs.text(), /https:\/\/thruput.network\/docs\/cli\/install\//);
  assert.equal((await request('thruput.network', '/missing-page')).status, 404);
  console.log('Caddy authentication, canonical host redirects, query preservation, static routing, and 404 checks passed.');
} finally {
  server.kill('SIGTERM');
  await stopped;
}
