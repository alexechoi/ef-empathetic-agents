# Still Here

### A memory companion that knows when to call.

Still turns the memories you choose to preserve into timely, gentle support. It
understands upcoming moments in your calendar, selects a relevant approved
memory, and calls when hearing it could help most.

Built for the **Empathetic Agents Hackathon** by EverSettled, ElevenLabs and
Lovable.

## The idea

Grief support often arrives all at once, then fades while difficult moments keep
coming. Still stays in the background. Before a job interview, anniversary or
family ritual, it can share the words, stories and encouragement a loved one
left behind.

The agent works without waiting for a prompt. It decides **whether to reach out,
when to do it and which memory is appropriate**, then starts a phone
conversation.

## Demo flow

1. Add memories from text or voice notes and approve each one for use.
2. Still maps people, themes and events into a memory graph.
3. A LangGraph planner reviews upcoming events and prepares safe outreach.
4. ElevenLabs places the call and lets the user respond in real time.

The service streams planner decisions, safety checks and sanitized live call
activity, giving the frontend an inspectable record of every action.

## What makes it different

- **Proactive support**: it arrives around meaningful moments without requiring
  the user to open an app.
- **Grounded conversations**: the caller uses only memories the user saved and
  approved. It says when a detail is missing.
- **Clear identity**: Still identifies itself as a companion and never claims to
  be the person who died. A standard voice is the default; a clone requires
  explicit consent.
- **Safe by design**: consent, quiet hours, contact limits, prohibited topics,
  advice, dependency language and an easy way to decline are checked before
  every call.
- **Traceable**: SSE traces expose why an event mattered, which memories were
  chosen and which guardrails passed.

## Architecture

```text
Next.js dashboard (UI shell)
       │  profiles · memories · calendar · live traces
       ▼
LangGraph agent service ─── SQLite source of truth
       │
       ├── Orchestrator: event importance → memory selection → safety
       │
       └── Caller: restricted context → safety re-check → conversation
                                                      │
                                                      ▼
                                          ElevenLabs + Twilio
```

| Layer               | Stack                                             |
| ------------------- | ------------------------------------------------- |
| Experience          | Next.js 16, React 19, TypeScript, Tailwind CSS    |
| Agent orchestration | LangGraph, OpenAI-compatible hackathon gateway    |
| Voice               | ElevenLabs Conversational AI, Twilio              |
| Memory              | SQLite plus a derived knowledge graph             |
| Observability       | Server-sent planner and call traces, Pino logging |

## Run locally

**Requirements:** Node.js 20+, npm and `make`.

```bash
git clone https://github.com/alexechoi/ef-empathetic-agents.git
cd ef-empathetic-agents

cp agent-service/.env.example agent-service/.env
make install
make dev
```

The UI shell runs on [localhost:3000](http://localhost:3000). The working agent
API runs on [localhost:2024](http://localhost:2024); its detailed demo commands
are in the [agent service guide](./agent-service/README.md).

Still works end to end in dry-run mode without telephony credentials. For a real
call, add the OpenAI and ElevenLabs values to `agent-service/.env`, push the
agent config, then disable dry-run:

```bash
cd agent-service
npm run agent:push
# Set DRY_RUN=false and ELEVENLABS_AGENT_PHONE_NUMBER_ID in .env
```

Never use real personal or sensitive data in development. The repository ships
with a synthetic demo profile, calendar and approved memories.

## Repository

```text
.
├── next-app/       # Next.js dashboard shell
└── agent-service/  # LangGraph agents, memory, safety and voice calls
```

See the [agent service API guide](./agent-service/README.md) for endpoints,
streaming events and call configuration.

## License

[Apache 2.0](./LICENSE)
