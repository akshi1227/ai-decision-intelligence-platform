import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  analyses,
  chatMessages,
  documents,
  sessions,
} from "@workspace/db";
import { desc, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/dashboard", async (_req, res) => {
  const [sessionRows, docRows, anaRows, msgRows, recentSessions, recentDocs, recentAnas, recentMsgs] =
    await Promise.all([
      db.select({ count: sql<number>`COUNT(*)`.mapWith(Number) }).from(sessions),
      db
        .select({
          count: sql<number>`COUNT(*)`.mapWith(Number),
          kind: documents.kind,
        })
        .from(documents)
        .groupBy(documents.kind),
      db
        .select({
          confidence: analyses.confidence,
        })
        .from(analyses),
      db.select({ count: sql<number>`COUNT(*)`.mapWith(Number) }).from(chatMessages),
      db
        .select({
          id: sessions.id,
          title: sessions.title,
          domain: sessions.domain,
          createdAt: sessions.createdAt,
          documentCount: sql<number>`(
            SELECT COUNT(*) FROM ${documents}
            WHERE ${documents.sessionId} = ${sessions.id}
          )`.mapWith(Number),
          analysisCount: sql<number>`(
            SELECT COUNT(*) FROM ${analyses}
            WHERE ${analyses.sessionId} = ${sessions.id}
          )`.mapWith(Number),
        })
        .from(sessions)
        .orderBy(desc(sessions.createdAt))
        .limit(6),
      db
        .select({
          id: documents.id,
          name: documents.name,
          createdAt: documents.createdAt,
          sessionId: documents.sessionId,
          sessionTitle: sessions.title,
        })
        .from(documents)
        .innerJoin(sessions, sql`${sessions.id} = ${documents.sessionId}`)
        .orderBy(desc(documents.createdAt))
        .limit(8),
      db
        .select({
          id: analyses.id,
          focus: analyses.focus,
          decision: analyses.decision,
          createdAt: analyses.createdAt,
          sessionId: analyses.sessionId,
          sessionTitle: sessions.title,
        })
        .from(analyses)
        .innerJoin(sessions, sql`${sessions.id} = ${analyses.sessionId}`)
        .orderBy(desc(analyses.createdAt))
        .limit(8),
      db
        .select({
          id: chatMessages.id,
          content: chatMessages.content,
          createdAt: chatMessages.createdAt,
          sessionId: chatMessages.sessionId,
          sessionTitle: sessions.title,
          role: chatMessages.role,
        })
        .from(chatMessages)
        .innerJoin(sessions, sql`${sessions.id} = ${chatMessages.sessionId}`)
        .orderBy(desc(chatMessages.createdAt))
        .limit(8),
    ]);

  const totalSessions = sessionRows[0]?.count ?? 0;
  const totalDocuments = docRows.reduce((sum, r) => sum + r.count, 0);
  const totalAnalyses = anaRows.length;
  const totalMessages = msgRows[0]?.count ?? 0;

  const avgConfidence =
    anaRows.length > 0
      ? anaRows.reduce((s, r) => s + (r.confidence ?? 0), 0) / anaRows.length
      : 0;

  const buckets = [
    { label: "0–25%", min: 0, max: 0.25, value: 0 },
    { label: "25–50%", min: 0.25, max: 0.5, value: 0 },
    { label: "50–75%", min: 0.5, max: 0.75, value: 0 },
    { label: "75–100%", min: 0.75, max: 1.01, value: 0 },
  ];
  for (const a of anaRows) {
    const c = a.confidence ?? 0;
    const b = buckets.find((x) => c >= x.min && c < x.max);
    if (b) b.value += 1;
  }

  const documentsByKind = docRows.map((r) => ({
    label: r.kind,
    value: r.count,
  }));

  type Activity = {
    kind: "session" | "document" | "analysis" | "chat";
    title: string;
    sessionId: number;
    sessionTitle: string;
    at: string;
  };

  const activity: Activity[] = [
    ...recentDocs.map((d) => ({
      kind: "document" as const,
      title: `Added document "${d.name}"`,
      sessionId: d.sessionId,
      sessionTitle: d.sessionTitle,
      at: d.createdAt.toISOString(),
    })),
    ...recentAnas.map((a) => ({
      kind: "analysis" as const,
      title: a.decision,
      sessionId: a.sessionId,
      sessionTitle: a.sessionTitle,
      at: a.createdAt.toISOString(),
    })),
    ...recentMsgs.map((m) => ({
      kind: "chat" as const,
      title:
        m.role === "user"
          ? `Asked: ${m.content.slice(0, 80)}${m.content.length > 80 ? "…" : ""}`
          : `Replied: ${m.content.slice(0, 80)}${m.content.length > 80 ? "…" : ""}`,
      sessionId: m.sessionId,
      sessionTitle: m.sessionTitle,
      at: m.createdAt.toISOString(),
    })),
    ...recentSessions.slice(0, 3).map((s) => ({
      kind: "session" as const,
      title: `Created session "${s.title}"`,
      sessionId: s.id,
      sessionTitle: s.title,
      at: s.createdAt.toISOString(),
    })),
  ];

  activity.sort((a, b) => (a.at < b.at ? 1 : -1));

  res.json({
    totalSessions,
    totalDocuments,
    totalAnalyses,
    totalMessages,
    avgConfidence,
    decisionsByConfidence: buckets.map((b) => ({
      label: b.label,
      value: b.value,
    })),
    documentsByKind,
    recentActivity: activity.slice(0, 12),
    recentSessions: recentSessions.map((s) => ({
      id: s.id,
      title: s.title,
      domain: s.domain,
      createdAt: s.createdAt.toISOString(),
      documentCount: s.documentCount,
      analysisCount: s.analysisCount,
    })),
  });
});

export default router;
