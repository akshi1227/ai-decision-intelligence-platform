import { openai } from "@workspace/integrations-openai-ai-server";
import type {
  AgentOutputJson,
  ChartJson,
  KeyMetricJson,
  RecommendationJson,
  RiskJson,
} from "@workspace/db";
import type { Document } from "@workspace/db";
import { logger } from "../logger";

const MODEL = "gpt-5.4";

const AGENT_DEFS: Array<{ name: string; role: string; system: string }> = [
  {
    name: "Atlas",
    role: "Data Analyst",
    system:
      "You are Atlas, a quantitative data analyst. Read the documents and surface the most decision-relevant facts, numbers, trends, and outliers. Be concrete. Cite numbers verbatim from the data when possible.",
  },
  {
    name: "Vega",
    role: "Strategy Advisor",
    system:
      "You are Vega, a strategy advisor (think McKinsey-meets-founder). Translate the data into strategic options, second-order effects, and trade-offs. Stay grounded in what the documents actually say.",
  },
  {
    name: "Orion",
    role: "Risk Assessor",
    system:
      "You are Orion, a risk assessor. Identify what could go wrong, what assumptions are fragile, what's missing from the data, and where confidence should be discounted. Be skeptical but useful.",
  },
  {
    name: "Lyra",
    role: "Operations Critic",
    system:
      "You are Lyra, an operations critic. Focus on execution: what would actually need to happen, who/what is required, what timelines look like, and which moves are reversible vs irreversible.",
  },
];

function truncateForContext(text: string, max = 6000): string {
  if (text.length <= max) return text;
  const head = text.slice(0, Math.floor(max * 0.7));
  const tail = text.slice(-Math.floor(max * 0.3));
  return `${head}\n\n... [truncated ${text.length - max} chars] ...\n\n${tail}`;
}

function buildCorpus(documents: Document[], maxChars = 18000): string {
  if (documents.length === 0) return "(No documents have been provided.)";
  const perDoc = Math.max(1500, Math.floor(maxChars / documents.length));
  return documents
    .map((d, i) => {
      const body = truncateForContext(d.content, perDoc);
      return `--- Document ${i + 1} [id=${d.id}] [name="${d.name}"] [kind=${d.kind}] ---\n${body}`;
    })
    .join("\n\n");
}

