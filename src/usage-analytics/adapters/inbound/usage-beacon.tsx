"use client";

import { useEffect, useRef } from "react";
import type { HighlightedStepKind, UsageEventType } from "../../domain/usage-event";

export const EVENTS_ENDPOINT = "/api/events";
const SESSION_KEY = "atlas_session_id";
const USER_KEY = "atlas_anonymous_user_id";
/** Selector of the programme section (labelled by its title). */
export const PROGRAMME_SELECTOR = '[aria-labelledby="programme-title"]';
const VISIBLE_SHARE = 0.5;

/** 32 random hex characters (matches the contract's opaque token pattern). */
function randomToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Opaque random token kept in `storage` under `key`; no cookie. Falls back to a fresh token. */
function storedToken(storage: () => Storage, key: string): string {
  try {
    const store = storage();
    const existing = store.getItem(key);
    if (existing && /^[A-Za-z0-9_-]{8,128}$/.test(existing)) return existing;
    const token = randomToken();
    store.setItem(key, token);
    return token;
  } catch {
    return randomToken();
  }
}

/** Fire-and-forget POST; never throws, never blocks the page. */
export function sendUsageEvent(eventType: UsageEventType, properties: Record<string, string>): void {
  try {
    const body = JSON.stringify({
      event_type: eventType,
      properties,
      session_id: storedToken(() => window.sessionStorage, SESSION_KEY),
      anonymous_user_id: storedToken(() => window.localStorage, USER_KEY),
    });
    fetch(EVENTS_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
      credentials: "omit",
    }).catch(() => undefined);
  } catch {
    // Analytics must never break the page.
  }
}

/** At least half of the section is visible, or it fills at least half of the viewport (tall sections). */
function isMostlyVisible(entry: IntersectionObserverEntry): boolean {
  if (!entry.isIntersecting) return false;
  const viewportHeight = entry.rootBounds?.height ?? window.innerHeight;
  return entry.intersectionRatio >= VISIBLE_SHARE || entry.intersectionRect.height >= viewportHeight * VISIBLE_SHARE;
}

/**
 * Sends `page_viewed` once per page load, and `programme_viewed` once per page load
 * when the programme section becomes mostly visible. Renders nothing.
 */
export function UsageBeacon({
  path,
  highlightedStepKind,
}: Readonly<{ path: string; highlightedStepKind?: HighlightedStepKind }>) {
  const pageSent = useRef(false);
  const programmeSent = useRef(false);

  useEffect(() => {
    if (pageSent.current) return;
    pageSent.current = true;
    sendUsageEvent("page_viewed", { path });
  }, [path]);

  useEffect(() => {
    if (programmeSent.current || typeof IntersectionObserver === "undefined") return;
    const section = document.querySelector(PROGRAMME_SELECTOR);
    if (!section) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (programmeSent.current || !entries.some(isMostlyVisible)) return;
        programmeSent.current = true;
        observer.disconnect();
        sendUsageEvent("programme_viewed", highlightedStepKind ? { highlighted_step_kind: highlightedStepKind } : {});
      },
      { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, [highlightedStepKind]);

  return null;
}
