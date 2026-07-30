"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import * as api from "@/lib/api";
import {
  decisionFromPlan,
  stepsFromDecision,
  toMoment,
  traceToMomentStep,
  type CalendarEvent,
  type CallRecord,
  type EventDecision,
  type Memory,
  type Moment,
  type OutreachPlan,
  type SafetyReport,
  type SourceType,
  type TraceStep,
} from "@/lib/moments";

export interface LiveCallTurn {
  role: string;
  text: string;
}

export interface LiveCallState {
  momentId: string;
  conversationId: string;
  turns: LiveCallTurn[];
  status: "live" | "ended";
}

interface CallResult {
  status: "initiated" | "skipped" | "failed" | "completed";
  safetyReport?: SafetyReport;
  call: CallRecord;
}

function localMemoryPlaceholder(sourceType: SourceType, summary: string): Memory {
  return {
    id: `mem-local-${Date.now()}`,
    sourceType,
    summary,
    themes: ["unsorted"],
    emotionalTone: "neutral",
    approvedForUse: false,
  };
}

/**
 * Single home for feed-level state: moments, run trace, memories, calls, and
 * every transition (generate / approve / decline / ingest / approve-memory).
 * The `initial*` mock data is the seed AND the fallback — on any load or
 * stream failure the state is simply left untouched, so the demo never
 * white-screens if agent-service is unreachable.
 */
