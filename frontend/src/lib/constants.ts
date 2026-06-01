/** Shared UI constants. */

/** The reaction palette offered in the picker (Discourse-style emoji set). */
export const REACTION_KINDS = [
  "👍",
  "❤️",
  "🎉",
  "😄",
  "😮",
  "🤔",
  "👀",
  "🙏",
] as const;

export type ReactionKind = (typeof REACTION_KINDS)[number];
