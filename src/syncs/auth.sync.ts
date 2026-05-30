/**
 * Authentication & session synchronizations.
 *
 * Endpoints:
 *   POST /auth/register  { username, password, displayName } -> { user }
 *   POST /auth/login     { username, password }              -> { session, user }
 *   POST /auth/logout    { session }                         -> { ok }
 *   POST /auth/me        { session }                         -> { user, username, profile }
 *   POST /auth/changePassword { session, oldPassword, newPassword } -> { user }
 */
import { actions, type Sync } from "@engine";
import { Authenticating, Profiling, Requesting, Sessioning } from "@concepts";

// --- register: create credentials, then a profile, then respond ---

export const RegisterRequest: Sync = ({ request, username, password }) => ({
  when: actions([
    Requesting.request,
    { path: "/auth/register", username, password },
    { request },
  ]),
  then: actions([Authenticating.register, { username, password }]),
});

export const RegisterCreatesProfile: Sync = (
  { request, displayName, user },
) => ({
  when: actions(
    [Requesting.request, { path: "/auth/register", displayName }, { request }],
    [Authenticating.register, {}, { user }],
  ),
  then: actions([Profiling.createProfile, { user, displayName }]),
});

export const RegisterResponse: Sync = ({ request, user }) => ({
  when: actions(
    [Requesting.request, { path: "/auth/register" }, { request }],
    [Authenticating.register, {}, { user }],
  ),
  then: actions([Requesting.respond, { request, user }]),
});

export const RegisterError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/auth/register" }, { request }],
    [Authenticating.register, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// --- login: authenticate, then open a session ---

export const LoginRequest: Sync = ({ request, username, password }) => ({
  when: actions([
    Requesting.request,
    { path: "/auth/login", username, password },
    { request },
  ]),
  then: actions([Authenticating.authenticate, { username, password }]),
});

export const LoginStartsSession: Sync = ({ request, user }) => ({
  when: actions(
    [Requesting.request, { path: "/auth/login" }, { request }],
    [Authenticating.authenticate, {}, { user }],
  ),
  then: actions([Sessioning.start, { user }]),
});

export const LoginResponse: Sync = ({ request, user, session }) => ({
  when: actions(
    [Requesting.request, { path: "/auth/login" }, { request }],
    [Authenticating.authenticate, {}, { user }],
    [Sessioning.start, {}, { session }],
  ),
  then: actions([Requesting.respond, { request, session, user }]),
});

export const LoginError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/auth/login" }, { request }],
    [Authenticating.authenticate, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// --- logout: end the session ---

export const LogoutRequest: Sync = ({ request, session }) => ({
  when: actions([
    Requesting.request,
    { path: "/auth/logout", session },
    { request },
  ]),
  then: actions([Sessioning.end, { session }]),
});

export const LogoutResponse: Sync = ({ request, session }) => ({
  when: actions(
    [Requesting.request, { path: "/auth/logout" }, { request }],
    [Sessioning.end, {}, { session }],
  ),
  then: actions([Requesting.respond, { request, ok: true }]),
});

export const LogoutError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/auth/logout" }, { request }],
    [Sessioning.end, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// --- me: resolve the session to the current user and profile ---

export const MeResponse: Sync = (
  { request, session, user, username, profile },
) => ({
  when: actions([
    Requesting.request,
    { path: "/auth/me", session },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(Sessioning._getUser, { session }, { user });
    frames = await frames.query(Authenticating._getById, { user }, { username });
    return await frames.query(Profiling._getProfile, { user }, { profile });
  },
  then: actions([Requesting.respond, { request, user, username, profile }]),
});

export const MeInvalidSession: Sync = ({ request, session, active }) => ({
  when: actions([
    Requesting.request,
    { path: "/auth/me", session },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(Sessioning._isActive, { session }, { active });
    return frames.filter(($) => $[active] === false);
  },
  then: actions([
    Requesting.respond,
    { request, error: "Invalid or expired session." },
  ]),
});

// --- changePassword: resolve session, change credentials (auth-only) ---

export const ChangePasswordRequest: Sync = (
  { request, session, oldPassword, newPassword, user },
) => ({
  when: actions([
    Requesting.request,
    { path: "/auth/changePassword", session, oldPassword, newPassword },
    { request },
  ]),
  where: async (frames) =>
    await frames.query(Sessioning._getUser, { session }, { user }),
  then: actions([
    Authenticating.changePassword,
    { user, oldPassword, newPassword },
  ]),
});

export const ChangePasswordResponse: Sync = ({ request, user }) => ({
  when: actions(
    [Requesting.request, { path: "/auth/changePassword" }, { request }],
    [Authenticating.changePassword, {}, { user }],
  ),
  then: actions([Requesting.respond, { request, user }]),
});

export const ChangePasswordError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/auth/changePassword" }, { request }],
    [Authenticating.changePassword, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

export const ChangePasswordInvalidSession: Sync = (
  { request, session, active },
) => ({
  when: actions([
    Requesting.request,
    { path: "/auth/changePassword", session },
    { request },
  ]),
  where: async (frames) => {
    frames = await frames.query(Sessioning._isActive, { session }, { active });
    return frames.filter(($) => $[active] === false);
  },
  then: actions([
    Requesting.respond,
    { request, error: "Invalid or expired session." },
  ]),
});
