"use client";

import { Loader2Icon, SparklesIcon } from "lucide-react";

import type { PersonaState } from "@/components/ai-elements/persona";
import { MemoriesColumn } from "@/components/memories/memories-column";
import { Button } from "@/components/ui/button";
import { MomentFeed } from "@/components/moments/moment-feed";
import { useMomentActions } from "@/components/moments/use-moment-actions";
import type { CallRecord, Memory, Moment, TraceStep } from "@/lib/moments";

/**
 * The main screen: Moments (left) + Memories (right), each its own scroll
 * container. All state lives in useMomentActions — mock props seed it and
 * are the fallback if agent-service is unreachable.
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
  const {
    moments,
    trace: liveTrace,
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
  } = useMomentActions({
    initialMoments,
    initialTrace: trace ?? [],
    initialMemories,
    initialCalls,
  });

  const dadState: PersonaState = playingMomentId
    ? "speaking"
    : moments.some((m) => m.decision === "ask_first")
      ? "thinking"
      : "idle";

  return (
    <div className="lg:grid lg:h-[calc(100svh-var(--header-height)-1rem-2px)] lg:grid-cols-[3fr_2fr] lg:overflow-hidden">
      <div className="min-w-0 p-4 lg:overflow-y-auto lg:p-6">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          <div className="flex items-center justify-between">
            <h1 className="text-sm font-medium text-muted-foreground">
              This week
            </h1>
            <Button size="sm" onClick={generate} disabled={generating}>
              {generating ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <SparklesIcon />
              )}
              Generate plans
            </Button>
          </div>
          <MomentFeed
            moments={moments}
            trace={liveTrace}
            onApprove={approve}
            onDecline={decline}
            onPlaybackChange={onPlaybackChange}
            callingMomentId={callingMomentId}
            liveCall={liveCall}
          />
        </div>
      </div>
      <div className="border-t p-4 lg:overflow-y-auto lg:border-t-0 lg:border-l lg:p-6">
        <MemoriesColumn
          dadState={dadState}
          memories={memories}
          calls={calls}
          onIngestText={ingestText}
          onIngestAudio={ingestAudio}
          onApprovedChange={setMemoryApproved}
        />
      </div>
    </div>
  );
}
