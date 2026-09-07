(function attachShared(root) {
  "use strict";

  const DEFAULT_MONTHS = 12;
  const CSV_HEADERS = [
    "date",
    "day_of_week",
    "nightly_rate",
    "nightly_rate_cents",
    "currency_symbol",
  ];
  const WEEKDAYS = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function todayIso() {
    const date = new Date();
    return [
      date.getFullYear(),
      pad2(date.getMonth() + 1),
      pad2(date.getDate()),
    ].join("-");
  }

  function addMonths(dateString, months) {
    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCMonth(date.getUTCMonth() + months);
    return date.toISOString().slice(0, 10);
  }

  function addDays(dateString, days) {
    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function getYearsForWindow(startDate, months) {
    const startYear = Number(startDate.slice(0, 4));
    const endYear = Number(addMonths(startDate, months).slice(0, 4));
    return Array.from(new Set([startYear, endYear])).sort((a, b) => a - b);
  }

  function filterRowsToWindow(rows, startDate, months) {
    const endDateExclusive = addMonths(startDate, months);
    return rows.filter(
      (row) => row.date >= startDate && row.date < endDateExclusive,
    );
  }

  function sortByDate(rows) {
    return [...rows].sort((a, b) => a.date.localeCompare(b.date));
  }

  function normalizeMarkupPercent(value) {
    const percent = Number(value);
    if (!Number.isFinite(percent) || percent < 0) {
      return 0;
    }
    return Math.min(percent, 100);
  }

  function removeMarkupFromRate(rate, markupPercent = 0) {
    const numericRate = Number(rate);
    const percent = normalizeMarkupPercent(markupPercent);
    if (!Number.isFinite(numericRate) || numericRate < 0) {
      return 0;
    }
    if (percent === 0) {
      return numericRate;
    }
    return numericRate / (1 + percent / 100);
  }

  function weekdayFromIsoDate(dateString) {
    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return WEEKDAYS[date.getUTCDay()];
  }

  function csvEscape(value) {
    const stringValue = value == null ? "" : String(value);
    if (!/[",\n\r]/.test(stringValue)) {
      return stringValue;
    }
    return `"${stringValue.replaceAll('"', '""')}"`;
  }

  function rowsToCsv(rows) {
    const lines = [CSV_HEADERS.join(",")];
    for (const row of rows) {
      lines.push(CSV_HEADERS.map((header) => csvEscape(row[header])).join(","));
    }
    return `${lines.join("\n")}\n`;
  }

  function slugifyPropertyName(value) {
    return cleanPropertyName(value)
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-+/g, "-")
      .slice(0, 80) || "airbnb-property";
  }

  function cleanPropertyName(value) {
    const text = String(value || "airbnb-property").trim();
    const editCalendarMatch = text.match(/^Edit calendar for ['"]?(.+?)['"]?\s+-\s+Airbnb$/i);
    if (editCalendarMatch) {
      return editCalendarMatch[1].trim();
    }

    return text.replace(/\s+-\s+Airbnb$/i, "").trim() || "airbnb-property";
  }

  function buildFilename(propertyName, startDate, months) {
    const endDateInclusive = addDays(addMonths(startDate, months), -1);
    return `airbnb-host-nightly-rates-${slugifyPropertyName(propertyName)}-${startDate}-to-${endDateInclusive}.csv`;
  }

  function buildYearUrl(url, year) {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/^\/multicalendar\/([^/]+)/);
    if (!match) {
      throw new Error("Open an Airbnb host multicalendar page for a single listing.");
    }

    parsed.pathname = `/multicalendar/${match[1]}/year/${year}`;
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString();
  }

  function isLikelyAirbnbHostCalendarUrl(url) {
    try {
      const parsed = new URL(url);
      return (
        /(^|\.)airbnb\./.test(parsed.hostname) &&
        parsed.pathname.startsWith("/multicalendar/")
      );
    } catch {
      return false;
    }
  }

  function normalizeScrapedRow(row, options = {}) {
    const nightlyRate = removeMarkupFromRate(row.nightlyRate, options.markupPercent);
    return {
      date: row.date,
      day_of_week: weekdayFromIsoDate(row.date),
      nightly_rate: nightlyRate.toFixed(2),
      nightly_rate_cents: Math.round(nightlyRate * 100),
      currency_symbol: row.currencySymbol,
    };
  }

  const api = {
    CSV_HEADERS,
    DEFAULT_MONTHS,
    addDays,
    addMonths,
    buildFilename,
    buildYearUrl,
    cleanPropertyName,
    filterRowsToWindow,
    getYearsForWindow,
    isLikelyAirbnbHostCalendarUrl,
    normalizeMarkupPercent,
    normalizeScrapedRow,
    pad2,
    removeMarkupFromRate,
    rowsToCsv,
    slugifyPropertyName,
    sortByDate,
    todayIso,
    weekdayFromIsoDate,
  };

  root.AirbnbRateExporter = Object.assign(root.AirbnbRateExporter || {}, api);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
