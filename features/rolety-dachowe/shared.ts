// Shared data + pure helpers for the rolety-dachowe (roof window blind)
// configurator - used by the landing (app/home-client.tsx), the panel
// (ConfiguratorPanel.tsx) and the cart's "Edytuj pozycję" modal.
//
// Hardware/material-type/fabric options and price tables come LIVE from the
// CRM's public "dachowe" payload (fetchRoofBlindProfile below - the same
// source the Allegro configurator uses). The arrays in this file are the
// 2026-08-30 snapshot of that payload, kept as the offline fallback; the
// 420-model window library moved to roof-window-library.ts. Nothing here is
// invented.
import { optimizeImageUrl } from "@/lib/image-optim";
import { ROLETY_DACHOWE_PRICE_TABLES, type PricingTable } from "./price-tables-data";

export type HardwareOption = {
  id: string;
  label: string;
  color: string;
  imageUrl: string;
  galleryUrls: string[];
  priceDelta: number;
  previewLayerUrl?: string;
};

export type MaterialTypeOption = {
  id: string;
  label: string;
  subtitle: string;
  color: string;
  imageUrl: string;
};

export type FabricOption = {
  id: string;
  label: string;
  subtitle: string;
  color: string;
  imageUrl: string;
  /** Which material-type option(s) this fabric belongs under (see
   * ROLETY_DACHOWE_MATERIAL_TYPES) - the fabric step only shows entries
   * whose materialTypeId matches whichever material type was chosen. */
  materialTypeId: string;
};

// Kaseta i prowadnice (hardware/profile) colors - real CRM data, "Wybierz
// kolor kasety i prowadnic" step, all 3 real options (incl. "Jasna Sosna").
export const ROLETY_DACHOWE_HARDWARE: HardwareOption[] = [
  {
    id: "srebrny",
    label: "Anoda",
    color: "#C7CED6",
    imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260705_093902_e1023f08_osprzet-anoda-200x300.png",
    galleryUrls: ["https://crm-keika.groovemedia.pl/storage/shop/media/20260705_093902_e1023f08_osprzet-anoda-200x300.png"],
    priceDelta: 0,
    previewLayerUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260729_170317_0240b561_anoda-warstwa.png",
  },
  {
    id: "bialy",
    label: "Biały",
    color: "#F4F7F8",
    imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260705_093800_71b8210e_osprzet-bialy-200x300.png",
    galleryUrls: ["https://crm-keika.groovemedia.pl/storage/shop/media/20260705_093800_71b8210e_osprzet-bialy-200x300.png"],
    priceDelta: 0,
    previewLayerUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260729_181502_f32127c8_biały-warstwa.png",
  },
  {
    id: "sosna",
    label: "Jasna Sosna",
    color: "#E5BD72",
    imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260807_213952_9bd5ab44_osprzet-sosna-200x300-2__swatch_640.webp",
    galleryUrls: ["https://crm-keika.groovemedia.pl/storage/shop/media/20260807_213952_9bd5ab44_osprzet-sosna-200x300-2__swatch_640.webp"],
    priceDelta: 0,
    previewLayerUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260729_175827_29308238_warstwa-sosna.png",
  },
];

// "Wybierz rodzaj materiału" step - real CRM data. Determines which of the
// two fabric families (below) the next step offers.
export const ROLETY_DACHOWE_MATERIAL_TYPES: MaterialTypeOption[] = [
  {
    id: "polprzepuszczalny",
    label: "Półprzepuszczalny",
    subtitle: "Subtelnie rozprasza światło i zachowuje lżejszy, dekoracyjny efekt.",
    color: "#D9C9B0",
    imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260717_121305_6f5a14c9_deko__swatch_640.webp",
  },
  {
    id: "termo",
    label: "Termo",
    subtitle: "Tkanina nie przepuszcza światła i dzięki powłoce termicznej na zewnątrz skutecznie zmniejsza nagrzewanie się pomieszczenia.",
    color: "#AFC5D6",
    imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260717_121405_7539c16a_silver__swatch_640.webp",
  },
];

