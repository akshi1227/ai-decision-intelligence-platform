import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  analyses,
  chatMessages,
  documents,
  sessions,
} from "@workspace/db";
import {
  AddDocumentBody,
  AddDocumentParams,
  CreateSessionBody,
  DeleteDocumentParams,
  DeleteSessionParams,
  GetSessionParams,
  ListAnalysesParams,
  ListMessagesParams,
  RunAnalysisBody,
  RunAnalysisParams,
  SendChatMessageBody,
  SendChatMessageParams,
} from "@workspace/api-zod";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { runMultiAgentAnalysis, summarizeDocument } from "../lib/ai/agents";
import { answerQuestion } from "../lib/ai/chat";

const router: IRouter = Router();

router.get("/sessions", async (_req, res) => {
  const rows = await db
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
    .orderBy(desc(sessions.createdAt));
  res.json(rows);
});

router.post("/sessions", async (req, res) => {
  const parsed = CreateSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const [created] = await db
    .insert(sessions)
    .values({
      title: parsed.data.title,
      domain: parsed.data.domain ?? "",
    })
    .returning();
  res.status(201).json({
    id: created.id,
    title: created.title,
    domain: created.domain,
    createdAt: created.createdAt.toISOString(),
    documentCount: 0,
    analysisCount: 0,
  });
});

router.get("/sessions/:sessionId", async (req, res) => {
  const params = GetSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.issues });
    return;
  }
  const sessionId = params.data.sessionId;
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const [docs, anas, msgs] = await Promise.all([
    db
      .select()
      .from(documents)
      .where(eq(documents.sessionId, sessionId))
      .orderBy(desc(documents.createdAt)),
    db
      .select()
      .from(analyses)
      .where(eq(analyses.sessionId, sessionId))
      .orderBy(desc(analyses.createdAt)),
    db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(asc(chatMessages.createdAt)),
  ]);
  res.json({
    session: {
      id: session.id,
      title: session.title,
      domain: session.domain,
      createdAt: session.createdAt.toISOString(),
      documentCount: docs.length,
      analysisCount: anas.length,
    },
    documents: docs.map((d) => ({
      id: d.id,
      sessionId: d.sessionId,
      name: d.name,
      kind: d.kind,
      content: d.content,
      charCount: d.content.length,
      summary: d.summary,
      createdAt: d.createdAt.toISOString(),
    })),
    analyses: anas.map((a) => ({
      id: a.id,
      sessionId: a.sessionId,
      focus: a.focus,
      decision: a.decision,
      confidence: a.confidence,
      summary: a.summary,
      agents: a.agents,
      keyMetrics: a.keyMetrics,
      recommendations: a.recommendations,
      risks: a.risks,
      charts: a.charts,
      createdAt: a.createdAt.toISOString(),
    })),
    messages: msgs.map((m) => ({
      id: m.id,
      sessionId: m.sessionId,
      role: m.role,
      content: m.content,
      sources: m.sources,
      createdAt: m.createdAt.toISOString(),
    })),
  });
});

router.delete("/sessions/:sessionId", async (req, res) => {
  const params = DeleteSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.issues });
    return;
  }
  await db.delete(sessions).where(eq(sessions.id, params.data.sessionId));
  res.status(204).end();
});

router.post("/sessions/:sessionId/documents", async (req, res) => {
  const params = AddDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.issues });
    return;
  }
  const body = AddDocumentBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.issues });
    return;
  }
  const sessionId = params.data.sessionId;
  const [exists] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.id, sessionId));
  if (!exists) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const summary = await summarizeDocument(
    body.data.name,
    body.data.kind,
    body.data.content,
  );
  const [doc] = await db
    .insert(documents)
    .values({
      sessionId,
      name: body.data.name,
      kind: body.data.kind,
      content: body.data.content,
      summary: summary || null,
    })
    .returning();
  res.status(201).json({
    id: doc.id,
    sessionId: doc.sessionId,
    name: doc.name,
    kind: doc.kind,
    content: doc.content,
    charCount: doc.content.length,
    summary: doc.summary,
    createdAt: doc.createdAt.toISOString(),
  });
});

