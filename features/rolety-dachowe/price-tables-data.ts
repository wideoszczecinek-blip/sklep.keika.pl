// Real price matrices for rolety-dachowe, sourced from the CRM's public
// configurator API for the wider "dachowe" product family
// (configurator_public?slug=dachowe - rolety-dachowe's own product record
// uses a flat price, but per the business owner these matrix-based tables
// from the "dachowe" family are what should actually drive this product's
// price too), fetched 2026-08-30. One table per hardware-color x
// material-type combination; each cell is the price (PLN, before the
// -10% "Domyslny profil Allegro" adjustment applied in shared.ts) for a
// roleta whose width/height falls within that row/column's breakpoint -
// see resolvePriceBreakpointIndex in shared.ts for the exact ceiling-
// lookup rule (matches resolveMatrixBreakpointIndex in the real
// configurator's own source, product-configurator-shell.tsx:185).
//
// A few cells are genuine data-entry anomalies already present in the
// CRM's own live pricing table (e.g. "37" instead of a ~370 in
// b25anoda2, and a few non-monotonic dips in b25sosna2/b25anoda/b25sosna)
// - kept byte-for-byte as fetched rather than "corrected" here, since the
// real configurator itself would charge exactly these same numbers; if
// they're really wrong, they should be fixed at the source (CRM) so the
// two stay in sync, not silently patched in just this one mirror of them.
export type PricingTable = {
  id: string;
  hardwareIds: string[];
  materialTypeIds: string[];
  widthBreakpointsMm: number[];
  heightBreakpointsMm: number[];
  /** [heightBreakpointIndex][widthBreakpointIndex] */
  prices: number[][];
};

export const ROLETY_DACHOWE_PRICE_TABLES: PricingTable[] = [
  {
    id: "b25anoda2",
    hardwareIds: ["bialy","srebrny"],
    materialTypeIds: ["polprzepuszczalny"],
    widthBreakpointsMm: [400,500,600,700,800,900,1000,1100,1200,1300,1400,1500,1600,1700,1800,1900,2000,2100],
    heightBreakpointsMm: [800,1100,1400,1700,2000,2300],
    prices: [
      [174,188,200,214,226,241,254,266,279,291,305,319,333,346,359,371,385,398],
      [207,222,238,253,269,285,299,315,331,346,361,375,391,406,421,436,452,467],
      [241,257,275,291,311,327,343,362,380,398,415,432,450,467,484,500,518,535],
      [273,291,311,331,350,371,390,408,428,448,468,488,507,525,545,565,585,605],
      [305,327,37,370,392,414,434,458,479,500,523,545,565,585,609,632,653,673],
      [339,362,386,408,432,458,480,504,528,551,576,600,624,648,673,697,720,743],
    ],
  },
  {
    id: "b25sosna2",
    hardwareIds: ["bialy","srebrny"],
    materialTypeIds: ["termo"],
    widthBreakpointsMm: [400,500,600,700,800,900,1000,1100,1200,1300,1400,1500,1600,1700,1800,1900,2000,2100],
    heightBreakpointsMm: [800,1100,1400,1700,2000,2300],
    prices: [
      [184,200,214,230,245,261,275,291,307,322,337,351,369,386,401,416,431,446],
      [218,238,257,275,293,313,331,347,367,386,404,422,441,460,478,495,514,533],
      [257,277,339,319,340,363,386,406,427,448,470,492,514,535,557,577,599,620],
      [291,317,340,363,390,414,439,463,487,511,536,561,585,609,634,658,684,709],
      [327,355,383,410,436,464,492,521,548,575,554,532,609,685,713,741,769,795],
      [363,394,424,456,487,516,547,577,608,638,669,698,729,759,789,819,851,882],
    ],
  },
  {
    id: "b25anoda",
    hardwareIds: ["sosna"],
    materialTypeIds: ["polprzepuszczalny"],
    widthBreakpointsMm: [400,500,600,700,800,900,1000,1100,1200,1300,1400,1500,1600,1700,1800,1900,2000,2100],
    heightBreakpointsMm: [800,1100,1400,1700,2000,2300],
    prices: [
      [214,230,245,261,277,291,307,322,339,355,371,386,401,416,432,448,464,479],
      [257,273,291,307,327,346,362,380,398,416,434,451,469,487,504,521,539,556],
      [297,317,335,358,375,398,416,436,456,476,496,516,436,556,576,596,616,636],
      [339,362,383,404,428,448,472,492,515,537,559,581,604,626,582,537,625,713],
      [380,404,430,452,473,503,525,549,573,597,623,648,671,694,719,743,768,793],
      [422,448,475,500,527,553,580,608,633,658,686,713,739,765,792,818,844,870],
    ],
  },
  {
    id: "b25sosna",
    hardwareIds: ["sosna"],
    materialTypeIds: ["termo"],
    widthBreakpointsMm: [400,500,600,700,800,900,1000,1100,1200,1300,1400,1500,1600,1700,1800,1900,2000,2100],
    heightBreakpointsMm: [800,1100,1400,1700,2000,2300],
    prices: [
      [223,241,258,277,293,313,331,347,417,486,453,420,438,456,474,491,509,527],
      [269,289,311,331,351,374,394,416,436,456,477,497,518,539,560,581,603,624],
      [313,339,362,386,408,432,458,480,504,527,552,577,601,624,649,673,697,721],
      [359,386,414,439,467,492,521,547,574,600,627,654,682,709,735,761,788,815],
      [404,434,463,492,523,553,584,612,643,673,704,734,764,793,824,854,883,912],
      [448,480,515,547,580,612,648,680,713,745,778,811,844,876,910,943,976,1009],
    ],
  },
];
