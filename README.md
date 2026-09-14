# Worst Date Picker

A date picker submission for "worst UI" purposes. Instead of a calendar,
picking a date opens a random Wikipedia article inside an iframe. Numbers
(day/year) or month names are highlighted as clickable links; click one to
select that value for the current stage (day → month → year).

Every other link on the page is a real, working Wikipedia link — you can
wander off to a totally different article at any point, and your progress
carries over no matter how far you go.

## Run locally

```bash
npm install
npm run dev
```

## How it works

- `app/api/wiki/route.ts` proxies Wikipedia's REST HTML API, rewrites
  internal links to stay inside the proxy (preserving the current picker
  stage), and wraps standalone numbers/month names in clickable spans that
  `postMessage` the chosen value to the parent window.
- `app/components/DatePickerModal.tsx` drives the day → month → year flow,
  validates selections, and shows a persistent overlay explaining that any
  other link is fair game to click.
