# tendernotice

POC for the DIC / MeitY RFP *Voice AI Agent Platform*. The design is in
[`docs/POC_DESIGN.md`](docs/POC_DESIGN.md).

## Frontends (static prototypes)

Three separate apps, plain HTML/CSS/JavaScript with mock data. No build step, no external libraries.

| Folder | App | Who uses it |
|---|---|---|
| [`end-user/`](end-user/) | Demo PM-KISAN scheme page with the AI chat widget (bottom right) | Citizens; DIC evaluators acting as citizens |
| [`admin/`](admin/) | Admin console: dashboard, knowledge base, providers & cache, calls & chats, evaluation | DIC admin / project team |
| [`human-assist/`](human-assist/) | Agent console: handoff queue, live transcript, AI summary, suggested answers, wrap-up; callbacks | Helpline officers |

### Run

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000/> for a launcher page with links to all three. Opening the HTML files directly
(`file://`) also works.

### Deploy to Vercel (three separate projects)

Each folder is a self-contained static site with its own `vercel.json`, so it deploys with no build step.
Do this three times, once per folder:

1. In Vercel: **Add New → Project** and import this GitHub repository.
2. **Root Directory**: `end-user`, `admin` or `human-assist`.
3. **Framework Preset**: *Other*. Leave the Build Command empty and the Output Directory as default.
4. Deploy.

Then link the admin console to the other two: put their URLs in [`admin/js/config.js`](admin/js/config.js)
(`agentConsoleUrl`, `citizenDemoUrl`) and push. Until you do, the admin sidebar just hides those two links.

Notes:
- Every response carries `X-Robots-Tag: noindex`, so search engines won't index the demo, in particular the
  citizen page, which looks like a Government site.
- There is no login yet. Anyone with an admin or agent console URL can open it. The data is all fake, but if you
  want the links private, turn on Vercel's Deployment Protection for those projects (check what your plan
  includes).
- Choose neutral project names (e.g. `voice-poc-citizen`), not names that look like an official domain.
- The repo-root `index.html` launcher is only for local use. Deploy it as a fourth project with Root Directory `.`
  if you want it, but its links assume the three apps sit under one site.

### Demo tips

- **Widget:** try "Am I eligible?", "kist kab aati hai?" (Hindi reply), "Check my status" (registration
  `UP123456789`, any 10-digit mobile, OTP `123456`), "Register a complaint", "Talk to an officer".
  Add `?agents=offline` to the URL to see the callback / email flow instead of a live officer.
- **Admin → Knowledge base:** upload any PDF/DOCX/CSV to watch ingestion, publish the draft circular
  (KB version goes up), click a document to preview its chunks, and use *Test a question*.
- **Admin → Providers:** switch LLM/STT/TTS, apply, and see the change log.
- **Agent console:** answer the voice call. New caller lines arrive live and the suggestions update.
  End the call and complete the wrap-up. A new handoff appears after about 20 seconds.

### What is mocked

All data is in each app's `mock-data.js` (`end-user/widget/mock-backend.js` for the widget). The mocks use the
same shapes as the orchestrator API in `docs/POC_DESIGN.md` §13–14, so wiring the real backend means replacing
those files with `fetch()` calls. State is in memory, so it resets on reload (the widget keeps its chat for the
browser tab via `sessionStorage`).

The citizen page summarises public PM-KISAN information for the demo. It carries a "not an official website"
banner and uses no Government emblem or logos. Check the content against the official guidelines before
showing it.
