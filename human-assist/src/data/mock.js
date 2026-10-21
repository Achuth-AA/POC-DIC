// Mock data for the human-assist (agent) console. In the real build the queue and live transcript arrive
// over SSE from GET /v1/sessions/live, and suggestions come from the same knowledge base the bot uses
// (public + internal documents, lower relevance threshold, raw snippets, no LLM).
export function createMock() {
  const officer = { name: 'Sunita Sharma', short: 'SS', role: 'Helpline officer · demo' };

  const queue = [
    {
      id: 's_8841', channel: 'voice', lang: 'Hindi', waitedSec: 42, reason: 'Caller asked for a person',
      caller: { label: 'Caller ••612', phone: '+91 ••••• ••612', verified: true, authLevel: 1, regNo: 'UP12•••••89', state: 'Uttar Pradesh', ekyc: 'Completed', land: 'Verified', last: '₹2,000 on 05 Oct 2026', tickets: [] },
      summary: {
        intent: 'Wants the exact date of the next instalment.',
        points: ['Verified with OTP (keypad).', 'Last instalment ₹2,000 received on 05 Oct 2026; e-KYC complete.', 'AI explained the Dec–Mar period; exact date is not in the knowledge base.', 'Caller then asked for a person.'],
        sentiment: 'Calm, slightly impatient',
      },
      history: [
        ['ai', 'Namaste! This is an automated assistant for PM-KISAN. Aap Hindi ya English mein baat kar sakte hain.'],
        ['citizen', 'Haan, mujhe ye jaanna tha ki kist kab aati hai?'],
        ['ai', 'Kisten char-char mahine ki teen avadhiyon mein aati hain: April se July, August se November, aur December se March.'],
        ['citizen', 'Mera status batao, registration number UP123456789.'],
        ['system', 'OTP verified by keypad · auth level 1'],
        ['ai', 'Aapki pichhli kist ₹2,000, 5 October ko aayi thi. e-KYC poora hai.'],
        ['citizen', 'Agli kist ki exact date batao.'],
        ['ai', 'Agli kist December se March ki avadhi mein aayegi. Exact date abhi tay nahi hai. Kya aap kisi adhikari se baat karna chahenge?'],
        ['citizen', 'Haan, kisi insaan se baat karao.'],
        ['system', 'Transferred to officer · AI summary attached'],
      ],
      // Lines that "arrive" while the officer is on the call (simulated live transcript).
      live: [
        ['citizen', 'Namaste madam. Mujhe bas ye jaanna hai ki December wali kist kab tak aa jaayegi?'],
        ['citizen', 'Aur kya mujhe kuch aur document jama karna padega?'],
        ['citizen', 'Theek hai. Aur agar mera mobile number badalna ho to?'],
      ],
    },
    {
      id: 's_c_2304', channel: 'chat', lang: 'English', waitedSec: 18, reason: 'Two answers not found',
      caller: { label: 'Web visitor', phone: '—', verified: false, authLevel: 0, tickets: [] },
      summary: {
        intent: 'Asking whether a farmer who leases land (tenant) can get the benefit.',
        points: ['Not verified (no personal data shared).', 'AI found no confident answer twice and handed over.', 'Likely needs the exclusion / landholding rule explained.'],
        sentiment: 'Neutral',
      },
      history: [
        ['ai', 'Namaste! I am the automated assistant for PM-KISAN.'],
        ['citizen', 'I farm on land that I lease from someone. Can I get PM-KISAN?'],
        ['ai', "Sorry, I couldn't find that in the scheme information. Could you say it another way?"],
        ['citizen', 'tenant farmer without land in my name, eligible?'],
        ['ai', "I still couldn't find an answer. I don't want to guess, so let me connect you to an officer."],
        ['system', 'Transferred to officer · AI summary attached'],
      ],
      live: [['citizen', 'Hello? Is anyone there?']],
    },
    {
      id: 's_8852', channel: 'voice', lang: 'Tamil', waitedSec: 7, reason: 'Distress detected (safety trigger)',
      priority: true,
      caller: { label: 'Caller ••318', phone: '+91 ••••• ••318', verified: false, authLevel: 0, tickets: [] },
      summary: {
        intent: 'Upset that payments stopped; mentioned crop loss.',
        points: ['Safety trigger on distress words → immediate transfer (no AI retry).', 'Not verified yet.', 'Handle with care; offer state helpline details if needed.'],
        sentiment: 'Distressed',
      },
      history: [
        ['ai', 'Vanakkam! This is an automated assistant for PM-KISAN.'],
        ['citizen', '(Tamil) My payments stopped and the crop has failed. I don’t know what to do.'],
        ['system', 'Safety trigger · transferred immediately · flagged Critical'],
      ],
      live: [['citizen', '(Tamil) Please help me, the last two instalments have not come.']],
    },
  ];

  // Knowledge snippets used for suggestions. internal = officer-only documents.
  const knowledge = [
    { keys: ['kist', 'instalment', 'december', 'date', 'kab'], text: 'Instalments are released for April–July, August–November and December–March. The exact release date is announced centrally.', source: 'PM-KISAN Operational Guidelines', page: 2 },
    { keys: ['document', 'jama', 'kagaz', 'papers'], text: 'No new documents are needed once registered and verified. Keep e-KYC and Aadhaar-bank seeding current.', source: 'PM-KISAN FAQs', page: 2 },
    { keys: ['mobile', 'number', 'badal', 'change'], text: 'Mobile number can be updated on the portal using Aadhaar OTP, or at a CSC.', source: 'PM-KISAN FAQs', page: 12 },
    { keys: ['bank', 'account', 'correction'], text: 'Bank correction: verify the new account by cancelled cheque or passbook and confirm Aadhaar seeding before submitting.', source: 'Officer SOP: bank detail correction', page: 2, internal: true },
    { keys: ['lease', 'tenant', 'land', 'name'], text: 'Benefit is for landholding families whose names are in the land records. Cultivators on leased land are not covered unless the land is in their name.', source: 'PM-KISAN Operational Guidelines', page: 3 },
    { keys: ['stopped', 'not', 'come', 'payment', 'instalments'], text: 'If payments stop, check e-KYC status, Aadhaar seeding and land verification; the status page shows the reason for the hold.', source: 'PM-KISAN FAQs', page: 9 },
    { keys: ['distress', 'crop', 'help'], text: 'For crop loss, share the state agriculture helpline and PM Fasal Bima Yojana details. Escalate to the supervisor if the caller is at risk.', source: 'Officer SOP: sensitive calls', page: 1, internal: true },
  ];

  const dispositions = ['Information given', 'Grievance registered', 'Callback scheduled', 'Escalated to state nodal officer', 'Wrong number / no response'];

  const callbacks = [
    { ref: 'CB-48213', when: 'Tomorrow · 9 am – 12 pm', lang: 'Bengali', channel: 'chat', summary: 'Asked why e-KYC shows pending after biometric e-KYC at a CSC last week.', verified: true, status: 'scheduled' },
    { ref: 'CB-48207', when: 'Tomorrow · 12 pm – 3 pm', lang: 'Hindi', channel: 'voice', summary: 'Wants to add a son who inherited land; asked about the mutation process.', verified: false, status: 'scheduled' },
    { ref: 'CB-48190', when: 'Today · 3 pm – 6 pm', lang: 'English', channel: 'chat', summary: 'Bank account closed; needs to update details. Complaint G-2026-0512 already registered.', verified: true, status: 'due' },
    { ref: 'CB-48177', when: 'Yesterday', lang: 'Marathi', channel: 'voice', summary: 'Asked about the 3 instalment periods; resolved on callback.', verified: false, status: 'done' },
  ];

  return { officer, queue, knowledge, dispositions, callbacks };
}
