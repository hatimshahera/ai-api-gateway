import { AiProvider, ModelId, ProviderRequest, ProviderResult } from "./types";
import { estimateTokens } from "./pricing";

function buildMockResponse(request: ProviderRequest) {
  const mode = request.model === "mock:quality" ? "quality" : "fast";
  const shortPrompt = request.prompt.trim().replace(/\s+/g, " ").slice(0, 220);
  const checklist =
    mode === "quality"
      ? [
          "Route model calls through one gateway endpoint.",
          "Track latency, cache status, fallback usage, and cost per request.",
          "Keep provider code behind a common interface.",
        ]
      : [
          "Gateway accepted the prompt.",
          "Local provider returned a deterministic response.",
          "Request metadata was logged.",
        ];

  return [
    `Local ${mode} response routed by the gateway.`,
    "",
    `Prompt summary: ${shortPrompt || "No prompt supplied."}`,
    "",
    checklist.map((item) => `- ${item}`).join("\n"),
  ].join("\n");
}

export const mockProvider: AiProvider = {
  id: "mock",
  label: "Local Provider",
  models: ["mock:fast", "mock:quality"],
  async generate(request) {
    if (
      request.model === "mock:fast" &&
      request.prompt.toLowerCase().includes("force failure")
    ) {
      throw new Error("Mock provider forced failure for retry/fallback testing.");
    }

    const text = buildMockResponse(request);
    return {
      text,
      inputTokens: estimateTokens(request.prompt),
      outputTokens: estimateTokens(text),
    };
  },
};

export const openAiProvider: AiProvider = {
  id: "openai",
  label: "OpenAI",
  models: ["openai:gpt-4o-mini", "openai:gpt-4.1-mini"],
  async generate(request): Promise<ProviderResult> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured.");
    }

    const modelName = request.model.replace("openai:", "");
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          {
            role: "system",
            content:
              "You are responding through an AI API gateway. Be concise and useful.",
          },
          { role: "user", content: request.prompt },
        ],
        temperature: request.temperature,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI ${response.status}: ${body.slice(0, 240)}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new Error("OpenAI returned an empty response.");
    }

    return {
      text,
      inputTokens: data.usage?.prompt_tokens ?? estimateTokens(request.prompt),
      outputTokens: data.usage?.completion_tokens ?? estimateTokens(text),
    };
  },
};

export function getProviderForModel(model: ModelId): AiProvider {
  if (model.startsWith("openai:")) return openAiProvider;
  if (model.startsWith("mock:")) return mockProvider;
  throw new Error(`No provider registered for model: ${model}`);
}

export function getFallbackModel(model: ModelId): ModelId {
  if (model.startsWith("openai:")) return "mock:quality";
  if (model === "mock:quality") return "mock:fast";
  return "mock:quality";
}

export const AVAILABLE_MODELS: Array<{
  id: ModelId;
  label: string;
  provider: string;
  description: string;
}> = [
  {
    id: "openai:gpt-4o-mini",
    label: "GPT-4o mini",
    provider: "OpenAI",
    description: "Uses OpenAI when OPENAI_API_KEY is configured; otherwise falls back locally.",
  },
  {
    id: "openai:gpt-4.1-mini",
    label: "GPT-4.1 mini",
    provider: "OpenAI",
    description: "Higher quality OpenAI route when credentials are available.",
  },
  {
    id: "mock:fast",
    label: "Local fast",
    provider: "Local",
    description: "Deterministic local response for tests and no-key development.",
  },
  {
    id: "mock:quality",
    label: "Local fallback",
    provider: "Local",
    description: "Longer deterministic response used as the default fallback.",
  },
];
