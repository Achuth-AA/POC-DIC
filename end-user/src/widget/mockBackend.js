// Mock of the orchestrator API used by the chat widget (see docs/POC_DESIGN.md §14).
// Every method returns a Promise shaped like the real endpoint, so swapping this file for
// fetch() calls to /v1/sessions, /v1/turn, /otp/* and /tickets should not touch Widget.jsx.
//
// Languages: English (en) and Hindi (hi) are mandatory; Telugu (te) and Malayalam (ml) are the two
// additional Indian languages for the POC.
//
// A reply is a list of blocks the widget knows how to render:
//   {type:'text', text, sources?}          answer text (streamed word by word by the widget)
//   {type:'quick', options:[{label, send}]} quick-reply buttons (label in the caller's language)
//   {type:'otp'}                           OTP verification form
//   {type:'status', record}                beneficiary status card
//   {type:'confirm', title, rows, action}  confirmation card (irreversible action)
//   {type:'handoff', online}               connect-to-officer / callback options
//   {type:'agent', name, text}             message from a human officer
export const LANGUAGES = [
  { code: 'en', name: 'English', short: 'EN' },
  { code: 'hi', name: 'हिन्दी', short: 'हिं' },
  { code: 'te', name: 'తెలుగు', short: 'తె' },
  { code: 'ml', name: 'മലയാളം', short: 'മ' },
];

const DEMO_OTP = '123456';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const params = new URLSearchParams(location.search);
const AGENTS_ONLINE = params.get('agents') !== 'offline';

const SRC = {
  guide: (page) => ({ title: 'PM-KISAN Operational Guidelines (demo KB)', page }),
  faq: (n) => ({ title: 'PM-KISAN FAQs (demo KB)', page: n }),
};

// Quick replies send the English value (so the router matches it) but show a label in the caller's language.
const QUICK = {
  'Am I eligible?': { hi: 'क्या मैं पात्र हूँ?', te: 'నేను అర్హుడినా?', ml: 'എനിക്ക് അർഹതയുണ്ടോ?' },
  'Documents needed': { hi: 'ज़रूरी दस्तावेज़', te: 'కావలసిన పత్రాలు', ml: 'ആവശ്യമായ രേഖകൾ' },
  'Check my status': { hi: 'मेरा स्टेटस देखें', te: 'నా స్థితి చూడండి', ml: 'എന്റെ സ്റ്റാറ്റസ് നോക്കുക' },
  'Talk to an officer': { hi: 'अधिकारी से बात करें', te: 'అధికారితో మాట్లాడండి', ml: 'ഉദ്യോഗസ്ഥനുമായി സംസാരിക്കുക' },
  'How to apply': { hi: 'आवेदन कैसे करें', te: 'ఎలా దరఖాస్తు చేయాలి', ml: 'എങ്ങനെ അപേക്ഷിക്കാം' },
  'When are instalments paid?': { hi: 'किस्त कब आती है?', te: 'విడతలు ఎప్పుడు వస్తాయి?', ml: 'ഗഡുക്കൾ എപ്പോൾ ലഭിക്കും?' },
  'Payment not received': { hi: 'पैसा नहीं आया', te: 'డబ్బు రాలేదు', ml: 'പണം ലഭിച്ചില്ല' },
  'Register a complaint': { hi: 'शिकायत दर्ज करें', te: 'ఫిర్యాదు నమోదు చేయండి', ml: 'പരാതി രജിസ്റ്റർ ചെയ്യുക' },
  'e-KYC': {},
  'How much money?': { hi: 'कितना पैसा मिलता है?', te: 'ఎంత డబ్బు వస్తుంది?', ml: 'എത്ര പണം ലഭിക്കും?' },
  'Instalment not received': { hi: 'किस्त नहीं आई', te: 'విడత రాలేదు', ml: 'ഗഡു ലഭിച്ചില്ല' },
  'Wrong bank details': { hi: 'बैंक विवरण गलत', te: 'బ్యాంక్ వివరాలు తప్పు', ml: 'ബാങ്ക് വിവരങ്ങൾ തെറ്റാണ്' },
  'e-KYC problem': { hi: 'e-KYC समस्या', te: 'e-KYC సమస్య', ml: 'e-KYC പ്രശ്നം' },
  Other: { hi: 'अन्य', te: 'ఇతర', ml: 'മറ്റുള്ളവ' },
};
const quick = (options, lang) => ({ type: 'quick', options: options.map((send) => ({ send, label: QUICK[send]?.[lang] || send })) });

