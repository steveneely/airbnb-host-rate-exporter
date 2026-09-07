const test = require("node:test");
const assert = require("node:assert/strict");

const shared = require("../src/shared.js");

test("buildYearUrl converts multicalendar URLs to year view URLs", () => {
  assert.equal(
    shared.buildYearUrl("https://www.airbnb.com/multicalendar/12345?foo=bar#x", 2027),
    "https://www.airbnb.com/multicalendar/12345/year/2027",
  );
});

test("getYearsForWindow includes both years when a 12 month window crosses New Year", () => {
  assert.deepEqual(shared.getYearsForWindow("2026-05-04", 12), [2026, 2027]);
});

test("filterRowsToWindow keeps rows in the half-open date window", () => {
  const rows = [
    { date: "2026-05-03" },
    { date: "2026-05-04" },
    { date: "2027-05-03" },
    { date: "2027-05-04" },
  ];

  assert.deepEqual(shared.filterRowsToWindow(rows, "2026-05-04", 12), [
    { date: "2026-05-04" },
    { date: "2027-05-03" },
  ]);
});

test("rowsToCsv writes stable headers and escapes spreadsheet-sensitive text", () => {
  const csv = shared.rowsToCsv([
    {
      date: "2026-05-04",
      day_of_week: "Monday",
      nightly_rate: "125.00",
      nightly_rate_cents: 12500,
      currency_symbol: "$",
    },
  ]);

  assert.equal(
    csv,
    [
      "date,day_of_week,nightly_rate,nightly_rate_cents,currency_symbol",
      "2026-05-04,Monday,125.00,12500,$",
      "",
    ].join("\n"),
  );
});

test("normalizeScrapedRow keeps only sync and spreadsheet columns", () => {
  assert.deepEqual(
    shared.normalizeScrapedRow({
      date: "2026-05-04",
      nightlyRate: 125,
      currencySymbol: "$",
      dateLabel: "ignored",
      rawPrice: "$125",
      rawText: "ignored",
    }),
    {
      date: "2026-05-04",
      day_of_week: "Monday",
      nightly_rate: "125.00",
      nightly_rate_cents: 12500,
      currency_symbol: "$",
    },
  );
});

test("normalizeScrapedRow can remove a user-defined markup before export", () => {
  assert.deepEqual(
    shared.normalizeScrapedRow(
      {
        date: "2026-05-04",
        nightlyRate: 115.5,
        currencySymbol: "$",
      },
      { markupPercent: 15.5 },
    ),
    {
      date: "2026-05-04",
      day_of_week: "Monday",
      nightly_rate: "100.00",
      nightly_rate_cents: 10000,
      currency_symbol: "$",
    },
  );
});

test("removeMarkupFromRate reverses percentage markup instead of subtracting points", () => {
  assert.equal(shared.removeMarkupFromRate(577.5, 15.5).toFixed(2), "500.00");
});

test("cleanPropertyName strips Airbnb edit-page chrome", () => {
  assert.equal(
    shared.cleanPropertyName("Edit calendar for '5 Acres, Hot Tub w/Mountain Views, Sledding Hill!' - Airbnb"),
    "5 Acres, Hot Tub w/Mountain Views, Sledding Hill!",
  );
});

test("buildFilename describes the export and date range", () => {
  assert.equal(
    shared.buildFilename("Edit calendar for '5 Acres, Hot Tub w/Mountain Views, Sledding Hill!' - Airbnb", "2026-05-05", 12),
    "airbnb-host-nightly-rates-5-acres-hot-tub-w-mountain-views-sledding-hill-2026-05-05-to-2027-05-04.csv",
  );
});
