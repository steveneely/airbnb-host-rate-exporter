(function attachPopup() {
  "use strict";

  const shared = globalThis.AirbnbRateExporter;
  const pageStatus = document.getElementById("pageStatus");
  const monthsInput = document.getElementById("months");
  const scrapeButton = document.getElementById("scrapeButton");
  const statusText = document.getElementById("statusText");
  const progress = document.getElementById("progress");
  const result = document.getElementById("result");
  const resultTitle = document.getElementById("resultTitle");
  const resultDetails = document.getElementById("resultDetails");

  let activeTab = null;

  function setStatus(text) {
    statusText.textContent = text;
  }

  function setBusy(isBusy) {
    scrapeButton.disabled = isBusy || !activeTab;
    monthsInput.disabled = isBusy;
    if (isBusy) {
      progress.removeAttribute("value");
    } else {
      progress.value = 0;
    }
  }

  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    return tab;
  }

  async function validateCurrentTab() {
    activeTab = await getActiveTab();
    const url = activeTab?.url || "";

    if (!shared.isLikelyAirbnbHostCalendarUrl(url)) {
      pageStatus.textContent = "Not on an Airbnb host calendar page.";
      setStatus("Open an Airbnb host multicalendar page for a single listing.");
      scrapeButton.disabled = true;
      return;
    }

    try {
      const response = await chrome.tabs.sendMessage(activeTab.id, {
        type: "VALIDATE_PAGE",
      });
      pageStatus.textContent = response?.message || "Ready.";
      setStatus("Ready to scrape the next 12 months.");
      scrapeButton.disabled = !response?.ok;
    } catch {
      pageStatus.textContent = "Reload this Airbnb tab, then try again.";
      setStatus("The content script is not ready on this page yet.");
      scrapeButton.disabled = true;
    }
  }

  function startScrape() {
    if (!activeTab) {
      return;
    }

    const months = Math.max(1, Math.min(Number(monthsInput.value) || 12, 24));
    monthsInput.value = String(months);
    result.hidden = true;
    setBusy(true);
    setStatus("Starting scrape...");

    const port = chrome.runtime.connect({ name: "scrape-rates" });
    port.onMessage.addListener((message) => {
      if (message.type === "PROGRESS") {
        setStatus(`${message.label} ${message.detail || ""}`.trim());
      }

      if (message.type === "DONE") {
        setBusy(false);
        result.hidden = false;
        resultTitle.textContent = `Downloaded ${message.result.rowCount} rows`;
        resultDetails.textContent = message.result.filename;
        setStatus("CSV download is ready.");
        port.disconnect();
      }

      if (message.type === "ERROR") {
        setBusy(false);
        setStatus(message.error);
        port.disconnect();
      }
    });

    port.postMessage({
      type: "START_SCRAPE",
      tabId: activeTab.id,
      url: activeTab.url,
      months,
    });
  }

  scrapeButton.addEventListener("click", startScrape);
  progress.value = 0;
  validateCurrentTab();
})();
