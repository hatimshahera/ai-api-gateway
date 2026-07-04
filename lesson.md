# Lesson — AI API Gateway

## What I Built

An AI inference gateway with one generation endpoint:
`/api/ai-gateway/generate`.

The app sends a prompt to the gateway. The gateway chooses a provider, checks
cache, retries once on failure, falls back if needed, estimates cost, logs the
request, and returns the response with metadata.

The dashboard is there to test the API and inspect recent requests. It is not
meant to be a chat product.

## What I Learned

- The useful part of this tool is the gateway layer, not the text generation
  itself.
- Request metadata matters: request id, latency, model used, cache status,
  token usage, retry count, fallback status, and estimated cost.
- A local provider is useful for development, testing, and fallback. It should
  not be positioned as the main feature.
- Provider abstraction keeps model-specific code out of the route and UI.
- Cache keys need prompt and model config. Otherwise the gateway can return the
  wrong cached response.
- Provider pricing is its own moving dependency. The gateway should show source
  URLs and parsing status instead of hiding where cost numbers came from.

## What Was Harder Than Expected

- The first version risked sounding too much like an AI-generated demo. I had to
  strip the copy back and make the project read like a real developer tool.
- The UI needed to expose the API behavior without turning into a normal chat
  interface.
- In-memory cache/logging is right for a one-day build, but the code still needs
  to make a future Redis/database version obvious.
- Fallback must be visible. If the primary provider fails, the caller should know
  which model actually answered.
- Scraping pricing pages is brittle. The better pattern is a pricing registry
  with official source URLs, seeded fallbacks, and refresh/parsing status.

## What I Would Improve

- Add persistent storage for logs and cache.
- Add API keys and per-user rate limits.
- Add streaming responses.
- Add provider health checks and weighted routing.
- Add Anthropic and local model providers.
- Add p50/p95 latency charts instead of only average latency.

## Skills Used

API design, provider abstraction, retry logic, fallback handling, in-memory
caching, request logging, latency measurement, token tracking, provider pricing
tracking, cost estimation, dashboard UI, Next.js Route Handlers, TypeScript.

## Possible Future Version

A v2 could become the shared backend layer for future challenge tools: one
gateway endpoint that other tools call, backed by persistent logs, provider
routing rules, model budgets, rate limits, streaming, and real observability.
