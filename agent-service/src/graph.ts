import { StateGraph, START, END } from "@langchain/langgraph";
import { PlannerState } from "./state.js";
import { evaluateImportance } from "./nodes/evaluateImportance.js";
import { retrieveMemories } from "./nodes/retrieveMemories.js";
import { generateProposal } from "./nodes/generateProposal.js";
import { safetyValidator } from "./nodes/safetyValidator.js";

/**
 * The planner agent as a LangGraph workflow:
 *   evaluate importance -> retrieve memories -> generate proposal -> safety.
 * Each node appends a TraceStep so callers can render the live trace.
 */
export const plannerGraph = new StateGraph(PlannerState)
  .addNode("evaluateImportance", evaluateImportance)
  .addNode("retrieveMemories", retrieveMemories)
  .addNode("generateProposal", generateProposal)
  .addNode("safetyValidator", safetyValidator)
  .addEdge(START, "evaluateImportance")
  .addEdge("evaluateImportance", "retrieveMemories")
  .addEdge("retrieveMemories", "generateProposal")
  .addEdge("generateProposal", "safetyValidator")
  .addEdge("safetyValidator", END)
  .compile();
