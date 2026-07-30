"use client";

import { useState } from "react";

import type { PersonaState } from "@/components/ai-elements/persona";
import { MemoriesColumn } from "@/components/memories/memories-column";
import { MomentFeed } from "@/components/moments/moment-feed";
import { useMomentActions } from "@/components/moments/use-moment-actions";
import type { CallRecord, Memory, Moment, TraceStep } from "@/lib/moments";

/**
 * The main screen: Moments (left) + Memories (right), each its own scroll
 * container. Owns all feed-level state so the Dad orb can react to playback
 * without prop drilling; commit 4 swaps the state internals for live API data.
 */
export function MomentsScreen({
  initialMoments,
  trace,
  initialMemories,
  initialCalls,
}: {
  initialMoments: Moment[];
  trace?: TraceStep[];
  initialMemories: Memory[];
  initialCalls: CallRecord[];
}) {
  const { moments, approve, decline, playingMomentId, onPlaybackChange } =
    useMomentActions(initialMoments);
  const [memories, setMemories] = useState(initialMemories);

  const dadState: PersonaState = playingMomentId
    ? "speaking"
    : moments.some((m) => m.decision === "ask_first")
      ? "thinking"
      : "idle";

  const addMemory = (memory: Memory) => setMemories((prev) => [memory, ...prev]);

  const onIngestText = (text: string) =>
    addMemory({
      id: `mem-local-${Date.now()}`,
      sourceType: "chat",
      summary: text,
      themes: ["unsorted"],
      emotionalTone: "neutral",
      approvedForUse: false,
    });

  const onIngestAudio = (file: File) =>
    addMemory({
      id: `mem-local-${Date.now()}`,
      sourceType: "voice_note",
      summary: `Voice note — ${file.name} (transcription pending)`,
      themes: ["unsorted"],
      emotionalTone: "neutral",
      approvedForUse: false,
    });

  const onApprovedChange = (id: string, approved: boolean) =>
    setMemories((prev) =>
      prev.map((m) => (m.id === id ? { ...m, approvedForUse: approved } : m)),
    );

  return (
    <div className="lg:grid lg:h-[calc(100svh-var(--header-height)-1rem-2px)] lg:grid-cols-[3fr_2fr] lg:overflow-hidden">
      <div className="min-w-0 p-4 lg:overflow-y-auto lg:p-6">
        <div className="mx-auto w-full max-w-2xl">
          <MomentFeed
            moments={moments}
            trace={trace}
            onApprove={approve}
            onDecline={decline}
            onPlaybackChange={onPlaybackChange}
          />
        </div>
      </div>
      <div className="border-t p-4 lg:overflow-y-auto lg:border-t-0 lg:border-l lg:p-6">
        <MemoriesColumn
          dadState={dadState}
          memories={memories}
          calls={initialCalls}
          onIngestText={onIngestText}
          onIngestAudio={onIngestAudio}
          onApprovedChange={onApprovedChange}
        />
      </div>
    </div>
  );
}
