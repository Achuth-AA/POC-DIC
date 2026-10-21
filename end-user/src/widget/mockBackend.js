// Mock of the orchestrator API used by the chat widget (see docs/POC_DESIGN.md §14).
// Every method returns a Promise shaped like the real endpoint, so swapping this file for
// fetch() calls to /v1/sessions, /v1/turn, /otp/* and /tickets should not touch Widget.jsx.
//
// A reply is a list of blocks the widget knows how to render:
//   {type:'text', text, sources?}          answer text (streamed word by word by the widget)
//   {type:'quick', options:[...]}          quick-reply buttons
//   {type:'otp'}                           OTP verification form
//   {type:'status', record}                beneficiary status card
//   {type:'confirm', title, rows, action}  confirmation card (irreversible action)
//   {type:'handoff', online}               connect-to-officer / callback options
//   {type:'agent', name, text}             message from a human officer
const DEMO_OTP = '123456';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const params = new URLSearchParams(location.search);
const AGENTS_ONLINE = params.get('agents') !== 'offline';

const SRC = {
  guide: (page) => ({ title: 'PM-KISAN Operational Guidelines (demo KB)', page }),
  faq: (n) => ({ title: 'PM-KISAN FAQs (demo KB)', page: n }),
};

// Answers grounded in the demo knowledge base. Each has English and Hindi text.
const ANSWERS = {
  eligibility: {
    en: 'Landholding farmer families with cultivable land in their names are eligible. A family means husband, wife and minor children. Some groups are excluded, such as income tax payers, institutional landholders and pensioners getting ₹10,000 or more a month.',
    hi: 'जिन किसान परिवारों के नाम पर खेती योग्य ज़मीन है, वे पात्र हैं। परिवार का मतलब पति, पत्नी और नाबालिग बच्चे। आयकर देने वाले, संस्थागत भूमिधारक और ₹10,000 या उससे ज़्यादा पेंशन पाने वाले पात्र नहीं हैं।',
    sources: [SRC.guide(3), SRC.guide(4)],
    quick: ['Documents needed', 'How to apply', 'Check my status'],
  },
  amount: {
    en: 'Eligible families get ₹6,000 a year, paid in three instalments of ₹2,000 each, directly into the Aadhaar-seeded bank account.',
    hi: 'पात्र परिवारों को साल में ₹6,000 मिलते हैं, ₹2,000 की तीन किस्तों में, सीधे आधार से जुड़े बैंक खाते में।',
    sources: [SRC.guide(2)],
    quick: ['When are instalments paid?', 'Check my status'],
  },
  timing: {
    en: 'Instalments follow three four-month periods: April to July, August to November, and December to March.',
    hi: 'किस्तें चार-चार महीने की तीन अवधियों में आती हैं: अप्रैल से जुलाई, अगस्त से नवंबर, और दिसंबर से मार्च।',
    sources: [SRC.guide(2)],
    quick: ['Check my status', 'Payment not received'],
  },
  documents: {
    en: 'You need: 1) Aadhaar card, 2) land ownership records, 3) bank account details (seeded with Aadhaar), 4) a mobile number linked to Aadhaar.',
    hi: 'ज़रूरी दस्तावेज़: 1) आधार कार्ड, 2) ज़मीन के कागज़, 3) आधार से जुड़ा बैंक खाता, 4) आधार से जुड़ा मोबाइल नंबर।',
    sources: [SRC.guide(5), SRC.faq(2)],
    quick: ['How to apply', 'e-KYC'],
  },
  apply: {
    en: 'Register using "New farmer registration" on the portal, at a Common Service Centre (CSC), or through your state nodal officer or patwari. The state then verifies your land records and Aadhaar.',
    hi: 'पोर्टल पर "New farmer registration" से, नज़दीकी CSC पर, या राज्य नोडल अधिकारी/पटवारी के ज़रिए पंजीकरण करें। फिर राज्य आपकी ज़मीन और आधार की जाँच करता है।',
    sources: [SRC.guide(6)],
    quick: ['Documents needed', 'e-KYC'],
  },
  ekyc: {
    en: 'e-KYC is mandatory to keep receiving instalments. You can do it with an Aadhaar OTP on the portal, or with biometric verification at a CSC.',
    hi: 'किस्तें मिलती रहें, इसके लिए e-KYC ज़रूरी है। पोर्टल पर आधार OTP से या CSC पर बायोमेट्रिक से e-KYC करें।',
    sources: [SRC.faq(7)],
    quick: ['Check my status', 'Talk to an officer'],
  },
  notReceived: {
    en: 'If an instalment has not arrived, first check your status, make sure e-KYC is complete and that your bank account is seeded with Aadhaar. If everything looks right, I can register a grievance for you.',
    hi: 'अगर किस्त नहीं आई है, तो पहले अपना स्टेटस देखें, e-KYC पूरा करें और देखें कि बैंक खाता आधार से जुड़ा है। सब ठीक होने पर मैं आपकी शिकायत दर्ज कर सकता हूँ।',
    sources: [SRC.faq(9)],
    quick: ['Check my status', 'Register a complaint'],
  },
};

