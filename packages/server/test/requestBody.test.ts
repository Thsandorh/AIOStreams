import express from 'express';
import { createServer } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import {
  apiJsonParser,
  isPayloadTooLargeError,
} from '../src/middlewares/requestBody.js';

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve()))
        )
    )
  );
});

describe('API request body parsing', () => {
  it('does not relabel unrelated HTTP 413 errors as parser failures', () => {
    expect(isPayloadTooLargeError({ status: 413 })).toBe(false);
    expect(isPayloadTooLargeError({ statusCode: 413 })).toBe(false);
    expect(isPayloadTooLargeError({ type: 'entity.too.large' })).toBe(true);
  });

  it('accepts configuration JSON above the Express 100 KB default', async () => {
    const app = express();
    app.use('/api/v1', apiJsonParser);
    app.use(express.json());
    app.put('/api/v1/user', (req, res) => {
      res.json({ bytes: req.body.config.length });
    });

    const url = await listen(app);
    const config = 'x'.repeat(150 * 1024);
    const response = await fetch(`${url}/api/v1/user`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ config }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ bytes: config.length });
  });

  it('still rejects oversized API JSON at the scoped 1 MB ceiling', async () => {
    const app = express();
    app.use('/api/v1', apiJsonParser);
    app.put('/api/v1/user', (_req, res) => res.sendStatus(204));
    app.use(
      (
        error: unknown,
        _req: express.Request,
        res: express.Response,
        _next: express.NextFunction
      ) => res.sendStatus(isPayloadTooLargeError(error) ? 413 : 500)
    );

    const url = await listen(app);
    const response = await fetch(`${url}/api/v1/user`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ config: 'x'.repeat(1024 * 1024) }),
    });

    expect(response.status).toBe(413);
  });
});

async function listen(app: express.Express): Promise<string> {
  const server = createServer(app);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test port');
  return `http://127.0.0.1:${address.port}`;
}
