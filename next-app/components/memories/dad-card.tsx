"use client";

import { useState } from "react";

import { Persona, type PersonaState } from "@/components/ai-elements/persona";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Dad's presence at the top of the Memories column. The Persona orb is the
 * primary visual, driven by feed state; a plain Avatar takes over if the
 * remote Rive asset fails to load (venue wifi).
 */
export function DadCard({ state }: { state: PersonaState }) {
  const [riveFailed, setRiveFailed] = useState(false);

  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        {riveFailed ? (
          <Avatar className="size-16">
            <AvatarFallback className="text-lg">D</AvatarFallback>
          </Avatar>
        ) : (
          <div className="size-16 shrink-0">
            <Persona
              state={state}
              className="size-16"
              onLoadError={() => setRiveFailed(true)}
            />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <span className="font-heading text-base font-medium">Dad</span>
          <Badge variant="secondary">
            {state === "speaking" ? "Speaking" : "Voice ready"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
