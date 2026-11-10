import { describe, expect, it } from "vitest";
import { sortPassportNames } from "./passport-order";

describe("passport alphabetical display order", () => {
  it("orders Arabic passport names alphabetically regardless of receipt grouping without changing accounts", () => {
    const accounts = [
      { name: "نزار امين", paid: 100, receipt: "1" },
      { name: "فارس نصر", paid: 200, receipt: "1" },
      { name: "بسام عمرو", paid: 300, receipt: "" },
      { name: "أحمد علي", paid: 400, receipt: "9" },
      { name: "عاهد فاهم", paid: 500, receipt: "1" },
    ];
    const ordered = sortPassportNames(accounts);
    expect(ordered.map((account) => account.name)).toEqual(["أحمد علي", "بسام عمرو", "عاهد فاهم", "فارس نصر", "نزار امين"]);
    expect(accounts.map((account) => account.name)).toEqual(["نزار امين", "فارس نصر", "بسام عمرو", "أحمد علي", "عاهد فاهم"]);
    expect(ordered.reduce((total, account) => total + account.paid, 0)).toBe(1500);
    for (const account of accounts) expect(ordered.find((row) => row.name === account.name)).toBe(account);
  });

  it("ignores Arabic diacritics, elongation and alef variants for sorting while retaining original spellings", () => {
    expect(sortPassportNames([{ name: "بسام" }, { name: "إبراهيم" }, { name: "أَحــمد" }]).map((row) => row.name))
      .toEqual(["إبراهيم", "أَحــمد", "بسام"]);
  });
});