/**
 * Homografia 2D (rzutowanie płaszczyzny szyby na zdjęcie). Szyba to płaski
 * prostokąt widziany w perspektywie: 4 rogi na zdjęciu wyznaczają macierz 3×3,
 * która przenosi współrzędne szyby (u, v) ∈ [0,1]² na piksele zdjęcia i z
 * powrotem. Renderer liczy (u, v) dla każdego piksela - dzięki temu fałdy,
 * belki i linki „siedzą” w szybie pod każdym kątem.
 */
export type Pt = [number, number];
export type Mat3 = [number, number, number, number, number, number, number, number, number];

/** Rozwiązuje układ 8×8 (eliminacja Gaussa z wyborem elementu głównego). */
function solve8(a: number[][], b: number[]): number[] | null {
  const n = 8;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
    if (Math.abs(m[p][c]) < 1e-12) return null;
    [m[c], m[p]] = [m[p], m[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = m[r][c] / m[c][c];
      for (let k = c; k <= n; k++) m[r][k] -= f * m[c][k];
    }
  }
  return m.map((row, i) => row[n] / row[i]);
}

/** Macierz H taka, że dst ~ H·src (wiersze, h33 = 1). */
export function homography(src: Pt[], dst: Pt[]): Mat3 | null {
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [X, Y] = dst[i];
    a.push([x, y, 1, 0, 0, 0, -x * X, -y * X]);
    b.push(X);
    a.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]);
    b.push(Y);
  }
  const h = solve8(a, b);
  if (!h) return null;
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

export function invert3(m: Mat3): Mat3 | null {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-14) return null;
  const k = 1 / det;
  return [
    A * k, -(b * i - c * h) * k, (b * f - c * e) * k,
    B * k, (a * i - c * g) * k, -(a * f - c * d) * k,
    C * k, -(a * h - b * g) * k, (a * e - b * d) * k,
  ];
}

export function apply(m: Mat3, p: Pt): Pt {
  const w = m[6] * p[0] + m[7] * p[1] + m[8];
  return [(m[0] * p[0] + m[1] * p[1] + m[2]) / w, (m[3] * p[0] + m[4] * p[1] + m[5]) / w];
}

const UNIT: Pt[] = [[0, 0], [1, 0], [1, 1], [0, 1]];

/** H: (u,v) szyby → piksel zdjęcia. Rogi w kolejności LG, PG, PD, LD. */
export function paneToImage(corners: Pt[]): Mat3 | null {
  return homography(UNIT, corners);
}

/** Czy czworokąt jest wypukły i niezdegenerowany (warunek poprawnej homografii). */
export function isConvexQuad(q: Pt[]): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    const c = q[(i + 2) % 4];
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(cross) < 1e-6) return false;
    const s = cross > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/** Punkt w czworokącie (wypukłym). */
export function pointInQuad(q: Pt[], p: Pt): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    const cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    const s = cross >= 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}
