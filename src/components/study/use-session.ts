"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { overrideLastAnswerAction, recordReviewAction, startSessionAction } from "@/app/actions";
import type { StudyMode } from "@/server/study";

/** Starts a study session on mount and returns a recorder for answers. */
export function useStudySession(mode: StudyMode, deckId: string | null) {
  const sessionId = useRef<Promise<string | undefined> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ensure = useCallback(() => {
    if (!sessionId.current) {
      sessionId.current = startSessionAction(mode, deckId).then((r) => (r.ok ? r.data.id : (setError(r.error), undefined)));
    }
    return sessionId.current;
  }, [mode, deckId]);

  useEffect(() => {
    void ensure();
  }, [ensure]);

  const record = useCallback(
    async (cardId: string, rating: string) => {
      const id = await ensure();
      const r = await recordReviewAction({ sessionId: id, cardId, mode, rating });
      if (!r.ok) setError(r.error);
      return r.ok ? r.data : null;
    },
    [ensure, mode],
  );

  const override = useCallback(
    async (cardId: string) => {
      const id = await ensure();
      await overrideLastAnswerAction(cardId, id);
    },
    [ensure],
  );

  /** Start a fresh session (e.g. after "restart"). */
  const restart = useCallback(() => {
    sessionId.current = null;
    void ensure();
  }, [ensure]);

  return { record, override, restart, error };
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Ignore global shortcuts while typing in a field. */
export function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable);
}
