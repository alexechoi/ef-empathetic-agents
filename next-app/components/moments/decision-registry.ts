import type { ComponentType } from "react";

import type { Decision, Moment } from "@/lib/moments";

import { AskFirstBody } from "./bodies/ask-first-body";
import { HeldBackBody } from "./bodies/held-back-body";
import { ReachOutBody } from "./bodies/reach-out-body";
import { StayQuietBody } from "./bodies/stay-quiet-body";

export interface MomentBodyProps {
  moment: Moment;
  onApprove?: (momentId: string) => void;
  onDecline?: (momentId: string) => void;
  onPlaybackChange?: (momentId: string, playing: boolean) => void;
}

export interface DecisionMeta {
  label: string;
  badgeVariant: "default" | "secondary" | "outline" | "destructive";
  /** Semantic tint layered over the variant so decisions read at a glance. */
  badgeClassName?: string;
  /** Dot color used by the calendar week strip. */
  dotClassName: string;
  Body: ComponentType<MomentBodyProps>;
}

export const decisionRegistry: Record<Decision, DecisionMeta> = {
  reach_out: {
    label: "Reaching out",
    badgeVariant: "default",
    badgeClassName:
      "bg-blue-600 text-white dark:bg-blue-500 dark:text-blue-50",
    dotClassName: "bg-blue-600 dark:bg-blue-400",
    Body: ReachOutBody,
  },
  ask_first: {
    label: "Asking first",
    badgeVariant: "secondary",
    badgeClassName:
      "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200",
    dotClassName: "bg-amber-500",
    Body: AskFirstBody,
  },
  stay_quiet: {
    label: "Staying quiet",
    badgeVariant: "outline",
    dotClassName: "bg-muted-foreground/40",
    Body: StayQuietBody,
  },
  held_back: {
    label: "Held back",
    badgeVariant: "destructive",
    badgeClassName:
      "bg-rose-100 text-rose-900 dark:bg-rose-900/50 dark:text-rose-200",
    dotClassName: "bg-rose-500",
    Body: HeldBackBody,
  },
};
