import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
export function handler(request, response) {
  if (request.url === '/private' && request.headers['x-fixture-auth'] !== 'britepulse-public-fixture') {
    response.writeHead(401, { 'content-type': 'text/html' });
    response.end('<!doctype html><html lang="en"><title>Unauthorized</title><body><h1>Authentication required</h1></body></html>');
    return;
  }
  response.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' });
  response.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width"><title>BritePulse synthetic fixture</title></head><body><main><h1>BritePulse public synthetic data</h1><p>Stable content for runner compatibility checks.</p></main></body></html>');
}
export function createFixtureServer() { return createServer(handler); }
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createFixtureServer();
  server.listen(Number(process.env.PORT ?? 4178), '127.0.0.1', () => console.log('Synthetic fixture listening', server.address()));
}