// Answers grounded in the demo knowledge base, in all four languages.
const ANSWERS = {
  eligibility: {
    en: 'Landholding farmer families with cultivable land in their names are eligible. A family means husband, wife and minor children. Some groups are excluded, such as income tax payers, institutional landholders and pensioners getting ₹10,000 or more a month.',
    hi: 'जिन किसान परिवारों के नाम पर खेती योग्य ज़मीन है, वे पात्र हैं। परिवार का मतलब पति, पत्नी और नाबालिग बच्चे। आयकर देने वाले, संस्थागत भूमिधारक और ₹10,000 या उससे ज़्यादा पेंशन पाने वाले पात्र नहीं हैं।',
    te: 'తమ పేరు మీద సాగు భూమి ఉన్న రైతు కుటుంబాలు అర్హులు. కుటుంబం అంటే భర్త, భార్య మరియు మైనర్ పిల్లలు. ఆదాయపు పన్ను చెల్లించేవారు, సంస్థాగత భూయజమానులు మరియు నెలకు ₹10,000 లేదా అంతకంటే ఎక్కువ పెన్షన్ పొందేవారు అర్హులు కారు.',
    ml: 'സ്വന്തം പേരിൽ കൃഷിഭൂമിയുള്ള കർഷക കുടുംബങ്ങൾക്ക് അർഹതയുണ്ട്. കുടുംബം എന്നാൽ ഭർത്താവ്, ഭാര്യ, പ്രായപൂർത്തിയാകാത്ത മക്കൾ. ആദായനികുതി അടയ്ക്കുന്നവർ, സ്ഥാപന ഭൂവുടമകൾ, പ്രതിമാസം ₹10,000 അല്ലെങ്കിൽ അതിൽ കൂടുതൽ പെൻഷൻ വാങ്ങുന്നവർ എന്നിവർക്ക് അർഹതയില്ല.',
    sources: [SRC.guide(3), SRC.guide(4)],
    quick: ['Documents needed', 'How to apply', 'Check my status'],
  },
  amount: {
    en: 'Eligible families get ₹6,000 a year, paid in three instalments of ₹2,000 each, directly into the Aadhaar-seeded bank account.',
    hi: 'पात्र परिवारों को साल में ₹6,000 मिलते हैं, ₹2,000 की तीन किस्तों में, सीधे आधार से जुड़े बैंक खाते में।',
    te: 'అర్హులైన కుటుంబాలకు సంవత్సరానికి ₹6,000 లభిస్తుంది, ₹2,000 చొప్పున మూడు విడతల్లో, నేరుగా ఆధార్‌తో అనుసంధానమైన బ్యాంక్ ఖాతాలోకి.',
    ml: 'അർഹരായ കുടുംബങ്ങൾക്ക് വർഷം ₹6,000 ലഭിക്കും, ₹2,000 വീതം മൂന്ന് ഗഡുക്കളായി, ആധാറുമായി ബന്ധിപ്പിച്ച ബാങ്ക് അക്കൗണ്ടിലേക്ക് നേരിട്ട്.',
    sources: [SRC.guide(2)],
    quick: ['When are instalments paid?', 'Check my status'],
  },
  timing: {
    en: 'Instalments follow three four-month periods: April to July, August to November, and December to March.',
    hi: 'किस्तें चार-चार महीने की तीन अवधियों में आती हैं: अप्रैल से जुलाई, अगस्त से नवंबर, और दिसंबर से मार्च।',
    te: 'విడతలు నాలుగు నెలల చొప్పున మూడు కాలాల్లో వస్తాయి: ఏప్రిల్ నుండి జూలై, ఆగస్టు నుండి నవంబర్, డిసెంబర్ నుండి మార్చి.',
    ml: 'ഗഡുക്കൾ നാല് മാസം വീതമുള്ള മൂന്ന് കാലയളവുകളിൽ വരും: ഏപ്രിൽ മുതൽ ജൂലൈ, ഓഗസ്റ്റ് മുതൽ നവംബർ, ഡിസംബർ മുതൽ മാർച്ച്.',
    sources: [SRC.guide(2)],
    quick: ['Check my status', 'Payment not received'],
  },
  documents: {
    en: 'You need: 1) Aadhaar card, 2) land ownership records, 3) bank account details (seeded with Aadhaar), 4) a mobile number linked to Aadhaar.',
    hi: 'ज़रूरी दस्तावेज़: 1) आधार कार्ड, 2) ज़मीन के कागज़, 3) आधार से जुड़ा बैंक खाता, 4) आधार से जुड़ा मोबाइल नंबर।',
    te: 'కావలసిన పత్రాలు: 1) ఆధార్ కార్డు, 2) భూమి యాజమాన్య పత్రాలు, 3) ఆధార్‌తో అనుసంధానమైన బ్యాంక్ ఖాతా వివరాలు, 4) ఆధార్‌తో లింక్ అయిన మొబైల్ నంబర్.',
    ml: 'ആവശ്യമായ രേഖകൾ: 1) ആധാർ കാർഡ്, 2) ഭൂമിയുടെ ഉടമസ്ഥാവകാശ രേഖകൾ, 3) ആധാറുമായി ബന്ധിപ്പിച്ച ബാങ്ക് അക്കൗണ്ട് വിവരങ്ങൾ, 4) ആധാറുമായി ലിങ്ക് ചെയ്ത മൊബൈൽ നമ്പർ.',
    sources: [SRC.guide(5), SRC.faq(2)],
    quick: ['How to apply', 'e-KYC'],
  },
  apply: {
    en: 'Register using "New farmer registration" on the portal, at a Common Service Centre (CSC), or through your state nodal officer or patwari. The state then verifies your land records and Aadhaar.',
    hi: 'पोर्टल पर "New farmer registration" से, नज़दीकी CSC पर, या राज्य नोडल अधिकारी/पटवारी के ज़रिए पंजीकरण करें। फिर राज्य आपकी ज़मीन और आधार की जाँच करता है।',
    te: 'పోర్టల్‌లో "New farmer registration" ద్వారా, సమీప CSC వద్ద, లేదా రాష్ట్ర నోడల్ అధికారి/పట్వారీ ద్వారా నమోదు చేసుకోండి. తర్వాత రాష్ట్రం మీ భూమి రికార్డులు మరియు ఆధార్‌ను ధృవీకరిస్తుంది.',
    ml: 'പോർട്ടലിലെ "New farmer registration" വഴിയോ, അടുത്തുള്ള CSC-യിലോ, സംസ്ഥാന നോഡൽ ഓഫീസർ/വില്ലേജ് ഓഫീസർ വഴിയോ രജിസ്റ്റർ ചെയ്യുക. തുടർന്ന് സംസ്ഥാനം നിങ്ങളുടെ ഭൂരേഖകളും ആധാറും പരിശോധിക്കും.',
    sources: [SRC.guide(6)],
    quick: ['Documents needed', 'e-KYC'],
  },
  ekyc: {
    en: 'e-KYC is mandatory to keep receiving instalments. You can do it with an Aadhaar OTP on the portal, or with biometric verification at a CSC.',
    hi: 'किस्तें मिलती रहें, इसके लिए e-KYC ज़रूरी है। पोर्टल पर आधार OTP से या CSC पर बायोमेट्रिक से e-KYC करें।',
    te: 'విడతలు అందుతూ ఉండాలంటే e-KYC తప్పనిసరి. పోర్టల్‌లో ఆధార్ OTP ద్వారా లేదా CSC వద్ద బయోమెట్రిక్ ద్వారా e-KYC చేయవచ్చు.',
    ml: 'ഗഡുക്കൾ തുടർന്നും ലഭിക്കാൻ e-KYC നിർബന്ധമാണ്. പോർട്ടലിൽ ആധാർ OTP വഴിയോ CSC-യിൽ ബയോമെട്രിക് വഴിയോ e-KYC ചെയ്യാം.',
    sources: [SRC.faq(7)],
    quick: ['Check my status', 'Talk to an officer'],
  },
  notReceived: {
    en: 'If an instalment has not arrived, first check your status, make sure e-KYC is complete and that your bank account is seeded with Aadhaar. If everything looks right, I can register a grievance for you.',
    hi: 'अगर किस्त नहीं आई है, तो पहले अपना स्टेटस देखें, e-KYC पूरा करें और देखें कि बैंक खाता आधार से जुड़ा है। सब ठीक होने पर मैं आपकी शिकायत दर्ज कर सकता हूँ।',
    te: 'విడత రాకపోతే, ముందుగా మీ స్థితిని చూడండి, e-KYC పూర్తి చేయండి, మీ బ్యాంక్ ఖాతా ఆధార్‌తో అనుసంధానమైందో చూసుకోండి. అన్నీ సరిగా ఉంటే, నేను మీ ఫిర్యాదును నమోదు చేయగలను.',
    ml: 'ഗഡു ലഭിച്ചില്ലെങ്കിൽ, ആദ്യം നിങ്ങളുടെ സ്റ്റാറ്റസ് പരിശോധിക്കുക, e-KYC പൂർത്തിയാക്കുക, ബാങ്ക് അക്കൗണ്ട് ആധാറുമായി ബന്ധിപ്പിച്ചിട്ടുണ്ടെന്ന് ഉറപ്പാക്കുക. എല്ലാം ശരിയാണെങ്കിൽ, ഞാൻ നിങ്ങളുടെ പരാതി രജിസ്റ്റർ ചെയ്യാം.',
    sources: [SRC.faq(9)],
    quick: ['Check my status', 'Register a complaint'],
  },
};

