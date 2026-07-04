import { createHash, randomUUID } from "node:crypto";
import { GenerateRequest, GenerateResponse, GatewayStats, RequestLogEntry } from "./types";

type CacheEntry = GenerateResponse & { response: string };

const CACHE_LIMIT = 100;
const LOG_LIMIT = 50;

type GatewayMemoryStore = {
  cache: Map<string, CacheEntry>;
  logs: RequestLogEntry[];
};

const globalStore = globalThis as typeof globalThis & {
  __aiGatewayStore?: GatewayMemoryStore;
};

function getStore() {
  if (!globalStore.__aiGatewayStore) {
    globalStore.__aiGatewayStore = {
      cache: new Map<string, CacheEntry>(),
      logs: [],
    };
  }

  return globalStore.__aiGatewayStore;
}

export function createRequestId() {
  return `gw_${randomUUID().slice(0, 8)}`;
}

export function createCacheKey(request: Required<Pick<GenerateRequest, "prompt" | "model" | "temperature">>) {
  return createHash("sha256")
    .update(JSON.stringify(request))
    .digest("hex")
    .slice(0, 24);
}

export function readCache(key: string) {
  return getStore().cache.get(key);
}

export function writeCache(key: string, value: CacheEntry) {
  const { cache } = getStore();
  cache.set(key, value);
  if (cache.size > CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
}

export function logRequest(entry: RequestLogEntry) {
  const { logs } = getStore();
  logs.unshift(entry);
  if (logs.length > LOG_LIMIT) logs.length = LOG_LIMIT;
}

export function getRecentRequests() {
  return getStore().logs;
}

export function getStats(): GatewayStats {
  const { logs } = getStore();
  const totalRequests = logs.length;
  const successful = logs.filter((entry) => entry.success);
  const totalLatency = logs.reduce((sum, entry) => sum + entry.latencyMs, 0);
  const cacheHits = logs.filter((entry) => entry.cached).length;

  return {
    totalRequests,
    averageLatencyMs: totalRequests ? Math.round(totalLatency / totalRequests) : 0,
    cacheHitRate: totalRequests ? cacheHits / totalRequests : 0,
    failedRequests: logs.filter((entry) => !entry.success).length,
    fallbacksUsed: logs.filter((entry) => entry.fallbackUsed).length,
    estimatedTotalCostUsd: successful.reduce(
      (sum, entry) => sum + entry.estimatedCostUsd,
      0,
    ),
  };
}