const TEXT = {
  greeting: {
    en: 'Namaste! I am the automated assistant for PM-KISAN. You can type in English, Hindi or your language.',
    hi: 'नमस्ते! मैं PM-KISAN का स्वचालित सहायक हूँ। आप हिंदी, अंग्रेज़ी या अपनी भाषा में लिख सकते हैं।',
  },
  clarify: {
    en: "Sorry, I couldn't find that in the scheme information. Could you say it another way?",
    hi: 'माफ़ कीजिए, यह जानकारी मुझे नहीं मिली। क्या आप दूसरे शब्दों में पूछ सकते हैं?',
  },
  offerHuman: {
    en: "I still couldn't find an answer. I don't want to guess, so let me connect you to an officer.",
    hi: 'मुझे अब भी जवाब नहीं मिला। मैं अंदाज़ा नहीं लगाना चाहता, इसलिए आपको एक अधिकारी से जोड़ता हूँ।',
  },
  authNeeded: {
    en: 'For your security, please verify with an OTP sent to the mobile number registered with PM-KISAN.',
    hi: 'आपकी सुरक्षा के लिए, PM-KISAN में दर्ज मोबाइल पर भेजे गए OTP से पुष्टि करें।',
  },
  refuse: {
    en: "I can't help with that. I can only share your own details after verification, and information from the scheme guidelines.",
    hi: 'मैं इसमें मदद नहीं कर सकता। मैं सिर्फ़ पुष्टि के बाद आपकी अपनी जानकारी और योजना के दिशानिर्देश बता सकता हूँ।',
  },
  thanks: { en: "You're welcome! Is there anything else I can help with?", hi: 'आपका स्वागत है! क्या मैं और कुछ मदद कर सकता हूँ?' },
  grievanceCategory: { en: 'Sure. What is the complaint about?', hi: 'ज़रूर। शिकायत किस बारे में है?' },
  grievanceDetails: {
    en: 'Please describe the problem in a sentence or two.',
    hi: 'कृपया समस्या एक-दो वाक्यों में बताइए।',
  },
  cancelled: { en: 'Okay, I have cancelled it. Nothing was submitted.', hi: 'ठीक है, रद्द कर दिया। कुछ भी जमा नहीं हुआ।' },
  connecting: { en: 'Connecting you to an officer. Please stay in this chat.', hi: 'आपको एक अधिकारी से जोड़ रहा हूँ। कृपया इसी चैट में रहें।' },
  offline: {
    en: 'Our officers are available 9 am to 6 pm. I can arrange a callback or send the reply by email.',
    hi: 'हमारे अधिकारी सुबह 9 से शाम 6 बजे तक उपलब्ध हैं। मैं कॉलबैक या ईमेल से जवाब की व्यवस्था कर सकता हूँ।',
  },
};

const CATEGORIES = ['Instalment not received', 'Wrong bank details', 'e-KYC problem', 'Other'];