router.delete(
  "/sessions/:sessionId/documents/:documentId",
  async (req, res) => {
    const params = DeleteDocumentParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.issues });
      return;
    }
    await db
      .delete(documents)
      .where(
        and(
          eq(documents.id, params.data.documentId),
          eq(documents.sessionId, params.data.sessionId),
        ),
      );
    res.status(204).end();
  },
);

router.post("/sessions/:sessionId/analyze", async (req, res) => {
  const params = RunAnalysisParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.issues });
    return;
  }
  const body = RunAnalysisBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.issues });
    return;
  }
  const sessionId = params.data.sessionId;
  const docs = await db
    .select()
    .from(documents)
    .where(eq(documents.sessionId, sessionId));

  const result = await runMultiAgentAnalysis(body.data.focus, docs);

  const [created] = await db
    .insert(analyses)
    .values({
      sessionId,
      focus: body.data.focus,
      decision: result.decision,
      confidence: result.confidence,
      summary: result.summary,
      agents: result.agents,
      keyMetrics: result.keyMetrics,
      recommendations: result.recommendations,
      risks: result.risks,
      charts: result.charts,
    })
    .returning();
  res.json({
    id: created.id,
    sessionId: created.sessionId,
    focus: created.focus,
    decision: created.decision,
    confidence: created.confidence,
    summary: created.summary,
    agents: created.agents,
    keyMetrics: created.keyMetrics,
    recommendations: created.recommendations,
    risks: created.risks,
    charts: created.charts,
    createdAt: created.createdAt.toISOString(),
  });
});

router.get("/sessions/:sessionId/analyses", async (req, res) => {
  const params = ListAnalysesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.issues });
    return;
  }
  const rows = await db
    .select()
    .from(analyses)
    .where(eq(analyses.sessionId, params.data.sessionId))
    .orderBy(desc(analyses.createdAt));
  res.json(
    rows.map((a) => ({
      id: a.id,
      sessionId: a.sessionId,
      focus: a.focus,
      decision: a.decision,
      confidence: a.confidence,
      summary: a.summary,
      agents: a.agents,
      keyMetrics: a.keyMetrics,
      recommendations: a.recommendations,
      risks: a.risks,
      charts: a.charts,
      createdAt: a.createdAt.toISOString(),
    })),
  );
});

router.post("/sessions/:sessionId/chat", async (req, res) => {
  const params = SendChatMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.issues });
    return;
  }
  const body = SendChatMessageBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.issues });
    return;
  }
  const sessionId = params.data.sessionId;
  const [session] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.id, sessionId));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const [docs, history] = await Promise.all([
    db.select().from(documents).where(eq(documents.sessionId, sessionId)),
    db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(asc(chatMessages.createdAt)),
  ]);

  const [userMsg] = await db
    .insert(chatMessages)
    .values({
      sessionId,
      role: "user",
      content: body.data.question,
      sources: [],
    })
    .returning();

  const { answer, sources } = await answerQuestion(
    body.data.question,
    docs,
    history,
  );

  const [assistantMsg] = await db
    .insert(chatMessages)
    .values({
      sessionId,
      role: "assistant",
      content: answer,
      sources: sources.map((s) => ({
        documentId: s.documentId,
        documentName: s.documentName,
        excerpt: s.excerpt,
      })),
    })
    .returning();

  res.json({
    userMessage: {
      id: userMsg.id,
      sessionId: userMsg.sessionId,
      role: userMsg.role,
      content: userMsg.content,
      sources: userMsg.sources,
      createdAt: userMsg.createdAt.toISOString(),
    },
    assistantMessage: {
      id: assistantMsg.id,
      sessionId: assistantMsg.sessionId,
      role: assistantMsg.role,
      content: assistantMsg.content,
      sources: assistantMsg.sources,
      createdAt: assistantMsg.createdAt.toISOString(),
    },
  });
});

router.get("/sessions/:sessionId/messages", async (req, res) => {
  const params = ListMessagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.issues });
    return;
  }
  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, params.data.sessionId))
    .orderBy(asc(chatMessages.createdAt));
  res.json(
    rows.map((m) => ({
      id: m.id,
      sessionId: m.sessionId,
      role: m.role,
      content: m.content,
      sources: m.sources,
      createdAt: m.createdAt.toISOString(),
    })),
  );
});

export default router;
