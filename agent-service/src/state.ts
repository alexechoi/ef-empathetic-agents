import { Annotation } from "@langchain/langgraph";

export interface Contact {
  /** Human-friendly name used to personalise the outreach. */
  name: string;
  /** Destination phone number in E.164 format, e.g. "+14155551234". */
  phoneNumber: string;
}

/**
 * The brief is the output of the decision layer (orchestrator). It captures
 * whether we should reach out and, if so, exactly what the caller agent needs.
 */
export interface Brief {
  shouldCall: boolean;
  /** Why we did / didn't decide to reach out. */
  reason: string;
  /** The goal of the call, in one sentence. */
  objective: string;
  /** Opening line the voice agent should say. */
  firstMessage: string;
  /** Runtime values injected into the ElevenLabs agent prompt. */
  dynamicVariables: Record<string, string>;
}

export type CallStatus = "initiated" | "skipped" | "failed";

export interface CallResult {
  status: CallStatus;
  /** ElevenLabs conversation id, when a call was placed. */
  conversationId?: string;
  /** Twilio call SID, when available. */
  callSid?: string;
  /** Human-readable detail (error message, simulation note, etc.). */
  detail?: string;
}

const replace = <T>(_prev: T, next: T): T => next;

/**
 * Shared graph state. Both agents read and write the same object, which
 * LangGraph checkpoints per thread so state survives across a conversation.
 */
export const AgentState = Annotation.Root({
  contact: Annotation<Contact>({ reducer: replace }),
  /** Free-text situation describing why we might reach out. */
  context: Annotation<string>({ reducer: replace, default: () => "" }),
  brief: Annotation<Brief | null>({ reducer: replace, default: () => null }),
  callResult: Annotation<CallResult | null>({
    reducer: replace,
    default: () => null,
  }),
});

export type AgentStateType = typeof AgentState.State;
export type AgentUpdate = typeof AgentState.Update;
