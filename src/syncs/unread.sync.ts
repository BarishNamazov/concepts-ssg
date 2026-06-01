/**
 * Unread (Tracking) synchronizations.
 *
 * Endpoints:
 *   POST /unread/list        { session, scope } -> { items }
 *   POST /unread/count       { session, scope } -> { count }
 *   POST /unread/markSeen    { session, item }  -> { item }
 *   POST /unread/markAllSeen { session, scope } -> { user }
 */
import { Sessioning, Tracking } from "@concepts";
import {
  type ActionOk,
  defineEndpoint,
  type QueryRow,
} from "@concepts/Requesting/api.ts";

type UnreadListOutput = { items: QueryRow<typeof Tracking, "_getUnread">[] };
type UnreadCountOutput = QueryRow<typeof Tracking, "_getUnreadCount">;
type MarkSeenOutput = ActionOk<typeof Tracking, "markSeen">;
type MarkAllSeenOutput = ActionOk<typeof Tracking, "markAllSeen">;

// --- list ---

const list = defineEndpoint(
  "/unread/list",
  ({ Sync, Actions, Request, Respond }) => ({
    UnreadListResponse: Sync(({ session, scope, user, item, items }) => ({
      when: Actions(Request({ session, scope })),
      where: async (frames) => {
        const [base] = frames;
        frames = await frames.query(Sessioning._getUser, { session }, { user });
        frames = await frames.query(
          Tracking._getUnread,
          { user, scope },
          { item },
        );
        return frames.aggregate(base, [item], items);
      },
      then: Actions(Respond<UnreadListOutput>({ items })),
    })),
  }),
);

// --- count ---

const unreadCount = defineEndpoint(
  "/unread/count",
  ({ Sync, Actions, Request, Respond }) => ({
    UnreadCountResponse: Sync(({ session, scope, user, count }) => ({
      when: Actions(Request({ session, scope })),
      where: async (frames) => {
        frames = await frames.query(Sessioning._getUser, { session }, { user });
        return await frames.query(
          Tracking._getUnreadCount,
          { user, scope },
          { count },
        );
      },
      then: Actions(Respond<UnreadCountOutput>({ count })),
    })),
  }),
);

// --- markSeen ---

const markSeen = defineEndpoint(
  "/unread/markSeen",
  ({ Sync, Actions, Request, Respond, Fail }) => ({
    UnreadMarkSeenRequest: Sync(({ session, item, user }) => ({
      when: Actions(Request({ session, item })),
      where: async (frames) =>
        await frames.query(Sessioning._getUser, { session }, { user }),
      then: Actions([Tracking.markSeen, { user, item }]),
    })),

    UnreadMarkSeenResponse: Sync(({ item }) => ({
      when: Actions([Tracking.markSeen, {}, { item }]),
      then: Actions(Respond<MarkSeenOutput>({ item })),
    })),

    UnreadMarkSeenError: Sync(({ error }) => ({
      when: Actions([Tracking.markSeen, {}, { error }]),
      then: Actions(Fail(error)),
    })),
  }),
);

// --- markAllSeen ---

const markAllSeen = defineEndpoint(
  "/unread/markAllSeen",
  ({ Sync, Actions, Request, Respond }) => ({
    UnreadMarkAllSeenRequest: Sync(({ session, scope, user }) => ({
      when: Actions(Request({ session, scope })),
      where: async (frames) =>
        await frames.query(Sessioning._getUser, { session }, { user }),
      then: Actions([Tracking.markAllSeen, { user, scope }]),
    })),

    UnreadMarkAllSeenResponse: Sync(({ user }) => ({
      when: Actions([Tracking.markAllSeen, {}, { user }]),
      then: Actions(Respond<MarkAllSeenOutput>({ user })),
    })),
  }),
);

export const unreadApi = {
  list,
  count: unreadCount,
  markSeen,
  markAllSeen,
};
