import { ModelId } from "./types";

export interface PricingRecord {
  provider: string;
  model: string;
  inputUsdPer1M: number;
  outputUsdPer1M: number;
  sourceUrl: string;
  sourceStatus: "scraped" | "seeded" | "local";
  checkedAt: string;
  notes?: string;
}

const CHECKED_AT = "2026-07-02";

const SOURCE_URLS = {
  openai: "https://platform.openai.com/docs/pricing",
  anthropic: "https://platform.claude.com/docs/en/about-claude/pricing",
  google: "https://ai.google.dev/gemini-api/docs/pricing",
};

const SEEDED_PRICING: PricingRecord[] = [
  {
    provider: "OpenAI",
    model: "gpt-4o-mini",
    inputUsdPer1M: 0.15,
    outputUsdPer1M: 0.6,
    sourceUrl: SOURCE_URLS.openai,
    sourceStatus: "seeded",
    checkedAt: CHECKED_AT,
    notes: "Seeded fallback used for runtime estimates when the OpenAI page cannot be parsed.",
  },
  {
    provider: "OpenAI",
    model: "gpt-4.1-mini",
    inputUsdPer1M: 0.4,
    outputUsdPer1M: 1.6,
    sourceUrl: SOURCE_URLS.openai,
    sourceStatus: "seeded",
    checkedAt: CHECKED_AT,
    notes: "Seeded fallback used for runtime estimates when the OpenAI page cannot be parsed.",
  },
  {
    provider: "Anthropic",
    model: "Claude Sonnet 4.6",
    inputUsdPer1M: 3,
    outputUsdPer1M: 15,
    sourceUrl: SOURCE_URLS.anthropic,
    sourceStatus: "seeded",
    checkedAt: CHECKED_AT,
  },
  {
    provider: "Anthropic",
    model: "Claude Haiku 4.5",
    inputUsdPer1M: 1,
    outputUsdPer1M: 5,
    sourceUrl: SOURCE_URLS.anthropic,
    sourceStatus: "seeded",
    checkedAt: CHECKED_AT,
  },
  {
    provider: "Google",
    model: "gemini-3.1-flash-lite",
    inputUsdPer1M: 0.25,
    outputUsdPer1M: 1.5,
    sourceUrl: SOURCE_URLS.google,
    sourceStatus: "seeded",
    checkedAt: CHECKED_AT,
    notes: "Standard text/image/video rate.",
  },
  {
    provider: "Local",
    model: "local-fast",
    inputUsdPer1M: 0,
    outputUsdPer1M: 0,
    sourceUrl: "local",
    sourceStatus: "local",
    checkedAt: CHECKED_AT,
  },
  {
    provider: "Local",
    model: "local-fallback",
    inputUsdPer1M: 0,
    outputUsdPer1M: 0,
    sourceUrl: "local",
    sourceStatus: "local",
    checkedAt: CHECKED_AT,
  },
];

const MODEL_PRICING: Record<ModelId, { input: number; output: number }> = {
  "openai:gpt-4o-mini": getSeededPrice("OpenAI", "gpt-4o-mini"),
  "openai:gpt-4.1-mini": getSeededPrice("OpenAI", "gpt-4.1-mini"),
  "mock:fast": { input: 0, output: 0 },
  "mock:quality": { input: 0, output: 0 },
};

export function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.trim().length / 4));
}

export function estimateCostUsd(model: ModelId, inputTokens: number, outputTokens: number) {
  const pricing = MODEL_PRICING[model];
  return (
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output
  );
}

export function getPricingRecords() {
  return SEEDED_PRICING;
}

export function getPricingSourceUrls() {
  return SOURCE_URLS;
}

function getSeededPrice(provider: string, model: string) {
  const record = SEEDED_PRICING.find(
    (item) => item.provider === provider && item.model === model,
  );
  return {
    input: record?.inputUsdPer1M ?? 0,
    output: record?.outputUsdPer1M ?? 0,
  };
}

