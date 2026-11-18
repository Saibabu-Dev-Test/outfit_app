// Plain-language text for one law section (scripts/laws-i18n.js writes plain.en/te/hi.ts).
// t = short plain title, x = simple explanation, p = punishment in simple words (te / hi only).
export interface PlainText {
  t: string;
  x: string;
  p?: string;
}
