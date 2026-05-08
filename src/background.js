importScripts("shared.js");

const shared = globalThis.AirbnbRateExporter;

function sendRuntimeMessage(tabId, message) {
  return chrome.tabs.sendMessage(tabId, message);
}

function updateTab(tabId, url) {
  return new Promise((resolve, reject) => {
    chrome.tabs.update(tabId, { url }, (tab) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(tab);
    });
  });
}

function waitForTabComplete(tabId) {
  return new Promise((resolve) => {
    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function navigateAndWait(tabId, url) {
  const loaded = waitForTabComplete(tabId);
  await updateTab(tabId, url);
  await loaded;
  await new Promise((resolve) => setTimeout(resolve, 1200));
}

function createPortMessenger(port) {
  let connected = true;

  port.onDisconnect.addListener(() => {
    connected = false;
  });

  return {
    post(message) {
      if (!connected) {
        return false;
      }

      try {
        port.postMessage(message);
        return true;
      } catch (error) {
        if (error.message?.includes("disconnected port")) {
          connected = false;
          return false;
        }
        throw error;
      }
    },
  };
}

function sendProgress(messenger, detail) {
  messenger.post({ type: "PROGRESS", ...detail });
}

async function scrapeRates(messenger, request) {
  const tabId = request.tabId;
  const startUrl = request.url;
  const months = Math.max(1, Math.min(Number(request.months) || shared.DEFAULT_MONTHS, 24));
  const startDate = shared.todayIso();
  const years = shared.getYearsForWindow(startDate, months);
  const collected = new Map();
  let propertyName = "";
  let sourceUrl = startUrl;

  if (!shared.isLikelyAirbnbHostCalendarUrl(startUrl)) {
    throw new Error("Open an Airbnb host multicalendar page for a single listing.");
  }

  for (const year of years) {
    const yearUrl = shared.buildYearUrl(startUrl, year);
    sendProgress(messenger, {
      label: `Opening ${year} year view...`,
      detail: `Collected ${collected.size} unique nightly rates so far.`,
    });

    await navigateAndWait(tabId, yearUrl);

    sendProgress(messenger, {
      label: `Scanning ${year}...`,
      detail: "Scrolling the virtualized calendar. Exact progress is not available from Airbnb's page.",
    });

    const response = await sendRuntimeMessage(tabId, {
      type: "COLLECT_YEAR_VIEW_ROWS",
      options: { maxScrolls: 30 },
    });

    if (!response?.ok) {
      throw new Error(response?.error || `Could not scrape ${year}.`);
    }

    const snapshot = response.result;
    propertyName = propertyName || snapshot.propertyName || snapshot.title || "";
    sourceUrl = sourceUrl || snapshot.url || yearUrl;

    for (const row of snapshot.rows) {
      collected.set(row.date, shared.normalizeScrapedRow(row));
    }

    sendProgress(messenger, {
      label: `Finished ${year}.`,
      detail: `Collected ${collected.size} unique nightly rates so far.`,
    });
  }

  const rows = shared.sortByDate(
    shared.filterRowsToWindow(Array.from(collected.values()), startDate, months),
  );

  if (rows.length === 0) {
    throw new Error(
      "No nightly rates were found. Make sure the visible page is the Airbnb host single-listing calendar with prices shown on each day.",
    );
  }

  const csv = shared.rowsToCsv(rows);
  const filename = shared.buildFilename(propertyName || "airbnb-property", startDate, months);

  await downloadCsv(filename, csv);

  return {
    filename,
    months,
    propertyName,
    rowCount: rows.length,
    sourceUrl,
  };
}

function downloadCsv(filename, csv) {
  return new Promise((resolve, reject) => {
    const url = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    chrome.downloads.download(
      {
        url,
        filename,
        saveAs: true,
        conflictAction: "uniquify",
      },
      (downloadId) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(downloadId);
      },
    );
  });
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "scrape-rates") {
    return;
  }

  const messenger = createPortMessenger(port);

  port.onMessage.addListener((message) => {
    if (message?.type !== "START_SCRAPE") {
      return;
    }

    scrapeRates(messenger, message)
      .then((result) => {
        messenger.post({ type: "DONE", result });
      })
      .catch((error) => {
        messenger.post({ type: "ERROR", error: error.message });
      });
  });
});
