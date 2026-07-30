"use client";

import type { Moment, TraceStep } from "@/lib/moments";

import type { MomentBodyProps } from "./decision-registry";
import { MomentCard } from "./moment-card";
import { PlannerTrace } from "./planner-trace";

type MomentFeedProps = Omit<MomentBodyProps, "moment"> & {
  moments: Moment[];
  trace?: TraceStep[];
};

/** Presentational feed: state lives in MomentsScreen via useMomentActions. */
export function MomentFeed({ moments, trace, ...callbacks }: MomentFeedProps) {
  return (
    <div className="flex flex-col gap-4">
      {trace ? <PlannerTrace trace={trace} /> : null}
      {moments.map((moment) => (
        <MomentCard key={moment.id} moment={moment} {...callbacks} />
      ))}
    </div>
  );
}
