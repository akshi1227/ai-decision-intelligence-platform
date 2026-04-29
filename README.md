🚀 AI Decision Intelligence Platform

An end-to-end AI system that processes text, voice, CSV, and PDFs to generate actionable insights, automated decisions, and visual outputs using LLMs, RAG, and multi-agent orchestration.

✨ Features
🧠 Multi-Agent reasoning for task routing & decision-making
🔎 RAG pipeline with vector search (context-aware answers)
🎤 Multimodal inputs: text, voice, CSV, PDF
📊 Analytics dashboard for insights & visualization
⚙️ Scalable REST APIs with authentication
☁️ Cloud-ready (Docker, CI/CD)
🔐 Basic security checks + automated testing
🧱 Tech Stack
AI/ML: Python, LLM APIs, LangChain, FAISS
Backend: FastAPI / Node.js, REST, JWT
Data: PostgreSQL, Kafka, Spark, Airflow
Frontend: React
DevOps: Docker, Kubernetes, GitHub Actions
Testing/Security: Selenium/Playwright, OWASP basics
🏗️ Architecture
Ingestion → text/voice/files
Processing → agents + RAG (embeddings + retrieval)
API Layer → service orchestration
Data Layer → SQL + vector DB
UI → dashboards & sessions
Deployment → containers + CI/CD
⚙️ Setup
Prerequisites
Node.js 20+
pnpm 10+
PostgreSQL
Install
pnpm install
Environment (.env)
DATABASE_URL=postgresql://postgres:password@localhost:5432/decision_iq
SESSION_SECRET=your_secret
AI_INTEGRATIONS_OPENAI_API_KEY=sk-xxxx
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
DB + Run
pnpm --filter @workspace/db run db:push
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/decision-iq run dev

Open: http://localhost:24353

🎯 Use Cases
Document analysis & summarization
Voice-based knowledge retrieval
AI-driven dashboards & reporting
Decision support systems
🔮 Future Work
Real-time streaming pipelines
Advanced agent collaboration
Personalization layer
Stronger security hardening
