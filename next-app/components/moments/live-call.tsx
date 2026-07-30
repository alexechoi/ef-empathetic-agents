"use client";

import { PhoneIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import type { LiveCallState } from "./use-moment-actions";

/**
 * Sanitized live-call transcript, rendered under a card while its
 * conversation is being monitored. Plain shadcn only — turns are role: text
 * lines, muted, wrapping naturally.
 */
export function LiveCall({ liveCall }: { liveCall: LiveCallState }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-center gap-2">
        <PhoneIcon className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">Live call</span>
        {liveCall.status === "live" ? (
          <Badge variant="secondary" className="gap-1.5">
            <span className="size-1.5 animate-pulse rounded-full bg-current" />
            Live
          </Badge>
        ) : (
          <Badge variant="outline">Ended</Badge>
        )}
      </div>
      {liveCall.turns.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {liveCall.status === "live" ? "Connecting…" : "Call ended."}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {liveCall.turns.map((turn, i) => (
            <p
              key={i}
              className="text-xs whitespace-pre-wrap text-muted-foreground"
            >
              <span className="font-medium text-foreground">{turn.role}:</span>{" "}
              {turn.text}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
