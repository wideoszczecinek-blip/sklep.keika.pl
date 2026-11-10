/**
 * Renderer wizualizatora „Twoje okno” (WebGL1, bez bibliotek).
 *
 * Warstwy (od spodu): zdjęcie klienta → na każdej szybie plisa: tkanina
 * (prawdziwa tekstura próbki z CRM, kafelkowana w skali szyby) z plisowaniem
 * liczonym w płaszczyźnie szyby (stała liczba fałd - na rozłożonej plisie co ok. 28 mm -
 * które ściskają się przy przesuwaniu belek; każda fałda to jasna ścianka górna, ścianka
 * dolna w cieniu i ciemne zagięcie), światło z pokoju + prześwit od strony okna
 * (transmisja tkaniny × jasność za szybą, wyrównana do średniej całej szyby),
 * belki górna i dolna (profil z odblaskiem, zaślepki, uchwyt, grubość profilu
 * widoczna pod kątem), linki po bokach i uchwyty narożne → przedmioty przed
 * szybą (maska z CRM) z powrotem NA WIERZCHU.
 *
 * Perspektywa: dla każdego piksela liczymy (u, v) szyby odwrotną homografią
 * (uniform mat3), więc fałdy, belki i linki zbiegają się zgodnie z kątem
 * patrzenia - także gdy okno nie jest na wprost.
 */
import { type Mat3, type Pt, apply, invert3, paneToImage } from "./homografia";

export type Rgb = [number, number, number];

export type FabricRender = {
  id: string;
  color: Rgb; // 0–1
  transmission: number; // 0–0.6
  texture: HTMLImageElement | null;
  honeycomb: boolean; // DUO: linki w środku plastra, bez otworów w tkaninie
};

export type PaneRender = {
  id: string;
  corners: Pt[]; // px zdjęcia: LG, PG, PD, LD
  top: number; // górna krawędź belki górnej, 0–1 wysokości szyby
  bottom: number; // dolna krawędź belki dolnej, 0–1
  fabric: FabricRender;
  rail: Rgb;
  railId: string; // listwa z katalogu (tekstura zdjęcia profilu, gdy wczytana)
  /** okleina drewnopodobna (sosna, dąb, orzech…) - słoje rysowane w shaderze zamiast płaskiej plamy albo skośnego zdjęcia */
  railWood?: boolean;
  bracket: Rgb;
  mount: "standard" | "bezinwazyjny";
  widthMm: number;
  heightMm: number;
  back: number; // jasność za szybą 0–1 (etap F)
  front: number; // światło z pokoju na przód plisy 0–1.2
  pitch: number; // kąt patrzenia (etap F): > 0 = z dołu
  selected: boolean;
  /** rodzaj osłony: plisa okienna (domyślnie), plisa dachowa albo roleta dachowa - obie w prowadnicach bocznych */
  kind?: "plisa" | "plisa-dachowa" | "roleta-dachowa";
};

export type SceneRender = {
  tint: Rgb; // barwa światła w pokoju
  split: number; // „przed/po”: po prawej od tej kolumny (px) zdjęcie bez plisy
  outline: boolean; // tryb edycji: obrys szyb
  /**
   * Okna dachowe (właściciel 7.11): zaciemnienie pokoju 0–0,55 - im niżej zaciągnięta osłona i im mniej światła
   * przepuszcza tkanina (Termo / blackout), tym ciemniejsze zdjęcie; nigdy do 100 %. Niezasłonięte szkło nie ciemnieje.
   */
  darken?: number;
};

/** Stałe produktu (mm). */
export const PLEAT_MM = 20;
/**
 * Odstęp fałd widziany z pokoju na całkiem rozłożonej plisie (mm). Tkanina ma fałdę 20 mm, ale harmonijka nigdy nie
 * rozkłada się na płasko - grzbiety wypadają co ok. 28 mm. Rysowane co 20 mm fałdy były za gęste: na telefonie zostawały
 * z nich cienkie kreski i mora (właściciel 10.11: „totalna tandeta”).
 */
export const OKRES_FALDY_MM = 28;
export const RAIL_MM = 22;
export const TILE_MM = 42;
/** Okna dachowe: prowadnica boczna plisy dachowej (mm). */
export const PROWADNICA_MM = 16;
/**
 * Roleta dachowa = system B25 szeroki (Dekolux): aluminiowa rama jak rama obrazu - kaseta u góry i prowadnice
 * po bokach z tego samego wypukłego profilu 50 mm (właściciel 10.11: „kaseta i prowadnice mają ten sam wymiar”),
 * łączone na ukos 45°; rama leży na skrzydle wokół szyby i tylko trochę zachodzi na szkło (ZAKLAD: w poziomie
 * i w pionie). Belka dolna jest smukła (BELKA_B25_MM). Wymiary w mm.
 */
export const KASETA_MM = 50;
export const PROWADNICA_B25_MM = 50;
export const BELKA_B25_MM = 18;
export const ZAKLAD_B25_MM: [number, number] = [8, 10];

const VS = `
attribute vec2 aPos;
uniform vec2 uVp;
varying vec2 vPix;
void main() {
  vPix = aPos;
  gl_Position = vec4(aPos.x / uVp.x * 2.0 - 1.0, 1.0 - aPos.y / uVp.y * 2.0, 0.0, 1.0);
}`;

