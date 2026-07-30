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
import type { Moment } from "@/lib/moments";

import { decisionRegistry, type MomentBodyProps } from "./decision-registry";

export type MomentCardProps = MomentBodyProps;

export function MomentCard({ moment, onApprove, onDecline }: MomentCardProps) {
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
          <Badge variant={badgeVariant}>{label}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{moment.reasoning[0]}</p>
        {Body ? (
          <Body moment={moment} onApprove={onApprove} onDecline={onDecline} />
        ) : null}
      </CardContent>
    </Card>
  );
}
