"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import type { PaczkomatPoint } from "@/app/api/paczkomaty/route";

type Props = {
  value: PaczkomatPoint | null;
  onChange: (point: PaczkomatPoint) => void;
};

const WARSAW_FALLBACK = { lat: 52.2297, lng: 21.0122 };

// Plain SVG pin markers instead of Leaflet's default icon - the default
// relies on image files at paths that don't resolve correctly once bundled
// by Next.js, a well-known Leaflet+bundler friction point. Two colors: the
// accent orange for an unselected point, a filled green check for the
// selected one.
function markerSvg(selected: boolean): string {
  const fill = selected ? "#1f9d63" : "#ff7a20";
  return `
    <svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 25 15 25s15-14.5 15-25C30 6.7 23.3 0 15 0z" fill="${fill}" />
      ${
        selected
          ? '<path d="M9.5 15.5l3.5 3.5 7.5-7.5" stroke="white" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
          : '<circle cx="15" cy="15" r="5.5" fill="white"/>'
      }
    </svg>
  `;
}

function formatDistance(meters: number | null): string {
  if (meters === null) return "";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export default function PaczkomatPicker({ value, onChange }: Props) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const leafletRef = useRef<typeof import("leaflet") | null>(null);

  const [points, setPoints] = useState<PaczkomatPoint[]>([]);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [geoDenied, setGeoDenied] = useState(false);

  // Mount the map once.
  useEffect(() => {
    let disposed = false;
    import("leaflet").then((L) => {
      if (disposed || !mapContainerRef.current || mapRef.current) return;
      leafletRef.current = L;
      const map = L.map(mapContainerRef.current, {
        center: [WARSAW_FALLBACK.lat, WARSAW_FALLBACK.lng],
        zoom: 12,
        scrollWheelZoom: false,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
    });
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  async function fetchPoints(params: { lat: number; lng: number } | { query: string }) {
    setLoading(true);
    setError(null);
    try {
      const search = new URLSearchParams(
        "query" in params ? { query: params.query } : { lat: String(params.lat), lng: String(params.lng) },
      );
      const response = await fetch(`/api/paczkomaty?${search.toString()}`);
      const json = (await response.json()) as { ok: boolean; points?: PaczkomatPoint[]; error?: string };
      if (!json.ok || !json.points) {
        setError(json.error || "Nie udało się wczytać paczkomatów.");
        setPoints([]);
        return;
      }
      setPoints(json.points);
      if (json.points.length === 0) {
        setError("Nie znaleziono paczkomatów w tej okolicy.");
      }
      const center = "query" in params ? json.points[0] : params;
      if (center && mapRef.current) {
        mapRef.current.setView([center.lat, center.lng], 14);
      }
    } catch {
      setError("Nie udało się połączyć z serwerem.");
      setPoints([]);
    } finally {
      setLoading(false);
    }
  }

  // On first mount: try geolocation to center on the nearest lockers. We
  // don't have a shipping address yet at this point in checkout (that's the
  // next section down) - geolocation is the only "where roughly is this
  // customer" signal available this early, so it's what "closest by
  // default" is based on. A denial just leaves the search box as the way in.
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setLocating(false);
      setGeoDenied(true);
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setLocating(false);
      setGeoDenied(true);
    }, 8000);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        window.clearTimeout(timeoutId);
        setLocating(false);
        void fetchPoints({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      () => {
        window.clearTimeout(timeoutId);
        setLocating(false);
        setGeoDenied(true);
      },
      { timeout: 7500, maximumAge: 5 * 60 * 1000 },
    );
    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw markers whenever the result set or selection changes.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();

    points.forEach((point) => {
      const isSelected = value?.id === point.id;
      const icon = L.divIcon({
        html: markerSvg(isSelected),
        className: "paczkomat-marker",
        iconSize: [30, 40],
        iconAnchor: [15, 40],
      });
      const marker = L.marker([point.lat, point.lng], { icon }).addTo(map);
      marker.on("click", () => onChange(point));
      marker.bindTooltip(point.id, { direction: "top", offset: [0, -36] });
      markersRef.current.set(point.id, marker);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, value?.id]);

  function handleSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = searchText.trim();
    if (trimmed.length < 3) {
      setError("Wpisz co najmniej 3 znaki (miasto, ulicę lub nazwę paczkomatu).");
      return;
    }
    void fetchPoints({ query: trimmed });
  }

  return (
    <div className="paczkomat-picker">
      <form className="paczkomat-picker-search" onSubmit={handleSearchSubmit}>
        <input
          type="text"
          placeholder="Wpisz miasto, ulicę albo nazwę paczkomatu…"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
        />
        <button type="submit" disabled={loading}>
          Szukaj
        </button>
      </form>

      {locating ? (
        <p className="paczkomat-picker-status">Szukamy paczkomatów najbliżej Ciebie…</p>
      ) : null}
      {!locating && geoDenied && points.length === 0 && !loading ? (
        <p className="paczkomat-picker-status">
          Nie mamy Twojej lokalizacji - wyszukaj paczkomat po mieście lub ulicy powyżej.
        </p>
      ) : null}
      {error ? <p className="paczkomat-picker-error">{error}</p> : null}

      <div className="paczkomat-picker-map" ref={mapContainerRef} />

      {value ? (
        <p className="paczkomat-picker-selected">
          Wybrany paczkomat: <strong>{value.id}</strong> — {value.address}
        </p>
      ) : null}

      {points.length > 0 ? (
        <ul className="paczkomat-picker-list">
          {points.map((point) => (
            <li key={point.id}>
              <button
                type="button"
                className={value?.id === point.id ? "is-selected" : ""}
                onClick={() => {
                  onChange(point);
                  mapRef.current?.setView([point.lat, point.lng], 15);
                }}
              >
                <span className="paczkomat-picker-list-name">
                  {point.id}
                  {value?.id === point.id ? <span aria-hidden="true"> ✓</span> : null}
                </span>
                <span className="paczkomat-picker-list-address">{point.address}</span>
                {point.distanceMeters !== null ? (
                  <span className="paczkomat-picker-list-distance">{formatDistance(point.distanceMeters)}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
