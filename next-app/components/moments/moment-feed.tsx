"use client";

import { CalendarIcon } from "lucide-react";

import type { LiveCallState } from "@/components/moments/use-moment-actions";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { Moment, TraceStep } from "@/lib/moments";

import type { MomentBodyProps } from "./decision-registry";
import { MomentCard } from "./moment-card";
import { PlannerTrace } from "./planner-trace";

type MomentFeedProps = Omit<MomentBodyProps, "moment"> & {
  moments: Moment[];
  trace?: TraceStep[];
  loading?: boolean;
  generating?: boolean;
  callingMomentId?: string | null;
  liveCall?: LiveCallState | null;
};

/** Presentational feed: state lives in MomentsScreen via useMomentActions. */
export function MomentFeed({
  moments,
  trace,
  loading = false,
  generating = false,
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
      {!loading && !generating && moments.length === 0 ? (
        <Empty className="border py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarIcon />
            </EmptyMedia>
            <EmptyTitle>Nothing planned yet</EmptyTitle>
            <EmptyDescription>
              Generate plans and this week&apos;s moments will appear here —
              each with the agent&apos;s decision to reach out, ask first, or
              stay quiet.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}
    </div>
  );
}
