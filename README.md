# A and A Holdings Business Dashboard

Responsive local management dashboard consolidating McCann Motors and AI Vending, with role views, prior-week reporting, editable targets, alerts, trends, vending operations, inventory, refills and faults.

## Run

Install Node.js 20+, then run `npm install` and `npm run dev`. Build with `npm run build`.

## Secure Routal connection

Enter `ROUTAL_API_KEY` and `ROUTAL_PROJECT_ID` in `.env.local` directly on the computer running the dashboard. This file is ignored by Git and must never be shared or committed. Restart the dashboard, open AI Vending → Routal planner, press **Test connection**, then use **Create one-stop test**. The test creates a plan and one geocoded stop for review in Routal; it does not optimise or dispatch the route automatically.

Select a profile on the demo sign-in screen. Owner sees the group; Keith, Gary and Sandra see McCann Motors responsibilities; AI Vending Ops sees vending operations.

Seeded records persist in browser local storage on the same device. The model separates businesses, machines, stock, reports and alerts so MAM, vending telemetry, payment and inventory APIs can replace the local repository later.

## Product principles carried forward from the original Cursor build

This is a management-intelligence layer over existing garage, sales, rental and vending systems—not replacement operational software. McCann Motors views should explain why performance moved and retain the agreed bonus settings: €97 labour rate, 35 billed-hour technician threshold, 140 combined workshop hours and a 20% bonus calculation. Future work should preserve KPI explanations, recovery and lost-hours analysis, job-type profitability, advisor upsell insights, manager notes and stock highlights.

The original Cursor version remains recoverable in Git history at commit `4a6971a`.
# Future integration note: UK and Irish registration lookup

Preferred provider to trial: **One Auto API (VRM360)**.

- Republic of Ireland vehicle identity: 15p per lookup on PrePay, 10p on the £25/month Business plan, and 6p on the £100/month Enterprise plan.
- Basic UK vehicle details: 5p per lookup on PrePay, 3p on Business, and 1p on Enterprise.
- PrePay has no monthly fee and currently requires a £25 initial top-up.
- The Business plan becomes cheaper overall at roughly 500 Irish lookups per month.
- Use a server-side integration so credentials are never exposed in the browser.
- Recheck current pricing and tax before purchasing: https://www.vrm360.co.uk/pricing/
