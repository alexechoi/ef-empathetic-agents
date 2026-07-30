"use client";

import { Loader2Icon, ShieldAlertIcon } from "lucide-react";

import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtStep,
} from "@/components/ai-elements/chain-of-thought";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { MomentStep } from "@/lib/moments";

import { decisionRegistry, type MomentBodyProps } from "./decision-registry";
import { LiveCall } from "./live-call";
import type { LiveCallState } from "./use-moment-actions";

const stepStatus = { ok: "complete", muted: "pending", blocked: "complete" } as const;

function DeliberationStep({ step }: { step: MomentStep }) {
  return (
    <ChainOfThoughtStep
      label={step.label}
      description={step.detail}
      status={stepStatus[step.tone]}
      icon={step.tone === "blocked" ? ShieldAlertIcon : undefined}
      className={cn(step.tone === "blocked" && "text-destructive")}
    />
  );
}

export type MomentCardProps = MomentBodyProps & {
  /** Pre-expand the deliberation — threaded for the demo's hero card. */
  defaultOpenReasoning?: boolean;
  /** True while this moment's call is being triggered — swaps in a spinner badge. */
  calling?: boolean;
  /** Present once this moment's live call is being monitored. */
  liveCall?: LiveCallState;
};

export function MomentCard({
  moment,
  defaultOpenReasoning = false,
  calling = false,
  liveCall,
  ...callbacks
}: MomentCardProps) {
  const { label, badgeVariant, Body } = decisionRegistry[moment.decision];
  const quiet = moment.decision === "stay_quiet";

  return (
    <Card
      size={quiet ? "sm" : "default"}
      className={cn(quiet && "opacity-70")}
    >
      <CardHeader>
        <CardTitle>{moment.title}</CardTitle>
        <CardDescription>{moment.when}</CardDescription>
        <CardAction>
          {calling ? (
            <Badge variant="secondary" className="gap-1.5">
              <Loader2Icon className="size-3 animate-spin" />
              Calling…
            </Badge>
          ) : (
            <Badge variant={badgeVariant}>{label}</Badge>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{moment.reasoningSummary}</p>
        <ChainOfThought defaultOpen={defaultOpenReasoning}>
          <ChainOfThoughtHeader>How it decided</ChainOfThoughtHeader>
          <ChainOfThoughtContent>
            {moment.steps.map((step, i) => (
              <DeliberationStep key={i} step={step} />
            ))}
          </ChainOfThoughtContent>
        </ChainOfThought>
        <Body moment={moment} {...callbacks} />
        {liveCall ? <LiveCall liveCall={liveCall} /> : null}
      </CardContent>
    </Card>
  );
}
