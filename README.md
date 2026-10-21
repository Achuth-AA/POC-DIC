# tendernotice

POC for the DIC / MeitY RFP *Voice AI Agent Platform*. The design is in
[`docs/POC_DESIGN.md`](docs/POC_DESIGN.md).

## Frontends

Three separate **React + Vite** apps (JavaScript/JSX), one per role, each with its own `package.json`. They run
on mock data for now.

| Folder | App | Who uses it | Dev port |
|---|---|---|---|
| [`end-user/`](end-user/) | Demo PM-KISAN scheme page with the AI chat widget (bottom right) | Citizens; DIC evaluators acting as citizens | 5175 |
| [`admin/`](admin/) | Admin console: dashboard, knowledge base, providers & cache, calls & chats, evaluation | DIC admin / project team | 5173 |
| [`human-assist/`](human-assist/) | Agent console: handoff queue, live transcript, AI summary, suggested answers, wrap-up; callbacks | Helpline officers | 5174 |

### Run locally

Needs Node 18 or newer.

```bash
npm run install:all     # installs all three apps
npm run dev:citizen     # http://localhost:5175
npm run dev:admin       # http://localhost:5173
npm run dev:agent       # http://localhost:5174
npm run build:all       # production builds into each app's dist/
```

Or work in one app directly: `cd admin && npm install && npm run dev`.

### Code layout (each app)

```
src/
  main.jsx          entry: router + providers
  store.jsx         app state (admin: context store, agent console: reducer)
  data/mock.js      mock data, shaped like the planned orchestrator API (docs/POC_DESIGN.md §13–14)
  pages/            one component per screen
  components/       shared UI (layout, badges, charts, toasts, drawer/modal)
  styles/           CSS
```

The citizen app has `src/SchemePage.jsx` (the page) and `src/widget/` (the assistant: `Widget.jsx`,
`cards.jsx`, `mockBackend.js`, `widget.css`). Connecting the real backend means replacing the mock files with
`fetch()` calls; the components don't change.

### Deploy to Vercel (three separate projects)

Do this once per folder:

1. In Vercel: **Add New → Project** and import this GitHub repository.
2. **Root Directory**: `end-user`, `admin` or `human-assist`.
3. **Framework Preset**: *Vite* (detected automatically). Build command `npm run build`, output directory `dist`.
4. For the **admin** project only, add these environment variables so its sidebar links to the other two apps
   (leave one out to hide that link):
   - `VITE_AGENT_CONSOLE_URL`: the agent console's Vercel URL
   - `VITE_CITIZEN_DEMO_URL`: the citizen page's Vercel URL
5. Deploy.

Each app's `vercel.json` sends every route to `index.html` (so deep links like `/knowledge` work) and adds
`X-Robots-Tag: noindex`, so search engines won't index the demo, in particular the citizen page, which looks
like a Government site.

Notes:
- There is no login yet. Anyone with an admin or agent console URL can open it. The data is all fake, but if you
  want the links private, turn on Vercel's Deployment Protection for those projects (check what your plan
  includes).
- Choose neutral project names (e.g. `voice-poc-citizen`), not names that look like an official domain.

### Demo tips

- **Languages:** English and Hindi (mandatory), plus Telugu and Malayalam. Pick one in the widget header, use the
  हिन्दी / తెలుగు / മലയാളം links in the top strip, or just type in that script; the reply comes back in the same
  language, and the quick-reply buttons are translated too.
- **Widget:** try "Am I eligible?", "kist kab aati hai?" (Hindi reply), "నాకు ఎంత డబ్బు వస్తుంది?" (Telugu),
  "എനിക്ക് അർഹതയുണ്ടോ?" (Malayalam), "Check my status" (registration `UP123456789`, `TS456123789` or
  `KL321654987`, any 10-digit mobile, OTP `123456`), "Register a complaint", "Talk to an officer".
  Add `?agents=offline` to the URL to see the callback / email flow instead of a live officer.
- **Voice call from the page:** "📞 Talk to the assistant" in the hero, "Call the assistant" in Help, or the
  **Call** button next to the chat button. The call screen has a language picker, timer, mute and end call. It is
  the screen only for now; the browser voice call connects once the LiveKit voice agent is built.
- **Look (all three apps):** light only, in a plain Google style. It uses Google Sans with Noto for Hindi, Telugu and Malayalam, and one outline icon set (`src/components/Icon.jsx`) instead of emoji. Colour is kept for data and state, with one main action per screen. Motion is short (under 300 ms) and respects reduced-motion settings. The dashboard's signature element is the *One voice turn* timeline: each stage of a reply is drawn against the 1,000 ms target.
- **Admin → Knowledge base:** press **Update knowledge base**, add files or a web page, choose who can use each
  (Public / Officers only), optionally say what changed, and press the button once. It shows each step (read,
  split into passages, embed, check for hidden instructions, publish as the next version, clear the old cached
  answers) and goes live as the new version. Each source's ⋯ menu has Preview, Re-index and Remove; every one of
  those also creates a new version and clears the cache. *History* shows the version log. *Test a question* runs
  retrieval as a live call would.
- **Admin → Models & voice:** a playground on the left (ask a question, see the answer, sources, route and the
  estimated voice-turn latency; ask twice for a cache hit) and **Run settings** on the right, all dropdowns and
  sliders: language model and backup, temperature, max reply length, speech-to-text and backup, text-to-speech,
  voice, default language, and under *Advanced* the passages per answer, cache and failover. *Save* applies to new
  calls and logs each change.
- **Agent console:** answer the voice call. New caller lines arrive live and the suggestions update.
  End the call and complete the wrap-up. A callback booked during a call shows on the Callbacks page.
  A new handoff appears after about 20 seconds.

### What is mocked

All data is mock data, held in memory, so it resets on reload (the widget keeps its chat for the browser tab
via `sessionStorage`). The three apps are not connected to each other yet: a handoff from the widget does not
reach the agent console until the backend exists.

The citizen page summarises public PM-KISAN information for the demo. It carries a "not an official website"
banner and uses no Government emblem or logos. Check the content against the official guidelines before
showing it.
