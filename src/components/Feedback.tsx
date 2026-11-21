"use client";

import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import s from "./Feedback.module.css";

const TYPES = [
  { id: "bug", label: "Bug" },
  { id: "suggestion", label: "Suggestion" },
  { id: "missing-answer", label: "Missing answer" },
] as const;

const PLACEHOLDER: Record<(typeof TYPES)[number]["id"], string> = {
  bug: "What happened, and what did you expect?",
  suggestion: "What would make Orebit better?",
  "missing-answer": "Which category, and what answer should have counted?",
};

export default function Feedback() {
  const path = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const [type, setType] = useState<(typeof TYPES)[number]["id"]>("bug");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  const open = () => {
    setState("idle");
    setError("");
    dialog.current?.showModal();
  };
  const close = () => dialog.current?.close();

  const send = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const website = (new FormData(e.currentTarget).get("website") as string) ?? "";
    setState("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, message, page: path, website }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Couldn't send that.");
      setState("sent");
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that.");
      setState("error");
    }
  };

  return (
    <>
      <button className={s.trigger} onClick={open} aria-haspopup="dialog" title="Report a bug or suggest something">
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M4 4h12v9H9l-4 3v-3H4z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
        <span className="sr-only">Feedback</span>
      </button>
      <dialog ref={dialog} className={s.dialog} aria-labelledby="feedback-title" onClick={(e) => e.target === dialog.current && close()}>
        {state === "sent" ? (
          <div className={s.body}>
            <h2 id="feedback-title" className={s.title}>Thanks!</h2>
            <p className={s.muted}>Got it. Reports get read every day.</p>
            <div className={s.actions}>
              <button className={s.primary} onClick={close} autoFocus>
                Close
              </button>
            </div>
          </div>
        ) : (
          <form className={s.body} onSubmit={send}>
            <h2 id="feedback-title" className={s.title}>Send feedback</h2>
            <div className={s.types} role="radiogroup" aria-label="Type">
              {TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={type === t.id}
                  className={s.type}
                  onClick={() => setType(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <label className={s.label}>
              <span className="sr-only">Message</span>
              <textarea
                className={s.textarea}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={PLACEHOLDER[type]}
                maxLength={1000}
                rows={5}
                required
                minLength={3}
                autoFocus
              />
            </label>
            <input name="website" className={s.honeypot} tabIndex={-1} autoComplete="off" aria-hidden="true" />
            <p className={s.fine}>Don&apos;t include personal info. The page you&apos;re on is sent along to help find the problem.</p>
            {state === "error" && <p className={s.error}>{error}</p>}
            <div className={s.actions}>
              <button type="button" className={s.secondary} onClick={close}>
                Cancel
              </button>
              <button type="submit" className={s.primary} disabled={state === "sending" || message.trim().length < 3}>
                {state === "sending" ? "Sending..." : "Send"}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
