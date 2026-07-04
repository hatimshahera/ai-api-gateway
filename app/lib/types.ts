export type ProviderId = "openai" | "mock";

export type ModelId =
  | "openai:gpt-4o-mini"
  | "openai:gpt-4.1-mini"
  | "mock:fast"
  | "mock:quality";

export interface GenerateRequest {
  prompt: string;
  model: ModelId;
  temperature?: number;
  cache?: boolean;
}

export interface ProviderRequest {
  prompt: string;
  model: ModelId;
  temperature: number;
  requestId: string;
}

export interface ProviderResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export interface AiProvider {
  id: ProviderId;
  label: string;
  models: ModelId[];
  generate(request: ProviderRequest): Promise<ProviderResult>;
}

export interface GenerateResponse {
  requestId: string;
  response: string;
  modelRequested: ModelId;
  modelUsed: ModelId;
  providerUsed: ProviderId;
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

export interface RequestLogEntry {
  requestId: string;
  timestamp: string;
  promptLength: number;
  modelRequested: ModelId;
  modelUsed: ModelId;
  providerUsed: ProviderId;
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

export interface GatewayStats {
  totalRequests: number;
  averageLatencyMs: number;
  cacheHitRate: number;
  failedRequests: number;
  fallbacksUsed: number;
  estimatedTotalCostUsd: number;
}