const TEXT = {
  greeting: {
    en: 'Namaste! I am the automated assistant for PM-KISAN. You can type in English, Hindi, Telugu or Malayalam.',
    hi: 'नमस्ते! मैं PM-KISAN का स्वचालित सहायक हूँ। आप हिंदी, अंग्रेज़ी, तेलुगु या मलयालम में लिख सकते हैं।',
    te: 'నమస్కారం! నేను PM-KISAN స్వయంచాలక సహాయకుడిని. మీరు తెలుగు, ఇంగ్లీష్, హిందీ లేదా మలయాళంలో అడగవచ్చు.',
    ml: 'നമസ്കാരം! ഞാൻ PM-KISAN-ന്റെ ഓട്ടോമേറ്റഡ് സഹായിയാണ്. നിങ്ങൾക്ക് മലയാളം, ഇംഗ്ലീഷ്, ഹിന്ദി അല്ലെങ്കിൽ തെലുങ്കിൽ ചോദിക്കാം.',
  },
  clarify: {
    en: "Sorry, I couldn't find that in the scheme information. Could you say it another way?",
    hi: 'माफ़ कीजिए, यह जानकारी मुझे नहीं मिली। क्या आप दूसरे शब्दों में पूछ सकते हैं?',
    te: 'క్షమించండి, ఈ సమాచారం పథకం వివరాల్లో దొరకలేదు. దయచేసి మరో విధంగా అడగగలరా?',
    ml: 'ക്ഷമിക്കണം, ഈ വിവരം പദ്ധതി വിവരങ്ങളിൽ കണ്ടെത്താനായില്ല. മറ്റൊരു രീതിയിൽ ചോദിക്കാമോ?',
  },
  offerHuman: {
    en: "I still couldn't find an answer. I don't want to guess, so let me connect you to an officer.",
    hi: 'मुझे अब भी जवाब नहीं मिला। मैं अंदाज़ा नहीं लगाना चाहता, इसलिए आपको एक अधिकारी से जोड़ता हूँ।',
    te: 'నాకు ఇంకా సమాధానం దొరకలేదు. ఊహించి చెప్పడం ఇష్టం లేదు, కాబట్టి మిమ్మల్ని ఒక అధికారితో కలుపుతాను.',
    ml: 'എനിക്ക് ഇപ്പോഴും ഉത്തരം കണ്ടെത്താനായില്ല. ഊഹിച്ചു പറയാൻ ഞാൻ ആഗ്രഹിക്കുന്നില്ല, അതിനാൽ നിങ്ങളെ ഒരു ഉദ്യോഗസ്ഥനുമായി ബന്ധിപ്പിക്കാം.',
  },
  authNeeded: {
    en: 'For your security, please verify with an OTP sent to the mobile number registered with PM-KISAN.',
    hi: 'आपकी सुरक्षा के लिए, PM-KISAN में दर्ज मोबाइल पर भेजे गए OTP से पुष्टि करें।',
    te: 'మీ భద్రత కోసం, PM-KISAN లో నమోదైన మొబైల్‌కు పంపిన OTP తో ధృవీకరించండి.',
    ml: 'നിങ്ങളുടെ സുരക്ഷയ്ക്കായി, PM-KISAN-ൽ രജിസ്റ്റർ ചെയ്ത മൊബൈലിലേക്ക് അയച്ച OTP ഉപയോഗിച്ച് സ്ഥിരീകരിക്കുക.',
  },
  refuse: {
    en: "I can't help with that. I can only share your own details after verification, and information from the scheme guidelines.",
    hi: 'मैं इसमें मदद नहीं कर सकता। मैं सिर्फ़ पुष्टि के बाद आपकी अपनी जानकारी और योजना के दिशानिर्देश बता सकता हूँ।',
    te: 'నేను దీనిలో సహాయం చేయలేను. ధృవీకరణ తర్వాత మీ స్వంత వివరాలు మరియు పథకం మార్గదర్శకాల సమాచారం మాత్రమే చెప్పగలను.',
    ml: 'എനിക്ക് ഇതിൽ സഹായിക്കാനാവില്ല. സ്ഥിരീകരണത്തിന് ശേഷം നിങ്ങളുടെ സ്വന്തം വിവരങ്ങളും പദ്ധതി മാർഗ്ഗനിർദ്ദേശങ്ങളിലെ വിവരങ്ങളും മാത്രമേ എനിക്ക് പറയാനാകൂ.',
  },
  thanks: {
    en: "You're welcome! Is there anything else I can help with?",
    hi: 'आपका स्वागत है! क्या मैं और कुछ मदद कर सकता हूँ?',
    te: 'మీకు స్వాగతం! ఇంకా ఏమైనా సహాయం కావాలా?',
    ml: 'സ്വാഗതം! മറ്റെന്തെങ്കിലും സഹായം വേണോ?',
  },
  grievanceCategory: {
    en: 'Sure. What is the complaint about?',
    hi: 'ज़रूर। शिकायत किस बारे में है?',
    te: 'తప్పకుండా. ఫిర్యాదు దేని గురించి?',
    ml: 'തീർച്ചയായും. പരാതി എന്തിനെക്കുറിച്ചാണ്?',
  },
  grievanceDetails: {
    en: 'Please describe the problem in a sentence or two.',
    hi: 'कृपया समस्या एक-दो वाक्यों में बताइए।',
    te: 'దయచేసి సమస్యను ఒకటి రెండు వాక్యాల్లో వివరించండి.',
    ml: 'ദയവായി പ്രശ്നം ഒന്നോ രണ്ടോ വാക്യങ്ങളിൽ വിവരിക്കുക.',
  },
  confirmTitle: {
    en: 'Please confirm your complaint',
    hi: 'कृपया अपनी शिकायत की पुष्टि करें',
    te: 'దయచేసి మీ ఫిర్యాదును నిర్ధారించండి',
    ml: 'ദയവായി നിങ്ങളുടെ പരാതി സ്ഥിരീകരിക്കുക',
  },
  registered: {
    en: (id) => `Your complaint is registered. The complaint number is ${id}. You will also get an SMS.`,
    hi: (id) => `आपकी शिकायत दर्ज हो गई है। शिकायत संख्या ${id} है।`,
    te: (id) => `మీ ఫిర్యాదు నమోదైంది. ఫిర్యాదు సంఖ్య ${id}.`,
    ml: (id) => `നിങ്ങളുടെ പരാതി രജിസ്റ്റർ ചെയ്തു. പരാതി നമ്പർ ${id}.`,
  },
  cancelled: {
    en: 'Okay, I have cancelled it. Nothing was submitted.',
    hi: 'ठीक है, रद्द कर दिया। कुछ भी जमा नहीं हुआ।',
    te: 'సరే, రద్దు చేశాను. ఏదీ సమర్పించబడలేదు.',
    ml: 'ശരി, റദ്ദാക്കി. ഒന്നും സമർപ്പിച്ചിട്ടില്ല.',
  },
  connecting: {
    en: 'Connecting you to an officer. Please stay in this chat.',
    hi: 'आपको एक अधिकारी से जोड़ रहा हूँ। कृपया इसी चैट में रहें।',
    te: 'మిమ్మల్ని ఒక అధికారితో కలుపుతున్నాను. దయచేసి ఈ చాట్‌లోనే ఉండండి.',
    ml: 'നിങ്ങളെ ഒരു ഉദ്യോഗസ്ഥനുമായി ബന്ധിപ്പിക്കുന്നു. ദയവായി ഈ ചാറ്റിൽ തന്നെ തുടരുക.',
  },
  offline: {
    en: 'Our officers are available 9 am to 6 pm. I can arrange a callback or send the reply by email.',
    hi: 'हमारे अधिकारी सुबह 9 से शाम 6 बजे तक उपलब्ध हैं। मैं कॉलबैक या ईमेल से जवाब की व्यवस्था कर सकता हूँ।',
    te: 'మా అధికారులు ఉదయం 9 నుండి సాయంత్రం 6 వరకు అందుబాటులో ఉంటారు. నేను కాల్‌బ్యాక్ లేదా ఈమెయిల్ ద్వారా సమాధానం ఏర్పాటు చేయగలను.',
    ml: 'ഞങ്ങളുടെ ഉദ്യോഗസ്ഥർ രാവിലെ 9 മുതൽ വൈകിട്ട് 6 വരെ ലഭ്യമാണ്. ഞാൻ ഒരു കോൾബാക്ക് അല്ലെങ്കിൽ ഇമെയിൽ വഴി മറുപടി ക്രമീകരിക്കാം.',
  },
};

