/** Arabic-normalize for search: lowercase, drop tashkeel, أ/إ/آ→ا, ة→ه, ى→ي. */
export function gdNorm(t: string): string {
  return String(t)
    .toLowerCase()
    .replace(/[ً-ٟ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
}