async function runAgent(
  agentDef: (typeof AGENT_DEFS)[number],
  focus: string,
  corpus: string,
): Promise<AgentOutputJson> {
  const userPrompt = `DECISION FOCUS:\n${focus}\n\nDOCUMENT CORPUS:\n${corpus}\n\nReturn a JSON object with exactly:\n{\n  "thinking": "2-4 sentences of your honest reasoning, in your voice",\n  "findings": ["3-6 short, specific, decision-relevant findings as a JSON array of strings"]\n}\nReturn JSON only.`;

  try {
    const resp = await openai.chat.completions.create({
      model: MODEL,
      max_completion_tokens: 1200,
      messages: [
        { role: "system", content: agentDef.system },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });
    const raw = resp.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as {
      thinking?: unknown;
      findings?: unknown;
    };
    const thinking =
      typeof parsed.thinking === "string"
        ? parsed.thinking
        : "(no reasoning provided)";
    const findings = Array.isArray(parsed.findings)
      ? parsed.findings.filter((f): f is string => typeof f === "string")
      : [];
    return {
      name: agentDef.name,
      role: agentDef.role,
      thinking,
      findings,
    };
  } catch (err) {
    logger.error({ err, agent: agentDef.name }, "Agent run failed");
    return {
      name: agentDef.name,
      role: agentDef.role,
      thinking: "(this agent encountered an error during analysis)",
      findings: [],
    };
  }
}

export type SynthesizedAnalysis = {
  decision: string;
  confidence: number;
  summary: string;
  keyMetrics: KeyMetricJson[];
  recommendations: RecommendationJson[];
  risks: RiskJson[];
  charts: ChartJson[];
};

const TREND_VALUES: KeyMetricJson["trend"][] = [
  "up",
  "down",
  "flat",
  "unknown",
];
const PRIORITY_VALUES: RecommendationJson["priority"][] = [
  "high",
  "medium",
  "low",
];
const SEVERITY_VALUES: RiskJson["likelihood"][] = ["high", "medium", "low"];
const CHART_TYPES: ChartJson["type"][] = ["bar", "line", "pie"];

function pickEnum<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

async function synthesize(
  focus: string,
  corpus: string,
  agentOutputs: AgentOutputJson[],
): Promise<SynthesizedAnalysis> {
  const agentBlock = agentOutputs
    .map(
      (a) =>
        `[${a.name} — ${a.role}]\nThinking: ${a.thinking}\nFindings:\n- ${a.findings.join("\n- ")}`,
    )
    .join("\n\n");

  const userPrompt = `You are the Synthesizer for an AI decision intelligence platform. Your job is to read the underlying documents AND the four agents' outputs below, then produce ONE clear executive answer.

DECISION FOCUS:
${focus}

DOCUMENT CORPUS:
${corpus}

AGENT OUTPUTS:
${agentBlock}

Return a JSON object with this exact shape (no extra keys):
{
  "decision": "One short, opinionated sentence stating the recommended decision.",
  "confidence": 0.0-to-1.0 number reflecting how confident the evidence supports the decision,
  "summary": "3-5 sentences of executive summary explaining the decision in plain language.",
  "keyMetrics": [
    { "label": "short label", "value": "string value (include units)", "trend": "up"|"down"|"flat"|"unknown" }
  ],
  "recommendations": [
    { "title": "imperative action", "rationale": "1-2 sentences", "priority": "high"|"medium"|"low" }
  ],
  "risks": [
    { "title": "risk", "likelihood": "high"|"medium"|"low", "impact": "high"|"medium"|"low", "mitigation": "1 sentence" }
  ],
  "charts": [
    { "title": "chart title", "type": "bar"|"line"|"pie", "points": [ { "label": "x label", "value": number } ] }
  ]
}

Rules:
- Provide 3-6 keyMetrics, 3-5 recommendations, 2-4 risks, and 1-3 charts.
- Charts MUST be derived from numbers actually present in the documents (counts, percentages, segments, timeseries). If no real numbers exist, return an empty charts array.
- Numbers in charts must be plain numbers (no "$" or "%" inside the value).
- Be specific to this domain. Do not give generic advice.
- Return JSON only.`;

  const resp = await openai.chat.completions.create({
    model: MODEL,
    max_completion_tokens: 4000,
    messages: [
      {
        role: "system",
        content:
          "You are a senior decision-intelligence synthesizer. You produce structured, opinionated, evidence-grounded answers.",
      },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
  });

  const raw = resp.choices[0]?.message?.content ?? "{}";
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch (err) {
    logger.error({ err, raw }, "Failed to parse synthesizer JSON");
  }

  const confidenceRaw =
    typeof parsed.confidence === "number"
      ? parsed.confidence
      : Number(parsed.confidence);
  const confidence = Number.isFinite(confidenceRaw)
    ? Math.min(1, Math.max(0, confidenceRaw))
    : 0.5;

  const keyMetrics: KeyMetricJson[] = asArray(parsed.keyMetrics).map((m) => {
    const o = m as Record<string, unknown>;
    return {
      label: asString(o.label, "Metric"),
      value: asString(o.value, "—"),
      trend: pickEnum(o.trend, TREND_VALUES, "unknown"),
    };
  });

  const recommendations: RecommendationJson[] = asArray(
    parsed.recommendations,
  ).map((r) => {
    const o = r as Record<string, unknown>;
    return {
      title: asString(o.title, "Recommendation"),
      rationale: asString(o.rationale, ""),
      priority: pickEnum(o.priority, PRIORITY_VALUES, "medium"),
    };
  });

  const risks: RiskJson[] = asArray(parsed.risks).map((r) => {
    const o = r as Record<string, unknown>;
    return {
      title: asString(o.title, "Risk"),
      likelihood: pickEnum(o.likelihood, SEVERITY_VALUES, "medium"),
      impact: pickEnum(o.impact, SEVERITY_VALUES, "medium"),
      mitigation: asString(o.mitigation, ""),
    };
  });

  const charts: ChartJson[] = asArray(parsed.charts).map((c) => {
    const o = c as Record<string, unknown>;
    const points = asArray(o.points)
      .map((p) => {
        const po = p as Record<string, unknown>;
        const value =
          typeof po.value === "number" ? po.value : Number(po.value);
        return {
          label: asString(po.label, ""),
          value: Number.isFinite(value) ? value : 0,
        };
      })
      .filter((p) => p.label.length > 0);
    return {
      title: asString(o.title, "Chart"),
      type: pickEnum(o.type, CHART_TYPES, "bar"),
      points,
    };
  });

  return {
    decision: asString(parsed.decision, "Insufficient evidence to commit."),
    confidence,
    summary: asString(
      parsed.summary,
      "Synthesizer was unable to produce a summary.",
    ),
    keyMetrics,
    recommendations,
    risks,
    charts: charts.filter((c) => c.points.length > 0),
  };
}

export async function runMultiAgentAnalysis(
  focus: string,
  documents: Document[],
): Promise<{
  agents: AgentOutputJson[];
} & SynthesizedAnalysis> {
  const corpus = buildCorpus(documents);
  const agents = await Promise.all(
    AGENT_DEFS.map((def) => runAgent(def, focus, corpus)),
  );
  const synth = await synthesize(focus, corpus, agents);
  return { agents, ...synth };
}

export async function summarizeDocument(
  name: string,
  kind: string,
  content: string,
): Promise<string> {
  try {
    const trimmed = truncateForContext(content, 8000);
    const resp = await openai.chat.completions.create({
      model: MODEL,
      max_completion_tokens: 300,
      messages: [
        {
          role: "system",
          content:
            "You are a precise document summarizer for a decision intelligence platform. Produce a 1-3 sentence summary that emphasizes decision-relevant facts (numbers, entities, dates, claims). No fluff.",
        },
        {
          role: "user",
          content: `Document name: ${name}\nKind: ${kind}\n\nCONTENT:\n${trimmed}\n\nSummary:`,
        },
      ],
    });
    return resp.choices[0]?.message?.content?.trim() ?? "";
  } catch (err) {
    logger.error({ err, name }, "Document summarization failed");
    return "";
  }
}
