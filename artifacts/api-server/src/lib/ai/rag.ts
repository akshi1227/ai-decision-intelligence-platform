import type { Document } from "@workspace/db";

export type RetrievedChunk = {
  documentId: number;
  documentName: string;
  excerpt: string;
  score: number;
};

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "if",
  "then",
  "else",
  "of",
  "in",
  "on",
  "at",
  "to",
  "for",
  "with",
  "by",
  "from",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "as",
  "it",
  "its",
  "this",
  "that",
  "these",
  "those",
  "i",
  "you",
  "he",
  "she",
  "we",
  "they",
  "them",
  "do",
  "does",
  "did",
  "will",
  "would",
  "should",
  "could",
  "can",
  "may",
  "might",
  "what",
  "which",
  "who",
  "whom",
  "where",
  "when",
  "why",
  "how",
  "about",
  "into",
  "than",
  "so",
  "not",
  "no",
  "yes",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s%.-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

function chunkDocument(
  doc: Document,
  size = 700,
  overlap = 120,
): Array<{ documentId: number; documentName: string; text: string }> {
  const text = doc.content;
  if (text.length <= size) {
    return [
      { documentId: doc.id, documentName: doc.name, text: text.trim() },
    ];
  }
  const chunks: Array<{
    documentId: number;
    documentName: string;
    text: string;
  }> = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(text.length, start + size);
    const slice = text.slice(start, end).trim();
    if (slice.length > 0) {
      chunks.push({
        documentId: doc.id,
        documentName: doc.name,
        text: slice,
      });
    }
    if (end === text.length) break;
    start = end - overlap;
    if (start < 0) start = 0;
  }
  return chunks;
}

export function retrieveChunks(
  question: string,
  documents: Document[],
  topK = 5,
): RetrievedChunk[] {
  const queryTerms = tokenize(question);
  if (queryTerms.length === 0 || documents.length === 0) return [];

  const queryFreq = new Map<string, number>();
  for (const t of queryTerms) {
    queryFreq.set(t, (queryFreq.get(t) ?? 0) + 1);
  }

  const allChunks = documents.flatMap((d) => chunkDocument(d));
  if (allChunks.length === 0) return [];

  // Document frequency for IDF.
  const df = new Map<string, number>();
  const tokenizedChunks = allChunks.map((c) => {
    const tokens = tokenize(c.text);
    const seen = new Set(tokens);
    for (const t of seen) {
      df.set(t, (df.get(t) ?? 0) + 1);
    }
    return tokens;
  });
  const N = allChunks.length;

  const scored = allChunks.map((chunk, i) => {
    const tokens = tokenizedChunks[i] ?? [];
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    let score = 0;
    for (const [term, qCount] of queryFreq) {
      const termTf = tf.get(term) ?? 0;
      if (termTf === 0) continue;
      const idf = Math.log(1 + N / ((df.get(term) ?? 0) + 1));
      score += qCount * (1 + Math.log(termTf)) * idf;
    }
    return { chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.filter((s) => s.score > 0).slice(0, topK);

  return top.map((s) => ({
    documentId: s.chunk.documentId,
    documentName: s.chunk.documentName,
    excerpt:
      s.chunk.text.length > 400
        ? `${s.chunk.text.slice(0, 400).trim()}…`
        : s.chunk.text,
    score: Math.round(s.score * 100) / 100,
  }));
}
