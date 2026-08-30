// Shared data + pure helpers for the rolety-dachowe (roof window blind)
// configurator, mirroring features/moskitiery-ramkowe/shared.ts - used both
// by the homepage (app/page.tsx, "add to cart") and by the cart's "Edytuj
// pozycję" modal. See ConfiguratorPanel.tsx for the actual step UI.
//
// Hardware/material-type/fabric option data and the price tables are real,
// pulled from the CRM's public configurator API for the wider "dachowe"
// product family (configurator_public?slug=dachowe - this shop product is
// branded/copy-wise "rolety-dachowe" but per the business owner should
// price and offer options exactly like "dachowe" does), fetched
// 2026-08-30. The 420-model window library in roof-windows-data.ts comes
// from that same CRM's public roof-window library endpoint. Nothing here
// is invented.
import { optimizeImageUrl } from "@/lib/image-optim";
import { ROOF_WINDOW_MODELS, type RoofWindowModel } from "./roof-windows-data";
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

// The "Domyslny profil Allegro" adjustment applied on top of every matrix
// price, real CRM data (allegro_profiles[0] on the "dachowe" product
// record) - a flat 10% discount, no fixed-amount component.
export const ROLETY_DACHOWE_PRICE_ADJUSTMENT_PERCENT = -10;
export const ROLETY_DACHOWE_PRICE_ADJUSTMENT_AMOUNT = 0;

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

/** Every real table happens to have exactly one hardwareIds/materialTypeIds
 * combination that matches any given (hardwareId, materialTypeId) pair (no
 * ties in this dataset), so a direct lookup gives the identical result the
 * real configurator's fuller scored-match algorithm
 * (resolveMatchedPricingTable) would - simpler code for the same outcome. */
export function findPricingTable(hardwareId: string, materialTypeId: string): PricingTable | null {
  return (
    ROLETY_DACHOWE_PRICE_TABLES.find(
      (table) => table.hardwareIds.includes(hardwareId) && table.materialTypeIds.includes(materialTypeId),
    ) || null
  );
}

/** The real per-unit price for a given size/hardware/material combination:
 * matrix cell (ceiling-breakpoint lookup) with the price-adjustment
 * percent/amount applied - same formula as the real configurator's
 * calculateMatrixProfilePricing(), just without its final step (converting
 * into a whole number of tiny-priced Allegro listing units), which only
 * matters for the actual Allegro purchase flow, not this shop's own
 * checkout. Returns null if any input is missing or out of range. */
export function calcRoletyDachowePrice(
  widthMm: number,
  heightMm: number,
  hardwareId: string,
  materialTypeId: string,
): number | null {
  const table = findPricingTable(hardwareId, materialTypeId);
  if (!table) return null;
  const widthIndex = resolvePriceBreakpointIndex(widthMm, table.widthBreakpointsMm);
  const heightIndex = resolvePriceBreakpointIndex(heightMm, table.heightBreakpointsMm);
  if (widthIndex === null || heightIndex === null) return null;
  const matrixPrice = table.prices[heightIndex]?.[widthIndex];
  if (typeof matrixPrice !== "number" || !Number.isFinite(matrixPrice) || matrixPrice <= 0) return null;
  return rdRoundMoney(
    Math.max(0, matrixPrice * (1 + ROLETY_DACHOWE_PRICE_ADJUSTMENT_PERCENT / 100) + ROLETY_DACHOWE_PRICE_ADJUSTMENT_AMOUNT),
  );
}

// "Od X zł" starting-price figure shown before a size is known (product
// description trust-row) - the smallest real table cell (smallest width +
// height breakpoint, Anoda/Biały + Półprzepuszczalny), run through the same
// adjustment formula. Deliberately not the matrix-wide minimum: one cell
// elsewhere (b25anoda2) is a known CRM data-entry anomaly ("37") far below
// its neighbors, and using it would show a starting price nobody would
// actually be charged.
export const ROLETY_DACHOWE_STARTING_PRICE = calcRoletyDachowePrice(400, 800, "bialy", "polprzepuszczalny") ?? 0;

// Manual "Wymiar A / Wymiar B" fallback range (customer types their own
// measured size instead of picking a library window model) - same
// 200-2300mm range the real configurator enforces for every non-mosquito
// product (MOSQUITO_MIN/MAX_DIMENSION_MM in product-configurator-shell.tsx,
// reused generically there; renamed here since this product has nothing to
// do with mosquito nets).
export const ROLETY_DACHOWE_MIN_DIMENSION_MM = 200;
export const ROLETY_DACHOWE_MAX_DIMENSION_MM = 2300;

export type RoofWindowSelection = {
  /** Set when picked from the library; empty for a manual "Wymiar A/B" entry. */
  producer: string;
  model: string;
  widthMm: number;
  heightMm: number;
  /** False for a library pick whose measurement the CRM flags unverified,
   * or for a manual entry (nothing to verify). */
  certain: boolean;
  isManual: boolean;
};

/** Simple substring search across producer + model + alternate model,
 * matching how the real configurator's own search box works - no fuzzy
 * matching, just case/diacritics-insensitive "contains". */
export function searchRoofWindowModels(query: string, limit = 30): RoofWindowModel[] {
  const normalized = query
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (!normalized) return ROOF_WINDOW_MODELS.slice(0, limit);
  const terms = normalized.split(/\s+/).filter(Boolean);
  return ROOF_WINDOW_MODELS.filter((entry) => {
    const haystack = `${entry.producer} ${entry.model} ${entry.altModel}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
    return terms.every((term) => haystack.includes(term));
  }).slice(0, limit);
}

export type ConfiguratorInitialValues = {
  hardwareId?: string;
  materialTypeId?: string;
  fabricId?: string;
  widthMm?: number;
  heightMm?: number;
  qty?: number;
};

export type ConfiguratorResult = {
  hardwareId: string;
  hardwareLabel: string;
  hardwareImageUrl: string;
  materialTypeId: string;
  materialTypeLabel: string;
  fabricId: string;
  fabricLabel: string;
  windowProducer: string;
  windowModel: string;
  widthMm: number;
  heightMm: number;
  qty: number;
  unitPrice: number;
  totalPrice: number;
};
