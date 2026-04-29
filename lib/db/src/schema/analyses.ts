import {
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { sessions } from "./sessions";

export type AgentOutputJson = {
  name: string;
  role: string;
  thinking: string;
  findings: string[];
};

export type RecommendationJson = {
  title: string;
  rationale: string;
  priority: "high" | "medium" | "low";
};

export type RiskJson = {
  title: string;
  likelihood: "high" | "medium" | "low";
  impact: "high" | "medium" | "low";
  mitigation: string;
};

export type KeyMetricJson = {
  label: string;
  value: string;
  trend: "up" | "down" | "flat" | "unknown";
};

export type ChartJson = {
  title: string;
  type: "bar" | "line" | "pie";
  points: { label: string; value: number }[];
};

export const analyses = pgTable("analyses", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  focus: text("focus").notNull(),
  decision: text("decision").notNull(),
  confidence: real("confidence").notNull(),
  summary: text("summary").notNull(),
  agents: jsonb("agents").$type<AgentOutputJson[]>().notNull(),
  keyMetrics: jsonb("key_metrics").$type<KeyMetricJson[]>().notNull(),
  recommendations: jsonb("recommendations")
    .$type<RecommendationJson[]>()
    .notNull(),
  risks: jsonb("risks").$type<RiskJson[]>().notNull(),
  charts: jsonb("charts").$type<ChartJson[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Analysis = typeof analyses.$inferSelect;
export type InsertAnalysis = typeof analyses.$inferInsert;
