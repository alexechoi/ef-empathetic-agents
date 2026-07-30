"use client";

import type { PersonaState } from "@/components/ai-elements/persona";
import type { CallRecord, Memory } from "@/lib/moments";

import { DadCard } from "./dad-card";
import { IngestBox } from "./ingest-box";
import { MemoryCard } from "./memory-card";
import { RecentCalls } from "./recent-calls";

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
  return (
    <div className="flex flex-col gap-4">
      <DadCard state={dadState} />
      <IngestBox onIngestText={onIngestText} onIngestAudio={onIngestAudio} />
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          What he left behind
        </h2>
        {memories.map((memory) => (
          <MemoryCard
            key={memory.id}
            memory={memory}
            onApprovedChange={onApprovedChange}
          />
        ))}
      </div>
      <RecentCalls calls={calls} />
    </div>
  );
}
