import type { ComponentType } from "react";

import type { Decision, Moment } from "@/lib/moments";

export interface MomentBodyProps {
  moment: Moment;
  onApprove?: (momentId: string) => void;
  onDecline?: (momentId: string) => void;
}

export interface DecisionMeta {
  label: string;
  badgeVariant: "default" | "secondary" | "outline";
  /** Card body for this decision; registered in commit 2. */
  Body: ComponentType<MomentBodyProps> | null;
}

export const decisionRegistry: Record<Decision, DecisionMeta> = {
  reach_out: { label: "Reaching out", badgeVariant: "default", Body: null },
  ask_first: { label: "Asking first", badgeVariant: "secondary", Body: null },
  stay_quiet: { label: "Staying quiet", badgeVariant: "outline", Body: null },
};