const CATEGORIES = ['Instalment not received', 'Wrong bank details', 'e-KYC problem', 'Other'];

// Rules first (cheap and predictable), as in the orchestrator's input guardrail and router.
// Each rule covers English, Hindi/Hinglish, Telugu and Malayalam keywords.
const INTENTS = [
  ['injection', /ignore (all|your|previous)|system prompt|act as|jailbreak|other (people|farmers|applicants)'?s? (data|details)/i],
  ['human', /human|officer|agent|person|insaan|adhikari|अधिकारी|इंसान|बात कर|అధికారి|మనిషి|ഉദ്യോഗസ്ഥ|മനുഷ്യ/i],
  ['status', /status|स्थिति|स्टेटस|kab aayega|beneficiary|मेरा पैसा|my payment|స్థితి|స్టేటస్|സ്റ്റാറ്റസ്|നില/i],
  ['grievance', /complain|complaint|grievance|shikayat|शिकायत|ఫిర్యాదు|പരാതി/i],
  ['notReceived', /not (received|come|credited)|nahi aaya|नहीं आ|didn'?t get|రాలేదు|ലഭിച്ചില്ല|കിട്ടിയില്ല/i],
  ['ekyc', /e-?kyc|केवाईसी|కేవైసీ|കെവൈസി/i],
  ['documents', /document|papers|kagaz|दस्तावेज़|कागज़|పత్రాలు|రేఖ|രേഖ/i],
  ['apply', /apply|register|registration|aavedan|पंजीकरण|आवेदन|దరఖాస్తు|నమోదు|അപേക്ഷ|രജിസ്റ്റർ/i],
  ['timing', /when|kab|कब|month|kist kab|ఎప్పుడు|విడత|എപ്പോൾ|ഗഡു/i],
  ['amount', /how much|amount|kitna|कितना|6,?000|money|paisa|पैसा|rupee|₹|ఎంత|డబ్బు|എത്ര|പണം/i],
  ['eligibility', /eligib|patra|पात्र|who can|qualif|అర్హ|അർഹ|യോഗ്യ/i],
  ['thanks', /thank|dhanyavad|shukriya|धन्यवाद|शुक्रिया|ధన్యవాద|నెనర్లు|നന്ദി/i],
];

const HINGLISH = /\b(kya|kab|kaise|mera|meri|mujhe|hai|nahi|kitna|paisa|kist|batao|chahiye)\b/i;
// Script decides first (Telugu, Malayalam, Devanagari), then Hinglish words; a full English sentence → English;
// otherwise (short text, quick replies) keep the caller's chosen language.
export function detectLang(text, preferred) {
  if (/[ఀ-౿]/.test(text)) return 'te';
  if (/[ഀ-ൿ]/.test(text)) return 'ml';
  if (/[ऀ-ॿ]/.test(text) || HINGLISH.test(text)) return 'hi';
  if (text.trim().split(/\s+/).length >= 4) return 'en';
  return preferred || 'en';
}

const sessions = new Map();

function pick(map, lang) { return map[lang] || map.en; }

function answerBlocks(key, lang) {
  const a = ANSWERS[key];
  const blocks = [{ type: 'text', text: pick(a, lang), sources: a.sources }];
  if (a.quick) blocks.push(quick(a.quick, lang));
  return blocks;
}

function maskName(name) { return name.split(' ').map((w) => `${w[0]}***`).join(' '); }

function lookupBeneficiary(regNo) {
  const known = {
    UP123456789: { name: 'Ramesh Kumar', state: 'Uttar Pradesh', ekyc: 'Completed', land: 'Verified', last: '₹2,000 credited on 05 Oct 2026', next: 'Expected in the December to March period' },
    TS456123789: { name: 'Lakshmi Reddy', state: 'Telangana', ekyc: 'Completed', land: 'Verified', last: '₹2,000 credited on 05 Oct 2026', next: 'Expected in the December to March period' },
    KL321654987: { name: 'Anil Kumar Nair', state: 'Kerala', ekyc: 'Pending', land: 'Verified', last: '₹2,000 credited on 12 Jun 2026', next: 'On hold until e-KYC is completed' },
  };
  const r = known[regNo] || { name: 'Demo Farmer', state: 'Andhra Pradesh', ekyc: 'Completed', land: 'Under verification', last: 'No instalment yet', next: 'After land record verification' };
  return { regNo, ...r, name: maskName(r.name) };
}

function handoff(s, lang) {
  s.failed = 0;
  return [{ type: 'handoff', online: AGENTS_ONLINE, text: pick(AGENTS_ONLINE ? TEXT.connecting : TEXT.offline, lang) }];
}

function grievanceStart(s, lang) {
  s.grievance = { step: 'category', regNo: s.regNo };
  return [{ type: 'text', text: pick(TEXT.grievanceCategory, lang) }, quick(CATEGORIES, lang)];
}

export const backend = {
  agentsOnline: AGENTS_ONLINE,

  async startSession({ tenant, language = 'en' }) {
    await wait(250);
    const id = `s_c_${Math.random().toString(36).slice(2, 8)}`;
    sessions.set(id, { tenant, failed: 0, auth: 0, pending: null, grievance: null, withAgent: false, lang: language });
    return {
      sessionId: id,
      greeting: TEXT.greeting,
      quick: (lang) => quick(['Am I eligible?', 'Documents needed', 'Check my status', 'Talk to an officer'], lang),
    };
  },

  // Restores a session after a page refresh (the real server keeps it in Redis).
  resume(sessionId, state) {
    if (!sessions.has(sessionId)) sessions.set(sessionId, state || { failed: 0, auth: 0, pending: null, grievance: null, withAgent: false, lang: 'en' });
  },

  snapshot(sessionId) { return sessions.get(sessionId); },

  // opts.quick: the text came from a quick-reply button, so answer in the caller's chosen language.
  async sendTurn(sessionId, text, preferredLang, opts = {}) {
    const s = sessions.get(sessionId);
    const lang = opts.quick ? preferredLang : detectLang(text, preferredLang);
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
          title: pick(TEXT.confirmTitle, lang),
          rows: [['Category', s.grievance.category], ['Registration no.', s.grievance.regNo || 'Not provided'], ['Details', s.grievance.details]],
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
        return { lang, blocks: handoff(s, lang) };
      case 'status':
        if (s.auth < 1) { s.pending = 'status'; return { lang, blocks: [{ type: 'text', text: pick(TEXT.authNeeded, lang) }, { type: 'otp' }] }; }
        return { lang, blocks: [{ type: 'status', record: lookupBeneficiary(s.regNo) }] };
      case 'grievance':
        if (s.auth < 1) { s.pending = 'grievance'; return { lang, blocks: [{ type: 'text', text: pick(TEXT.authNeeded, lang) }, { type: 'otp' }] }; }
        return { lang, blocks: grievanceStart(s, lang) };
      case 'thanks':
        s.failed = 0;
        return { lang, blocks: [{ type: 'text', text: pick(TEXT.thanks, lang) }] };
      case 'unknown':
        s.failed += 1;
        if (s.failed >= 2) return { lang, blocks: [{ type: 'text', text: pick(TEXT.offerHuman, lang) }, ...handoff(s, lang)] };
        return { lang, blocks: [{ type: 'text', text: pick(TEXT.clarify, lang) }, quick(['Am I eligible?', 'How much money?', 'Talk to an officer'], lang)] };
      default:
        s.failed = 0;
        return { lang, blocks: answerBlocks(intent, lang) };
    }
  },

  async sendOtp(sessionId, regNo, mobile) {
    await wait(500);
    if (!/^[A-Z]{2}\d{9}$/.test(regNo)) return { ok: false, error: 'Registration number should be 2 letters followed by 9 digits, for example UP123456789.' };
    if (!/^\d{10}$/.test(mobile)) return { ok: false, error: 'Enter the 10-digit mobile number.' };
    sessions.get(sessionId).regNo = regNo;
    return { ok: true, hint: `OTP sent to ******${mobile.slice(-4)}. Demo OTP: ${DEMO_OTP}` };
  },

  async verifyOtp(sessionId, otp) {
    await wait(400);
    const s = sessions.get(sessionId);
    if (otp !== DEMO_OTP) return { ok: false, error: 'That OTP is not correct. Please try again.' };
    s.auth = 1;
    const next = s.pending;
    s.pending = null;
    if (next === 'grievance') return { ok: true, blocks: grievanceStart(s, s.lang) };
    return { ok: true, blocks: [{ type: 'status', record: lookupBeneficiary(s.regNo) }] };
  },

  async confirmAction(sessionId, action, confirmed) {
    await wait(600);
    const s = sessions.get(sessionId);
    if (action !== 'submit_grievance') return { blocks: [] };
    if (!confirmed) { s.grievance = null; return { blocks: [{ type: 'text', text: pick(TEXT.cancelled, s.lang) }] }; }
    const ticket = `G-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    s.grievance = null;
    return { ticket, blocks: [{ type: 'text', text: pick(TEXT.registered, s.lang)(ticket) }] };
  },

  async editGrievance(sessionId) {
    const s = sessions.get(sessionId);
    return { blocks: grievanceStart(s, s.lang) };
  },

  async connectAgent(sessionId) {
    await wait(2200);
    sessions.get(sessionId).withAgent = true;
    return { name: 'Officer Sunita (demo)', text: 'Namaste, I am Sunita. I have read your conversation with the assistant. How can I help?' };
  },

  async scheduleCallback(sessionId, slot) {
    await wait(500);
    return { ref: `CB-${Math.floor(10000 + Math.random() * 90000)}`, slot };
  },

  async feedback() { await wait(100); return { ok: true }; },
};
