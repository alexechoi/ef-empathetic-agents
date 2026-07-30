"use client";

import { useMemo } from "react";
import type { NodeProps as FlowNodeProps, NodeTypes, EdgeTypes } from "@xyflow/react";

import { Canvas } from "@/components/ai-elements/canvas";
import { Edge } from "@/components/ai-elements/edge";
import {
  Node,
  NodeDescription,
  NodeHeader,
  NodeTitle,
} from "@/components/ai-elements/node";
import { Badge } from "@/components/ui/badge";
import type { KnowledgeGraph, KnowledgeGraphNode } from "@/lib/moments";

const typeLabel: Record<KnowledgeGraphNode["type"], string> = {
  memory: "Memory",
  person: "Person",
  theme: "Theme",
  event: "Event",
};

function GraphNode({ data }: FlowNodeProps) {
  const node = data as unknown as KnowledgeGraphNode;
  const isMemory = node.type === "memory";

  return (
    <Node
      handles={{ source: isMemory, target: !isMemory }}
      className={isMemory ? "w-sm" : "w-56"}
    >
      <NodeHeader>
        <NodeTitle className="text-sm">
          {isMemory
            ? String(node.metadata.sourceType ?? "memory").replaceAll("_", " ")
            : node.label}
        </NodeTitle>
        <NodeDescription>
          <Badge variant="outline">{typeLabel[node.type]}</Badge>
        </NodeDescription>
      </NodeHeader>
      {isMemory ? (
        <div className="p-3 text-sm text-muted-foreground">{node.label}</div>
      ) : null}
    </Node>
  );
}

const nodeTypes: NodeTypes = { graph: GraphNode };
const edgeTypes: EdgeTypes = { animated: Edge.Animated };

/**
 * Renders the backend's KnowledgeGraph shape: memories on the left (sources),
 * people/themes/events on the right (targets). Positions are computed here —
 * the API sends none.
 */
export function GraphView({ graph }: { graph: KnowledgeGraph }) {
  const { nodes, edges } = useMemo(() => {
    const memories = graph.nodes.filter((n) => n.type === "memory");
    const entities = graph.nodes.filter((n) => n.type !== "memory");

    const positioned = [
      ...memories.map((n, i) => ({
        id: n.id,
        type: "graph",
        position: { x: 0, y: i * 190 },
        data: n as unknown as Record<string, unknown>,
      })),
      ...entities.map((n, i) => ({
        id: n.id,
        type: "graph",
        position: { x: 560, y: i * 110 },
        data: n as unknown as Record<string, unknown>,
      })),
    ];

    const flowEdges = graph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: "animated",
    }));

    return { nodes: positioned, edges: flowEdges };
  }, [graph]);

  return (
    <div className="h-[calc(100svh-var(--header-height)-1rem-2px)]">
      <Canvas
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable
      />
    </div>
  );
}
