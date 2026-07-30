"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import type { Moment } from "@/lib/moments";

import { decisionRegistry } from "./decision-registry";

const dayKey = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

/**
 * The next 7 days as a compact strip — the "agent knows your calendar" visual.
 * Each day shows dots colored by the decision of moments falling on it.
 * Rendered after mount only: "today" depends on the client clock.
 */
export function WeekStrip({ moments }: { moments: Moment[] }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  if (!now) return <div aria-hidden className="h-16" />;

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now);
    date.setDate(now.getDate() + i);
    const key = dayKey(date);
    const dots = moments
      .filter((m) => m.startsAt && dayKey(new Date(m.startsAt)) === key)
      .slice(0, 3);
    return { date, key, dots, isToday: i === 0 };
  });

  return (
    <div className="grid grid-cols-7 gap-1.5">
      {days.map((day) => (
        <div
          key={day.key}
          className={cn(
            "flex flex-col items-center gap-1 rounded-lg border py-2",
            day.isToday
              ? "border-foreground/20 bg-muted/50"
              : "border-transparent",
          )}
        >
          <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            {day.date.toLocaleDateString("en-GB", { weekday: "short" })}
          </span>
          <span className="text-sm font-medium">{day.date.getDate()}</span>
          <div className="flex h-1.5 items-center gap-1">
            {day.dots.map((m) => (
              <span
                key={m.id}
                title={m.title}
                className={cn(
                  "size-1.5 rounded-full",
                  decisionRegistry[m.decision].dotClassName,
                )}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
