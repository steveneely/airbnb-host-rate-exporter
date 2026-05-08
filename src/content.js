(function attachContentScript() {
  "use strict";

  const shared = globalThis.AirbnbRateExporter;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const MONTH_MAP = {
    Jan: 1,
    Feb: 2,
    Mar: 3,
    Apr: 4,
    May: 5,
    Jun: 6,
    Jul: 7,
    Aug: 8,
    Sep: 9,
    Oct: 10,
    Nov: 11,
    Dec: 12,
  };

  const DAY_CELL_RE =
    /^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\s+\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:\s+Unavailable)?\s+([$€£])(\d[\d,]*(?:\.\d{1,2})?)(?:\b|$)/;
  const MONTH_YEAR_RE =
    /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})$/;

  function normalize(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function findScroller() {
    return (
      document.querySelector("[data-testid='virtuoso-scroller']") ||
      document.querySelector(".virtuoso-scroller") ||
      document.scrollingElement ||
      document.documentElement ||
      document.body
    );
  }

  function scrollToTop() {
    const scroller = findScroller();
    if (typeof scroller.scrollTo === "function") {
      scroller.scrollTo({ top: 0, behavior: "instant" });
    } else {
      scroller.scrollTop = 0;
    }
  }

  function scrollForward() {
    const scroller = findScroller();
    const amount = Math.max(
      (scroller.clientHeight || window.innerHeight || 900) * 0.9,
      900,
    );
    if (typeof scroller.scrollBy === "function") {
      scroller.scrollBy({ top: amount, behavior: "instant" });
    } else {
      scroller.scrollTop = (scroller.scrollTop || 0) + amount;
    }
  }

  function findMonthYear(node) {
    let current = node;

    for (let depth = 0; current && depth < 8; depth += 1, current = current.parentElement) {
      const candidates = [
        current.getAttribute("aria-label"),
        current.getAttribute("title"),
      ]
        .map((value) => normalize(value))
        .filter(Boolean);

      for (const candidate of candidates) {
        const match = candidate.match(MONTH_YEAR_RE);
        if (match) {
          return {
            monthName: match[1],
            year: Number(match[2]),
          };
        }
      }
    }

    return null;
  }

  function readVisibleYearRows() {
    const scroller = findScroller();
    const headings = Array.from(
      document.querySelectorAll("h1, h2, h3, [role='heading']"),
    )
      .map((node) => normalize(node.innerText || node.textContent || ""))
      .filter(Boolean)
      .slice(0, 40);

    const candidates = Array.from(
      document.querySelectorAll("[role='gridcell'] button, [role='gridcell']"),
    );

    const rows = [];
    const sampleTail = [];

    for (const node of candidates) {
      const text = normalize(node.innerText || node.textContent || "");
      if (!text) {
        continue;
      }

      if (sampleTail.length < 20) {
        sampleTail.push(text);
      } else {
        sampleTail.shift();
        sampleTail.push(text);
      }

      if (text.length > 80) {
        continue;
      }

      const match = text.match(DAY_CELL_RE);
      if (!match) {
        continue;
      }

      const monthYear = findMonthYear(node);
      if (!monthYear) {
        continue;
      }

      const month = MONTH_MAP[match[2]];
      const day = Number(match[3]);
      const date = `${monthYear.year}-${shared.pad2(month)}-${shared.pad2(day)}`;

      rows.push({
        date,
        dateLabel: text,
        currencySymbol: match[4],
        nightlyRate: Number(match[5].replaceAll(",", "")),
        rawPrice: `${match[4]}${match[5]}`,
        rawText: text,
      });
    }

    return {
      url: location.href,
      title: document.title,
      propertyName:
        normalize(document.querySelector("h1")?.innerText) ||
        normalize(document.querySelector("[data-testid='listing-name']")?.innerText) ||
        normalize(document.title),
      rows,
      headings,
      sampleTail: sampleTail.join(" | "),
      scrollTop: scroller.scrollTop || window.scrollY || 0,
      scrollHeight: scroller.scrollHeight || 0,
      clientHeight: scroller.clientHeight || window.innerHeight || 0,
    };
  }

  function validatePage() {
    return {
      ok: shared.isLikelyAirbnbHostCalendarUrl(location.href),
      url: location.href,
      title: document.title,
      message: shared.isLikelyAirbnbHostCalendarUrl(location.href)
        ? "Ready on an Airbnb host multicalendar page."
        : "Open an Airbnb host multicalendar page for a single listing.",
    };
  }

  async function collectYearViewRows({ maxScrolls = 30 } = {}) {
    const collected = new Map();
    let previousSample = "";
    let stagnantIterations = 0;
    let lastSnapshot = null;

    scrollToTop();
    await sleep(700);

    for (let attempt = 0; attempt < maxScrolls; attempt += 1) {
      const snapshot = readVisibleYearRows();
      lastSnapshot = snapshot;

      for (const row of snapshot.rows) {
        if (!collected.has(row.date)) {
          collected.set(row.date, row);
        }
      }

      const progressKey = `${snapshot.headings.join(" / ")} || ${snapshot.sampleTail}`;
      if (progressKey === previousSample) {
        stagnantIterations += 1;
      } else {
        stagnantIterations = 0;
        previousSample = progressKey;
      }

      const nearBottom =
        snapshot.scrollTop + snapshot.clientHeight >= snapshot.scrollHeight - 32;

      if (nearBottom && stagnantIterations >= 2) {
        break;
      }

      scrollForward();
      await sleep(700);
    }

    const rows = shared.sortByDate(Array.from(collected.values()));
    return {
      url: lastSnapshot?.url || location.href,
      title: lastSnapshot?.title || document.title,
      propertyName:
        lastSnapshot?.propertyName ||
        normalize(document.querySelector("h1")?.innerText) ||
        normalize(document.title),
      rows,
      rowCount: rows.length,
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "VALIDATE_PAGE") {
      sendResponse(validatePage());
      return false;
    }

    if (message?.type === "COLLECT_YEAR_VIEW_ROWS") {
      collectYearViewRows(message.options)
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error) => sendResponse({ ok: false, error: error.message }));
      return true;
    }

    return false;
  });
})();
