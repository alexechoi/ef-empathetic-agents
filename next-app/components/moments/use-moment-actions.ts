"use client";

import { useMemo, useState } from "react";

import type { Decision, Moment } from "@/lib/moments";

/**
 * Single home for feed-level state: decision overrides (approve/decline) and
 * which moment's audio is playing. Backend wiring later swaps these internals
 * (approve -> POST /calls { planId }) without touching any component.
 */
export function useMomentActions(initial: Moment[]) {
  const [overrides, setOverrides] = useState<Record<string, Decision>>({});
  const [playingMomentId, setPlayingMomentId] = useState<string | null>(null);

  const moments = useMemo(
    () =>
      initial.map((m) =>
        overrides[m.id] ? { ...m, decision: overrides[m.id] } : m,
      ),
    [initial, overrides],
  );

  const approve = (momentId: string) =>
    setOverrides((prev) => ({ ...prev, [momentId]: "reach_out" }));

  const decline = (momentId: string) =>
    setOverrides((prev) => ({ ...prev, [momentId]: "stay_quiet" }));

  const onPlaybackChange = (momentId: string, playing: boolean) =>
    setPlayingMomentId((prev) =>
      playing ? momentId : prev === momentId ? null : prev,
    );

  return { moments, approve, decline, playingMomentId, onPlaybackChange };
}
