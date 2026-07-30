import { PhoneIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { CallRecord, CallStatus } from "@/lib/moments";

const statusVariant: Record<
  CallStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  initiated: "default",
  completed: "secondary",
  skipped: "outline",
  failed: "destructive",
};

export function RecentCalls({ calls }: { calls: CallRecord[] }) {
  if (calls.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-muted-foreground">
        Recent calls
      </h2>
      {calls.map((call) => (
        <Card key={call.id} size="sm">
          <CardContent className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <PhoneIcon className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  {call.detail ?? "Outbound call"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(call.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}
                </p>
              </div>
              <Badge variant={statusVariant[call.status]}>{call.status}</Badge>
            </div>
            {call.transcript ? (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  Transcript
                </summary>
                <pre className="mt-1 whitespace-pre-wrap text-muted-foreground">
                  {call.transcript}
                </pre>
              </details>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