function pricePair(text: string, modelPattern: RegExp) {
  const match = text.match(modelPattern);
  if (!match?.[1] || !match?.[2]) return null;
  return {
    inputUsdPer1M: Number(match[1]),
    outputUsdPer1M: Number(match[2]),
  };
}

function compactPageText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function scrapeAnthropicPricing(checkedAt: string): Promise<PricingRecord[]> {
  const response = await fetch(SOURCE_URLS.anthropic, { cache: "no-store" });
  if (!response.ok) throw new Error(`Anthropic pricing returned ${response.status}.`);
  const text = compactPageText(await response.text());
  const records: PricingRecord[] = [];

  const sonnet = pricePair(
    text,
    /Claude Sonnet 4\.6\$(\d+(?:\.\d+)?) \/ MTok.*?\$(\d+(?:\.\d+)?) \/ MTok/,
  );
  if (sonnet) {
    records.push({
      provider: "Anthropic",
      model: "Claude Sonnet 4.6",
      inputUsdPer1M: sonnet.inputUsdPer1M,
      outputUsdPer1M: sonnet.outputUsdPer1M,
      sourceUrl: SOURCE_URLS.anthropic,
      sourceStatus: "scraped",
      checkedAt,
    });
  }

  const haiku = pricePair(
    text,
    /Claude Haiku 4\.5\$(\d+(?:\.\d+)?) \/ MTok.*?\$(\d+(?:\.\d+)?) \/ MTok/,
  );
  if (haiku) {
    records.push({
      provider: "Anthropic",
      model: "Claude Haiku 4.5",
      inputUsdPer1M: haiku.inputUsdPer1M,
      outputUsdPer1M: haiku.outputUsdPer1M,
      sourceUrl: SOURCE_URLS.anthropic,
      sourceStatus: "scraped",
      checkedAt,
    });
  }

  if (!records.length) throw new Error("Anthropic pricing page could not be parsed.");
  return records;
}

async function scrapeGooglePricing(checkedAt: string): Promise<PricingRecord[]> {
  const response = await fetch(SOURCE_URLS.google, { cache: "no-store" });
  if (!response.ok) throw new Error(`Google pricing returned ${response.status}.`);
  const text = compactPageText(await response.text());
  const flashLite = pricePair(
    text,
    /gemini-3\.1-flash-lite.*?Standard.*?Input price.*?\$(\d+(?:\.\d+)?).*?Output price.*?\$(\d+(?:\.\d+)?)/,
  );

  if (!flashLite) throw new Error("Google pricing page could not be parsed.");

  return [
    {
      provider: "Google",
      model: "gemini-3.1-flash-lite",
      inputUsdPer1M: flashLite.inputUsdPer1M,
      outputUsdPer1M: flashLite.outputUsdPer1M,
      sourceUrl: SOURCE_URLS.google,
      sourceStatus: "scraped",
      checkedAt,
      notes: "Standard text/image/video rate.",
    },
  ];
}

export async function refreshProviderPricing() {
  const checkedAt = new Date().toISOString();
  const [anthropic, google] = await Promise.allSettled([
    scrapeAnthropicPricing(checkedAt),
    scrapeGooglePricing(checkedAt),
  ]);
  const scrapedRecords = [anthropic, google].flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );
  const failures = [
    anthropic.status === "rejected" ? `Anthropic: ${anthropic.reason.message}` : "",
    google.status === "rejected" ? `Google: ${google.reason.message}` : "",
  ].filter(Boolean);

  const seededKeys = new Set(
    scrapedRecords.map((record) => `${record.provider}:${record.model}`),
  );
  const fallbackRecords = SEEDED_PRICING.filter(
    (record) =>
      !seededKeys.has(`${record.provider}:${record.model}`) ||
      record.provider === "OpenAI" ||
      record.provider === "Local",
  );

  return {
    records: [...scrapedRecords, ...fallbackRecords],
    failures,
    refreshedAt: checkedAt,
  };
}
