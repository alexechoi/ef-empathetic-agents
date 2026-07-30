import { classifyEventKind } from "../nodes/evaluateImportance.js";
import {
  KnowledgeGraphSchema,
  type CalendarEvent,
  type KnowledgeGraph,
  type KnowledgeGraphEdge,
  type KnowledgeGraphNode,
  type Memory,
} from "../schemas.js";

function entityId(type: "person" | "theme", value: string): string {
  return `${type}:${encodeURIComponent(value.trim().toLowerCase())}`;
}

/**
 * Projects canonical memories and events into a deterministic frontend graph.
 * This is deliberately computed on read: SQLite remains the only data store.
 * Transcripts are never included in graph metadata.
 */
export function buildMemoryGraph(
  memories: Memory[],
  events: CalendarEvent[],
): KnowledgeGraph {
  const nodes = new Map<string, KnowledgeGraphNode>();
  const edges = new Map<string, KnowledgeGraphEdge>();

  const addNode = (node: KnowledgeGraphNode) => nodes.set(node.id, node);
  const addEdge = (edge: KnowledgeGraphEdge) => edges.set(edge.id, edge);

  for (const event of events) {
    addNode({
      id: `event:${event.id}`,
      type: "event",
      label: event.title,
      metadata: {
        startsAt: event.startsAt,
        eventKind: classifyEventKind(event),
      },
    });
  }

  for (const memory of memories) {
    const memoryId = `memory:${memory.id}`;
    addNode({
      id: memoryId,
      type: "memory",
      label: memory.summary,
      metadata: {
        sourceType: memory.sourceType,
        emotionalTone: memory.emotionalTone,
        sensitivity: memory.sensitivity,
        approvedForUse: memory.approvedForUse,
      },
    });

    for (const person of memory.people.filter((value) => value.trim())) {
      const personId = entityId("person", person);
      addNode({
        id: personId,
        type: "person",
        label: person.trim(),
        metadata: {},
      });
      addEdge({
        id: `${memoryId}:MENTIONS:${personId}`,
        source: memoryId,
        target: personId,
        type: "MENTIONS",
      });
    }

    for (const theme of memory.themes.filter((value) => value.trim())) {
      const themeId = entityId("theme", theme);
      addNode({
        id: themeId,
        type: "theme",
        label: theme.trim(),
        metadata: {},
      });
      addEdge({
        id: `${memoryId}:HAS_THEME:${themeId}`,
        source: memoryId,
        target: themeId,
        type: "HAS_THEME",
      });
    }

    const relatedKinds = new Set(
      memory.relatedEvents.map((kind) => kind.trim().toLowerCase()),
    );
    for (const event of events) {
      if (!relatedKinds.has(classifyEventKind(event))) continue;
      const eventId = `event:${event.id}`;
      addEdge({
        id: `${memoryId}:RELATES_TO:${eventId}`,
        source: memoryId,
        target: eventId,
        type: "RELATES_TO",
      });
    }
  }

  return KnowledgeGraphSchema.parse({
    nodes: [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id)),
    edges: [...edges.values()].sort((a, b) => a.id.localeCompare(b.id)),
  });
}
