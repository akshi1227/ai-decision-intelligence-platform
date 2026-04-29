# Decision IQ — AI Decision Intelligence Platform

A flagship "command center" web app that turns messy raw inputs (text briefings, CSV exports, PDFs) into clear, defensible decisions using a multi-agent LLM workflow + lightweight RAG.

## Stack

- **Monorepo**: pnpm workspaces, TypeScript, contract-first via OpenAPI (Orval codegen).
- **Backend** (`artifacts/api-server`): Express 5 + Drizzle ORM + PostgreSQL.
- **Frontend** (`artifacts/decision-iq`): React + Vite + wouter + TanStack Query + shadcn/ui + Recharts + framer-motion.
- **AI**: OpenAI integration via Replit AI proxy (`@workspace/integrations-openai-ai-server`), model `gpt-5.4`, JSON-mode for structured output.

## Architecture

### Multi-agent analysis (`artifacts/api-server/src/lib/ai/agents.ts`)
Four specialized agents (Atlas — Data Analyst, Vega — Strategy, Orion — Risk, Lyra — Operations) run in parallel against the document corpus, then a Synthesizer merges their outputs into a single structured decision (decision string, confidence 0–1, summary, key metrics, recommendations, risks, charts).

### RAG chat (`artifacts/api-server/src/lib/ai/{rag,chat}.ts`)
Documents are chunked (~700 chars, 120 overlap) and ranked with a TF·IDF scoring function (the AI proxy doesn't expose embeddings). The top chunks are passed to the chat model with citation instructions, and the user sees clickable source chips.

### Data model (`lib/db/src/schema/`)
- `sessions` — top-level analysis workspaces.
- `documents` — text/csv/pdf source material with auto-generated summaries.
- `analyses` — full structured analysis (jsonb columns for agents/keyMetrics/recommendations/risks/charts).
- `chatMessages` — conversation history with jsonb `sources`.

### API surface (`lib/api-spec/openapi.yaml`)
- `GET /ai/dashboard` — portfolio summary + activity feed.
- `GET/POST/DELETE /ai/sessions` and `GET /ai/sessions/:id`.
- `POST/DELETE /ai/sessions/:id/documents/...`
- `POST /ai/sessions/:id/analyze`, `GET /ai/sessions/:id/analyses`.
- `POST /ai/sessions/:id/chat`, `GET /ai/sessions/:id/messages`.

React Query hooks and Zod schemas are codegen'd by `pnpm --filter @workspace/api-spec run codegen`.

## Conventions

- Server validates every body/params with Zod schemas from `@workspace/api-zod`.
- `lib/api-zod/src/index.ts` only re-exports `./generated/api` (the `./generated/types` namespace conflicts with the Zod consts of the same names — derive types via `z.infer` if needed).
- The Express body limit is bumped to 20 MB so users can paste large PDFs/CSVs as text.
- The OpenAI integration library declares `@types/node` as a devDependency (required by `node:fs` imports in `image/client.ts`).

## Workflows

- `artifacts/api-server: API Server` — Express on port 8080, mounted at `/api`.
- `artifacts/decision-iq: web` — Vite on port 24353, mounted at `/`.
- `artifacts/mockup-sandbox: Component Preview Server` — design-only sandbox.