const FS_PHOTO = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uPhoto;
uniform sampler2D uMask;
uniform vec2 uRes;
uniform float uMaskOnly;
uniform float uDark;   // zaciemnienie pokoju przez osłony okien dachowych (0 = brak)
uniform float uSplit;  // „przed/po”: na prawo od tej kolumny zdjęcie bez osłon i bez zaciemnienia
varying vec2 vPix;
void main() {
  vec2 tc = vPix / uRes;
  vec3 c = texture2D(uPhoto, tc).rgb;
  // mniej światła w pokoju: ciemniej i odrobinę chłodniej (światło dzienne zza tkaniny), ale nigdy czarno
  if (vPix.x <= uSplit) c *= (1.0 - uDark) * vec3(1.0 - 0.02 * uDark, 1.0, 1.0 + 0.03 * uDark);
  if (uMaskOnly > 0.5) {
    float m = texture2D(uMask, tc).r;
    if (m < 0.01) discard;
    gl_FragColor = vec4(c * m, m);
  } else {
    gl_FragColor = vec4(c, 1.0);
  }
}`;

const FS_PANE = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uPhoto;
uniform sampler2D uTex;
uniform vec2 uRes;
uniform mat3 uInv;
uniform vec2 uPx;       // piksele na jednostkę u, v
uniform float uTop;
uniform float uBot;
uniform float uRailH;
uniform float uPleats;
uniform vec2 uRep;
uniform float uHasTex;
uniform vec3 uTexMean;
uniform vec3 uFabric;
uniform float uTrans;
uniform float uBack;
uniform float uFront;
uniform vec3 uTint;
uniform vec3 uRail;
uniform vec3 uBracket;
uniform float uMount;   // 0 standard, 1 bezinwazyjny
uniform float uHoney;
uniform float uPitch;
uniform float uSplit;
uniform float uSel;
uniform float uOutline;
uniform sampler2D uRailTex; // zdjęcie listwy z katalogu (lico profilu, słoje wzdłuż)
uniform float uHasRailTex;
uniform vec3 uRailMean;
uniform float uRailRep;
uniform float uWood;        // 1 = okleina drewnopodobna bez zdjęcia: słoje proceduralne
uniform float uWoodRings;   // ile słojów w poprzek profilu (mniej, gdy profil ma mało pikseli - bez migotania)
uniform vec2 uMm;           // szerokość i wysokość szyby w mm (rozmiary uchwytów w mm, nie w % szyby)
uniform float uKind;        // 0 plisa okienna, 1 plisa dachowa, 2 roleta dachowa
uniform float uDark;        // zaciemnienie pokoju (okna dachowe): niezasłonięte szkło wraca do jasności oryginału
uniform float uTopH;        // wysokość górnej belki / kasety (część wysokości szyby)
uniform float uGuide;       // szerokość prowadnicy bocznej (część szerokości szyby), 0 = bez prowadnic
uniform vec4 uBackAvg;     // średni kolor zdjęcia w obrębie szyby (a = 1, gdy policzony) - równy prześwit plisy
uniform vec2 uLap;          // roleta B25: ile rama zachodzi na szkło (część szerokości / wysokości szyby)
varying vec2 vPix;

float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

vec3 woodBase() {
  // lakierowana sosna: miodowa baza, mniej cytrynowej żółci niż kolor z katalogu (#E5BD72 wyglądał jak musztarda)
  vec3 b = uRail * vec3(0.99, 0.92, 0.80);
  return mix(vec3(lum(b)), b, 0.85);
}

// kolor jednolitych elementów w barwie osprzętu (zaślepki, uchwyty) - przy drewnie ten sam ton co listwy
vec3 railPlain() { return uWood > 0.5 ? woodBase() : uRail; }

vec3 woodGrain(float r, float along) {
  // okleina drewnopodobna (właściciel 8.11: „jasna sosna wychodzi niezachęcająco” - była płaską musztardową plamą):
  // lakierowana sosna - miodowa baza, falujące ciemniejsze słoje
  // późnego drewna wzdłuż profilu, drobne włókna i powolna zmiana tonu na długości listwy. along w mm.
  vec3 base = woodBase();
  float warp = 0.9 * vnoise(vec2(along * 0.006, r * 1.3)) + 0.3 * sin(along * 0.011 + r * 2.7);
  float ring = fract(r * uWoodRings + warp);
  float late = smoothstep(0.5, 0.72, ring) * (1.0 - smoothstep(0.82, 1.0, ring));
  float fib = vnoise(vec2(along * 0.045, r * uWoodRings * 9.0));
  float blot = vnoise(vec2(along * 0.0022, 3.7));
  vec3 c = mix(base, base * vec3(0.78, 0.64, 0.48), late * 0.5);
  return clamp(c * (0.95 + 0.08 * fib + 0.08 * (blot - 0.5)), 0.0, 1.0);
}

vec3 railBase(float r, float u) {
  // okleiny drewnopodobne: słoje proceduralne (u: wzdłuż profilu, w szerokościach szyby) - zdjęcia katalogu pokazują
  // profil skośnie, więc wycinek dawał ukośne pasy z białym tłem („złoty lambrekin”, właściciel 8.11);
  // pozostałe kolory: zdjęcie profilu względem jego średniej
  if (uWood > 0.5) return woodGrain(r, u * uMm.x);
  if (uHasRailTex > 0.5) {
    vec3 t = texture2D(uRailTex, vec2(u * uRailRep, clamp(r, 0.03, 0.97))).rgb;
    return clamp(uRail * t / max(uRailMean, vec3(0.03)), 0.0, 1.0);
  }
  return uRail;
}

vec3 railShade(float r, float u, float pxr) {
  // profil belki jak na filmie 3D: jasna górna krawędź (odblask), płaskie lico z lekkim
  // spadkiem jasności, wyżłobienie (linia łączenia z tkaniną) i zaokrąglony, ciemniejszy spód
  vec3 base = railBase(r, u);
  float edgeTop = 1.0 - smoothstep(0.0, max(0.06, 1.5 * pxr), r);
  float face = mix(1.04, 0.94, smoothstep(0.08, 0.78, r));
  // rowek: ze zdjęcia listwy (gdy jest), inaczej proceduralny
  float groove = uHasRailTex > 0.5 ? 1.0 : 1.0 - 0.16 * exp(-pow((r - 0.5) / max(0.035, pxr), 2.0));
  float bottom = mix(1.0, 0.7, smoothstep(0.8, 1.0, r));
  vec3 c = base * face * groove * bottom;
  c = mix(c, min(base * 1.18 + 0.05, vec3(1.0)), edgeTop * 0.7);
  // zaślepki na końcach (tworzywo w kolorze, bez słojów), zaokrąglone: jaśniejszy środek, ciemne krawędzie
  float cw = 12.0 / max(uMm.x, 200.0);
  float cap = 1.0 - smoothstep(cw, cw + 0.003, u) * smoothstep(cw, cw + 0.003, 1.0 - u);
  float capShade = 0.8 + 0.16 * sin(clamp(r, 0.0, 1.0) * 3.1416);
  c = mix(c, railPlain() * capShade, cap);
  // szczelina między zaślepką a profilem
  float seam = (1.0 - smoothstep(0.0, 0.0025, abs(u - cw - 0.0015))) + (1.0 - smoothstep(0.0, 0.0025, abs(1.0 - u - cw - 0.0015)));
  c *= 1.0 - 0.25 * clamp(seam, 0.0, 1.0);
  return c;
}

// ---- roleta dachowa B25 szeroki (właściciel 10.11: render ma wyglądać jak prawdziwa roleta, a nie cienkie listewki)
// szczotkowane aluminium / lakier: drobne rysy wzdłuż profilu (mm wzdłuż i w poprzek); okleina ma własne słoje
float brushed(float alongMm, float acrossMm) {
  if (uWood > 0.5) return 1.0;
  return 1.0 + 0.04 * (vnoise(vec2(alongMm * 0.035, acrossMm * 2.2)) - 0.5) + 0.03 * (vnoise(vec2(alongMm * 0.008, acrossMm * 0.6 + 9.0)) - 0.5);
}

// kolor ramy i belki B25: lakier / anoda gładko, okleina sosnowa - szerokie, falujące słoje co ok. 15 mm
// (słoje listwy plisy są gęstsze - na ramie 50 mm wyglądały jak sztruks); pxMm: ile mm przypada na piksel
vec3 frameBase(float acrossMm, float alongMm, float pxMm) {
  if (uWood < 0.5) return uRail;
  vec3 base = woodBase();
  float warp = 1.1 * vnoise(vec2(alongMm * 0.004, acrossMm * 0.05)) + 0.35 * sin(alongMm * 0.007 + acrossMm * 0.11);
  float ring = fract(acrossMm / 15.0 + warp);
  float late = smoothstep(0.45, 0.75, ring) * (1.0 - smoothstep(0.8, 1.0, ring));
  late *= clamp((15.0 / max(pxMm, 0.01) - 2.0) / 3.0, 0.0, 1.0); // słoje cieńsze niż ~3 px uśredniamy
  float fib = vnoise(vec2(alongMm * 0.04, acrossMm * 1.6));
  float blot = vnoise(vec2(alongMm * 0.002, acrossMm * 0.02 + 3.7));
  vec3 c = mix(base, base * vec3(0.8, 0.67, 0.52), late * 0.34);
  return clamp(c * (0.96 + 0.07 * fib + 0.08 * (blot - 0.5)), 0.0, 1.0);
}

// profil ramy B25 w poprzek - ten sam dla kasety i prowadnic (q: 0 = krawędź zewnętrzna, 1 = wewnętrzna przy
// tkaninie): gładkie wypukłe lico - zaokrąglona krawędź zewnętrzna, odblask w 1/4 szerokości, łagodne ciemnienie
// ku tkaninie i cień krawędzi, pod którą wchodzi tkanina; k: siła światłocienia (kaseta łapie światło z góry)
float profB25(float q, float pxq, float k) {
  float s = mix(0.7, 0.95, smoothstep(0.0, max(0.07, pxq), q));
  s = mix(s, 1.0 + 0.09 * k, smoothstep(0.07, 0.28, q));
  s = mix(s, 1.0, smoothstep(0.3, 0.54, q));
  s = mix(s, 1.0 - 0.13 * k, smoothstep(0.54, 0.86, q));
  s = mix(s, 0.56, smoothstep(1.0 - max(0.09, 1.5 * pxq), 1.0, q));
  return s;
}

// belka dolna rolety: smukły profil aluminiowy bez zaślepek (końce chowają się w prowadnicach)
vec3 barB25(float r, float u, float pxr) {
  float s = mix(0.66, 1.12, smoothstep(0.0, max(0.09, 1.5 * pxr), r));
  s = mix(s, 1.0, smoothstep(0.1, 0.32, r));
  s = mix(s, 0.9, smoothstep(0.32, 0.62, r));
  s *= 1.0 - 0.14 * exp(-pow((r - 0.66) / max(0.04, pxr), 2.0));
  s = mix(s, 0.74, smoothstep(0.7, 0.86, r));
  s = mix(s, 0.52, smoothstep(0.88, 1.0, r));
  return frameBase(r * 18.0, u * uMm.x, uMm.y / max(uPx.y, 1.0)) * s * brushed(u * uMm.x, r * 18.0);
}

void main() {
  if (vPix.x > uSplit) discard;
  vec3 hp = uInv * vec3(vPix, 1.0);
  vec2 uv = hp.xy / hp.z;
  float u = uv.x;
  float v = uv.y;
  vec2 px = 1.0 / max(uPx, vec2(1.0));
  vec2 tc = vPix / uRes;

  bool b25 = uKind > 1.5;
  bool inPane = u > 0.0 && u < 1.0;
  // roleta B25: rama leży na skrzydle - rysujemy też poza szybą (prowadnica + miękki cień na ramie okna)
  float x0 = b25 ? uLap.x - uGuide - 16.0 / uMm.x : uKind > 0.5 ? -0.75 * uGuide - 0.004 : -0.008;
  float x1 = 1.0 - x0;
  float brushH = b25 ? max(5.0 / uMm.y, 1.6 * px.y) : 0.0;
  // tkanina rolety wchodzi 2 px pod wargę kasety i pod belkę - bez tego na styku prześwituje ciemna szyba
  float fx = b25 ? 2.0 * px.y : 0.0;
  // rama i belka B25 leżą na skrzydle, w świetle pokoju: przy zaciemnieniu ciemnieją prawie jak ściany
  // (bez tego biała rama świeciła w ciemnym pokoju jak listwa LED)
  float frameK = b25 ? (1.0 - 0.7 * uDark) / (1.0 - 0.45 * uDark) : 1.0;
  float inX = smoothstep(x0 - px.x, x0 + px.x, u) * (1.0 - smoothstep(x1 - px.x, x1 + px.x, u));

  float tTop = uTop;
  float tBot = uTop + uTopH;
  float bTop = uBot - uRailH;
  float bBot = uBot;
  float span = max(bTop - tBot, 0.0);
  float spanMax = max(1.0 - 2.0 * uRailH, 0.001);
  float comp = 1.0 - clamp(span / spanMax, 0.0, 1.0);

  vec4 col = vec4(0.0);

  // ---- tkanina
  if (v >= tBot - fx && v <= bTop + fx && span > 0.0 && (!b25 || inPane)) {
    float t = (v - tBot) / span;
    bool roleta = uKind > 1.5;
    if (roleta) t = (v - tBot) / max(1.0 - tBot - uRailH, 0.001);
    float ph = roleta ? 0.25 : fract(t * uPleats);
    float pitchPx = span / uPleats * uPx.y;
    // Fałda „harmonijka” widziana z pokoju (właściciel 10.11: podgląd wyglądał jak płaska naklejka z cienkimi
    // kreskami): każda fałda to DWA wyraźne pasy - szersza ścianka górna łapie światło i jaśnieje ku grzbietowi,
    // za ostrym grzbietem węższa ścianka dolna leży w cieniu, a w zagięciu przy szybie jest ciemna, miękka linia.
    // Tak plisę pokazują zdjęcia; cienkie jednopikselowe kreski dawały morę i wrażenie tapety w paski.
    // cut: gdzie kończy się ścianka górna (rozłożona plisa: 60 % fałdy, ściśnięta: połowa)
    float cut = mix(0.6, 0.5, comp);
    float aw = clamp(0.8 / max(pitchPx, 1.0), 0.015, 0.2); // wygładzenie krawędzi: ok. 1,5 px
    float upF = mix(0.965, 1.06, smoothstep(0.0, cut, ph));
    float dnF = mix(0.815, 0.895, smoothstep(cut, 1.0, ph));
    float isDn = smoothstep(cut - aw, cut + aw, ph);
    float fold = mix(upF, dnF, isDn);
    // zagięcie przy szybie: ciemna linia o miękkich brzegach (obie ścianki dochodzą do tej samej wartości - bez schodka)
    float dv = min(ph, 1.0 - ph);
    float vw = max(0.07, 1.6 / max(pitchPx, 1.0));
    float crease = 1.0 - smoothstep(0.0, vw, dv);
    fold = mix(fold, 0.76, crease);
    // rozłożona plisa ma płytsze fałdy, ściśnięta - głębokie
    fold = 1.0 + (fold - 1.0) * (0.85 + 0.75 * comp);
    if (roleta) {
      fold = 1.0;
      isDn = 0.0;
      crease = 0.0;
    }
    // fałdy drobniejsze niż ~3 px uśredniamy, żeby nie migotały
    float aa = clamp((pitchPx - 2.5) / 3.5, 0.0, 1.0);
    fold = mix(roleta ? 1.0 : 0.95, fold, aa);
    crease *= aa;
    // s: światło pokoju na licu tkaniny (bez fałd - te nakładamy na gotowy kolor, razem z prześwitem)
    float s = 1.0;
    // roleta: płaska, napięta tkanina - tylko bardzo łagodne podłużne pofalowanie i jaśniejszy środek
    if (roleta) s = 1.0 + 0.012 * sin(u * 37.0 + 1.3) - 0.03 * pow(abs(u - 0.5) * 2.0, 3.0);
    vec3 alb = uFabric;
    if (uHasTex > 0.5) {
      // tekstura niesie splot i wzór (względem swojej średniej), średni kolor zawsze z katalogu
      vec3 tx = texture2D(uTex, vec2(u * uRep.x, t * uRep.y)).rgb;
      alb = clamp(uFabric * tx / max(uTexMean, vec3(0.03)), 0.0, 1.0);
    }
    // splot tkaniny w dwóch skalach (włókna ~0,7 mm i nierówności ~2,5 mm) - delikatna matowa faktura;
    // mocniejszy szum robił z plisy „tapetę z kaszą”; gaśnie, gdy piksel jest większy od ziarna
    vec2 gm = vec2(u, t) * uMm;
    float mmPx = uPx.x / max(uMm.x, 200.0);
    float fine = (hash(floor(gm / 0.7)) - 0.5) * 0.05 * clamp((mmPx * 0.7 - 0.25) * 2.0, 0.0, 1.0);
    float coarse = (hash(floor(gm / 2.5) + 7.0) - 0.5) * 0.03 * clamp((mmPx * 2.5 - 0.3) * 1.5, 0.0, 1.0);
    s *= 1.0 + fine + coarse;
    // krawędzie tkaniny odchodzą od światła, cień belki górnej na fałdach
    float edge = smoothstep(0.0, 0.035, u) * smoothstep(0.0, 0.035, 1.0 - u);
    // roleta B25: szeroka prowadnica rzuca na brzeg tkaniny wyraźniejszy cień
    if (roleta) edge = smoothstep(0.0, 16.0 / uMm.x, min(u, 1.0 - u) - uLap.x);
    s *= mix(roleta ? 0.84 : 0.9, 1.0, edge);
    float dTop = (v - tBot) * uPx.y;
    s *= 1.0 - 0.22 * exp(-dTop / 5.0);
    float dBot = (bTop - v) * uPx.y;
    s *= 1.0 - 0.08 * exp(-dBot / 4.0);
    // barwa światła pokoju tylko w połowie - kolor próbki ma zostać rozpoznawalny
    vec3 front = alb * s * uFront * mix(vec3(1.0), uTint, 0.5);
    // prześwit: światło zza szyby rozproszone w tkaninie - plisa nie pokazuje kształtów za oknem, tylko miękki
    // blask: średnia jasność całej szyby (liczona raz w JS) z domieszką lokalnego rozmycia (12 próbek w ~3 % zdjęcia),
    // które zostawia łagodne przejście nieba w ziemię; samo lokalne rozmycie rysowało na tkaninie plamy dachów i drzew
    vec2 r1 = vec2(0.03) * vec2(1.0, uRes.x / uRes.y);
    vec3 back = vec3(0.0);
    for (int k = 0; k < 8; k++) {
      float ang = float(k) * 0.7854;
      back += texture2D(uPhoto, clamp(tc + r1 * vec2(cos(ang), sin(ang)), 0.0, 1.0)).rgb;
    }
    for (int k = 0; k < 4; k++) {
      float ang = float(k) * 1.5708 + 0.3927;
      back += texture2D(uPhoto, clamp(tc + 0.5 * r1 * vec2(cos(ang), sin(ang)), 0.0, 1.0)).rgb;
    }
    back /= 12.0;
    if (!roleta) back = mix(back, uBackAvg.rgb, 0.65 * uBackAvg.a);
    // ściśnięta plisa to więcej warstw tkaniny na drodze światła
    float dbl = roleta ? 1.0 : 1.0 - 0.15 * comp;
    // światło po przejściu przez tkaninę bierze jej barwę (kremowa plisa pod słońce świeci ciepło, nie szaro)
    vec3 diffused = roleta ? mix(vec3(lum(alb)), alb, 0.8) : alb * mix(vec3(1.0), alb / max(lum(alb), 0.05), 0.2);
    // Realna jasność za szybą wpływa na ilość rozproszonego światła. Mocno
    // rozmyta próbka daje subtelny blask, bez ostrego widoku przez tkaninę.
    // Dla blackout (uTrans == 0) nie dodajemy żadnego prześwitu.
    float daylight = smoothstep(0.08, 0.8, lum(back));
    vec3 trans = clamp(uTrans * uBack * (0.65 + 1.15 * daylight) * diffused * dbl * mix(vec3(1.0), back / max(lum(back), 0.08), 0.12), 0.0, 0.92);
    // linki przez otwory w tkaninie (nie w plastrze miodu): widać je głównie w cieniu fałdy - jak przerywaną kreskę
    float cords = 0.0;
    if (uHoney < 0.5 && uKind < 0.5) {
      float cu = min(min(abs(u - 0.018), abs(u - 0.03)), min(abs(u - 0.97), abs(u - 0.982)));
      cords = (1.0 - smoothstep(0.0, px.x * 1.1, cu)) * 0.16 * mix(1.0, 0.35 + 0.65 * isDn, aa);
    }
    // światło z pokoju + prześwit (mieszanie „screen”: jasna tkanina pod słońce nie przepala się do bieli)
    vec3 lit3 = 1.0 - (1.0 - clamp(front, 0.0, 1.0)) * (1.0 - trans);
    // fałdy na gotowym kolorze: widać je tak samo w ciemnym pokoju pod światło i wieczorem przy lampie
    // (liczone tylko na świetle z pokoju ginęły w dzień pod prześwitem); cień fałdy lekko nasyca barwę tkaniny
    lit3 *= fold * mix(vec3(1.0), alb / max(lum(alb), 0.05), clamp((1.0 - fold) * 0.6, 0.0, 0.2));
    col = vec4(clamp(lit3, 0.0, 1.0) * (1.0 - cords), 1.0);
  }
  // ziarno jak w fotografii z telefonu (~1,5 % szumu na piksel) - bez niego render wygląda jak naklejka
  float grain = (hash(floor(vPix)) - 0.5) * 0.03;

  // ---- belki (z grubością profilu widoczną pod kątem)
  float k = b25 ? 0.0 : uRailH * min(0.9, abs(uPitch) * 3.5);
  for (int i = 0; i < 2; i++) {
    if (b25 && (i == 0 || !inPane)) continue;
    float a = i == 0 ? tTop : bTop;
    float b = i == 0 ? tBot : bBot;
    float fa = a - (uPitch < 0.0 ? k : 0.0);
    float fb = b + (uPitch > 0.0 ? k : 0.0);
    if (v >= fa - px.y && v <= fb + px.y) {
      float edgeA = smoothstep(fa - px.y, fa + px.y, v);
      float edgeB = 1.0 - smoothstep(fb - px.y, fb + px.y, v);
      vec3 c;
      if (v < a) {
        c = railBase(0.1, u) * 1.08; // wierzch profilu (patrzymy z góry)
      } else if (v > b) {
        c = railBase(0.9, u) * 0.66; // spód profilu (patrzymy z dołu)
      } else if (b25) {
        c = barB25((v - a) / max(b - a, 0.0001), u, px.y / max(b - a, 0.0001));
      } else {
        c = railShade((v - a) / max(b - a, 0.0001), u, px.y / max(b - a, 0.0001));
      }
      c *= uFront * frameK * mix(vec3(1.0), uTint, 0.5) * 1.02;
      float al = edgeA * edgeB;
      col = vec4(mix(col.rgb, c, al), max(col.a, al));
    }
  }

  // cień belki dolnej na szybie tuż pod nią (miękki)
  if (v > bBot + brushH && v < bBot + brushH + 0.03 && col.a < 0.01 && (!b25 || inPane)) {
    float d = (v - bBot - brushH) * uPx.y;
    float a = 0.18 * exp(-d / 3.0) * uFront;
    col = vec4(vec3(0.0), a);
  }

  // ---- uchwyty na belkach: języczek ~24×8 mm na środku, na zewnątrz (górna belka - w górę, dolna - w dół)
  float tabW = max(12.0 / max(uMm.x, 200.0), 3.0 * px.x);
  float tabH = max(8.0 / max(uMm.y, 300.0), 2.5 * px.y);
  // plisa do 100 cm: jeden uchwyt na środku listwy, szersza: dwa (właściciel 8.11, jak w produkcji)
  float hu = uKind < 0.5 && uMm.x > 1000.0 ? min(abs(u - 0.28), abs(u - 0.72)) : abs(u - 0.5);
  if (!b25 && hu < tabW + px.x) {
    float inU = 1.0 - smoothstep(tabW - px.x, tabW + px.x, hu);
    // górna belka: nad nią; dolna: pod nią
    float tA = uKind > 1.5 ? 0.0 : smoothstep(tTop - tabH - px.y, tTop - tabH + px.y, v) * (1.0 - smoothstep(tTop - px.y, tTop + px.y, v));
    float tB = smoothstep(bBot - px.y, bBot + px.y, v) * (1.0 - smoothstep(bBot + tabH - px.y, bBot + tabH + px.y, v));
    float tab = inU * max(tA, tB);
    if (tab > 0.0) {
      float lr = 1.0 - 0.18 * smoothstep(tabW * 0.55, tabW, hu); // boki wypustki w cieniu
      float rr = tA > tB ? (v - (tTop - tabH)) / tabH : (v - bBot) / tabH;
      vec3 tcol = railPlain() * lr * (tA > tB ? mix(1.1, 0.96, rr) : mix(0.98, 0.74, rr)) * uFront * mix(vec3(1.0), uTint, 0.5);
      col = vec4(mix(col.rgb, tcol, tab), max(col.a, tab));
    }
  }

  // ---- linki: po dwie przy każdej krawędzi szyby, od uchwytu narożnego do uchwytu (przez otwory w tkaninie i belkach)
  float cu = min(min(abs(u - 0.018), abs(u - 0.03)), min(abs(u - 0.97), abs(u - 0.982)));
  float line = 1.0 - smoothstep(px.x * 0.45, px.x * 1.2, cu);
  if (uKind < 0.5 && (v < tTop || v > bBot) && v > -0.01 && v < 1.01 && line > 0.0) {
    // żyłka napinająca: cienka, jasna, półprzezroczysta - na zdjęciu ledwo widoczna
    vec3 cc = mix(texture2D(uPhoto, tc).rgb, vec3(0.82, 0.8, 0.76) * uFront, 0.55);
    float la = line * 0.5;
    col = vec4(mix(col.rgb, cc, la), max(col.a, la));
  }

  // ---- uchwyty narożne w prawdziwej skali: montaż standard - mały uchwyt ~10×14 mm przykręcony do listwy
  // przyszybowej, w większości schowany za belką; bez wiercenia - zaczep ~14×22 mm zakładany na skrzydło
  float bwMm = uMount > 0.5 ? 14.0 : 10.0;
  float bhMm = uMount > 0.5 ? 22.0 : 14.0;
  float bw = bwMm / max(uMm.x, 200.0);
  float bh = bhMm / max(uMm.y, 300.0);
  float ox = (uMount > 0.5 ? 6.0 : 3.0) / max(uMm.x, 200.0); // ile wystaje poza szybę (na ramę)
  float oy = (uMount > 0.5 ? 4.0 : 2.0) / max(uMm.y, 300.0);
  bool inBx = (u > -ox && u < bw - ox) || (u > 1.0 - bw + ox && u < 1.0 + ox);
  bool inBy = (v > -oy && v < bh - oy) || (v > 1.0 - bh + oy && v < 1.0 + oy);
  if (uKind < 0.5 && inBx && inBy) {
    float lu = u < 0.5 ? (u + ox) / bw : (1.0 + ox - u) / bw;
    float lv = v < 0.5 ? (v + oy) / bh : (1.0 + oy - v) / bh;
    // mała bryła z tworzywa: lekki gradient, zaokrąglone rogi, cień przy ramie
    float shade = 0.92 + 0.1 * smoothstep(0.0, 0.4, lv) - 0.1 * smoothstep(0.7, 1.0, lu);
    vec2 cr = abs(vec2(lu, lv) - 0.5) * 2.0;
    float rounded = 1.0 - smoothstep(0.85, 1.0, max(cr.x, cr.y) + 0.25 * min(cr.x, cr.y));
    float edgeA = rounded * smoothstep(0.0, 1.5 * px.x / bw, lu) * smoothstep(0.0, 1.5 * px.y / bh, lv);
    vec3 bc = uBracket * shade * uFront * mix(vec3(1.0), uTint, 0.5);
    col = vec4(mix(col.rgb, bc, edgeA), max(col.a, edgeA));
  }
  // ---- prowadnice boczne (okna dachowe): profil aluminiowy na całej wysokości szyby, w kolorze osprzętu,
  // zachodzi ok. 1/4 szerokości na szkło; zaokrąglony: jaśniejszy środek, ciemniejsze krawędzie i rowek po wewnętrznej stronie
  if (uKind > 0.5 && !b25 && uGuide > 0.0) {
    float gIn = 0.25 * uGuide;
    float gL = (u > gIn - uGuide && u < gIn) ? (u - (gIn - uGuide)) / uGuide : -1.0;
    float gR = (u > 1.0 - gIn && u < 1.0 - gIn + uGuide) ? 1.0 - (u - (1.0 - gIn)) / uGuide : -1.0;
    float gq = max(gL, gR);
    if (gq >= 0.0 && v > -0.012 && v < 1.012) {
      float sh = 0.8 + 0.26 * sin(gq * 3.1416);
      sh *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 0.12, abs(gq - 0.85)));
      vec3 gc = railBase(gq, v * uMm.y / max(uMm.x, 1.0)) * sh * uFront * mix(vec3(1.0), uTint, 0.5) * 1.02;
      float ga = smoothstep(0.0, 1.5 * px.x / uGuide, gq) * smoothstep(0.0, 1.5 * px.x / uGuide, 1.0 - gq);
      ga *= smoothstep(-0.012, -0.012 + px.y, v) * (1.0 - smoothstep(1.012 - px.y, 1.012, v));
      col = vec4(mix(col.rgb, gc, ga), max(col.a, ga));
    }
  }
  // ---- roleta dachowa B25 szeroki: szczotka pod belką, uchwyty, rama (kaseta + szerokie prowadnice łączone na ukos)
  if (b25) {
    vec3 lightC = uFront * frameK * mix(vec3(1.0), uTint, 0.5);
    if (inPane) {
      // szczotka uszczelniająca pod belką (ciemnoszare włosie)
      float sb = smoothstep(bBot - px.y, bBot + px.y, v) * (1.0 - smoothstep(bBot + brushH - px.y, bBot + brushH + px.y, v));
      if (sb > 0.0) {
        float fib = (hash(vec2(floor(u * uMm.x / 1.6), 3.0)) - 0.5) * clamp(uPx.x / uMm.x * 1.6, 0.0, 1.0);
        vec3 bc = vec3(0.3, 0.31, 0.33) * (1.0 + 0.5 * fib) * lightC;
        col = vec4(mix(col.rgb, bc, sb), max(col.a, sb));
      }
      // uchwyt z tworzywa na środku belki - za niego ściąga się roletę
      float hw = max(28.0 / uMm.x, 3.0 * px.x);
      float hu2 = abs(u - 0.5);
      float hy0 = bTop + 0.2 * uRailH;
      float hy1 = bBot + 0.3 * uRailH;
      float hr = clamp((v - hy0) / max(hy1 - hy0, 0.0001), 0.0, 1.0);
      float hwv = hw * (1.0 - 0.16 * hr);
      float hTab = (1.0 - smoothstep(hwv - px.x, hwv + px.x, hu2)) * smoothstep(hy0 - px.y, hy0 + px.y, v) * (1.0 - smoothstep(hy1 - px.y, hy1 + px.y, v));
      if (hTab > 0.0) {
        float hs = mix(1.0, 0.66, smoothstep(0.1, 1.0, hr)) * (1.0 - 0.3 * smoothstep(hwv * 0.55, hwv, hu2));
        hs += 0.12 * (1.0 - smoothstep(0.0, 0.16, hr));
        vec3 hc = mix(railPlain(), vec3(0.74, 0.76, 0.78), 0.45) * hs * lightC;
        col = vec4(mix(col.rgb, hc, hTab), max(col.a, hTab));
      }
    }
    // rama w milimetrach: xm - od zewnętrznej krawędzi prowadnicy do środka (obie strony symetrycznie),
    // ym - od górnej krawędzi kasety w dół; otwór na tkaninę ma proste górne narożniki (cięcie na ukos dochodzi
    // do samego rogu), zewnętrzne narożniki ramy są lekko ścięte
    vec2 mm = vec2(u, v) * uMm;
    vec2 pmm = uMm / max(uPx, vec2(1.0));
    float pm = max(pmm.x, pmm.y);
    float gW = uGuide * uMm.x;
    float cH = uTopH * uMm.y;
    float xm = min(mm.x - (uLap.x * uMm.x - gW), (uMm.x - uLap.x * uMm.x + gW) - mm.x);
    float ym = mm.y - (uLap.y * uMm.y - cH);
    float yB = uMm.y + 14.0; // prowadnice kończą się tuż pod szybą, na dolnym ramiaku skrzydła
    float R = 2.0;
    float sc = (xm + ym - 9.0) * 0.7071; // ścięcie zewnętrznego narożnika
    vec2 dc = vec2(gW + R - xm, cH + R - ym);
    float hole = (dc.x > 0.0 && dc.y > 0.0) ? R - length(dc) : min(xm - gW, ym - cH);
    float fa = smoothstep(-pmm.x, pmm.x, xm) * smoothstep(-pmm.y, pmm.y, ym) * (1.0 - smoothstep(yB - pmm.y, yB + pmm.y, mm.y)) * (1.0 - smoothstep(-pm, pm, hole)) * smoothstep(-pm, pm, sc);
    if (fa > 0.0) {
      float diag = ym * gW - xm * cH; // < 0: kaseta, > 0: prowadnica (łączenie na ukos jak w ramie obrazu)
      vec3 c;
      if (diag < 0.0) {
        c = frameBase(ym + 7.0, mm.x, pmm.y) * profB25(clamp(ym / cH, 0.0, 1.0), pmm.y / cH, 1.0) * brushed(mm.x, ym);
        c *= 1.0 - 0.07 * abs(u - 0.45) * 2.0; // lico jaśniejsze przy środku okna
      } else {
        float qg = clamp(xm / gW, 0.0, 1.0);
        c = frameBase(xm + 7.0, mm.y, pmm.x) * profB25(qg, pmm.x / gW, 0.7) * brushed(mm.y, xm);
        if (u > 0.5) c *= 0.96;
        // zaślepka z tworzywa na dole prowadnicy
        float capT = yB - 12.0;
        float cap = smoothstep(capT - pmm.y, capT + pmm.y, mm.y);
        vec3 capC = railPlain() * (0.74 + 0.24 * sin(qg * 3.1416)) * mix(1.04, 0.8, clamp((mm.y - capT) / 12.0, 0.0, 1.0));
        c = mix(c, capC, cap);
        c *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, max(0.8, 1.2 * pmm.y), abs(mm.y - capT)));
      }
      // ścięty narożnik zewnętrzny: wąska, jaśniejsza faza
      c *= 1.0 + 0.1 * (1.0 - smoothstep(0.0, 5.0, sc)) * step(max(xm, ym), 16.0);
      if (xm < gW + R && ym < cH + R) {
        // narożnik: jaśniejszy pasek łącznika i ciemna linia cięcia na ukos
        float dd = abs(diag) / length(vec2(gW, cH));
        float sw = max(0.9, 1.1 * pm);
        c *= 1.0 + 0.06 * (1.0 - smoothstep(sw, 4.0 * sw, dd));
        c *= 1.0 - 0.34 * (1.0 - smoothstep(0.0, sw, dd));
      }
      c = clamp(c * lightC * 1.02, 0.0, 1.0);
      col = vec4(mix(col.rgb, c, fa), max(col.a, fa));
    }
    // miękki cień ramy: na skrzydle wokół niej i na odsłoniętej szybie przy prowadnicach i pod kasetą
    float outD = max(max(max(-xm, -ym), -sc), xm < gW + 2.0 ? mm.y - yB : -1.0);
    if (outD > 0.0 && col.a < 0.01) col = vec4(vec3(0.0), 0.26 * exp(-outD / 5.0));
    if (hole > 0.0 && inPane && v < 1.0 && col.a < 0.01) col = vec4(vec3(0.0), 0.2 * exp(-hole / 6.0) * uFront);
  }
  // ziarno zdjęcia na wszystkim, co narysowaliśmy
  col.rgb = clamp(col.rgb + grain * 0.7 * col.a, 0.0, 1.0);

  // ---- obrys szyby w trybie edycji
  if (uOutline > 0.5) {
    float du = min(abs(u), abs(1.0 - u)) * uPx.x;
    float dv = min(abs(v), abs(1.0 - v)) * uPx.y;
    float o = (1.0 - smoothstep(1.0, 2.5, min(du, dv))) * step(-0.01, u) * step(u, 1.01) * step(-0.01, v) * step(v, 1.01);
    vec3 oc = uSel > 0.5 ? vec3(0.06, 0.73, 0.65) : vec3(1.0);
    col = vec4(mix(col.rgb, oc, o), max(col.a, o));
  }

  col.a *= inX;
  // zaciemnienie pokoju (okna dachowe): przez niezasłonięte szkło nadal widać jasne niebo - tu wracamy do oryginału
  if (uDark > 0.001 && u > 0.0 && u < 1.0 && v > 0.0 && v < 1.0 && uOutline < 0.5) {
    vec3 ph = texture2D(uPhoto, tc).rgb;
    col = vec4(mix(ph, col.rgb, col.a), 1.0);
  }
  if (col.a < 0.003) discard;
  gl_FragColor = vec4(col.rgb * col.a, col.a);
}`;

