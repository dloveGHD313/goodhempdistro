import { FORM_TS_FIELD, HONEYPOT_FIELD } from "@/lib/server/antiSpam";

/**
 * Invisible anti-bot fields for server-rendered forms.
 * - Honeypot input real users never see or fill (bots auto-fill it).
 * - Render timestamp so submissions faster than a human types are rejected.
 * Pair with formSpamCheck() in the form's server action.
 */
export default function FormSpamGuardFields() {
  return (
    <>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-9999px",
          top: "-9999px",
          width: 0,
          height: 0,
          overflow: "hidden",
        }}
      >
        <label htmlFor={HONEYPOT_FIELD}>Company website</label>
        <input
          id={HONEYPOT_FIELD}
          name={HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>
      {/* Server component: rendered once per request, so a request-time
          timestamp is intentional here (bot timing trap). */}
      {/* eslint-disable-next-line react-hooks/purity */}
      <input type="hidden" name={FORM_TS_FIELD} value={Date.now()} />
    </>
  );
}
