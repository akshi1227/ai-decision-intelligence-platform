import { openai } from "@workspace/integrations-openai-ai-server";
import type { ChatMessageRow, Document } from "@workspace/db";
import { logger } from "../logger";
import { retrieveChunks, type RetrievedChunk } from "./rag";

const MODEL = "gpt-5.4";

export async function answerQuestion(
  question: string,
  documents: Document[],
  history: ChatMessageRow[],
): Promise<{ answer: string; sources: RetrievedChunk[] }> {
  const sources = retrieveChunks(question, documents, 6);

  const contextBlock =
    sources.length > 0
      ? sources
          .map(
            (s, i) =>
              `[${i + 1}] (${s.documentName}, doc#${s.documentId})\n${s.excerpt}`,
          )
          .join("\n\n")
      : "(No matching passages were found in the uploaded documents.)";

  const recent = history.slice(-6);
  const messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }> = [
    {
      role: "system",
      content:
        "You are the Decision IQ research assistant. Answer the user's question grounded in the provided document excerpts. Cite sources by their bracket number, e.g. [1], [2]. If the excerpts do not contain the answer, say so clearly and suggest what document the user could add. Be concise (3-6 sentences max) and decision-focused.",
    },
    ...recent.map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    })),
    {
      role: "user",
      content: `QUESTION:\n${question}\n\nRELEVANT EXCERPTS:\n${contextBlock}`,
    },
  ];

  try {
    const resp = await openai.chat.completions.create({
      model: MODEL,
      max_completion_tokens: 800,
      messages,
    });
    const answer =
      resp.choices[0]?.message?.content?.trim() ??
      "I couldn't generate a response — please try again.";
    return { answer, sources };
  } catch (err) {
    logger.error({ err }, "Chat answer failed");
    return {
      answer:
        "I ran into an error reaching the model. Please try again in a moment.",
      sources,
    };
  }
}
