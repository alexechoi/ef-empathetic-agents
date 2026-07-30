import { ShieldAlertIcon } from "lucide-react";

import type { MomentBodyProps } from "../decision-registry";

/**
 * The safety layer made visible: the checks that failed, by name, with detail.
 * No audio, no actions — the system chose care.
 */
export function HeldBackBody({ moment }: MomentBodyProps) {
  const failed = moment.safetyReport?.checks.filter((c) => !c.passed) ?? [];
  if (failed.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-destructive/20 bg-destructive/5 p-3">
      {failed.map((check) => (
        <div key={check.name} className="flex items-start gap-2 text-sm">
          <ShieldAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <span className="font-medium text-destructive">
              {check.name.replaceAll("_", " ")}
            </span>
            {check.detail ? (
              <span className="text-muted-foreground"> — {check.detail}</span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
