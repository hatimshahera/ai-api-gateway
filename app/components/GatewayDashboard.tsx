"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type ModelId =
  | "openai:gpt-4o-mini"
  | "openai:gpt-4.1-mini"
  | "mock:fast"
  | "mock:quality";

interface ModelOption {
  id: ModelId;
  label: string;
  provider: string;
  description: string;
}

interface GenerateResponse {
  requestId: string;
  response: string;
  modelRequested: ModelId;
  modelUsed: ModelId;
  providerUsed: "openai" | "mock";
  latencyMs: number;
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
  cached: boolean;
  fallbackUsed: boolean;
  retryCount: number;
  estimatedCostUsd: number;
  success: boolean;
  error?: string;
}

interface RequestLogEntry {
  requestId: string;
  timestamp: string;
  promptLength: number;
  modelRequested: ModelId;
  modelUsed: ModelId;
  providerUsed: "openai" | "mock";
  latencyMs: number;
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
  success: boolean;
  cached: boolean;
  fallbackUsed: boolean;
  retryCount: number;
  estimatedCostUsd: number;
  error?: string;
}

interface GatewayStats {
  totalRequests: number;
  averageLatencyMs: number;
  cacheHitRate: number;
  failedRequests: number;
  fallbacksUsed: number;
  estimatedTotalCostUsd: number;
}

interface RequestsResponse {
  stats: GatewayStats;
  requests: RequestLogEntry[];
  models: ModelOption[];
}

interface PricingRecord {
  provider: string;
  model: string;
  inputUsdPer1M: number;
  outputUsdPer1M: number;
  sourceUrl: string;
  sourceStatus: "scraped" | "seeded" | "local";
  checkedAt: string;
  notes?: string;
}

interface PricingResponse {
  records: PricingRecord[];
  failures: string[];
  refreshedAt: string | null;
}

const DEFAULT_MODELS: ModelOption[] = [
  {
    id: "mock:fast",
    label: "Local fast",
    provider: "Local",
    description: "Deterministic local response.",
  },
  {
    id: "mock:quality",
    label: "Local fallback",
    provider: "Local",
    description: "Longer deterministic fallback response.",
  },
];

const EMPTY_STATS: GatewayStats = {
  totalRequests: 0,
  averageLatencyMs: 0,
  cacheHitRate: 0,
  failedRequests: 0,
  fallbacksUsed: 0,
  estimatedTotalCostUsd: 0,
};

const PROMPT_EXAMPLES = [
  {
    label: "Normal request",
    model: "mock:fast" as ModelId,
    prompt:
      "Explain why an API gateway helps when an app uses multiple AI providers.",
  },
  {
    label: "Cache demo",
    model: "mock:fast" as ModelId,
    prompt:
      "Summarize the benefit of caching repeated AI requests in three bullets.",
  },
  {
    label: "Fallback demo",
    model: "openai:gpt-4o-mini" as ModelId,
    prompt:
      "Route this through OpenAI if configured; otherwise show the fallback path.",
  },
  {
    label: "Forced failure",
    model: "mock:fast" as ModelId,
    prompt:
      "force failure so the gateway demonstrates retry and fallback behavior.",
  },
];

function formatCurrency(value: number) {
  return `$${value.toFixed(value > 0.01 ? 4 : 6)}`;
}

