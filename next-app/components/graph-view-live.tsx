"use client";

import { useEffect, useState } from "react";

import { GraphView } from "@/components/graph-view";
import { getMemoryGraph, USER_ID } from "@/lib/api";
import type { KnowledgeGraph } from "@/lib/moments";

/**
 * Client wrapper around GraphView: renders the `initial` (mock) graph
 * immediately, then swaps in the live `GET /memories/graph` result once it
 * loads. Any fetch failure is silently ignored — the mock graph stays.
 */
export function GraphViewLive({ initial }: { initial: KnowledgeGraph }) {
  const [graph, setGraph] = useState<KnowledgeGraph>(initial);

  useEffect(() => {
    getMemoryGraph(USER_ID)
      .then(setGraph)
      .catch(() => {});
  }, []);

  return <GraphView graph={graph} />;
}
