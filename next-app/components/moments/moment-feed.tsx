"use client";

import type { LiveCallState } from "@/components/moments/use-moment-actions";
import type { Moment, TraceStep } from "@/lib/moments";

import type { MomentBodyProps } from "./decision-registry";
import { MomentCard } from "./moment-card";
import { PlannerTrace } from "./planner-trace";

type MomentFeedProps = Omit<MomentBodyProps, "moment"> & {
  moments: Moment[];
  trace?: TraceStep[];
  callingMomentId?: string | null;
  liveCall?: LiveCallState | null;
};

/** Presentational feed: state lives in MomentsScreen via useMomentActions. */
export function MomentFeed({
  moments,
  trace,
  callingMomentId,
  liveCall,
  ...callbacks
}: MomentFeedProps) {
  return (
    <div className="flex flex-col gap-4">
      {trace && trace.length > 0 ? <PlannerTrace trace={trace} /> : null}
      {moments.map((moment) => (
        <MomentCard
          key={moment.id}
          moment={moment}
          calling={callingMomentId === moment.id}
          liveCall={liveCall?.momentId === moment.id ? liveCall : undefined}
          {...callbacks}
        />
      ))}
    </div>
  );
}
