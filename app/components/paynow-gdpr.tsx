"use client";

import { useEffect, useState } from "react";
import styles from "./paynow-gdpr.module.css";

type Notice = { title: string; content: string };

/** Klauzula RODO mElements S.A. przy polu kodu BLIK (PayNow White Label).
 * Wymóg PayNow: treść pobierana z ich API (u nas przez CRM, /api/paynow/gdpr),
 * nie wpisana na sztywno. Tytuł widoczny zawsze, pełna treść po rozwinięciu.
 * Brak odpowiedzi = nic nie renderujemy, płatność działa dalej. */
export function PaynowGdprNotice() {
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(() => {
    let alive = true;
    fetch("/api/paynow/gdpr")
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        if (!alive || !json?.ok || !Array.isArray(json.notices)) return;
        setNotices(
          json.notices.filter(
            (notice: Notice) => notice && typeof notice.title === "string" && notice.title.trim() !== "",
          ),
        );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (notices.length === 0) return null;

  return (
    <div className={styles.box}>
      {notices.map((notice, index) => (
        <details key={index} className={styles.item}>
          <summary className={styles.title}>{notice.title}</summary>
          <div className={styles.content} dangerouslySetInnerHTML={{ __html: notice.content }} />
        </details>
      ))}
    </div>
  );
}
