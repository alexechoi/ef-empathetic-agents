"use client";

import {
  Confirmation,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationRequest,
  ConfirmationTitle,
} from "@/components/ai-elements/confirmation";

import type { MomentBodyProps } from "../decision-registry";

/**
 * Approved by safety, awaiting the user's go-ahead. Approve/decline flip the
 * moment's decision at feed level, so this body unmounts on either choice —
 * it only ever renders the request state.
 */
export function AskFirstBody({ moment, onApprove, onDecline }: MomentBodyProps) {
  return (
    <Confirmation
      approval={{ id: moment.id }}
      state="approval-requested"
    >
      <ConfirmationRequest>
        <ConfirmationTitle>
          {moment.purpose ??
            "Dad would usually mark this one. Want a message?"}
        </ConfirmationTitle>
      </ConfirmationRequest>
      <ConfirmationActions>
        <ConfirmationAction
          variant="outline"
          onClick={() => onDecline?.(moment.id)}
        >
          Leave it be
        </ConfirmationAction>
        <ConfirmationAction onClick={() => onApprove?.(moment.id)}>
          Yes, I&apos;d like that
        </ConfirmationAction>
      </ConfirmationActions>
    </Confirmation>
  );
}
