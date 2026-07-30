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
  Body: ComponentType<MomentBodyProps>;
}

export const decisionRegistry: Record<Decision, DecisionMeta> = {
  reach_out: { label: "Reaching out", badgeVariant: "default", Body: ReachOutBody },
  ask_first: { label: "Asking first", badgeVariant: "secondary", Body: AskFirstBody },
  stay_quiet: { label: "Staying quiet", badgeVariant: "outline", Body: StayQuietBody },
  held_back: { label: "Held back", badgeVariant: "destructive", Body: HeldBackBody },
};