// Tkanina (fabric) colors - real CRM data, "Wybierz kolor materiału" step.
// 54 "Deko" options (materialTypeId "polprzepuszczalny") + 19 "Termo"
// options (materialTypeId "termo"), 73 total. Three Termo entries (67/68/69)
// never had a real accent_color set in the CRM (still the placeholder
// #D8DEE3) - left as-is rather than guessing a "more correct"
// green/red/black, since their real swatch photo is what's actually shown.
// "Term 66" is a CRM label typo, corrected here to "Termo 66" for
// consistency with the rest. Deko value "e03" (no hyphen, unlike every
// other "e-NN") is a real irregularity in the CRM data, kept as-is.
export const ROLETY_DACHOWE_FABRIC: FabricOption[] = [
  { id: "e-01", label: "Deko 01", subtitle: "", color: "#DACCA5", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_214141_18ed4928_ED-001_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-02", label: "Deko 02", subtitle: "", color: "#E5C586", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_214225_0f5327c0_ED-002_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e03", label: "Deko 03", subtitle: "", color: "#E9CB68", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_214358_bade6412_ED-003_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-04", label: "Deko 04", subtitle: "", color: "#ECB84B", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_214426_16718063_ED-004_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-05", label: "Deko 05", subtitle: "", color: "#D37F45", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_214605_69dccb8d_ED-005_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-06", label: "Deko 06", subtitle: "", color: "#8E3837", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_215010_9dd724d5_ED-006_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-07", label: "Deko 07", subtitle: "", color: "#B32E35", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_215101_5d4debfb_ED-007_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-08", label: "Deko 08", subtitle: "", color: "#666996", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_215201_29634592_ED-008_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-09", label: "Deko 09", subtitle: "", color: "#A296AE", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_215236_6e08c1e8_ED-009_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-10", label: "Deko 10", subtitle: "", color: "#C58A9C", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_215306_1bdbd396_ED-010_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-11", label: "Deko 11", subtitle: "", color: "#943D5A", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_215336_8d0ca52a_ED-011_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-12", label: "Deko 12", subtitle: "", color: "#40293D", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_215406_fc25e76c_ED-012_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-13", label: "Deko 13", subtitle: "", color: "#BECAB6", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_215432_cc140cdb_ED-013_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-14", label: "Deko 14", subtitle: "", color: "#BDBFA9", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_220002_f961e323_ED-014_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-15", label: "Deko 15", subtitle: "", color: "#A3CFAC", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_220031_9792234b_ED-015_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-16", label: "Deko 16", subtitle: "", color: "#A1B9AB", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_220102_c58cca62_ED-016_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-17", label: "Deko 17", subtitle: "", color: "#018474", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_220133_3c1f9b6b_ED-017_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-18", label: "Deko 18", subtitle: "", color: "#2F4233", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_220200_f7cd660a_ED-018_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-19", label: "Deko 19", subtitle: "", color: "#80A5C0", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_220228_b06faecd_ED-019_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-20", label: "Deko 20", subtitle: "", color: "#3D6CB0", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_220257_34775fa8_ED-020_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-21", label: "Deko 21", subtitle: "", color: "#7894AC", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_220324_52e9a008_ED-021_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-22", label: "Deko 22", subtitle: "", color: "#4C719F", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_220423_b1e1c829_ED-022_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-23", label: "Deko 23", subtitle: "", color: "#29334E", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_220448_2f8a4d26_ED-023_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-24", label: "Deko 24", subtitle: "", color: "#3B4657", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_220521_d703e479_ED-024_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-25", label: "Deko 25", subtitle: "", color: "#D7D2BE", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_220548_e42aaa74_ED-025_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-26", label: "Deko 26", subtitle: "", color: "#D9CAA3", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_220621_3352103e_ED-026_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-27", label: "Deko 27", subtitle: "", color: "#CFCCBD", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_220653_b4831ad4_ED-027_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-28", label: "Deko 28", subtitle: "", color: "#D7B896", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_220742_e12378e8_ED-028_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-29", label: "Deko 29", subtitle: "", color: "#BFA688", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_220810_9f6560d1_ED-029_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-30", label: "Deko 30", subtitle: "", color: "#CDC1A7", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_220847_45a7f8f8_ED-030_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-31", label: "Deko 31", subtitle: "", color: "#85735D", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_220914_af040dd9_ED-031_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-32", label: "Deko 32", subtitle: "", color: "#493326", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_220959_de49bdf2_ED-032_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-33", label: "Deko 33", subtitle: "", color: "#CAC6BD", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_221023_ba3b42b9_ED-033_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-34", label: "Deko 34", subtitle: "", color: "#C7C8BA", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_221227_9f9015f1_ED-034_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-35", label: "Deko 35", subtitle: "", color: "#B7B7AF", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_221254_794f4a6a_ED-035_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-36", label: "Deko 36", subtitle: "", color: "#282A28", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_221322_98b10bc9_ED-036_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-37", label: "Deko 37", subtitle: "", color: "#E2E0DE", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_221350_12fe5f7f_ED-037_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-38", label: "Deko 38", subtitle: "", color: "#B1AFAE", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_221415_0de55ccb_ED-038_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-39", label: "Deko 39", subtitle: "", color: "#777671", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_221439_a5f10425_ED-039_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-40", label: "Deko 40", subtitle: "", color: "#30312E", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_221501_a762f052_ED-040_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-41", label: "Deko 41", subtitle: "", color: "#3A2424", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_232836_1e63f8e9_ED-041_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-42", label: "Deko 42", subtitle: "", color: "#F9A56F", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_232900_04f712bf_ED-042_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-43", label: "Deko 43", subtitle: "", color: "#CE5743", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_232922_8a0ab807_ED-043_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-44", label: "Deko 44", subtitle: "", color: "#7C313E", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_232943_135855cb_ED-044_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-45", label: "Deko 45", subtitle: "", color: "#B1AD40", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_233006_9359bf2d_ED-045_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-46", label: "Deko 46", subtitle: "", color: "#DFC5AA", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_233029_b1b534ca_ED-046_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-47", label: "Deko 47", subtitle: "", color: "#B2A893", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_233052_608d802e_ED-047_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-48", label: "Deko 48", subtitle: "", color: "#907F6F", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_233115_3e274352_ED-048_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-49", label: "Deko 49", subtitle: "", color: "#866552", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_233135_0a94152d_ED-049_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-50", label: "Deko 50", subtitle: "", color: "#5C4034", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_233157_fd14a89a_ED-050_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-51", label: "Deko 51", subtitle: "", color: "#975C3E", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_233219_4b563a42_ED-051_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-52", label: "Deko 52", subtitle: "", color: "#A57F58", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_233241_e11f6ab4_ED-052_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-53", label: "Deko 53", subtitle: "", color: "#95775F", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_233258_c4e62baf_ED-053_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "e-54", label: "Deko 54", subtitle: "", color: "#6B492F", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260718_233320_a34e8034_ED-054_res-300x200.jpg", materialTypeId: "polprzepuszczalny" },
  { id: "mgrs-51", label: "Termo 51", subtitle: "Czysta biel", color: "#D9D6D1", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260724_152654_e6ae9ace_MGRS51__swatch_640.webp", materialTypeId: "termo" },
  { id: "mgrs-52", label: "Termo 52", subtitle: "Piaskowy", color: "#D4C4A9", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260724_152818_3dd0ea0c_MGRS52__swatch_640.webp", materialTypeId: "termo" },
  { id: "mgrs-53", label: "Termo 53", subtitle: "Kawa z mlekiem", color: "#C79A70", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260724_152855_da3c4407_MGRS53__swatch_640.webp", materialTypeId: "termo" },
  { id: "mgrs-54", label: "Termo 54", subtitle: "Jasny szary", color: "#B2A796", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260724_153118_76bec5fd_MGRS54__swatch_640.webp", materialTypeId: "termo" },
  { id: "mgrs-55", label: "Termo 55", subtitle: "Seledynowy", color: "#B6B998", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260724_153342_1cfb8df6_MGRS55__swatch_640.webp", materialTypeId: "termo" },
  { id: "mgrs-56", label: "Termo 56", subtitle: "Jasny piasek", color: "#DED2B9", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260724_153439_a06659e2_MGRS56__swatch_640.webp", materialTypeId: "termo" },
  { id: "mgrs-57", label: "Termo 57", subtitle: "", color: "#E5CFAB", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260724_153557_7ea6e1de_MGRS57__swatch_640.webp", materialTypeId: "termo" },
  { id: "mgrs-58", label: "Termo 58", subtitle: "", color: "#E0B57A", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260724_153625_873cc6d7_MGRS58__swatch_640.webp", materialTypeId: "termo" },
  { id: "mgrs-59", label: "Termo 59", subtitle: "", color: "#E1B461", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260724_153652_fc27e562_MGRS59__swatch_640.webp", materialTypeId: "termo" },
  { id: "mgrs-60", label: "Termo 60", subtitle: "Pomarańczowy", color: "#E68C3B", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260724_153726_4232667a_MGRS60__swatch_640.webp", materialTypeId: "termo" },
  { id: "mgrs-61", label: "Termo 61", subtitle: "Antracyt - grafit", color: "#606666", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260724_153812_0366ca34_MGRS61__swatch_640.webp", materialTypeId: "termo" },
  { id: "mgrs-62", label: "Termo 62", subtitle: "Róż", color: "#D9C3CD", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260724_153842_4cdae736_MGRS62__swatch_640.webp", materialTypeId: "termo" },
  { id: "mgrs-63", label: "Termo 63", subtitle: "Wzór - beżowy", color: "#CBC8C0", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260724_153926_6f484576_MGRS63__swatch_640.webp", materialTypeId: "termo" },
  { id: "mgrs-64", label: "Termo 64", subtitle: "Wzór - szary", color: "#B5AFAA", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260724_153956_22b8d258_MGRS64__swatch_640.webp", materialTypeId: "termo" },
  { id: "mgrs-65", label: "Termo 65", subtitle: "Granatowy", color: "#23466C", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260724_154033_6b9fbbdd_MGRS65__swatch_640.webp", materialTypeId: "termo" },
  { id: "mgrs-66", label: "Termo 66", subtitle: "Brązowy", color: "#735138", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260724_154114_3f027403_MGRS66__swatch_640.webp", materialTypeId: "termo" },
  { id: "mgrs-67", label: "Termo 67", subtitle: "Zielony", color: "#D8DEE3", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260724_154153_51deae28_MGRS67__swatch_640.webp", materialTypeId: "termo" },
  { id: "mgrs-68", label: "Termo 68", subtitle: "Czerwony", color: "#D8DEE3", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260724_230536_a6725177_MGRS68__swatch_640.webp", materialTypeId: "termo" },
  { id: "mgrs-69", label: "Termo 69", subtitle: "Czarny", color: "#D8DEE3", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260724_230601_b540ca9e_MGRS69__swatch_640.webp", materialTypeId: "termo" },
];

// Ported byte-for-byte from features/moskitiery-ramkowe/shared.ts (which
// itself ports the CRM admin panel's live swatch preview technique) - same
// masked-gradient-surface + low-opacity-multiply-overlay two-layer render,
// reused here for the hardware/kaseta step's live preview.
function rdNormalizeHexColor(value: string, fallback = "#1F2937"): string {
  const normalized = String(value || "").trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(normalized) ? normalized : fallback;
}

function rdHexToRgb(hex: string) {
  const normalized = rdNormalizeHexColor(hex);
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function rdRgba(hex: string, alpha: number): string {
  const rgb = rdHexToRgb(hex);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function rdShiftHex(hex: string, amount: number): string {
  const rgb = rdHexToRgb(hex);
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value + amount)));
  return `#${[clamp(rgb.r), clamp(rgb.g), clamp(rgb.b)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

export function buildRdLayerSurfaceStyle(imageUrl: string, accentColor: string) {
  const normalizedColor = rdNormalizeHexColor(accentColor, "#D8DEE3");
  const gradient = `linear-gradient(135deg, ${normalizedColor} 0%, ${rdShiftHex(normalizedColor, -22)} 100%)`;
  const optimizedUrl = optimizeImageUrl(imageUrl, 500);
  return {
    backgroundImage: gradient,
    maskImage: `url(${optimizedUrl})`,
    maskRepeat: "no-repeat",
    maskPosition: "center",
    maskSize: "contain",
    WebkitMaskImage: `url(${optimizedUrl})`,
    WebkitMaskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    WebkitMaskSize: "contain",
  } as const;
}

export { ROLETY_DACHOWE_PRICE_TABLES, type PricingTable };

// ---------------------------------------------------------------------------
// Live profile (2026-09-18). The option data and the price tables above were
// a snapshot of the CRM's public "dachowe" payload from 2026-08-30. Since the
// shop launch of this product they are read LIVE from the same endpoint the
// Allegro configurator (konfiguruj.com.pl/dachowa) uses, so the owner edits
// prices and fabrics in one place (CRM -> Allegro -> Konfiguratory ->
// dachowe) and both channels follow. The snapshot stays as the fallback for
// a failed fetch or an empty/zeroed profile (which is exactly what happened
// 2026-08-31 .. 2026-09-18 on the Allegro side) - the shop then prices from
// the bundled tables and reports it (configurator_profile_fallback).
//
// Owner decision 2026-09-18: the shop charges the table price 1:1 (no
// "-10 % profil Allegro" as before - that profile belongs to the Allegro
// unit-price scheme). The only shop-side knob is the CRM "Korekta ceny (%)"
// (lib/price-adjustment.ts), applied on top by calcRoletyDachowePrice.
// ---------------------------------------------------------------------------

export const ROOF_BLIND_SOURCE_SLUG = "dachowe";
const ROOF_BLIND_PROFILE_URL = `https://crm-keika.groovemedia.pl/biuro/api/allegro/configurator_public?slug=${ROOF_BLIND_SOURCE_SLUG}`;

export type RoofBlindProfile = {
  hardware: HardwareOption[];
  materialTypes: MaterialTypeOption[];
  fabrics: FabricOption[];
  tables: PricingTable[];
  /** "Skąd wziąć model okna" help block (CRM roof_window_model_help). */
  modelHelp: { eyebrow: string; title: string; body: string; imageUrl: string };
  measurementSections: Array<{ id: string; eyebrow: string; title: string; body: string }>;
  source: "live" | "bundled";
};

type RawOption = {
  id?: string;
  label?: string;
  value?: string;
  subtitle?: string;
  image_url?: string;
  full_image_url?: string;
  thumbnail_url?: string;
  gallery_urls?: string[];
  preview_layer_url?: string;
  accent_color?: string;
  material_parent_values?: string[];
};
type RawStep = { key?: string; type?: string; options?: RawOption[] };
type RawTable = {
  id?: string;
  hardware_ids?: string[];
  fabric_group_ids?: string[];
  width_breakpoints?: number[];
  height_breakpoints?: number[];
  prices?: number[][];
};
type RawProduct = {
  slug?: string;
  pricing_calculation?: { mode?: string; tables?: RawTable[] };
  configurator?: {
    steps?: RawStep[];
    roof_window_model_help?: { eyebrow?: string; title?: string; body?: string; image_url?: string };
    measurement_guide_sections?: Array<{ id?: string; eyebrow?: string; title?: string; body?: string }>;
  };
};

// The CRM labels for this product were typed without Polish diacritics
// ("Bialy", "Polprzepuszczalny") - the shop shows them properly.
const LABEL_FIXES: Record<string, string> = {
  bialy: "Biały",
  polprzepuszczalny: "Półprzepuszczalny",
  "jasna sosna": "Jasna Sosna",
};
function fixLabel(label: string): string {
  const key = String(label || "").trim().toLowerCase();
  return LABEL_FIXES[key] || String(label || "").trim();
}

function normalizeStepKey(key: string | undefined): string {
  return String(key || "").trim().toLowerCase().replace(/-/g, "_");
}

function firstTruthy(...values: Array<string | undefined>): string {
  for (const value of values) {
    const trimmed = String(value || "").trim();
    if (trimmed) return trimmed;
  }
  return "";
}

export function buildBundledRoofBlindProfile(): RoofBlindProfile {
  return {
    hardware: ROLETY_DACHOWE_HARDWARE,
    materialTypes: ROLETY_DACHOWE_MATERIAL_TYPES,
    fabrics: ROLETY_DACHOWE_FABRIC,
    tables: ROLETY_DACHOWE_PRICE_TABLES,
    modelHelp: { eyebrow: "", title: "", body: "", imageUrl: ROOF_WINDOW_MODEL_HELP_IMAGE_FALLBACK },
    measurementSections: [],
    source: "bundled",
  };
}

/** The nameplate-location illustration (CRM roof_window_model_help.image_url). */
export const ROOF_WINDOW_MODEL_HELP_IMAGE_FALLBACK =
  "https://crm-keika.groovemedia.pl/storage/shop/media/20260809_002723_40b6e7e0_A-7.webp";

function tableHasPositiveCell(table: PricingTable): boolean {
  return table.prices.some((row) => row.some((cell) => typeof cell === "number" && Number.isFinite(cell) && cell > 0));
}

function parseRoofBlindProfile(product: RawProduct): RoofBlindProfile | null {
  const steps = product.configurator?.steps || [];
  const byKey = (wanted: string) => steps.find((step) => normalizeStepKey(step.key) === wanted) || null;
  const hardwareStep = byKey("hardware_color");
  const materialStep = byKey("material_type");
  const fabricStep = byKey("fabric_variant");
  if (!hardwareStep || !materialStep || !fabricStep) return null;

  const hardware: HardwareOption[] = (hardwareStep.options || [])
    .map((option) => ({
      id: String(option.value || option.id || "").trim(),
      label: fixLabel(option.label || ""),
      color: String(option.accent_color || "").trim() || "#D8DEE3",
      imageUrl: firstTruthy(option.image_url, option.full_image_url, option.thumbnail_url),
      galleryUrls: (Array.isArray(option.gallery_urls) && option.gallery_urls.length
        ? option.gallery_urls
        : [firstTruthy(option.full_image_url, option.image_url)]
      ).filter(Boolean),
      priceDelta: 0,
      previewLayerUrl: String(option.preview_layer_url || "").trim() || undefined,
    }))
    .filter((option) => option.id && option.label);

  const materialTypes: MaterialTypeOption[] = (materialStep.options || [])
    .map((option) => ({
      id: String(option.value || option.id || "").trim(),
      label: fixLabel(option.label || ""),
      subtitle: String(option.subtitle || "").trim(),
      color: String(option.accent_color || "").trim() || "#D8DEE3",
      imageUrl: firstTruthy(option.image_url, option.full_image_url, option.thumbnail_url),
    }))
    .filter((option) => option.id && option.label);

  const materialIds = new Set(materialTypes.map((option) => option.id));
  const fabrics: FabricOption[] = (fabricStep.options || [])
    .map((option) => {
      const parents = Array.isArray(option.material_parent_values) ? option.material_parent_values : [];
      const materialTypeId = parents.map((entry) => String(entry || "").trim()).find((entry) => materialIds.has(entry)) || "";
      return {
        id: String(option.value || option.id || "").trim(),
        label: fixLabel(option.label || "").replace(/^Term (\d)/, "Termo $1"),
        subtitle: String(option.subtitle || "").trim(),
        color: String(option.accent_color || "").trim() || "#D8DEE3",
        imageUrl: firstTruthy(option.thumbnail_url, option.image_url, option.full_image_url),
        materialTypeId,
      };
    })
    .filter((option) => option.id && option.label && option.materialTypeId);

  const tables: PricingTable[] = (product.pricing_calculation?.tables || [])
    .map((table) => ({
      id: String(table.id || "").trim(),
      hardwareIds: (table.hardware_ids || []).map((entry) => String(entry || "").trim()).filter(Boolean),
      materialTypeIds: (table.fabric_group_ids || []).map((entry) => String(entry || "").trim()).filter(Boolean),
      widthBreakpointsMm: (table.width_breakpoints || []).map(Number).filter((n) => Number.isFinite(n) && n > 0),
      heightBreakpointsMm: (table.height_breakpoints || []).map(Number).filter((n) => Number.isFinite(n) && n > 0),
      prices: (table.prices || []).map((row) => (Array.isArray(row) ? row.map(Number) : [])),
    }))
    .filter((table) => table.widthBreakpointsMm.length && table.heightBreakpointsMm.length && tableHasPositiveCell(table));

  if (!hardware.length || !materialTypes.length || !fabrics.length || !tables.length) return null;
  if (product.pricing_calculation?.mode !== "dimension_price_matrix_allegro_profile") return null;

  const help = product.configurator?.roof_window_model_help || {};
  return {
    hardware,
    materialTypes,
    fabrics,
    tables,
    modelHelp: {
      eyebrow: String(help.eyebrow || "").trim(),
      title: String(help.title || "").trim(),
      body: String(help.body || "").trim(),
      imageUrl: String(help.image_url || "").trim() || ROOF_WINDOW_MODEL_HELP_IMAGE_FALLBACK,
    },
    measurementSections: (product.configurator?.measurement_guide_sections || [])
      .map((section) => ({
        id: String(section.id || "").trim(),
        eyebrow: String(section.eyebrow || "").trim(),
        title: String(section.title || "").trim(),
        body: String(section.body || "").trim(),
      }))
      .filter((section) => section.title || section.body),
    source: "live",
  };
}

let roofBlindProfilePromise: Promise<RoofBlindProfile> | null = null;
let lastProfileFallbackReason = "";

/** Why the last fetchRoofBlindProfile() fell back to the bundled snapshot
 * ("" when the live profile is in use) - for the tracking event only. */
export function roofBlindProfileFallbackReason(): string {
  return lastProfileFallbackReason;
}

/** Fetches the live roof-blind profile (steps + price tables) from the CRM.
 * Cached for the page lifetime; never throws - falls back to the bundled
 * snapshot and records why (see roofBlindProfileFallbackReason). */
export function fetchRoofBlindProfile(): Promise<RoofBlindProfile> {
  if (!roofBlindProfilePromise) {
    roofBlindProfilePromise = (async () => {
      try {
        const response = await fetch(ROOF_BLIND_PROFILE_URL, { cache: "no-store" });
        const json = (await response.json()) as {
          ok?: boolean;
          config?: { catalog?: { categories?: Array<{ products?: RawProduct[] }> } };
        };
        const product = (json?.config?.catalog?.categories || [])
          .flatMap((category) => category.products || [])
          .find((entry) => entry.slug === ROOF_BLIND_SOURCE_SLUG);
        if (!json?.ok || !product) {
          lastProfileFallbackReason = "no_product";
          return buildBundledRoofBlindProfile();
        }
        const parsed = parseRoofBlindProfile(product);
        if (!parsed) {
          lastProfileFallbackReason = "invalid_profile";
          return buildBundledRoofBlindProfile();
        }
        lastProfileFallbackReason = "";
        return parsed;
      } catch {
        lastProfileFallbackReason = "fetch_failed";
        return buildBundledRoofBlindProfile();
      }
    })();
  }
  return roofBlindProfilePromise;
}

/** Same rounding as the real configurator's roundMoneyAmount()
 * (product-configurator-shell.tsx) - 2 decimal places. */
function rdRoundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Ceiling lookup: the first breakpoint >= size, clamped to the last one if
 * size exceeds every breakpoint. Byte-for-byte the same rule as the real
 * configurator's resolveMatrixBreakpointIndex()
 * (product-configurator-shell.tsx:185) - price tiers round UP to the next
 * breakpoint, never interpolated. */
export function resolvePriceBreakpointIndex(size: number, breakpoints: number[]): number | null {
  if (!Number.isFinite(size) || size <= 0 || !breakpoints.length) return null;
  for (let index = 0; index < breakpoints.length; index += 1) {
    if (size <= breakpoints[index]) return index;
  }
  return breakpoints.length - 1;
}

// The shop's historical option ids and the CRM's "dachowe" values differ
// for two entries - accepted both ways so a cart item from before the live
// profile still prices.
const OPTION_ID_ALIASES: Record<string, string[]> = {
  srebrny: ["anoda"],
  anoda: ["srebrny"],
  polprzepuszczalny: ["ed", "deko"],
  ed: ["polprzepuszczalny"],
  termo: ["silver"],
  silver: ["termo"],
};
function idMatches(wanted: string, list: string[]): boolean {
  if (list.includes(wanted)) return true;
  return (OPTION_ID_ALIASES[wanted] || []).some((alias) => list.includes(alias));
}

/** Most specific table for the (hardware, material) pair - same scoring idea
 * as the real configurator's resolveMatchedPricingTable(): a table naming
 * both ids beats one naming only one, which beats an unscoped table. */
export function findPricingTable(tables: PricingTable[], hardwareId: string, materialTypeId: string): PricingTable | null {
  let best: PricingTable | null = null;
  let bestScore = -1;
  for (const table of tables) {
    const hwScoped = table.hardwareIds.length > 0;
    const matScoped = table.materialTypeIds.length > 0;
    if (hwScoped && !idMatches(hardwareId, table.hardwareIds)) continue;
    if (matScoped && !idMatches(materialTypeId, table.materialTypeIds)) continue;
    const score = (hwScoped ? 2 : 0) + (matScoped ? 2 : 0);
    if (score > bestScore) {
      best = table;
      bestScore = score;
    }
  }
  return best;
}

/** Price of one blind: matrix cell (ceiling-breakpoint lookup) x the CRM
 * "Korekta ceny (%)" of this product. No Allegro unit rounding, no -10 %
 * profile (owner, 2026-09-18). Returns null if any input is missing or the
 * size falls outside the matrix. */
export function calcRoletyDachowePrice(
  tables: PricingTable[],
  widthMm: number,
  heightMm: number,
  hardwareId: string,
  materialTypeId: string,
  extraPercent = 0,
): number | null {
  const table = findPricingTable(tables, hardwareId, materialTypeId);
  if (!table) return null;
  const widthIndex = resolvePriceBreakpointIndex(widthMm, table.widthBreakpointsMm);
  const heightIndex = resolvePriceBreakpointIndex(heightMm, table.heightBreakpointsMm);
  if (widthIndex === null || heightIndex === null) return null;
  const matrixPrice = table.prices[heightIndex]?.[widthIndex];
  if (typeof matrixPrice !== "number" || !Number.isFinite(matrixPrice) || matrixPrice <= 0) return null;
  return rdRoundMoney(Math.max(0, matrixPrice * (1 + (extraPercent || 0) / 100)));
}

/** "Od X zł" - the cheapest real blind: the smallest size in the cheapest
 * hardware/material combination (never the matrix-wide minimum, which could
 * be a data-entry slip). */
export function roofBlindStartingPrice(profile: RoofBlindProfile | null, extraPercent = 0): number {
  const source = profile || buildBundledRoofBlindProfile();
  let best = Number.POSITIVE_INFINITY;
  for (const table of source.tables) {
    const cell = table.prices[0]?.[0];
    if (typeof cell === "number" && Number.isFinite(cell) && cell > 0 && cell < best) best = cell;
  }
  if (!Number.isFinite(best)) return 0;
  return rdRoundMoney(best * (1 + (extraPercent || 0) / 100));
}

/** Server-render / first-paint value: the bundled snapshot's cheapest cell. */
export const ROLETY_DACHOWE_STARTING_PRICE = roofBlindStartingPrice(null);

/** Size limits of the price matrix (widest/tallest breakpoint) - a manual
 * "Wymiar A/B" outside them cannot be priced. */
export function roofBlindSizeLimits(profile: RoofBlindProfile | null): { maxWidthMm: number; maxHeightMm: number } {
  const source = profile || buildBundledRoofBlindProfile();
  let maxWidthMm = 0;
  let maxHeightMm = 0;
  for (const table of source.tables) {
    maxWidthMm = Math.max(maxWidthMm, ...table.widthBreakpointsMm);
    maxHeightMm = Math.max(maxHeightMm, ...table.heightBreakpointsMm);
  }
  return { maxWidthMm: maxWidthMm || 2100, maxHeightMm: maxHeightMm || 2300 };
}

// Manual "Wymiar A / Wymiar B" fallback range (customer types their own
// measured size instead of picking a library window model) - same 200 mm
// floor the real configurator enforces; the ceiling is the matrix itself.
export const ROLETY_DACHOWE_MIN_DIMENSION_MM = 200;
export const ROLETY_DACHOWE_MAX_DIMENSION_MM = 2300;

export type MissingModelRequest = {
  producer: string;
  model: string;
  dimensionAMm: number;
  dimensionBMm: number;
  attachmentIds: string[];
  aiProducer?: string;
  aiModel?: string;
  aiConfidence?: string;
};

export type ConfiguratorInitialValues = {
  hardwareId?: string;
  materialTypeId?: string;
  fabricId?: string;
  /** /koszyk's "Edytuj pozycję" only has the cart item's LABELS - resolved
   * against the live profile once it loads (see ConfiguratorPanel). */
  hardwareLabel?: string;
  materialTypeLabel?: string;
  fabricLabel?: string;
  /** Library window picked before (cart edit / "Wyceń podobną"). */
  windowLibraryId?: number;
  /** Pre-typed search ("Konfiguruj to okno" from the quick price up top). */
  windowQuery?: string;
  widthMm?: number;
  heightMm?: number;
  qty?: number;
  bracketCount?: 1 | 2;
  /** Cart edit of an "okno spoza biblioteki" position - restored 1:1. */
  missingModelRequest?: MissingModelRequest | null;
};

export type ConfiguratorResult = {
  hardwareId: string;
  hardwareLabel: string;
  hardwareImageUrl: string;
  hardwareColor: string;
  previewLayerUrl: string;
  materialTypeId: string;
  materialTypeLabel: string;
  fabricId: string;
  fabricLabel: string;
  fabricColor: string;
  fabricImageUrl: string;
  windowProducer: string;
  windowModel: string;
  /** Library id of the chosen window (0 for a manual size). */
  windowLibraryId: number;
  /** False when the library flags the measurement as unverified or for a
   * manual "Wymiar A/B" entry - the CRM shows "wymiar orientacyjny". */
  windowCertain: boolean;
  isManual: boolean;
  widthMm: number;
  heightMm: number;
  qty: number;
  unitPrice: number;
  totalPrice: number;
  /** Number of handles on the bottom bar (owner's extra option, no surcharge). */
  bracketCount: 1 | 2;
  /** Attachment id of the nameplate photo the customer uploaded (CRM storage). */
  nameplateAttachmentId: string;
  missingModelRequest: MissingModelRequest | null;
};
