"use client";

import { FileTextIcon, MessageSquareIcon, MicIcon, CalendarIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { Memory, SourceType } from "@/lib/moments";

const sourceIcons: Record<SourceType, typeof MicIcon> = {
  voice_note: MicIcon,
  chat: MessageSquareIcon,
  written: FileTextIcon,
  calendar: CalendarIcon,
};

export function MemoryCard({
  memory,
  onApprovedChange,
}: {
  memory: Memory;
  onApprovedChange: (id: string, approved: boolean) => void;
}) {
  const Icon = sourceIcons[memory.sourceType];

  return (
    <Card size="sm" className={cn(!memory.approvedForUse && "opacity-60")}>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="flex-1 text-sm">{memory.summary}</p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {memory.themes.slice(0, 3).map((theme) => (
              <Badge key={theme} variant="outline">
                {theme}
              </Badge>
            ))}
          </div>
          <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
            Approved
            <Switch
              checked={memory.approvedForUse}
              onCheckedChange={(checked) =>
                onApprovedChange(memory.id, Boolean(checked))
              }
            />
          </label>
        </div>
      </CardContent>
    </Card>
  );
}
