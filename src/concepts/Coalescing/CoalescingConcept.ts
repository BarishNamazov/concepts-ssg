import type { ID } from "@utils/types.ts";

type Context = ID;

interface ContextDoc {
  _id: Context;
  active: boolean;
  pending: boolean;
  pendingKind?: string;
}

/**
 * Coalescing [Context]
 *
 * **purpose** serialize repeated requests for a context while retaining at most
 *   one follow-up request when work is already active
 *
 * **principle** after a request starts work for a context, later requests made
 *   before that work finishes are coalesced into one pending request; finishing
 *   active work either starts that pending request or returns the context to idle
 */
export default class CoalescingConcept {
  private contexts = new Map<Context, ContextDoc>();

  /**
   * request ({ context, kind }): ({ context, kind, started }) | ({ context, kind, queued })
   *
   * **requires** `context` is provided
   *
   * **effects** starts work if the context is idle; otherwise records one
   *   pending request for the context
   */
  async request({
    context,
    kind,
  }: {
    context: Context;
    kind: string;
  }): Promise<
    | { context: Context; kind: string; started: true }
    | { context: Context; kind: string; queued: true }
    | { error: string }
  > {
    if (context === "") return { error: "Context is required" };

    const doc = this.contexts.get(context);
    if (doc === undefined || !doc.active) {
      this.contexts.set(context, {
        _id: context,
        active: true,
        pending: false,
      });
      return { context, kind, started: true };
    }

    doc.pending = true;
    doc.pendingKind = kind;
    return { context, kind, queued: true };
  }

  /**
   * finish ({ context }): ({ context, kind, started }) | ({ context, idle })
   *
   * **requires** `context` has active work
   *
   * **effects** if a request was queued, starts one coalesced follow-up;
   *   otherwise marks the context idle
   */
  async finish({
    context,
  }: {
    context: Context;
  }): Promise<
    | { context: Context; kind: string; started: true }
    | { context: Context; idle: true }
    | { error: string }
  > {
    const doc = this.contexts.get(context);
    if (doc === undefined || !doc.active) {
      return { error: `No active work for context: ${context}` };
    }

    if (doc.pending) {
      const kind = doc.pendingKind ?? "queued";
      doc.pending = false;
      delete doc.pendingKind;
      return { context, kind, started: true };
    }

    doc.active = false;
    return { context, idle: true };
  }

  async _get({ context }: { context: Context }): Promise<
    {
      active: boolean;
      pending: boolean;
      pendingKind?: string;
    }[]
  > {
    const doc = this.contexts.get(context);
    if (doc === undefined) return [];
    return [
      {
        active: doc.active,
        pending: doc.pending,
        pendingKind: doc.pendingKind,
      },
    ];
  }
}