type Uniforms = Record<string, WebGLUniformLocation | null>;

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type);
  if (!s) throw new Error("shader");
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader");
  return s;
}

function program(gl: WebGLRenderingContext, fs: string, names: string[]): { p: WebGLProgram; u: Uniforms; a: number } {
  const p = gl.createProgram();
  if (!p) throw new Error("program");
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VS));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || "link");
  const u: Uniforms = {};
  for (const n of names) u[n] = gl.getUniformLocation(p, n);
  return { p, u, a: gl.getAttribLocation(p, "aPos") };
}

function edgeLen(a: Pt, b: Pt): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/** Wymiary szyby w px na zdjęciu (średnie krawędzie). */
export function panePixelSize(c: Pt[]): [number, number] {
  return [(edgeLen(c[0], c[1]) + edgeLen(c[3], c[2])) / 2, (edgeLen(c[0], c[3]) + edgeLen(c[1], c[2])) / 2];
}

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "").trim();
  const f = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
  const n = parseInt(f.slice(0, 6), 16);
  if (!Number.isFinite(n)) return [0.9, 0.9, 0.9];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export class WizRenderer {
  private gl: WebGLRenderingContext;
  private canvas: HTMLCanvasElement;
  private photoProg: ReturnType<typeof program>;
  private paneProg: ReturnType<typeof program>;
  private buf: WebGLBuffer;
  private photoTex: WebGLTexture | null = null;
  private maskTex: WebGLTexture | null = null;
  private emptyTex: WebGLTexture;
  private fabricTex = new Map<string, WebGLTexture>();
  private texMean = new Map<string, Rgb>();
  private railTex = new Map<string, WebGLTexture>();
  private railMean = new Map<string, Rgb>();
  private w = 1;
  private h = 1;
  /** pomniejszona kopia zdjęcia - z niej liczymy średni kolor za każdą szybą (równy prześwit plisy) */
  private photoSmall: { d: Uint8ClampedArray; w: number; h: number } | null = null;
  private backAvg = new Map<string, Rgb | null>();

  static supported(): boolean {
    try {
      const c = document.createElement("canvas");
      return !!(c.getContext("webgl") || c.getContext("experimental-webgl"));
    } catch {
      return false;
    }
  }

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = (canvas.getContext("webgl", { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: true }) ||
      canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) throw new Error("Twoja przeglądarka nie obsługuje WebGL.");
    this.gl = gl;
    this.photoProg = program(gl, FS_PHOTO, ["uPhoto", "uMask", "uRes", "uMaskOnly", "uVp", "uDark", "uSplit"]);
    this.paneProg = program(gl, FS_PANE, [
      "uPhoto", "uTex", "uRes", "uInv", "uPx", "uTop", "uBot", "uRailH", "uPleats", "uRep", "uHasTex", "uTexMean", "uFabric", "uTrans", "uBack",
      "uFront", "uTint", "uRail", "uBracket", "uMount", "uHoney", "uPitch", "uSplit", "uSel", "uOutline", "uVp",
      "uRailTex", "uHasRailTex", "uRailMean", "uRailRep", "uWood", "uWoodRings", "uMm", "uKind", "uTopH", "uGuide", "uLap", "uDark", "uBackAvg",
    ]);
    const b = gl.createBuffer();
    if (!b) throw new Error("buffer");
    this.buf = b;
    this.emptyTex = this.makeTexture(null, false);
  }

  private makeTexture(img: TexImageSource | null, repeat: boolean): WebGLTexture {
    const gl = this.gl;
    const t = gl.createTexture();
    if (!t) throw new Error("texture");
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    if (img) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    }
    if (repeat) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  }

  setPhoto(img: HTMLImageElement): void {
    this.w = img.naturalWidth;
    this.h = img.naturalHeight;
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    if (this.photoTex) this.gl.deleteTexture(this.photoTex);
    this.photoTex = this.makeTexture(img, false);
    this.backAvg.clear();
    this.photoSmall = null;
    try {
      const k = 96 / Math.max(this.w, this.h, 1);
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(this.w * k));
      c.height = Math.max(1, Math.round(this.h * k));
      const ctx = c.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, c.width, c.height);
        this.photoSmall = { d: ctx.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height };
      }
    } catch {
      // bez kopii zostaje samo lokalne rozmycie w shaderze
    }
  }

  /** Średni kolor zdjęcia w obrębie szyby (siatka 10×10 punktów, bez samych brzegów przy ramie). */
  private paneBackAvg(H: Mat3, corners: Pt[]): Rgb | null {
    const ps = this.photoSmall;
    if (!ps) return null;
    const key = corners.map((c) => Math.round(c[0]) + "," + Math.round(c[1])).join(";");
    const hit = this.backAvg.get(key);
    if (hit !== undefined) return hit;
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 10; j++) {
        const [x, y] = apply(H, [0.08 + (0.84 * i) / 9, 0.08 + (0.84 * j) / 9]);
        const px = Math.round((x / this.w) * (ps.w - 1));
        const py = Math.round((y / this.h) * (ps.h - 1));
        if (px < 0 || py < 0 || px >= ps.w || py >= ps.h) continue;
        const o = (py * ps.w + px) * 4;
        r += ps.d[o];
        g += ps.d[o + 1];
        b += ps.d[o + 2];
        n++;
      }
    }
    const avg: Rgb | null = n >= 20 ? [r / n / 255, g / n / 255, b / n / 255] : null;
    if (this.backAvg.size > 64) this.backAvg.clear();
    this.backAvg.set(key, avg);
    return avg;
  }

  setMask(img: HTMLImageElement | null): void {
    if (this.maskTex) this.gl.deleteTexture(this.maskTex);
    this.maskTex = img ? this.makeTexture(img, false) : null;
  }

  /** Tekstura tkaniny (kafel 256×256 z CRM). */
  hasFabric(id: string): boolean {
    return this.fabricTex.has(id);
  }

  addFabric(id: string, img: HTMLImageElement): void {
    if (this.fabricTex.has(id)) return;
    this.fabricTex.set(id, this.makeTexture(img, true));
    // średni kolor kafla - shader liczy wzór względem niego. Liczony z 64×64 pikseli: zmniejszenie do 1×1
    // przeglądarka robi z kilku punktów, nie z całego kafla, i kolor plisy uciekał od próbki (właściciel 1.11)
    let mean: Rgb = [0.8, 0.8, 0.8];
    try {
      const c = document.createElement("canvas");
      c.width = 64;
      c.height = 64;
      const ctx = c.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, 64, 64);
        const d = ctx.getImageData(0, 0, 64, 64).data;
        let r = 0;
        let g = 0;
        let b = 0;
        for (let i = 0; i < d.length; i += 4) {
          r += d[i];
          g += d[i + 1];
          b += d[i + 2];
        }
        const n = d.length / 4;
        mean = [r / n / 255, g / n / 255, b / n / 255];
      }
    } catch {
      // obraz bez CORS - zostaje szara średnia
    }
    this.texMean.set(id, mean);
  }

  hasRail(id: string): boolean {
    return this.railTex.has(id);
  }

  /** Zdjęcie listwy z katalogu (profil poziomo, 600×300): wycinamy lico profilu i kafelkujemy wzdłuż belki. */
  addRail(id: string, img: HTMLImageElement): void {
    if (this.railTex.has(id)) return;
    try {
      const c = document.createElement("canvas");
      c.width = 512;
      c.height = 64;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const sx = img.naturalWidth * 0.06;
      const sw = img.naturalWidth * 0.46;
      const sy = img.naturalHeight * 0.3;
      const sh = img.naturalHeight * 0.4;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 512, 64);
      // lustrzane odbicie na końcu kafla, żeby słoje nie miały szwu
      ctx.save();
      ctx.translate(512, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 512, 64);
      ctx.restore();
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 256, 64);
      const d = ctx.getImageData(0, 0, 512, 64).data;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let i = 0; i < d.length; i += 4) {
        r += d[i];
        g += d[i + 1];
        b += d[i + 2];
      }
      const n = d.length / 4;
      this.railMean.set(id, [r / n / 255, g / n / 255, b / n / 255]);
      this.railTex.set(id, this.makeTexture(c, true));
    } catch {
      // obraz bez CORS - belka w jednolitym kolorze z katalogu
    }
  }

  get size(): [number, number] {
    return [this.w, this.h];
  }

  private drawPoly(prog: ReturnType<typeof program>, pts: number[]): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pts), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(prog.a);
    gl.vertexAttribPointer(prog.a, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, pts.length / 2);
  }

  render(panes: PaneRender[], scene: SceneRender): void {
    const gl = this.gl;
    if (!this.photoTex) return;
    gl.viewport(0, 0, this.w, this.h);
    gl.disable(gl.BLEND);
    const full = [0, 0, this.w, 0, this.w, this.h, 0, 0, this.w, this.h, 0, this.h];

    // 1) zdjęcie
    const pp = this.photoProg;
    gl.useProgram(pp.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.photoTex);
    gl.uniform1i(pp.u.uPhoto, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.maskTex || this.emptyTex);
    gl.uniform1i(pp.u.uMask, 1);
    gl.uniform2f(pp.u.uRes, this.w, this.h);
    gl.uniform2f(pp.u.uVp, this.w, this.h);
    gl.uniform1f(pp.u.uMaskOnly, 0);
    const dark = Math.max(0, Math.min(0.55, scene.darken || 0));
    gl.uniform1f(pp.u.uDark, dark);
    gl.uniform1f(pp.u.uSplit, scene.split);
    this.drawPoly(pp, full);

    // 2) plisy
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const q = this.paneProg;
    gl.useProgram(q.p);
    gl.uniform2f(q.u.uRes, this.w, this.h);
    gl.uniform2f(q.u.uVp, this.w, this.h);
    gl.uniform3f(q.u.uTint, scene.tint[0], scene.tint[1], scene.tint[2]);
    gl.uniform1f(q.u.uSplit, scene.split);
    gl.uniform1f(q.u.uOutline, scene.outline ? 1 : 0);
    gl.uniform1f(q.u.uDark, dark);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.photoTex);
    gl.uniform1i(q.u.uPhoto, 0);
    for (const p of panes) {
      const H = paneToImage(p.corners);
      const Hi = H ? invert3(H) : null;
      if (!H || !Hi) continue;
      // macierz w GLSL kolumnami
      gl.uniformMatrix3fv(q.u.uInv, false, [Hi[0], Hi[3], Hi[6], Hi[1], Hi[4], Hi[7], Hi[2], Hi[5], Hi[8]]);
      const [pw, ph] = panePixelSize(p.corners);
      gl.uniform2f(q.u.uPx, pw, ph);
      const hMm = Math.max(300, p.heightMm || 1200);
      const wMm = Math.max(200, p.widthMm || hMm * (pw / Math.max(ph, 1)));
      const railH = Math.max(RAIL_MM / hMm, 4 / Math.max(ph, 1));
      const kind = p.kind === "roleta-dachowa" ? 2 : p.kind === "plisa-dachowa" ? 1 : 0;
      gl.uniform1f(q.u.uKind, kind);
      // roleta B25: kaseta na stałe nad szybą (dolna warga zachodzi na szkło), szerokie prowadnice na skrzydle;
      // plisa dachowa: górna belka jak dolna, wąskie prowadnice na krawędzi szyby
      const b25 = kind === 2;
      const kasH = Math.max(KASETA_MM / hMm, 8 / Math.max(ph, 1));
      const lap: [number, number] = b25 ? [ZAKLAD_B25_MM[0] / wMm, ZAKLAD_B25_MM[1] / hMm] : [0, 0];
      const guide = b25 ? Math.max(PROWADNICA_B25_MM / wMm, 6 / Math.max(pw, 1)) : kind > 0 ? Math.max(PROWADNICA_MM / wMm, 3 / Math.max(pw, 1)) : 0;
      gl.uniform1f(q.u.uTopH, b25 ? kasH : railH);
      gl.uniform1f(q.u.uGuide, guide);
      gl.uniform2f(q.u.uLap, lap[0], lap[1]);
      gl.uniform1f(q.u.uTop, b25 ? lap[1] - kasH : p.top);
      gl.uniform1f(q.u.uBot, p.bottom);
      gl.uniform1f(q.u.uRailH, b25 ? Math.max(BELKA_B25_MM / hMm, 4 / Math.max(ph, 1)) : railH);
      gl.uniform1f(q.u.uPleats, Math.max(8, Math.round(hMm / OKRES_FALDY_MM)));
      const avg = this.paneBackAvg(H, p.corners);
      gl.uniform4f(q.u.uBackAvg, avg ? avg[0] : 0, avg ? avg[1] : 0, avg ? avg[2] : 0, avg ? 1 : 0);
      gl.uniform2f(q.u.uRep, wMm / TILE_MM, hMm / TILE_MM);
      const tex = this.fabricTex.get(p.fabric.id);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, tex || this.emptyTex);
      gl.uniform1i(q.u.uTex, 1);
      gl.uniform1f(q.u.uHasTex, tex ? 1 : 0);
      const tm = this.texMean.get(p.fabric.id) || [0.8, 0.8, 0.8];
      gl.uniform3f(q.u.uTexMean, tm[0], tm[1], tm[2]);
      gl.uniform3f(q.u.uFabric, p.fabric.color[0], p.fabric.color[1], p.fabric.color[2]);
      gl.uniform1f(q.u.uTrans, p.fabric.transmission);
      gl.uniform1f(q.u.uBack, p.back);
      // ciemniejszy pokój słabiej oświetla przód osłony (prześwit zza szyby zostaje)
      gl.uniform1f(q.u.uFront, p.front * (1 - 0.45 * dark));
      gl.uniform3f(q.u.uRail, p.rail[0], p.rail[1], p.rail[2]);
      const rt = this.railTex.get(p.railId);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, rt || this.emptyTex);
      gl.uniform1i(q.u.uRailTex, 2);
      gl.uniform1f(q.u.uHasRailTex, rt && !p.railWood && !b25 ? 1 : 0);
      const rm = this.railMean.get(p.railId) || [0.8, 0.8, 0.8];
      gl.uniform3f(q.u.uRailMean, rm[0], rm[1], rm[2]);
      gl.uniform1f(q.u.uRailRep, wMm / 260); // zdjęcie profilu pokazuje ok. 26 cm listwy
      gl.uniform1f(q.u.uWood, p.railWood ? 1 : 0);
      // ok. 5 px na słój w poprzek profilu (belka 22 mm), od 1,2 do 4 słojów - małe okno na telefonie nie migocze
      gl.uniform1f(q.u.uWoodRings, Math.max(1.2, Math.min(4, (RAIL_MM / hMm) * ph / 5)));
      gl.uniform2f(q.u.uMm, wMm, hMm);
      gl.uniform3f(q.u.uBracket, p.bracket[0], p.bracket[1], p.bracket[2]);
      gl.uniform1f(q.u.uMount, p.mount === "bezinwazyjny" ? 1 : 0);
      gl.uniform1f(q.u.uHoney, p.fabric.honeycomb ? 1 : 0);
      gl.uniform1f(q.u.uPitch, p.pitch);
      gl.uniform1f(q.u.uSel, p.selected ? 1 : 0);
      // obszar rysowania: szyba z marginesem na uchwyty, linki i grubość belek
      const mx = b25 ? guide - lap[0] + 24 / wMm : kind > 0 ? 0.03 + PROWADNICA_MM / wMm : 0.03;
      const myT = b25 ? Math.max(0.06, kasH - lap[1] + 24 / hMm) : 0.06;
      const myB = b25 ? Math.max(0.06, 40 / hMm) : 0.06;
      const m: Pt[] = [[-mx, -myT], [1 + mx, -myT], [1 + mx, 1 + myB], [-mx, 1 + myB]].map((x) => apply(H as Mat3, x as Pt));
      this.drawPoly(q, [m[0][0], m[0][1], m[1][0], m[1][1], m[2][0], m[2][1], m[0][0], m[0][1], m[2][0], m[2][1], m[3][0], m[3][1]]);
    }

    // 3) przedmioty przed szybą z powrotem na wierzch
    if (this.maskTex) {
      gl.useProgram(pp.p);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.photoTex);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.maskTex);
      gl.uniform1f(pp.u.uMaskOnly, 1);
      this.drawPoly(pp, full);
    }
  }

  /** Obraz do pobrania / udostępnienia (JPEG). */
  toDataUrl(quality = 0.9): string {
    return this.canvas.toDataURL("image/jpeg", quality);
  }

  dispose(): void {
    const gl = this.gl;
    for (const t of this.fabricTex.values()) gl.deleteTexture(t);
    this.fabricTex.clear();
    for (const t of this.railTex.values()) gl.deleteTexture(t);
    this.railTex.clear();
    if (this.photoTex) gl.deleteTexture(this.photoTex);
    if (this.maskTex) gl.deleteTexture(this.maskTex);
    gl.deleteTexture(this.emptyTex);
    gl.deleteBuffer(this.buf);
  }
}
