"use client";

import type { Moment, TraceStep } from "@/lib/moments";

import { MomentCard } from "./moment-card";
import { PlannerTrace } from "./planner-trace";
import { useMomentActions } from "./use-moment-actions";

export function MomentFeed({
  moments: initial,
  trace,
}: {
  moments: Moment[];
  trace?: TraceStep[];
}) {
  const { moments, approve, decline, onPlaybackChange } =
    useMomentActions(initial);

  return (
    <div className="flex flex-col gap-4">
      {trace ? <PlannerTrace trace={trace} /> : null}
      {moments.map((moment) => (
        <MomentCard
          key={moment.id}
          moment={moment}
          onApprove={approve}
          onDecline={decline}
          onPlaybackChange={onPlaybackChange}
        />
      ))}
    </div>
  );
}
