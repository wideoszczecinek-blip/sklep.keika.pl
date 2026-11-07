/**
 * Renderer wizualizatora „Twoje okno” (WebGL1, bez bibliotek).
 *
 * Warstwy (od spodu): zdjęcie klienta → na każdej szybie plisa: tkanina
 * (prawdziwa tekstura próbki z CRM, kafelkowana w skali szyby) z plisowaniem
 * liczonym w płaszczyźnie szyby (stała liczba fałd ~20 mm, które ściskają się
 * przy przesuwaniu belek), światło z pokoju + prześwit od strony okna
 * (transmisja tkaniny × jasność za szybą, ciemniejsze zagięcia przy podświetleniu),
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
export const RAIL_MM = 22;
export const TILE_MM = 42;
/** Okna dachowe: kaseta rolety (wałek z tkaniną) i prowadnica boczna (mm). */
export const KASETA_MM = 46;
export const PROWADNICA_MM = 16;

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
uniform vec2 uMm;           // szerokość i wysokość szyby w mm (rozmiary uchwytów w mm, nie w % szyby)
uniform float uKind;        // 0 plisa okienna, 1 plisa dachowa, 2 roleta dachowa
uniform float uDark;        // zaciemnienie pokoju (okna dachowe): niezasłonięte szkło wraca do jasności oryginału
uniform float uTopH;        // wysokość górnej belki / kasety (część wysokości szyby)
uniform float uGuide;       // szerokość prowadnicy bocznej (część szerokości szyby), 0 = bez prowadnic
varying vec2 vPix;

float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

vec3 railBase(float r, float u) {
  // kolor listwy z katalogu; okleiny drewnopodobne mają słoje ze zdjęcia profilu (względem jego średniej)
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
  c = mix(c, uRail * capShade, cap);
  // szczelina między zaślepką a profilem
  float seam = (1.0 - smoothstep(0.0, 0.0025, abs(u - cw - 0.0015))) + (1.0 - smoothstep(0.0, 0.0025, abs(1.0 - u - cw - 0.0015)));
  c *= 1.0 - 0.25 * clamp(seam, 0.0, 1.0);
  return c;
}

