# CLAUDE.md

This project follows [AGENTS.md](./AGENTS.md) — read it for the full layout, run
commands, and conventions. Key points repeated here for convenience.

## OpenAI client (hackathon gateway)

The event gateway speaks the OpenAI API; only the **key** and **base URL** differ.
Config lives in `agent-service/.env` (copy `.env.example`):

```
OPENAI_API_KEY=sk-...your-team-key...     # from organisers — NEVER commit
OPENAI_BASE_URL=https://4.231.223.10.nip.io
OPENAI_MODEL=gpt-5.4-mini                  # develop here; switch up only where it matters
```

Use the shared singleton client, don't construct a new one per call site:

```ts
import { getOpenAI, DEFAULT_MODEL } from "./lib/openai.js"; // in agent-service/src

const res = await getOpenAI().chat.completions.create({
  model: DEFAULT_MODEL,
  messages: [{ role: "user", content: "Hi" }],
});
```

Models: `gpt-5.4-mini` (default), `-nano`, `gpt-5.4`, `gpt-5.5`, `gpt-5.6-terra`,
`-luna`, `-sol`, plus `gpt-audio`, `gpt-realtime-2.1`, `gpt-5.3-codex` (Responses API).
`$50` hard budget per team — avoid runaway loops on the pricey models.

## Conventions

- Centralised logging (`agent-service/src/lib/logger.ts`); always log errors.
- Add deps with `npm install`, never by editing `package.json` text.
- Never commit secrets; use synthetic data only.
