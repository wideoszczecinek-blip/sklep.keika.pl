// ---------------------------------------------------------------------------
// Polskie nazwy kolorów lameli. Etykiety w CRM pochodzą z formularza
// dostawcy (angielskie: „Basswood pearl white”, „Silver matt PERF”). Klient
// widzi polską nazwę; oryginał zostaje w kodzie koloru i w zamówieniu u
// dostawcy (zamówienie bierze wartości id[...] z ss-options, nie etykiety).
// ---------------------------------------------------------------------------

const PHRASES: Array<[RegExp, string]> = [
  [/\bantiq?ue? white\b|\bantic white\b/i, "antyczna biel"],
  [/\boff-white\b/i, "złamana biel"],
  [/\bpearl white\b/i, "perłowa biel"],
  [/\boyster white\b/i, "ostrygowa biel"],
  [/\bstone white\b/i, "kamienna biel"],
  [/\bghost white\b/i, "mglista biel"],
  [/\bgolden oak\b/i, "złoty dąb"],
  [/\blight oak\b/i, "jasny dąb"],
  [/\bantiq?e oak\b|\bantique oak\b/i, "dąb antyczny"],
  [/\bamerican walnut\b/i, "orzech amerykański"],
  [/\bcottage pine\b/i, "sosna rustykalna"],
  [/\bnatural maple\b/i, "klon naturalny"],
  [/\bblack coffee\b/i, "czarna kawa"],
  [/\bcacao bean\b/i, "ziarno kakao"],
  [/\bdark chocolate\b/i, "gorzka czekolada"],
  [/\bdark greige\b/i, "ciemny greige"],
  [/\blight greige\b/i, "jasny greige"],
  [/\bdark grey\b/i, "ciemnoszary"],
  [/\blight gr[ae]y\b/i, "jasnoszary"],
  [/\bgrey shadow\b/i, "szary cień"],
  [/\bsmoke grey\b/i, "szary dymny"],
  [/\bstone grey\b/i, "szary kamienny"],
  [/\bstone ash\b/i, "popiel kamienny"],
  [/\bsteel grey\b/i, "szary stalowy"],
  [/\broyal clay\b/i, "glina"],
  [/\btiger eye\b/i, "tygrysie oko"],
  [/\bbirch wood\b/i, "brzoza"],
  [/\bcorn silk\b/i, "kukurydziany"],
  [/\bhoney dew\b/i, "miodowy"],
  [/\blavender blush\b/i, "lawendowy róż"],
  [/\blemon chiffon\b/i, "cytrynowy"],
  [/\blight yellow\b/i, "jasnożółty"],
  [/\blight copper\b/i, "jasna miedź"],
  [/\bdark seagreen\b/i, "ciemnomorski"],
  [/\bdark green\b/i, "ciemnozielony"],
  [/\bdarkred\b/i, "ciemnoczerwony"],
  [/\bmedium blue\b/i, "niebieski"],
  [/\bmint cream\b/i, "miętowy"],
  [/\bsteelblue\b/i, "stalowoniebieski"],
  [/\blimegreen\b/i, "limonkowy"],
  [/\bstardust rosy brown\b/i, "brokat różany brąz"],
  [/\bstardust beige\b/i, "brokat beżowy"],
  [/\bstardust gold\b/i, "brokat złoty"],
  [/\bstardust silver\b|\bsilver stardust\b/i, "brokat srebrny"],
  [/\bdark shadow\b/i, "ciemny cień"],
  [/\bgrade b\b/i, "klasa B"],
  [/\bsilver metallic\b/i, "srebrny metalik"],
  [/\bgrey metallic\b/i, "szary metalik"],
  [/\bsteelblue metallic\b/i, "stalowoniebieski metalik"],
];

const WORDS: Record<string, string> = {
  white: "biały", black: "czarny", grey: "szary", gray: "szary", antracite: "antracyt", oak: "dąb", walnut: "orzech",
  cherry: "wiśnia", chestnut: "kasztan", wenge: "wenge", wengee: "wenge", natural: "naturalny", beech: "buk", maple: "klon",
  limestone: "wapień", linen: "len", taupe: "taupe", cloud: "obłok", sand: "piaskowy", shell: "muszla", pecan: "pekan",
  vanilla: "waniliowy", marble: "marmur", mahogany: "mahoń", redwood: "sekwoja", pine: "sosna", ash: "jesion", almond: "migdał",
  hazelnut: "orzech laskowy", palisander: "palisander", ivory: "kość słoniowa", beige: "beżowy", silver: "srebrny",
  copper: "miedziany", steel: "stalowy", stone: "kamienny", champagne: "szampański", prosecco: "prosecco", ginger: "imbirowy",
  java: "jawa", night: "nocny", shadow: "cień", navy: "granatowy", orange: "pomarańczowy", sienna: "sjena", mocha: "mokka",
  carbon: "karbon", blanco: "biel", nube: "obłok", nuez: "orzech", nogal: "orzech włoski", noche: "noc", paloma: "gołębi",
  castana: "kasztanowy", cascara: "kora", griseo: "szarość", gravilla: "żwir", escala: "skała", soleado: "słoneczny",
  honey: "miodowy", cappucino: "cappuccino", calvados: "calvados", atmosphere: "atmosfera", oyster: "ostrygowy", smoke: "dymny",
  snow: "śnieżnobiały", velvet: "aksamitny", metallic: "metalik", matt: "mat", mat: "mat", smooth: "gładki", gloss: "połysk",
  rosa: "różowy", brown: "brązowy", blue: "niebieski", green: "zielony", yellow: "żółty", gold: "złoty", cedro: "cedr",
  dark: "ciemny", light: "jasny", medium: "średni", alabaster: "alabastrowy", greige: "greige", birch: "brzoza",
};

const MATERIAL_PREFIX = /^(basswood|bamboo|abachi)\s+/i;

/** „Basswood pearl white” -> „Perłowa biel”, „Silver matt PERF” -> „Srebrny mat · perforowany”. */
export function zaluzjeColorNamePl(raw: string): string {
  let text = String(raw || "").trim();
  if (!text) return text;
  const notes: string[] = [];
  text = text.replace(/\*?now lighter/i, "");
  if (/dost[eę]pno[sś][cć]\s+do\s+wyczerpania\s+zapas[oó]w/i.test(text)) notes.push("do wyczerpania zapasów");
  const until = text.match(/dost[eę]pno[sś][cć]\s+do\s+ko[nń]ca\s+([\d.]+)/i);
  if (until) notes.push(`dostępny do ${until[1]}`);
  text = text.replace(/\(?\s*dost[eę]pno[sś][cć].*$/i, "").trim();
  const perforated = /\b(PERF|PRF)\b/.test(text);
  text = text.replace(/\b(PERF|PRF|EXPRESS)\b/g, "").trim();
  const isGloss = /^GLOSS\b/.test(text);
  text = text.replace(MATERIAL_PREFIX, "");
  for (const [pattern, value] of PHRASES) text = text.replace(pattern, value);
  text = text
    .split(/(\s+|-)/)
    .map((part) => {
      const key = part.toLowerCase();
      return WORDS[key] ?? part;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  if (isGloss) text = "czarny połysk";
  if (!text) text = String(raw || "").trim();
  let out = text.charAt(0).toUpperCase() + text.slice(1);
  if (perforated) out += " · perforowany";
  if (notes.length) out += ` (${notes.join(", ")})`;
  return out;
}