function formatTokenPrice(value: number) {
  return value === 0 ? "$0" : `$${value.toFixed(value >= 1 ? 2 : 4)}`;
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function Help({ text }: { text: string }) {
  return (
    <span
      className="help"
      data-tooltip={text}
      aria-label={text}
      role="note"
      tabIndex={0}
    >
      ?
    </span>
  );
}

export default function GatewayDashboard() {
  const [prompt, setPrompt] = useState(
    "Summarize why an app might route model calls through one gateway endpoint.",
  );
  const [model, setModel] = useState<ModelId>("mock:fast");
  const [temperature, setTemperature] = useState(0.3);
  const [cache, setCache] = useState(true);
  const [models, setModels] = useState<ModelOption[]>(DEFAULT_MODELS);
  const [stats, setStats] = useState<GatewayStats>(EMPTY_STATS);
  const [requests, setRequests] = useState<RequestLogEntry[]>([]);
  const [pricing, setPricing] = useState<PricingRecord[]>([]);
  const [pricingFailures, setPricingFailures] = useState<string[]>([]);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshingPricing, setIsRefreshingPricing] = useState(false);

  const selectedModel = useMemo(
    () => models.find((option) => option.id === model),
    [model, models],
  );
  const totalTokens = useMemo(
    () => requests.reduce((sum, entry) => sum + entry.tokenUsage.total, 0),
    [requests],
  );

  async function loadRequests() {
    const response = await fetch("/api/ai-gateway/requests");
    if (!response.ok) return;
    const data = (await response.json()) as RequestsResponse;
    setStats(data.stats);
    setRequests(data.requests);
    setModels(data.models);
  }

  async function loadPricing(refresh = false) {
    setIsRefreshingPricing(refresh);
    try {
      const response = await fetch(
        `/api/ai-gateway/pricing${refresh ? "?refresh=true" : ""}`,
      );
      if (!response.ok) return;
      const data = (await response.json()) as PricingResponse;
      setPricing(data.records);
      setPricingFailures(data.failures);
    } finally {
      setIsRefreshingPricing(false);
    }
  }

  useEffect(() => {
    loadRequests().catch(() => {});
    loadPricing().catch(() => {});
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai-gateway/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model, temperature, cache }),
      });
      const data = (await response.json()) as GenerateResponse | { error: string };

      if (!response.ok || ("error" in data && !("requestId" in data))) {
        setError(
          "error" in data && typeof data.error === "string"
            ? data.error
            : "Gateway request failed.",
        );
        return;
      }

      setResult(data as GenerateResponse);
      await loadRequests();
    } catch {
      setError("The gateway request failed. Check that the dev server is running.");
    } finally {
      setIsLoading(false);
    }
  }

  const metaItems = result
    ? [
        {
          label: "Request ID",
          value: result.requestId,
          help: "Unique id for this gateway request. Useful for logs and debugging.",
        },
        {
          label: "Model used",
          value: result.modelUsed,
          help: "The model that actually answered. This can differ from the requested model if fallback was used.",
        },
        {
          label: "Provider",
          value: result.providerUsed,
          help: "The provider that served the final response.",
        },
        {
          label: "Latency",
          value: `${result.latencyMs} ms`,
          help: "Total gateway time, including provider call, retry, fallback, or cache lookup.",
        },
        {
          label: "Tokens",
          value: `${result.tokenUsage.total}`,
          help: `Input ${result.tokenUsage.input}, output ${result.tokenUsage.output}. OpenAI returns usage; local responses are estimated.`,
        },
        {
          label: "Cached",
          value: result.cached ? "true" : "false",
          help: "True means the response came from the gateway cache instead of calling a provider again.",
        },
        {
          label: "Fallback",
          value: result.fallbackUsed ? "used" : "not used",
          help: "Used means the requested provider failed and the gateway switched to another provider.",
        },
        {
          label: "Cost",
          value: formatCurrency(result.estimatedCostUsd),
          help: "Estimated from token usage and the pricing registry. Cache hits are counted as zero new provider cost.",
        },
      ]
    : [];

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Tool 03 · AI Infrastructure</p>
          <h1>AI API Gateway</h1>
        </div>
        <div className="endpoint-card">
          <span>Call this API from another app</span>
          <code>POST /api/ai-gateway/generate</code>
          <p>Send a prompt here instead of calling OpenAI directly.</p>
        </div>
      </header>

      <section className="endpoint-note">
        <p>
          This endpoint accepts a prompt and model config, calls the selected
          provider, then returns the response with latency, cache, fallback, and
          estimated cost metadata.
        </p>
      </section>

      <div className="workspace">
        <form className="panel request-panel" onSubmit={handleSubmit}>
          <div className="panel-heading">
            <div>
              <h2>Try the gateway</h2>
              <p>Send one request and inspect what the gateway did.</p>
            </div>
            <span className="status-dot">Gateway online</span>
          </div>

          <label htmlFor="prompt">
            Prompt
            <Help text="This is the user input the application sends to the gateway." />
          </label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={10}
          />

          <div className="example-row" aria-label="Example prompts">
            {PROMPT_EXAMPLES.map((example) => (
              <button
                key={example.label}
                type="button"
                className="chip-button"
                onClick={() => {
                  setPrompt(example.prompt);
                  setModel(example.model);
                }}
              >
                {example.label}
              </button>
            ))}
          </div>

          <div className="control-grid">
            <label>
              Provider / model
              <Help text="The gateway routes to this model first. If it fails, fallback logic can switch to another provider." />
              <select
                value={model}
                onChange={(event) => setModel(event.target.value as ModelId)}
              >
                {models.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.provider} · {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Temperature
              <Help text="Controls how varied the model's wording can be. Use lower values for predictable answers and higher values for more creative wording." />
              <input
                type="number"
                value={temperature}
                min={0}
                max={1.5}
                step={0.1}
                onChange={(event) => setTemperature(Number(event.target.value))}
              />
            </label>
          </div>

          {selectedModel ? (
            <p className="model-note">{selectedModel.description}</p>
          ) : null}

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={cache}
              onChange={(event) => setCache(event.target.checked)}
            />
            Use cache for identical prompt + model config
            <Help text="When enabled, identical prompt/model/temperature requests return from cache and avoid another provider call." />
          </label>

          {error ? <p className="error">{error}</p> : null}

          <button type="submit" disabled={isLoading || !prompt.trim()}>
            {isLoading ? "Routing request..." : "Send request"}
          </button>
        </form>

        <section className="panel response-panel">
          <div className="panel-heading">
            <div>
              <h2>Response</h2>
              <p>Model output on top, routing details below.</p>
            </div>
          </div>

          <pre className="response-output">
            {result?.response ||
              "The response will appear here after a request is sent."}
          </pre>

          <div className="metadata-grid">
            {metaItems.length ? (
              metaItems.map((item) => (
                <div key={item.label}>
                  <span>
                    {item.label}
                    <Help text={item.help} />
                  </span>
                  <strong>{item.value}</strong>
                </div>
              ))
            ) : (
              <div>
                <span>Status</span>
                <strong>Waiting for request</strong>
              </div>
            )}
          </div>
        </section>
      </div>

      <details className="panel secondary-panel" open>
        <summary>
          <span>Recent requests</span>
          <small>
            {stats.totalRequests} total · {stats.averageLatencyMs} ms avg ·{" "}
            {totalTokens} tokens
          </small>
        </summary>
        <div className="panel-heading">
          <div>
            <h2>Request log</h2>
            <p>Each row is one gateway call.</p>
          </div>
          <button type="button" className="secondary-button" onClick={loadRequests}>
            Refresh
          </button>
        </div>

        <div className="log-metrics" aria-label="Gateway stats">
          <span>Total {stats.totalRequests}</span>
          <span>Avg {stats.averageLatencyMs} ms</span>
          <span>Tokens {totalTokens}</span>
          <span>Cache {formatPercent(stats.cacheHitRate)}</span>
          <span>Failures {stats.failedRequests}</span>
          <span>Fallbacks {stats.fallbacksUsed}</span>
          <span>Cost {formatCurrency(stats.estimatedTotalCostUsd)}</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Request</th>
                <th>Model</th>
                <th>Latency</th>
                <th>Tokens</th>
                <th>Cache</th>
                <th>Fallback</th>
                <th>Cost</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.length ? (
                requests.map((entry) => (
                  <tr key={entry.requestId}>
                    <td>{formatTime(entry.timestamp)}</td>
                    <td className="mono">{entry.requestId}</td>
                    <td>{entry.modelUsed}</td>
                    <td>{entry.latencyMs} ms</td>
                    <td>{entry.tokenUsage.total}</td>
                    <td>{entry.cached ? "hit" : "miss"}</td>
                    <td>{entry.fallbackUsed ? "yes" : "no"}</td>
                    <td>{formatCurrency(entry.estimatedCostUsd)}</td>
                    <td>
                      <span className={entry.success ? "badge ok" : "badge fail"}>
                        {entry.success ? "success" : "failed"}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="empty-cell">
                    No requests yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </details>

      <details className="panel secondary-panel pricing-panel">
        <summary>
          <span>Pricing reference</span>
          <small>Used only for estimated cost</small>
        </summary>
        <div className="panel-heading">
          <div>
            <h2>Pricing reference</h2>
            <p>Used for estimated cost. Scraping provider pages is best-effort.</p>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={() => loadPricing(true)}
            disabled={isRefreshingPricing}
          >
            {isRefreshingPricing ? "Refreshing..." : "Refresh pricing"}
          </button>
        </div>

        {pricingFailures.length ? (
          <p className="pricing-warning">{pricingFailures.join(" ")}</p>
        ) : null}

        <div className="table-wrap">
          <table className="pricing-table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Model</th>
                <th>Input / 1M</th>
                <th>Output / 1M</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {pricing.map((record) => (
                <tr key={`${record.provider}-${record.model}`}>
                  <td>{record.provider}</td>
                  <td>{record.model}</td>
                  <td>{formatTokenPrice(record.inputUsdPer1M)}</td>
                  <td>{formatTokenPrice(record.outputUsdPer1M)}</td>
                  <td>
                    {record.sourceStatus === "local" ? (
                      "local"
                    ) : (
                      <a href={record.sourceUrl} target="_blank" rel="noreferrer">
                        {record.sourceStatus}
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </main>
  );
}
