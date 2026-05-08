# Chrome Web Store Listing Draft

## Short Description

Export Airbnb host calendar nightly prices to CSV.

## Detailed Description

Airbnb Host Rate Exporter helps hosts download visible nightly prices from their Airbnb host calendar into a clean CSV file.

Open the Airbnb host calendar for a single listing, click the extension, and export the next 12 months of visible nightly rates. The CSV opens in Excel, Numbers, Google Sheets, or tools that import rate data.

The export includes:

- Date
- Day of week
- Nightly rate
- Nightly rate in cents
- Currency symbol

Booked nights may be missing because Airbnb does not show a nightly price row for those dates in the host calendar.

The extension runs locally in Chrome. It does not send calendar data to a server, use analytics, sell data, or include ads.

## Single Purpose

Export visible Airbnb host calendar nightly prices to a local CSV file.

## Permission Justifications

### activeTab

Used when the host clicks the extension so the popup can verify and work with the current Airbnb host calendar tab.

### downloads

Used to save the exported nightly rate CSV file to the host's computer.

### Host permission: `https://www.airbnb.com/*` and `https://*.airbnb.com/*`

Used only on Airbnb pages so the content script can read visible host calendar dates and nightly prices.

## Remote Code

No remote code is used.

## Data Disclosure

The extension reads visible Airbnb host calendar dates and nightly prices only after the user clicks **Scrape rates**. The data is used locally to create a CSV download. It is not transmitted, sold, shared, stored remotely, or used for analytics.

## Screenshots To Capture

- Popup on an Airbnb host calendar page, ready to scrape
- Popup after export completes
- Example CSV open in a spreadsheet
