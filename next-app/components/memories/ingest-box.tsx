"use client";

import { useRef, useState } from "react";
import { MicIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export function IngestBox({
  onIngestText,
  onIngestAudio,
}: {
  onIngestText: (text: string) => void;
  onIngestAudio: (file: File) => void;
}) {
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const submitText = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onIngestText(trimmed);
    setText("");
  };

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Add a memory</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Textarea
          placeholder="Paste a chat, or something he used to say…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
        />
        <div className="flex items-center justify-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onIngestAudio(file);
              e.target.value = "";
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            <MicIcon /> Voice note
          </Button>
          <Button size="sm" onClick={submitText} disabled={!text.trim()}>
            <PlusIcon /> Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
