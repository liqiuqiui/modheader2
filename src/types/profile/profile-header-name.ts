/** RFC 9110 field-name = token, and the headers a DNR rule may not touch. */

/**
 * `tchar` from RFC 9110 section 5.6.2. A header name containing anything else
 * is rejected by `updateSessionRules`, so catching it in the editor turns an
 * opaque background failure into a visible, local one.
 */
const HEADER_NAME_TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

/**
 * Headers the browser owns. Modifying them either fails silently or breaks the
 * request, so the editor refuses them up front. `:pseudo` headers are reserved
 * by fetch and are never script-settable.
 */
export const PROTECTED_HEADER_NAMES: ReadonlySet<string> = new Set([
  ":authority",
  ":method",
  ":path",
  ":scheme",
  ":status",
  ":target",
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

/** Headers that are legal but need an explicit opt-in, because they routinely
 * carry credentials and are frequently broken by hand-editing. */
export const CREDENTIAL_HEADER_NAMES: ReadonlySet<string> = new Set([
  "authorization",
  "cookie",
  "proxy-authorization",
  "set-cookie",
]);

export type HeaderNameProblem = "empty" | "syntax" | "protected" | "credentials";

export interface HeaderNameCheck {
  ok: boolean;
  problem?: HeaderNameProblem;
  /** Lower-cased name, present whenever the name is syntactically usable. */
  normalized?: string;
}

/**
 * Classifies a header name so the UI can explain *why* a name is refused
 * instead of only reporting that Chrome rejected the rule.
 */
export function checkHeaderName(value: string): HeaderNameCheck {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return { ok: false, problem: "empty" };
  // Protected names are checked first: `:authority` and friends fail the token
  // rule because of the leading colon, and "managed by the browser" is a far
  // more useful message than "not a valid header name".
  if (PROTECTED_HEADER_NAMES.has(normalized))
    return { ok: false, problem: "protected", normalized };
  if (!HEADER_NAME_TOKEN.test(normalized)) return { ok: false, problem: "syntax" };
  return { ok: true, normalized };
}

/** Whether a rule with this name may be sent to DNR at all. Credential headers
 * are allowed: they are a legitimate thing to override when debugging. */
export function isCompilableHeaderName(value: string): boolean {
  return checkHeaderName(value).ok;
}

/** Cookie headers have their own editor, so writing them as a plain header rule
 * would silently fight the cookie section. */
export function isCookieManagedHeaderName(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "cookie" || normalized === "set-cookie";
}