export function useMomentActions({
  initialMoments,
  initialTrace,
  initialMemories,
  initialCalls,
}: {
  initialMoments: Moment[];
  initialTrace: TraceStep[];
  initialMemories: Memory[];
  initialCalls: CallRecord[];
}) {
  const [moments, setMoments] = useState<Moment[]>(initialMoments);
  const [trace, setTrace] = useState<TraceStep[]>(initialTrace);
  const [memories, setMemories] = useState<Memory[]>(initialMemories);
  const [calls, setCalls] = useState<CallRecord[]>(initialCalls);
  const [playingMomentId, setPlayingMomentId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [callingMomentId, setCallingMomentId] = useState<string | null>(null);
  const [liveCall, setLiveCall] = useState<LiveCallState | null>(null);

  const eventsRef = useRef<Map<string, CalendarEvent>>(new Map());
  const decisionsRef = useRef<Map<string, EventDecision>>(new Map());
  const loadedRef = useRef(false);
  const monitorRef = useRef<EventSource | null>(null);

  const patchMoment = useCallback(
    (momentId: string, fn: (m: Moment) => Moment) =>
      setMoments((prev) => prev.map((m) => (m.id === momentId ? fn(m) : m))),
    [],
  );

  const patchMomentByEvent = useCallback(
    (eventId: string, fn: (m: Moment) => Moment) =>
      setMoments((prev) => prev.map((m) => (m.eventId === eventId ? fn(m) : m))),
    [],
  );

  const rebuildMomentsFromPlans = useCallback((plans: OutreachPlan[]) => {
    const mapped = plans
      .map((plan) => {
        const event = eventsRef.current.get(plan.eventId);
        if (!event) return null;
        return toMoment(event, plan, decisionsRef.current.get(plan.eventId));
      })
      .filter((m): m is Moment => m !== null);
    if (mapped.length > 0) setMoments(mapped);
  }, []);

  // --- Initial load: live data wins; empty plans or any failure keep mocks ---
  useEffect(() => {
    if (loadedRef.current) return; // idempotent across StrictMode's double effect
    loadedRef.current = true;

    (async () => {
      try {
        const [events, plans, liveMemories, liveCalls] = await Promise.all([
          api.getEvents(),
          api.getPlans(),
          api.getMemories(),
          api.getCalls(),
        ]);

        for (const event of events) eventsRef.current.set(event.id, event);
        if (plans.length > 0) rebuildMomentsFromPlans(plans);

        setMemories(liveMemories);
        setCalls(liveCalls);
      } catch {
        // agent-service unreachable — mocks stay as the demo fallback.
      }
    })();
  }, [rebuildMomentsFromPlans]);

  // Close any open live-call monitor on unmount.
  useEffect(() => () => monitorRef.current?.close(), []);

  const openLiveMonitor = useCallback((momentId: string, conversationId: string) => {
    monitorRef.current?.close();
    setLiveCall({ momentId, conversationId, turns: [], status: "live" });

    const monitor = new EventSource(`${api.API_BASE}/calls/${conversationId}/stream`);
    monitorRef.current = monitor;

    const appendTurn = (role: string) => (evt: MessageEvent) => {
      let text = evt.data;
      try {
        const parsed = JSON.parse(evt.data);
        text =
          typeof parsed === "string"
            ? parsed
            : (parsed?.text ?? parsed?.message ?? JSON.stringify(parsed));
      } catch {
        // plain-string payload — use as-is.
      }
      setLiveCall((prev) =>
        prev && prev.conversationId === conversationId
          ? { ...prev, turns: [...prev.turns, { role, text }] }
          : prev,
      );
    };

    const parseText = (evt: MessageEvent): string => {
      try {
        const parsed = JSON.parse(evt.data);
        return typeof parsed === "string"
          ? parsed
          : (parsed?.text ?? parsed?.message ?? JSON.stringify(parsed));
      } catch {
        return evt.data;
      }
    };

    // Agent speech arrives as growing partials, then a final agent_response.
    // Both replace the trailing agent turn so the sentence grows live without
    // stacking duplicates.
    const mergeAgentTurn = (evt: Event) => {
      const text = parseText(evt as MessageEvent);
      setLiveCall((prev) => {
        if (!prev || prev.conversationId !== conversationId) return prev;
        const turns = [...prev.turns];
        const last = turns[turns.length - 1];
        if (last?.role === "agent") {
          turns[turns.length - 1] = { role: "agent", text };
        } else {
          turns.push({ role: "agent", text });
        }
        return { ...prev, turns };
      });
    };

    monitor.addEventListener("user_transcript", appendTurn("user"));
    monitor.addEventListener("agent_response", mergeAgentTurn);
    monitor.addEventListener("agent_response_part", mergeAgentTurn);
    // enable_reasoning_summary is false in the default agent config, so this
    // rarely fires — kept anyway since it's harmless if it ever does.
    monitor.addEventListener("reasoning_summary", appendTurn("agent"));

    const endMonitor = () => {
      setLiveCall((prev) =>
        prev && prev.conversationId === conversationId
          ? { ...prev, status: "ended" }
          : prev,
      );
      monitor.close();
      if (monitorRef.current === monitor) monitorRef.current = null;
      api
        .getCalls()
        .then(setCalls)
        .catch(() => {});
    };

    monitor.addEventListener("call_ended", endMonitor);
    monitor.addEventListener("complete", endMonitor);
    // Named "error" events from the server AND native connection errors both
    // land here; only server-sent ones carry data. For native errors, end only
    // once the connection is permanently closed (EventSource auto-reconnects).
    monitor.addEventListener("error", (evt) => {
      const isServerError = (evt as MessageEvent).data !== undefined;
      if (isServerError || monitor.readyState === EventSource.CLOSED) {
        endMonitor();
      }
    });
  }, []);

  // --- Generate plans: streamed trace + live per-card decisions ---
  const generate = useCallback(() => {
    if (generating) return;
    setGenerating(true);
    setTrace([]);
    decisionsRef.current = new Map();

    (async () => {
      try {
        await api.streamPost(
          "/plans/generate/stream",
          { userId: api.USER_ID },
          (event, data) => {
            if (event === "trace") {
              setTrace((prev) => [...prev, data as TraceStep]);
            } else if (event === "event_decision") {
              const decision = data as EventDecision;
              decisionsRef.current.set(decision.eventId, decision);
              patchMomentByEvent(decision.eventId, (m) => ({
                ...m,
                decision: decisionFromPlan(decision),
                reasoningSummary: decision.reasoningSummary,
                steps: stepsFromDecision(decision),
                memoryIds: decision.selectedMemoryIds,
              }));
            } else if (event === "plans") {
              rebuildMomentsFromPlans(data as OutreachPlan[]);
            } else if (event === "error") {
              throw new Error(
                (data as { message?: string })?.message ?? "Planner stream failed",
              );
            }
          },
        );
      } catch {
        try {
          const { plans } = await api.generatePlans();
          rebuildMomentsFromPlans(plans);
        } catch {
          toast.error("Couldn't reach the planner — showing the last known feed.");
        }
      } finally {
        setGenerating(false);
      }
    })();
  }, [generating, patchMomentByEvent, rebuildMomentsFromPlans]);

  // --- Approve an ask-first moment: trigger the call, live guardrail re-check ---
  const approve = useCallback(
    (momentId: string) => {
      setCallingMomentId(momentId);
      let streamStarted = false;
      let resultHandled = false;

      const revertAndToast = (message: string) => {
        patchMoment(momentId, (m) => ({ ...m, decision: "ask_first" }));
        toast.error(message);
      };

      const handleResult = (result: CallResult) => {
        resultHandled = true;
        if (result.status === "initiated" || result.status === "completed") {
          patchMoment(momentId, (m) => ({ ...m, decision: "reach_out" }));
          setCalls((prev) => [result.call, ...prev]);
          const conversationId = result.call.conversationId;
          if (conversationId && !conversationId.startsWith("dry-run-")) {
            openLiveMonitor(momentId, conversationId);
          }
        } else if (result.status === "skipped") {
          const failed = result.safetyReport?.checks.filter((c) => !c.passed) ?? [];
          patchMoment(momentId, (m) => ({
            ...m,
            decision: "held_back",
            safetyReport: result.safetyReport ?? m.safetyReport,
            steps: [
              ...m.steps,
              ...failed.map((c) => ({
                label: "Blocked by safety",
                detail: `${c.name}${c.detail ? ` — ${c.detail}` : ""}`,
                tone: "blocked" as const,
              })),
            ],
          }));
        } else {
          revertAndToast("The call couldn't go through — please try again.");
        }
      };

      (async () => {
        try {
          await api.streamPost(
            "/calls/trigger/stream",
            { planId: momentId },
            (event, data) => {
              if (event === "started") {
                streamStarted = true;
              } else if (event === "trace") {
                const step = data as TraceStep;
                patchMoment(momentId, (m) => ({
                  ...m,
                  steps: [...m.steps, traceToMomentStep(step)],
                }));
              } else if (event === "result") {
                handleResult(data as CallResult);
              } else if (event === "error") {
                resultHandled = true;
                revertAndToast(
                  (data as { message?: string })?.message ?? "Call failed",
                );
              }
            },
          );
        } catch {
          if (!resultHandled) {
            if (!streamStarted) {
              try {
                const result = await api.triggerCall(momentId);
                handleResult(result);
              } catch {
                revertAndToast("Couldn't place the call — please try again.");
              }
            } else {
              revertAndToast("Couldn't place the call — please try again.");
            }
          }
        } finally {
          setCallingMomentId(null);
        }
      })();
    },
    [patchMoment, openLiveMonitor],
  );

  const decline = useCallback(
    (momentId: string) => patchMoment(momentId, (m) => ({ ...m, decision: "stay_quiet" })),
    [patchMoment],
  );

  const onPlaybackChange = useCallback((momentId: string, playing: boolean) => {
    setPlayingMomentId((prev) => (playing ? momentId : prev === momentId ? null : prev));
  }, []);

  const ingestText = useCallback(async (text: string) => {
    try {
      const extracted = await api.ingestText(text);
      setMemories((prev) => [
        ...(extracted.length > 0 ? extracted : [localMemoryPlaceholder("chat", text)]),
        ...prev,
      ]);
    } catch {
      setMemories((prev) => [localMemoryPlaceholder("chat", text), ...prev]);
    }
  }, []);

  const ingestAudio = useCallback(async (file: File) => {
    try {
      const { memories: extracted } = await api.uploadAudio(file);
      setMemories((prev) => [
        ...(extracted.length > 0
          ? extracted
          : [
              localMemoryPlaceholder(
                "voice_note",
                `Voice note — ${file.name} (transcription pending)`,
              ),
            ]),
        ...prev,
      ]);
    } catch {
      toast.error("Couldn't process that voice note — added as a placeholder.");
      setMemories((prev) => [
        localMemoryPlaceholder(
          "voice_note",
          `Voice note — ${file.name} (transcription pending)`,
        ),
        ...prev,
      ]);
    }
  }, []);

  const setMemoryApproved = useCallback((id: string, approved: boolean) => {
    setMemories((prev) =>
      prev.map((m) => (m.id === id ? { ...m, approvedForUse: approved } : m)),
    );
    api.approveMemory(id, approved).catch(() => {
      setMemories((prev) =>
        prev.map((m) => (m.id === id ? { ...m, approvedForUse: !approved } : m)),
      );
      toast.error("Couldn't save that — reverted.");
    });
  }, []);

  return {
    moments,
    trace,
    memories,
    calls,
    playingMomentId,
    onPlaybackChange,
    generating,
    generate,
    approve,
    decline,
    callingMomentId,
    liveCall,
    ingestText,
    ingestAudio,
    setMemoryApproved,
  };
}
