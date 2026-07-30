import { StateGraph, START, END } from "@langchain/langgraph";
import { AgentState, type AgentStateType } from "./state.js";
import { orchestrator } from "./nodes/orchestrator.js";
import { caller } from "./nodes/caller.js";
import { logger } from "./lib/logger.js";

const log = logger.child({ module: "graph" });

/**
 * Routes after the decision layer: only hand off to the caller when the brief
 * says we should reach out; otherwise finish.
 */
function routeAfterBrief(state: AgentStateType): "caller" | typeof END {
  const shouldCall = state.brief?.shouldCall ?? false;
  log.info({ shouldCall }, "Routing after brief");
  return shouldCall ? "caller" : END;
}

/**
 * One orchestration service, two agents, shared state:
 *   orchestrator (decision layer) --> caller (call layer)
 */
export const graph = new StateGraph(AgentState)
  .addNode("orchestrator", orchestrator)
  .addNode("caller", caller)
  .addEdge(START, "orchestrator")
  .addConditionalEdges("orchestrator", routeAfterBrief, ["caller", END])
  .addEdge("caller", END)
  .compile();
