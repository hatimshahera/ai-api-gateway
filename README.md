# Tool 03 — AI API Gateway

Day 3 of 60 AI Tools in 60 Days.

A small inference gateway that sits between an app and model providers. It gives
the app one endpoint, then handles provider selection, retry, fallback, cache,
request logging, latency, and rough cost estimates behind that endpoint.

It is a developer tool, not a chat app.

## Problem it solves

If every feature calls model providers directly, provider logic spreads across
the codebase. A gateway keeps that logic in one place.

That makes it easier to swap models, log requests, cache repeated calls, handle
provider errors, and see what the system is spending.

## Features

- **Inference API** at `POST /api/ai-gateway/generate`
- Accepts `prompt`, `model`, `temperature`, and `cache`
- Returns generated response plus request id, model used, provider used, latency,
  cache status, retry count, fallback status, and estimated cost
- **Provider abstraction** with optional OpenAI support and local fallback
- **Retry once** on primary provider failure
- **Fallback** to a secondary model/provider if the primary still fails
- **In-memory response cache** keyed by prompt + model config
- **In-memory request log** for recent requests
- **Provider pricing table** with source URLs and refresh endpoint
- **Dashboard UI** at `/60-days-ai/tools/ai-api-gateway`
- Stats cards for total requests, average latency, cache hit rate, failures,
  fallbacks, and estimated total cost

## Tech stack

- Next.js 15 App Router
- React 19
- TypeScript
- Route Handlers for API endpoints
- In-memory cache and request log
- Optional OpenAI API via `fetch`
- Local provider for fallback and no-key development

## API example

```bash
curl -X POST http://localhost:3000/api/ai-gateway/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Explain why an AI gateway is useful.",
    "model": "mock:fast",
    "temperature": 0.3,
    "cache": true
  }'
```

Example response:

```json
{
  "requestId": "gw_12345678",
  "response": "...",
  "modelRequested": "mock:fast",
  "modelUsed": "mock:fast",
  "providerUsed": "mock",
  "latencyMs": 4,
  "tokenUsage": {
    "input": 12,
    "output": 42,
    "total": 54
  },
  "cached": false,
  "fallbackUsed": false,
  "retryCount": 0,
  "estimatedCostUsd": 0,
  "success": true
}
```

Pricing endpoint:

```bash
curl http://localhost:3000/api/ai-gateway/pricing
curl http://localhost:3000/api/ai-gateway/pricing?refresh=true
```

## Run locally

```bash
cd tool-03-ai-api-gateway
npm install
npm run dev
```

Open:

```text
http://localhost:3000/60-days-ai/tools/ai-api-gateway
```

Other scripts:

```bash
npm run build
npm run typecheck
```

## Environment variables

Optional:

```env
OPENAI_API_KEY=your_openai_api_key_here
```

If `OPENAI_API_KEY` is not set, OpenAI routes fail cleanly and use the local
fallback provider. This keeps the gateway usable without paid credentials while
still exercising retry, fallback, cache, logging, and metadata paths.

## How the gateway works

1. The API validates the request.
2. It hashes `prompt + model + temperature` to check the cache.
3. On a cache hit, it returns immediately with `cached: true`.
4. On a cache miss, it calls the selected provider through a common interface.
5. If the primary provider fails, it retries once.
6. If the retry fails, it falls back to the local provider.
7. It logs timestamp, prompt length, model/provider, latency, token usage,
   status, cache, fallback, retry count, and estimated cost.
8. The dashboard reads recent logs, aggregate stats, and provider pricing.

## Pricing data

Runtime cost estimates use a small pricing registry in `app/lib/pricing.ts`.
Each record includes provider, model, input price, output price, source URL,
source status, and checked date.

`GET /api/ai-gateway/pricing` returns the current registry.
`GET /api/ai-gateway/pricing?refresh=true` attempts to fetch and parse official
provider pricing pages for providers with stable page text. If a source cannot
be parsed, the gateway keeps seeded fallback prices and returns the parse
failure in the response.

## Notes & limitations

- Logs and cache are in memory, so they reset when the dev server restarts.
- Cost is estimated from token counts and provider pricing records.
- Provider pricing pages can change format. Scraping is best-effort and should
  be verified before using the data for billing.
- No authentication, billing, rate limits, persistence, or multi-tenant controls
  yet.
- The provider interface is small on purpose so other providers can be added
  without rewriting the route or UI.

## Status

in-progress
