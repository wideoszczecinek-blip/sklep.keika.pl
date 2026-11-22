"use client";

// Animacja 3D plisy KEIKA (właściciel 30.10.2026: „ten filmik może dźwignąć sprzedaż”, film własny,
// pełne prawa). Miejsca wybrała Agencja AI: pętla „nie odstaje” pod kartą oferty, cały film w galerii,
// montaż w Instrukcjach, otwieranie okna w FAQ. Filmy są bez dźwięku, napisy wypalone w obrazie;
// pliki w public/plisy/film (źródło i cięcia: D:/KEIKA/REKLAMA/film-plisa-3d, tnij.cjs + klipy.json).
import { useEffect, useRef, useState } from "react";
import { trackShopStep } from "@/lib/track-step";

export const PLISY_FILM = {
  oferta: { src: "/plisy/film/plisa-oferta.mp4", poster: "/plisy/film/plisa-oferta.jpg" },
  montaz: { src: "/plisy/film/plisa-montaz.mp4", poster: "/plisy/film/plisa-montaz.jpg" },
  otwieranie: { src: "/plisy/film/plisa-otwieranie.mp4", poster: "/plisy/film/plisa-otwieranie.jpg" },
  caly: { src: "/plisy/film/plisa-film.mp4", poster: "/plisy/film/plisa-film.jpg" },
} as const;

/** Krótka pętla bez dźwięku, gra tylko na ekranie (jak baner moskitier) - nie ściąga pliku, póki nie widać. */
export function PlisyFilmLoop({
  src,
  poster,
  caption,
  id,
  label,
  className = "",
}: {
  src: string;
  poster: string;
  caption?: string;
  id?: string;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.play().catch(() => {});
      return;
    }
    let seen = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!seen) {
            seen = true;
            trackShopStep("film_view", "plisy", { film: label });
          }
          el.play().catch(() => {});
        } else {
          el.pause();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [label]);
  return (
    <figure className={`plv2-film ${className}`.trim()} id={id}>
      <video ref={ref} src={src} poster={poster} muted loop playsInline preload="none" aria-label={label} />
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}

/** Slajd galerii z całym filmem: plakat + przycisk, gra po dotknięciu, pauza po przewinięciu galerii. */
export function PlisyFilmSlide({ active }: { active: boolean }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!active && ref.current && !ref.current.paused) ref.current.pause();
  }, [active]);
  const start = () => {
    const el = ref.current;
    if (!el) return;
    el.play().then(() => setPlaying(true)).catch(() => {});
    trackShopStep("film_play", "plisy", { film: "galeria" });
  };
  return (
    <figure className="plv2-slide plv2-slide--film" id="film-plisa" aria-label="Film: plisa KEIKA - montaż, praca, otwieranie okna">
      <video
        ref={ref}
        src={PLISY_FILM.caly.src}
        poster={PLISY_FILM.caly.poster}
        muted
        playsInline
        preload="none"
        controls={playing}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        onEnded={() => setPlaying(false)}
      />
      {!playing ? (
        <button type="button" className="plv2-film-play" onClick={start} aria-label="Odtwórz film">
          <span aria-hidden="true">▶</span> Zobacz plisę w ruchu
        </button>
      ) : null}
    </figure>
  );
}

/** „Doba z plisą” (właściciel 22.11: „więcej emocji – filmiki z produktem i emocjami”; ustalenie z GPT: emocje niżej
 *  na stronie, po dotknięciu, nie w tle). Wersja reklamy bez planszy Black Weeks: rano, południe, wieczór, noc
 *  + prawdziwy montaż u klienta, 20 s, z lektorką. Pliku nie ściąga, dopóki klient nie dotknie. */
export function PlisyFilmDoba() {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const start = () => {
    const el = ref.current;
    if (!el) return;
    el.muted = false;
    el.play()
      .then(() => setPlaying(true))
      .catch(() => {
        el.muted = true;
        el.play().then(() => setPlaying(true)).catch(() => {});
      });
    trackShopStep("film_play", "plisy", { film: "doba" });
  };
  return (
    <section className="pm-section plisy-doba" aria-labelledby="plisy-doba-t">
      <p className="pm-eyebrow">Na co dzień</p>
      <h2 id="plisy-doba-t" className="pm-title">Jedna plisa przez całą dobę</h2>
      <p className="pm-lead">
        Rano wpuszczasz słońce, w dzień zasłaniasz tylko ekran, wieczorem nikt nie zagląda, a w nocy latarnia nie świeci Ci w oczy.
      </p>
      <figure className="plisy-doba-film">
        <video
          ref={ref}
          src="/plisy/film/doba-z-plisa.mp4"
          poster="/plisy/film/doba-z-plisa.jpg"
          playsInline
          preload="none"
          controls={playing}
          onEnded={() => setPlaying(false)}
          aria-label="Film: jedna plisa przez całą dobę"
        />
        {!playing ? (
          <button type="button" className="plv2-film-play" onClick={start}>
            ▶ Obejrzyj (20 s)
          </button>
        ) : null}
      </figure>
      <p className="plisy-doba-uwaga">Sceny we wnętrzach to wizualizacja, ostatnie ujęcie to prawdziwy montaż u klienta.</p>
    </section>
  );
}