void main() {
  if (vPix.x > uSplit) discard;
  vec3 hp = uInv * vec3(vPix, 1.0);
  vec2 uv = hp.xy / hp.z;
  float u = uv.x;
  float v = uv.y;
  vec2 px = 1.0 / max(uPx, vec2(1.0));
  vec2 tc = vPix / uRes;

  float x0 = uKind > 0.5 ? -0.75 * uGuide - 0.004 : -0.008;
  float x1 = uKind > 0.5 ? 1.0 + 0.75 * uGuide + 0.004 : 1.008;
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
  if (v >= tBot && v <= bTop && span > 0.0) {
    float t = (v - tBot) / span;
    bool roleta = uKind > 1.5;
    if (roleta) t = (v - tBot) / max(1.0 - tBot - uRailH, 0.001);
    float ph = roleta ? 0.25 : fract(t * uPleats);
    float pitchPx = span / uPleats * uPx.y;
    // fałda: górna ścianka do światła, dolna w lekkim cieniu; przy rozłożonej plisie
    // fałdy są płytkie (mały kontrast), przy ściśniętej - głębokie
    // fałda „harmonijka” jak na filmie 3D: górna ścianka do światła (jaśniejsza u grzbietu),
    // dolna w cieniu, ostry jasny grzbiet i ciemna dolina; kontrast rośnie przy ściśnięciu
    float cw = clamp(1.0 / max(pitchPx, 0.5), 0.04, 0.3);
    // tkanina matowa: rozłożona plisa ma płytkie, miękkie fałdy (mały kontrast), ściśnięta - głębsze
    float upF = mix(0.995, 1.03 + 0.07 * comp, smoothstep(0.0, 0.5, ph));
    float dnF = mix(0.985, 0.90 - 0.16 * comp, smoothstep(0.5, 1.0, ph));
    float s = ph < 0.5 ? upF : dnF;
    float prof = ph < 0.5 ? 1.0 : -1.0;
    float ridge = 1.0 - smoothstep(0.0, cw * 1.2, abs(ph - 0.5));
    s += (0.025 + 0.04 * comp) * ridge;
    float crease = smoothstep(1.0 - cw, 1.0, ph) + (1.0 - smoothstep(0.0, cw * 0.5, ph));
    s *= 1.0 - (0.07 + 0.18 * comp) * clamp(crease, 0.0, 1.0);
    if (roleta) {
      // roleta: płaska, napięta tkanina - tylko bardzo łagodne podłużne pofalowanie i jaśniejszy środek
      s = 1.0 + 0.012 * sin(u * 37.0 + 1.3) - 0.03 * pow(abs(u - 0.5) * 2.0, 3.0);
      prof = 0.0;
      crease = 0.0;
    }
    // drobne fałdy (poniżej ~3 px) uśredniamy, żeby nie migotały
    float aa = clamp((pitchPx - 1.5) / 3.0, 0.0, 1.0);
    s = mix(0.97, s, aa);
    crease *= aa;
    vec3 alb = uFabric;
    if (uHasTex > 0.5) {
      // tekstura niesie splot i wzór (względem swojej średniej, wzmocniony), średni kolor zawsze z katalogu
      vec3 tx = texture2D(uTex, vec2(u * uRep.x, t * uRep.y)).rgb;
      alb = clamp(uFabric * mix(vec3(1.0), tx / max(uTexMean, vec3(0.03)), 1.35), 0.0, 1.0);
    }
    // splot tkaniny w dwóch skalach (włókna ~0,7 mm i nierówności ~2,5 mm) - matowa faktura,
    // bez niej plisa wygląda jak blacha falista; gaśnie, gdy piksel jest większy od ziarna
    vec2 gm = vec2(u, t) * uMm;
    float mmPx = uPx.x / max(uMm.x, 200.0);
    float fine = (hash(floor(gm / 0.7)) - 0.5) * 0.14 * clamp((mmPx * 0.7 - 0.25) * 2.0, 0.0, 1.0);
    float coarse = (hash(floor(gm / 2.5) + 7.0) - 0.5) * 0.06 * clamp((mmPx * 2.5 - 0.3) * 1.5, 0.0, 1.0);
    s *= 1.0 + fine + coarse;
    // krawędzie tkaniny odchodzą od światła, cień belki górnej na fałdach
    float edge = smoothstep(0.0, 0.035, u) * smoothstep(0.0, 0.035, 1.0 - u);
    s *= mix(0.9, 1.0, edge);
    float dTop = (v - tBot) * uPx.y;
    s *= 1.0 - 0.22 * exp(-dTop / 5.0);
    float dBot = (bTop - v) * uPx.y;
    s *= 1.0 - 0.08 * exp(-dBot / 4.0);
    // barwa światła pokoju tylko w połowie - kolor próbki ma zostać rozpoznawalny
    vec3 front = alb * s * uFront * mix(vec3(1.0), uTint, 0.5);
    // prześwit: światło zza szyby rozproszone w tkaninie - plisa nie pokazuje kształtów za oknem,
    // tylko miękki blask (12 próbek w promieniu ~3 % zdjęcia)
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
    float dbl = roleta ? 1.0 : 1.0 - 0.3 * crease - 0.15 * comp + 0.06 * prof;
    vec3 diffused = mix(vec3(lum(alb)), alb, 0.8);
    // Realna jasność za szybą wpływa na ilość rozproszonego światła. Mocno
    // rozmyta próbka daje subtelny blask, bez ostrego widoku przez tkaninę.
    // Dla blackout (uTrans == 0) nie dodajemy żadnego prześwitu.
    float daylight = smoothstep(0.08, 0.8, lum(back));
    vec3 trans = clamp(uTrans * uBack * (0.65 + 1.15 * daylight) * diffused * dbl * mix(vec3(1.0), back / max(lum(back), 0.08), 0.12), 0.0, 0.92);
    // linki przez otwory w tkaninie (nie w plastrze miodu)
    float cords = 0.0;
    if (uHoney < 0.5 && uKind < 0.5) {
      float cu = min(min(abs(u - 0.018), abs(u - 0.03)), min(abs(u - 0.97), abs(u - 0.982)));
      cords = (1.0 - smoothstep(0.0, px.x * 1.1, cu)) * 0.18;
    }
    // światło z pokoju + prześwit (mieszanie „screen”: jasna tkanina pod słońce nie przepala się do bieli)
    vec3 lit3 = 1.0 - (1.0 - clamp(front, 0.0, 1.0)) * (1.0 - trans);
    col = vec4(lit3 * (1.0 - cords), 1.0);
  }
  // ziarno jak w fotografii z telefonu (~1,5 % szumu na piksel) - bez niego render wygląda jak naklejka
  float grain = (hash(floor(vPix)) - 0.5) * 0.03;

  // ---- belki (z grubością profilu widoczną pod kątem)
  float k = uRailH * min(0.9, abs(uPitch) * 3.5);
  for (int i = 0; i < 2; i++) {
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
      } else if (i == 0 && uKind > 1.5) {
        // kaseta rolety: zaokrąglona obudowa wałka - odblask u góry, cień ku dołowi, szczelina wylotu tkaniny
        float r = (v - a) / max(b - a, 0.0001);
        c = railBase(r, u) * (0.78 + 0.32 * sin(r * 3.1416 * 0.9 + 0.25));
        c *= 1.0 - 0.35 * (1.0 - smoothstep(0.0, max(0.05, 2.0 * px.y / max(b - a, 0.0001)), 1.0 - r));
      } else {
        c = railShade((v - a) / max(b - a, 0.0001), u, px.y / max(b - a, 0.0001));
      }
      c *= uFront * mix(vec3(1.0), uTint, 0.5) * 1.02;
      float al = edgeA * edgeB;
      col = vec4(mix(col.rgb, c, al), max(col.a, al));
    }
  }

  // cień belki dolnej na szybie tuż pod nią (miękki)
  if (v > bBot && v < bBot + 0.03 && col.a < 0.01) {
    float d = (v - bBot) * uPx.y;
    float a = 0.18 * exp(-d / 3.0) * uFront;
    col = vec4(vec3(0.0), a);
  }

  // ---- uchwyty na belkach: języczek ~24×8 mm na środku, na zewnątrz (górna belka - w górę, dolna - w dół)
  float tabW = max(12.0 / max(uMm.x, 200.0), 3.0 * px.x);
  float tabH = max(8.0 / max(uMm.y, 300.0), 2.5 * px.y);
  float hu = abs(u - 0.5);
  if (hu < tabW + px.x) {
    float inU = 1.0 - smoothstep(tabW - px.x, tabW + px.x, hu);
    // górna belka: nad nią; dolna: pod nią
    float tA = uKind > 1.5 ? 0.0 : smoothstep(tTop - tabH - px.y, tTop - tabH + px.y, v) * (1.0 - smoothstep(tTop - px.y, tTop + px.y, v));
    float tB = smoothstep(bBot - px.y, bBot + px.y, v) * (1.0 - smoothstep(bBot + tabH - px.y, bBot + tabH + px.y, v));
    float tab = inU * max(tA, tB);
    if (tab > 0.0) {
      float lr = 1.0 - 0.18 * smoothstep(tabW * 0.55, tabW, hu); // boki wypustki w cieniu
      float rr = tA > tB ? (v - (tTop - tabH)) / tabH : (v - bBot) / tabH;
      vec3 tcol = uRail * lr * (tA > tB ? mix(1.1, 0.96, rr) : mix(0.98, 0.74, rr)) * uFront * mix(vec3(1.0), uTint, 0.5);
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
  if (uKind > 0.5 && uGuide > 0.0) {
    float gIn = 0.25 * uGuide;
    float gL = (u > gIn - uGuide && u < gIn) ? (u - (gIn - uGuide)) / uGuide : -1.0;
    float gR = (u > 1.0 - gIn && u < 1.0 - gIn + uGuide) ? 1.0 - (u - (1.0 - gIn)) / uGuide : -1.0;
    float gq = max(gL, gR);
    if (gq >= 0.0 && v > -0.012 && v < 1.012) {
      float sh = 0.8 + 0.26 * sin(gq * 3.1416);
      sh *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 0.12, abs(gq - 0.85)));
      vec3 gc = railBase(gq, v * 3.0) * sh * uFront * mix(vec3(1.0), uTint, 0.5) * 1.02;
      float ga = smoothstep(0.0, 1.5 * px.x / uGuide, gq) * smoothstep(0.0, 1.5 * px.x / uGuide, 1.0 - gq);
      ga *= smoothstep(-0.012, -0.012 + px.y, v) * (1.0 - smoothstep(1.012 - px.y, 1.012, v));
      col = vec4(mix(col.rgb, gc, ga), max(col.a, ga));
    }
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
      "uRailTex", "uHasRailTex", "uRailMean", "uRailRep", "uMm", "uKind", "uTopH", "uGuide", "uDark",
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
      // roleta: kaseta z wałkiem na górze szyby (stała), plisa: górna belka jak dolna
      gl.uniform1f(q.u.uTopH, kind === 2 ? Math.max(KASETA_MM / hMm, 6 / Math.max(ph, 1)) : railH);
      gl.uniform1f(q.u.uGuide, kind > 0 ? Math.max(PROWADNICA_MM / wMm, 3 / Math.max(pw, 1)) : 0);
      gl.uniform1f(q.u.uTop, kind === 2 ? 0 : p.top);
      gl.uniform1f(q.u.uBot, p.bottom);
      gl.uniform1f(q.u.uRailH, railH);
      gl.uniform1f(q.u.uPleats, Math.max(8, Math.round(hMm / PLEAT_MM)));
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
      gl.uniform1f(q.u.uHasRailTex, rt ? 1 : 0);
      const rm = this.railMean.get(p.railId) || [0.8, 0.8, 0.8];
      gl.uniform3f(q.u.uRailMean, rm[0], rm[1], rm[2]);
      gl.uniform1f(q.u.uRailRep, wMm / 260); // zdjęcie profilu pokazuje ok. 26 cm listwy
      gl.uniform2f(q.u.uMm, wMm, hMm);
      gl.uniform3f(q.u.uBracket, p.bracket[0], p.bracket[1], p.bracket[2]);
      gl.uniform1f(q.u.uMount, p.mount === "bezinwazyjny" ? 1 : 0);
      gl.uniform1f(q.u.uHoney, p.fabric.honeycomb ? 1 : 0);
      gl.uniform1f(q.u.uPitch, p.pitch);
      gl.uniform1f(q.u.uSel, p.selected ? 1 : 0);
      // obszar rysowania: szyba z marginesem na uchwyty, linki i grubość belek
      const mx = kind > 0 ? 0.03 + PROWADNICA_MM / wMm : 0.03;
      const m: Pt[] = [[-mx, -0.06], [1 + mx, -0.06], [1 + mx, 1.06], [-mx, 1.06]].map((x) => apply(H as Mat3, x as Pt));
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
