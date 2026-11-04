"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import qrcode from "qrcode-generator";

const API = "https://crm-keika.groovemedia.pl/biuro/api/shop-public/roof_photo_qr.php";
type State = "loading" | "waiting" | "scanned" | "received" | "error";

/** A short-lived transfer only; the parent uploads the received File using
 * the normal attachment session and performs the existing AI recognition. */
export default function RoofPhoneQr({ enabled, onFile }: { enabled: boolean; onFile: (file: File) => void }) {
  const [desktop, setDesktop] = useState(false);
  const [state, setState] = useState<State>("loading");
  const [link, setLink] = useState("");
  const [attempt, setAttempt] = useState(0);
  const onFileRef = useRef(onFile);
  useEffect(() => { onFileRef.current = onFile; }, [onFile]);

  useEffect(() => {
    const media = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setDesktop(media.matches);
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!enabled || !desktop) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const start = async () => {
      setState("loading"); setLink("");
      try {
        const response = await fetch(`${API}?action=create`, { method: "POST", signal: controller.signal, cache: "no-store" });
        const data = await response.json() as { ok?: boolean; token?: string; url?: string };
        if (!response.ok || !data.ok || !data.token || !/^[a-f0-9]{64}$/.test(data.token) || !data.url || new URL(data.url).origin !== "https://crm-keika.groovemedia.pl") throw new Error("Nie udało się utworzyć kodu.");
        if (!live) return;
        setLink(data.url); setState("waiting");
        const token = data.token;
        const poll = async () => {
          try {
            const statusResponse = await fetch(`${API}?action=status&t=${token}`, { signal: controller.signal, cache: "no-store" });
            const status = await statusResponse.json() as { ok?: boolean; status?: string };
            if (!statusResponse.ok || !status.ok) throw new Error("Kod wygasł.");
            if (!live) return;
            if (status.status === "uploaded") {
              const photoResponse = await fetch(`${API}?action=photo&t=${token}`, { signal: controller.signal, cache: "no-store" });
              if (!photoResponse.ok) throw new Error("Nie udało się odebrać zdjęcia.");
              const blob = await photoResponse.blob();
              if (!live || !blob.size) return;
              const suffix = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : blob.type === "image/heic" ? "heic" : blob.type === "image/heif" ? "heif" : "jpg";
              setState("received");
              onFileRef.current(new File([blob], `tabliczka.${suffix}`, { type: blob.type || "image/jpeg" }));
              return;
            }
            setState(status.status === "scanned" ? "scanned" : "waiting");
            timer = setTimeout(poll, 2500);
          } catch {
            if (live) setState("error");
          }
        };
        timer = setTimeout(poll, 1000);
      } catch {
        if (live) setState("error");
      }
    };
    void start();
    return () => { live = false; controller.abort(); if (timer) clearTimeout(timer); };
  }, [enabled, desktop, attempt]);

  const svg = useMemo(() => {
    if (!link) return "";
    const qr = qrcode(0, "M"); qr.addData(link); qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true });
  }, [link]);

  if (!enabled || !desktop) return null;
  return <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "16px 0", padding: 14, background: "#f4f7fb", borderRadius: 16, border: "1px solid #dce4ed" }}>
    {svg ? <div aria-label="Kod QR do zdjęcia telefonem" style={{ width: 132, minWidth: 132, lineHeight: 0, background: "white", padding: 4, borderRadius: 8 }} dangerouslySetInnerHTML={{ __html: svg }} /> : null}
    <div><strong style={{ display: "block", color: "#15294a", marginBottom: 5 }}>Zrób zdjęcie telefonem</strong>
      <span style={{ display: "block", color: "#586981", fontSize: 13, lineHeight: 1.45 }} role="status">
        {state === "loading" ? "Przygotowujemy kod QR…" : state === "scanned" ? "Telefon połączony. Zrób zdjęcie tabliczki." : state === "received" ? "Zdjęcie dotarło na komputer." : state === "error" ? "Kod wygasł lub połączenie zostało przerwane." : "Zeskanuj kod aparatem telefonu. Zdjęcie automatycznie pojawi się tutaj."}
      </span>
      {state === "error" ? <button type="button" onClick={() => setAttempt((n) => n + 1)} style={{ marginTop: 8, cursor: "pointer" }}>Utwórz nowy kod</button> : null}
    </div>
  </div>;
}
