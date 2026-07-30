"use client";

import { ShieldAlertIcon } from "lucide-react";

import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtStep,
} from "@/components/ai-elements/chain-of-thought";
import { cn } from "@/lib/utils";
import type { TraceStep } from "@/lib/moments";

const traceStatus = {
  ok: "complete",
  info: "complete",
  skip: "pending",
  blocked: "complete",
} as const;

/** The run-level planner trace — one step per graph node, shown once per feed. */
export function PlannerTrace({ trace }: { trace: TraceStep[] }) {
  return (
    <ChainOfThought>
      <ChainOfThoughtHeader>How the planner ran</ChainOfThoughtHeader>
      <ChainOfThoughtContent>
        {trace.map((step) => (
          <ChainOfThoughtStep
            key={step.step}
            label={step.label}
            description={step.detail}
            status={traceStatus[step.status]}
            icon={step.status === "blocked" ? ShieldAlertIcon : undefined}
            className={cn(step.status === "blocked" && "text-destructive")}
          />
        ))}
      </ChainOfThoughtContent>
    </ChainOfThought>
  );
}
