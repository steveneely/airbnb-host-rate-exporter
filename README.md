# Airbnb Host Rate Exporter

Export nightly prices from your Airbnb host calendar into a CSV file you can open in Excel, Numbers, or import into Strcoop.

## What You Need

- Google Chrome
- An Airbnb host account
- Access to the Airbnb calendar for a single listing

## Install in Chrome

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this repo folder: `/Users/sneely/code/airbnb-host-rate-exporter`.

If you update the extension files later, click the reload icon on the extension card in `chrome://extensions`.

## Export Airbnb Rates

1. Log in to Airbnb in Chrome.
2. Open the host calendar for one listing.
3. Click the **Airbnb Host Rate Exporter** extension icon.
4. Click **Scrape rates**.
5. Choose where to save the CSV when Chrome asks.

By default, the extension exports the next 12 months of visible nightly prices.

If the button is disabled, make sure you are on an Airbnb host multicalendar page for a single listing. If you just reloaded the extension, reload the Airbnb calendar tab too.

## Output File

The downloaded file is named with the listing name and date range, for example:

```text
airbnb-host-nightly-rates-mountain-cabin-2026-05-05-to-2027-05-04.csv
```

Booked nights may be missing from the CSV because Airbnb does not show a nightly price row for those dates in the host calendar. That is expected.

## Privacy

The extension runs locally in Chrome. It reads visible nightly prices from the Airbnb host calendar page you open and downloads a CSV file to your computer. It does not send your Airbnb calendar data to a server, sell data, track browsing, or include analytics.

See [PRIVACY.md](PRIVACY.md) for the full privacy policy.

## CSV columns

- `date`: night date in `YYYY-MM-DD` format
- `day_of_week`: useful for scanning rates in a spreadsheet
- `nightly_rate`: dollar amount, such as `525.00`
- `nightly_rate_cents`: cents value for Strcoop imports, such as `52500`
- `currency_symbol`: usually `$`

## Development

Run tests:

```sh
npm test
```

The scraper intentionally focuses tests on stable helpers like dates, CSV output, filtering, and row shaping. Airbnb changes its page markup often, so DOM scraping details are kept pragmatic.
