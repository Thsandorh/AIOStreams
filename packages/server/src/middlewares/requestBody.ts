import express, { type RequestHandler } from 'express';

// User configuration also travels through catalog and formatter-preview API
// requests, not only the user save route. Apply one bounded API allowance so a
// valid configuration behaves consistently across those workflows.
export const API_JSON_LIMIT = '1mb';

export const apiJsonParser: RequestHandler = express.json({
  limit: API_JSON_LIMIT,
});

export function isPayloadTooLargeError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const candidate = error as {
    type?: unknown;
  };
  return candidate.type === 'entity.too.large';
}
