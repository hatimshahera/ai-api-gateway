import { estimateCostUsd } from "./pricing";
import { getFallbackModel, getProviderForModel } from "./providers";
import {
  createCacheKey,
  createRequestId,
  logRequest,
  readCache,
  writeCache,
} from "./store";
import { GenerateRequest, GenerateResponse, ModelId, ProviderResult } from "./types";

function normalizeTemperature(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0.3;
  return Math.min(1.5, Math.max(0, parsed));
}

function normalizeRequest(body: unknown): Required<GenerateRequest> {
  const data = body as Partial<GenerateRequest>;
  const prompt = typeof data.prompt === "string" ? data.prompt.trim() : "";
  const model = (typeof data.model === "string" ? data.model : "mock:fast") as ModelId;
  const cache = data.cache !== false;
  const temperature = normalizeTemperature(data.temperature);

  if (!prompt) throw new Error("Prompt is required.");
  if (prompt.length > 8000) throw new Error("Prompt must be 8,000 characters or fewer.");

  return { prompt, model, cache, temperature };
}

async function attemptGenerate(
  model: ModelId,
  prompt: string,
  temperature: number,
  requestId: string,
) {
  const provider = getProviderForModel(model);
  const result = await provider.generate({ model, prompt, temperature, requestId });
  return { provider, result };
}

export async function runGatewayRequest(body: unknown): Promise<GenerateResponse> {
  const normalized = normalizeRequest(body);
  const requestId = createRequestId();
  const started = performance.now();
  const cacheKey = createCacheKey(normalized);

  if (normalized.cache) {
    const cached = readCache(cacheKey);
    if (cached) {
      const latencyMs = Math.max(1, Math.round(performance.now() - started));
      const response = {
        ...cached,
        requestId,
        latencyMs,
        cached: true,
      };
      logRequest({
        requestId,
        timestamp: new Date().toISOString(),
        promptLength: normalized.prompt.length,
        modelRequested: normalized.model,
        modelUsed: response.modelUsed,
        providerUsed: response.providerUsed,
        latencyMs,
        tokenUsage: response.tokenUsage,
        success: true,
        cached: true,
        fallbackUsed: response.fallbackUsed,
        retryCount: 0,
        estimatedCostUsd: 0,
      });
      return response;
    }
  }

  let retryCount = 0;
  let fallbackUsed = false;
  let finalModel = normalized.model;
  let finalProvider = getProviderForModel(normalized.model);
  let finalResult: ProviderResult | null = null;
  let finalError = "";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { provider, result } = await attemptGenerate(
        normalized.model,
        normalized.prompt,
        normalized.temperature,
        requestId,
      );
      finalProvider = provider;
      finalResult = result;
      break;
    } catch (error) {
      finalError = error instanceof Error ? error.message : "Unknown provider error.";
      if (attempt === 0) retryCount += 1;
    }
  }

  if (!finalResult) {
    fallbackUsed = true;
    finalModel = getFallbackModel(normalized.model);
    try {
      const { provider, result } = await attemptGenerate(
        finalModel,
        normalized.prompt,
        normalized.temperature,
        requestId,
      );
      finalProvider = provider;
      finalResult = result;
    } catch (error) {
      finalError = error instanceof Error ? error.message : "Unknown fallback error.";
    }
  }

  const latencyMs = Math.max(1, Math.round(performance.now() - started));

  if (!finalResult) {
    const failed: GenerateResponse = {
      requestId,
      response: "",
      modelRequested: normalized.model,
      modelUsed: finalModel,
      providerUsed: finalProvider.id,
      latencyMs,
      tokenUsage: { input: 0, output: 0, total: 0 },
      cached: false,
      fallbackUsed,
      retryCount,
      estimatedCostUsd: 0,
      success: false,
      error: finalError,
    };
    logRequest({
      requestId,
      timestamp: new Date().toISOString(),
      promptLength: normalized.prompt.length,
      modelRequested: normalized.model,
      modelUsed: finalModel,
      providerUsed: finalProvider.id,
      latencyMs,
      tokenUsage: { input: 0, output: 0, total: 0 },
      success: false,
      cached: false,
      fallbackUsed,
      retryCount,
      estimatedCostUsd: 0,
      error: finalError,
    });
    return failed;
  }

  const estimatedCostUsd = estimateCostUsd(
    finalModel,
    finalResult.inputTokens,
    finalResult.outputTokens,
  );
  const tokenUsage = {
    input: finalResult.inputTokens,
    output: finalResult.outputTokens,
    total: finalResult.inputTokens + finalResult.outputTokens,
  };
  const response: GenerateResponse = {
    requestId,
    response: finalResult.text,
    modelRequested: normalized.model,
    modelUsed: finalModel,
    providerUsed: finalProvider.id,
    latencyMs,
    tokenUsage,
    cached: false,
    fallbackUsed,
    retryCount,
    estimatedCostUsd,
    success: true,
  };

  if (normalized.cache) writeCache(cacheKey, response);

  logRequest({
    requestId,
    timestamp: new Date().toISOString(),
    promptLength: normalized.prompt.length,
    modelRequested: normalized.model,
    modelUsed: finalModel,
    providerUsed: finalProvider.id,
    latencyMs,
    tokenUsage,
    success: true,
    cached: false,
    fallbackUsed,
    retryCount,
    estimatedCostUsd,
  });

  return response;
}
