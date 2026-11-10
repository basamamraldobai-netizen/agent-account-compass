import { normalizeText } from "@/lib/wakilio/engine";

const alphabet = new Intl.Collator("ar", { usage: "sort", sensitivity: "base", numeric: true });
const sortKey = (name: string) => normalizeText(name)
  .normalize("NFC")
  .replace(/[\u064B-\u065F\u0670]/g, "")
  .replace(/[أإآٱ]/g, "ا");

/** Display-only ordering: source names, transactions, and balances stay unchanged. */
export function sortPassportNames<T extends { name: string }>(accounts: readonly T[]): T[] {
  return [...accounts].sort((a, b) => alphabet.compare(sortKey(a.name), sortKey(b.name)));
}