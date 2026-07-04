# Demo Notes — AI API Gateway

## What The Demo Should Show

The app calls one gateway endpoint. The gateway handles provider routing, cache,
retry, fallback, logs, latency, and cost estimates.

## Demo Flow

1. Open `/60-days-ai/tools/ai-api-gateway`.
2. Show the endpoint label: `POST /api/ai-gateway/generate`.
3. Keep model = **Local fast** and click **Send request**.
4. Point out the metadata: request id, model used, latency, cached flag,
   token usage, fallback flag, and estimated cost.
5. Click generate again with the same prompt and cache enabled. The request
   should return with `cached: true` and lower latency.
6. Select an OpenAI model without setting `OPENAI_API_KEY`. Generate again to
   show retry + fallback to the local provider.
7. Show the stats cards updating: total requests, cache hit rate, fallbacks.
8. Show the provider pricing table and source status.
9. Show the recent requests table.

## Edge Cases Worth Showing

- Same prompt + config returns from cache.
- OpenAI without an API key falls back cleanly.
- Typing `force failure` into the prompt forces the local provider to fail,
  exercising retry/fallback behaviour.
- Pricing refresh can fail if a provider page changes format; the UI shows that
  instead of pretending the data is live.
- In-memory stats reset when the dev server restarts.

## Screenshot / Video Ideas

- Dashboard with prompt, response, stats, and recent requests visible.
- Cache hit demo: first request vs. second request metadata.
- Fallback demo: OpenAI selected, local fallback shown in the metadata panel.
- Recent requests table showing success, cache, fallback, and cost columns.
