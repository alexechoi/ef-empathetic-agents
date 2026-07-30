"use client";

import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";

import type { PersonaState } from "@/components/ai-elements/persona";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CallRecord, Memory } from "@/lib/moments";

import { DadCard } from "./dad-card";
import { IngestBox } from "./ingest-box";
import { MemoryCard } from "./memory-card";
import { RecentCalls } from "./recent-calls";

const COLLAPSED_COUNT = 3;

export function MemoriesColumn({
  dadState,
  memories,
  calls,
  onIngestText,
  onIngestAudio,
  onApprovedChange,
}: {
  dadState: PersonaState;
  memories: Memory[];
  calls: CallRecord[];
  onIngestText: (text: string) => void;
  onIngestAudio: (file: File) => void;
  onApprovedChange: (id: string, approved: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? memories : memories.slice(0, COLLAPSED_COUNT);
  const hiddenCount = memories.length - COLLAPSED_COUNT;

  return (
    <div className="flex flex-col gap-4">
      <DadCard state={dadState} />
      <IngestBox onIngestText={onIngestText} onIngestAudio={onIngestAudio} />
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          What he left behind
        </h2>
        {visible.map((memory) => (
          <MemoryCard
            key={memory.id}
            memory={memory}
            onApprovedChange={onApprovedChange}
          />
        ))}
        {hiddenCount > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            className="self-start text-muted-foreground"
            onClick={() => setExpanded((prev) => !prev)}
          >
            <ChevronDownIcon
              className={cn("transition-transform", expanded && "rotate-180")}
            />
            {expanded ? "Show less" : `Show all ${memories.length}`}
          </Button>
        ) : null}
      </div>
      <RecentCalls calls={calls} />
    </div>
  );
}