// Rules first (cheap and predictable), as in the orchestrator's input guardrail and router.
const INTENTS = [
  ['injection', /ignore (all|your|previous)|system prompt|act as|jailbreak|other (people|farmers|applicants)'?s? (data|details)/i],
  ['human', /human|officer|agent|person|real person|insaan|adhikari|अधिकारी|इंसान|बात कर/i],
  ['status', /status|स्थिति|स्टेटस|kab aayega|beneficiary|मेरा पैसा|my payment/i],
  ['grievance', /complain|complaint|grievance|shikayat|शिकायत/i],
  ['notReceived', /not (received|come|credited)|nahi aaya|नहीं आ|didn'?t get/i],
  ['ekyc', /e-?kyc|केवाईसी/i],
  ['documents', /document|papers|kagaz|दस्तावेज़|कागज़/i],
  ['apply', /apply|register|registration|aavedan|पंजीकरण|आवेदन/i],
  ['timing', /when|kab|कब|month|instalment date|kist kab/i],
  ['amount', /how much|amount|kitna|कितना|6,?000|money|paisa|पैसा|rupee|₹/i],
  ['eligibility', /eligib|patra|पात्र|who can|qualif/i],
  ['thanks', /thank|dhanyavad|shukriya|धन्यवाद|शुक्रिया/i],
];

const HINGLISH = /\b(kya|kab|kaise|mera|meri|mujhe|hai|nahi|kitna|paisa|kist|batao|chahiye)\b/i;
// Devanagari or Hinglish → Hindi; a full English sentence → English; otherwise keep the caller's choice.
function detectLang(text, preferred) {
  if (/[ऀ-ॿ]/.test(text) || HINGLISH.test(text)) return 'hi';
  if (text.trim().split(/\s+/).length >= 4) return 'en';
  return preferred || 'en';
}

const sessions = new Map();

function pick(map, lang) { return map[lang] || map.en; }

function answerBlocks(key, lang) {
  const a = ANSWERS[key];
  const blocks = [{ type: 'text', text: pick(a, lang), sources: a.sources }];
  if (a.quick) blocks.push({ type: 'quick', options: a.quick });
  return blocks;
}

function maskName(name) { return name.split(' ').map((w) => w[0] + '***').join(' '); }

function lookupBeneficiary(regNo) {
  const known = {
    UP123456789: { name: 'Ramesh Kumar', state: 'Uttar Pradesh', ekyc: 'Completed', land: 'Verified', last: '₹2,000 credited on 05 Oct 2026', next: 'Expected in the December to March period' },
    MH987654321: { name: 'Sunanda Patil', state: 'Maharashtra', ekyc: 'Pending', land: 'Verified', last: '₹2,000 credited on 12 Jun 2026', next: 'On hold until e-KYC is completed' },
  };
  const r = known[regNo] || { name: 'Demo Farmer', state: 'Bihar', ekyc: 'Completed', land: 'Under verification', last: 'No instalment yet', next: 'After land record verification' };
  return { regNo, ...r, name: maskName(r.name) };
}

export const backend = {
  agentsOnline: AGENTS_ONLINE,

  async startSession({ tenant, language = 'en' }) {
    await wait(250);
    const id = 's_c_' + Math.random().toString(36).slice(2, 8);
    sessions.set(id, { tenant, failed: 0, auth: 0, pending: null, grievance: null, withAgent: false, lang: language });
    return {
      sessionId: id,
      greeting: TEXT.greeting,
      quick: ['Am I eligible?', 'Documents needed', 'Check my status', 'Talk to an officer'],
    };
  },

  // Restores a session after a page refresh (the real server keeps it in Redis).
  resume(sessionId, state) {
    if (!sessions.has(sessionId)) sessions.set(sessionId, state || { failed: 0, auth: 0, pending: null, grievance: null, withAgent: false, lang: 'en' });
  },

  snapshot(sessionId) { return sessions.get(sessionId); },

  async sendTurn(sessionId, text, preferredLang) {
    const s = sessions.get(sessionId);
    const lang = detectLang(text, preferredLang);
    s.lang = lang;
    await wait(350 + Math.random() * 300);

    if (s.withAgent) {
      await wait(900);
      return { lang, blocks: [{ type: 'agent', name: 'Officer Sunita (demo)', text: 'Thank you. I can see your details and the AI summary. Let me check this for you.' }] };
    }

    // Grievance slot filling in progress.
    if (s.grievance && s.grievance.step === 'details') {
      s.grievance.details = text.slice(0, 300);
      s.grievance.step = 'confirm';
      return {
        lang,
        blocks: [{
          type: 'confirm',
          title: lang === 'hi' ? 'कृपया अपनी शिकायत की पुष्टि करें' : 'Please confirm your complaint',
          rows: [
            ['Category', s.grievance.category],
            ['Registration no.', s.grievance.regNo || 'Not provided'],
            ['Details', s.grievance.details],
          ],
          action: 'submit_grievance',
        }],
      };
    }
    if (s.grievance && s.grievance.step === 'category') {
      s.grievance.category = CATEGORIES.find((c) => c.toLowerCase() === text.toLowerCase()) || text.slice(0, 60);
      s.grievance.step = 'details';
      return { lang, blocks: [{ type: 'text', text: pick(TEXT.grievanceDetails, lang) }] };
    }

    const intent = (INTENTS.find(([, re]) => re.test(text)) || ['unknown'])[0];

    switch (intent) {
      case 'injection':
        s.failed += 1;
        return { lang, blocks: [{ type: 'text', text: pick(TEXT.refuse, lang) }] };
      case 'human':
        return { lang, blocks: this._handoff(s, lang) };
      case 'status':
        if (s.auth < 1) { s.pending = 'status'; return { lang, blocks: [{ type: 'text', text: pick(TEXT.authNeeded, lang) }, { type: 'otp' }] }; }
        return { lang, blocks: [{ type: 'status', record: lookupBeneficiary(s.regNo) }] };
      case 'grievance':
        if (s.auth < 1) { s.pending = 'grievance'; return { lang, blocks: [{ type: 'text', text: pick(TEXT.authNeeded, lang) }, { type: 'otp' }] }; }
        s.grievance = { step: 'category', regNo: s.regNo };
        return { lang, blocks: [{ type: 'text', text: pick(TEXT.grievanceCategory, lang) }, { type: 'quick', options: CATEGORIES }] };
      case 'thanks':
        s.failed = 0;
        return { lang, blocks: [{ type: 'text', text: pick(TEXT.thanks, lang) }] };
      case 'unknown':
        s.failed += 1;
        if (s.failed >= 2) return { lang, blocks: [{ type: 'text', text: pick(TEXT.offerHuman, lang) }, ...this._handoff(s, lang)] };
        return { lang, blocks: [{ type: 'text', text: pick(TEXT.clarify, lang) }, { type: 'quick', options: ['Am I eligible?', 'How much money?', 'Talk to an officer'] }] };
      default:
        s.failed = 0;
        return { lang, blocks: answerBlocks(intent, lang) };
    }
  },

  _handoff(s, lang) {
    s.failed = 0;
    return [{ type: 'handoff', online: AGENTS_ONLINE, text: pick(AGENTS_ONLINE ? TEXT.connecting : TEXT.offline, lang) }];
  },

  async sendOtp(sessionId, regNo, mobile) {
    await wait(500);
    if (!/^[A-Z]{2}\d{9}$/.test(regNo)) return { ok: false, error: 'Registration number should be 2 letters followed by 9 digits, for example UP123456789.' };
    if (!/^\d{10}$/.test(mobile)) return { ok: false, error: 'Enter the 10-digit mobile number.' };
    const s = sessions.get(sessionId);
    s.regNo = regNo;
    return { ok: true, hint: `OTP sent to ******${mobile.slice(-4)}. Demo OTP: ${DEMO_OTP}` };
  },

  async verifyOtp(sessionId, otp) {
    await wait(400);
    const s = sessions.get(sessionId);
    if (otp !== DEMO_OTP) return { ok: false, error: 'That OTP is not correct. Please try again.' };
    s.auth = 1;
    const next = s.pending;
    s.pending = null;
    if (next === 'grievance') {
      s.grievance = { step: 'category', regNo: s.regNo };
      return { ok: true, blocks: [{ type: 'text', text: pick(TEXT.grievanceCategory, s.lang) }, { type: 'quick', options: CATEGORIES }] };
    }
    return { ok: true, blocks: [{ type: 'status', record: lookupBeneficiary(s.regNo) }] };
  },

  async confirmAction(sessionId, action, confirmed) {
    await wait(600);
    const s = sessions.get(sessionId);
    if (action !== 'submit_grievance') return { blocks: [] };
    if (!confirmed) { s.grievance = null; return { blocks: [{ type: 'text', text: pick(TEXT.cancelled, s.lang) }] }; }
    const ticket = 'G-2026-' + String(Math.floor(1000 + Math.random() * 9000));
    s.grievance = null;
    return {
      ticket,
      blocks: [{ type: 'text', text: s.lang === 'hi' ? `आपकी शिकायत दर्ज हो गई है। शिकायत संख्या ${ticket} है।` : `Your complaint is registered. The complaint number is ${ticket}. You will also get an SMS.` }],
    };
  },

  async editGrievance(sessionId) {
    const s = sessions.get(sessionId);
    s.grievance = { step: 'category', regNo: s.regNo };
    return { blocks: [{ type: 'text', text: pick(TEXT.grievanceCategory, s.lang) }, { type: 'quick', options: CATEGORIES }] };
  },

  async connectAgent(sessionId) {
    await wait(2200);
    const s = sessions.get(sessionId);
    s.withAgent = true;
    return { name: 'Officer Sunita (demo)', text: 'Namaste, I am Sunita. I have read your conversation with the assistant. How can I help?' };
  },

  async scheduleCallback(sessionId, slot) {
    await wait(500);
    return { ref: 'CB-' + String(Math.floor(10000 + Math.random() * 90000)), slot };
  },

  async feedback(sessionId, messageId, value) { await wait(100); return { ok: true }; },
};
