// Demo citizen page. Layout follows common Government of India portal conventions
// (accessibility strip, tricolour rule, plain sections). No official emblems or logos.
import { useEffect, useState } from 'react';
import Icon from './components/Icon.jsx';

function AskButton({ ask, call, assistant, className, children }) {
  const opts = call ? { call: true } : ask ? { ask } : {};
  return <button type="button" className={className} onClick={() => assistant.open(opts)}>{children}</button>;
}

export default function SchemePage({ assistant }) {
  const [scale, setScale] = useState(1);
  const [contrast, setContrast] = useState(false);

  useEffect(() => { document.documentElement.style.setProperty('--font-scale', scale.toFixed(2)); }, [scale]);
  useEffect(() => { document.body.classList.toggle('high-contrast', contrast); }, [contrast]);
  const font = (step) => setScale((s) => (step === 0 ? 1 : Math.min(1.3, Math.max(0.85, s + step * 0.1))));

  return (
    <>
      <a className="skip-link" href="#main">Skip to main content</a>

      <div className="demo-banner" role="note">
        <strong>Demonstration page</strong> built for the Voice AI Agent POC. This is not an official Government website.
        For official information visit <a href="https://pmkisan.gov.in" rel="noopener noreferrer" target="_blank">pmkisan.gov.in</a>.
      </div>

      <div className="gov-strip">
        <div className="container gov-strip__inner">
          <span className="gov-strip__name">Government of India · Ministry of Agriculture &amp; Farmers Welfare</span>
          <div className="gov-strip__tools" aria-label="Accessibility tools">
            <button type="button" className="tool-btn" onClick={() => font(-1)} aria-label="Decrease text size">A-</button>
            <button type="button" className="tool-btn" onClick={() => font(0)} aria-label="Reset text size">A</button>
            <button type="button" className="tool-btn" onClick={() => font(1)} aria-label="Increase text size">A+</button>
            <button type="button" className="tool-btn" aria-pressed={contrast} onClick={() => setContrast((c) => !c)}>High contrast</button>
            <span className="tool-sep" aria-hidden="true" />
            {/* The page is English-only in the demo; these open the assistant in that language. */}
            <button type="button" className="tool-btn" lang="hi" onClick={() => assistant.open({ language: 'hi' })}>हिन्दी</button>
            <button type="button" className="tool-btn" lang="te" onClick={() => assistant.open({ language: 'te' })}>తెలుగు</button>
            <button type="button" className="tool-btn" lang="ml" onClick={() => assistant.open({ language: 'ml' })}>മലയാളം</button>
          </div>
        </div>
      </div>
      <div className="tricolour" aria-hidden="true"><span /><span /><span /></div>

      <header className="site-header">
        <div className="container site-header__inner">
          <a className="brand" href="#main">
            <svg className="brand__mark" viewBox="0 0 48 48" aria-hidden="true">
              <circle cx="24" cy="24" r="22" fill="#eef5e9" stroke="#138808" strokeWidth="2" />
              <path d="M24 38V16M24 22c-5-1-8-5-8-9 5 0 8 4 8 9zm0 0c5-1 8-5 8-9-5 0-8 4-8 9zm0 7c-5-1-8-5-8-9 5 0 8 4 8 9zm0 0c5-1 8-5 8-9-5 0-8 4-8 9z" fill="none" stroke="#138808" strokeWidth="2" strokeLinejoin="round" />
            </svg>
            <span>
              <span className="brand__title">PM-KISAN</span>
              <span className="brand__sub">Pradhan Mantri Kisan Samman Nidhi</span>
            </span>
          </a>
          <nav className="main-nav" aria-label="Main">
            <a href="#about">About</a><a href="#eligibility">Eligibility</a><a href="#apply">How to apply</a><a href="#faq">FAQs</a><a href="#help">Help</a>
          </nav>
        </div>
      </header>

      <main id="main">
        <section className="hero">
          <div className="container hero__inner">
            <div className="hero__text">
              <h1>Income support of ₹6,000 a year for landholding farmer families</h1>
              <p className="lead">Paid in three equal instalments of ₹2,000, directly into the bank accounts of eligible farmers.</p>
              <p className="hero__langs">Ask by chat or voice call in English, हिन्दी, తెలుగు or മലയാളം. No phone needed.</p>
              <div className="hero__actions">
                <AskButton assistant={assistant} ask="Am I eligible for PM-KISAN?" className="btn btn--primary">Check eligibility with the assistant</AskButton>
                <AskButton assistant={assistant} call className="btn btn--ghost"><Icon name="phone" />Talk to the assistant</AskButton>
              </div>
            </div>
            <ul className="facts" aria-label="Key facts">
              <li><span className="facts__num">₹6,000</span><span className="facts__label">per year, per eligible family</span></li>
              <li><span className="facts__num">3</span><span className="facts__label">instalments of ₹2,000</span></li>
              <li><span className="facts__num">DBT</span><span className="facts__label">paid directly to the bank account</span></li>
              <li><span className="facts__num">100%</span><span className="facts__label">funded by the Government of India</span></li>
            </ul>
          </div>
        </section>

        <section className="corner" aria-labelledby="corner-title">
          <div className="container">
            <h2 id="corner-title">Farmers corner</h2>
            <div className="corner__grid">
              <a className="tile" href="#apply">
                <span className="tile__icon" aria-hidden="true"><Icon name="edit" size={20} /></span>
                <span className="tile__title">New farmer registration</span>
                <span className="tile__text">Register through the portal, a CSC or your state nodal officer.</span>
              </a>
              <AskButton assistant={assistant} ask="What is my beneficiary status?" className="tile">
                <span className="tile__icon" aria-hidden="true"><Icon name="search" size={20} /></span>
                <span className="tile__title">Know your status</span>
                <span className="tile__text">Ask the assistant. It verifies you with an OTP first.</span>
              </AskButton>
              <AskButton assistant={assistant} ask="How do I complete e-KYC?" className="tile">
                <span className="tile__icon" aria-hidden="true"><Icon name="idCard" size={20} /></span>
                <span className="tile__title">e-KYC</span>
                <span className="tile__text">e-KYC is mandatory to keep receiving instalments.</span>
              </AskButton>
              <AskButton assistant={assistant} ask="I want to register a complaint" className="tile">
                <span className="tile__icon" aria-hidden="true"><Icon name="megaphone" size={20} /></span>
                <span className="tile__title">Register a grievance</span>
                <span className="tile__text">Payment not received or wrong details? Raise it here.</span>
              </AskButton>
            </div>
          </div>
        </section>

        <section id="about" className="section">
          <div className="container two-col">
            <div>
              <h2>About the scheme</h2>
              <p>PM-KISAN provides income support to landholding farmer families across the country to help them meet
                expenses related to agriculture and allied activities, as well as domestic needs.</p>
              <p>The benefit of ₹6,000 per year is transferred in three four-monthly instalments of ₹2,000 each through
                Direct Benefit Transfer (DBT) to the Aadhaar-seeded bank accounts of beneficiaries.</p>
              <p>State Governments and Union Territory Administrations identify the eligible farmer families and upload
                their details for verification.</p>
            </div>
            <aside className="callout" aria-label="Instalment cycle">
              <h3>Instalment cycle</h3>
              <ol className="timeline">
                <li><strong>April – July</strong><span>1st instalment of the year</span></li>
                <li><strong>August – November</strong><span>2nd instalment of the year</span></li>
                <li><strong>December – March</strong><span>3rd instalment of the year</span></li>
              </ol>
            </aside>
          </div>
        </section>

        <section id="eligibility" className="section section--alt">
          <div className="container two-col">
            <div>
              <h2>Who is eligible</h2>
              <ul className="checklist">
                <li>Landholding farmer families with cultivable land in their names, as per land records of the State/UT.</li>
                <li>A family means husband, wife and minor children.</li>
                <li>Bank account seeded with Aadhaar and e-KYC completed.</li>
              </ul>
            </div>
            <div>
              <h2>Who is not eligible</h2>
              <ul className="crosslist">
                <li>Institutional landholders.</li>
                <li>Present or former holders of constitutional posts, ministers, MPs, MLAs and similar elected representatives.</li>
                <li>Serving or retired officers and employees of Central/State Governments and PSUs (except Multi Tasking Staff / Class IV / Group D).</li>
                <li>Retired pensioners with a monthly pension of ₹10,000 or more (except Multi Tasking Staff / Class IV / Group D).</li>
                <li>Persons who paid income tax in the last assessment year.</li>
                <li>Registered professionals such as doctors, engineers, lawyers, chartered accountants and architects.</li>
              </ul>
            </div>
          </div>
        </section>

        <section id="apply" className="section">
          <div className="container">
            <h2>How to apply</h2>
            <ol className="steps">
              <li><span className="steps__n" aria-hidden="true">1</span><div><h3>Keep documents ready</h3><p>Aadhaar card, land ownership records, bank account details and a mobile number linked to Aadhaar.</p></div></li>
              <li><span className="steps__n" aria-hidden="true">2</span><div><h3>Register</h3><p>Use "New farmer registration" on the portal, visit a Common Service Centre (CSC), or contact the state nodal officer or local patwari.</p></div></li>
              <li><span className="steps__n" aria-hidden="true">3</span><div><h3>Verification</h3><p>The State/UT verifies land records and Aadhaar; the bank account is validated before payment.</p></div></li>
              <li><span className="steps__n" aria-hidden="true">4</span><div><h3>Complete e-KYC</h3><p>OTP-based e-KYC on the portal, or biometric e-KYC at a CSC.</p></div></li>
            </ol>
          </div>
        </section>

        <section id="faq" className="section section--alt">
          <div className="container narrow">
            <h2>Frequently asked questions</h2>
            <details><summary>How much money does a farmer family receive?</summary><p>₹6,000 per year, paid as three instalments of ₹2,000 each.</p></details>
            <details><summary>Is e-KYC mandatory?</summary><p>Yes. e-KYC must be completed to continue receiving instalments. It can be done with an OTP on the portal or biometrically at a CSC.</p></details>
            <details><summary>My instalment has not arrived. What should I do?</summary><p>Check your beneficiary status, make sure e-KYC is complete and your bank account is seeded with Aadhaar. If the problem continues, register a grievance.</p></details>
            <details><summary>Can I update my mobile number or bank details?</summary><p>Yes. Contact your state nodal officer or a CSC, or raise a grievance with the correct details.</p></details>
          </div>
        </section>

        <section id="help" className="section">
          <div className="container help">
            <div>
              <h2>Need help?</h2>
              <p>Chat with our AI assistant or talk to it by voice, in English, Hindi, Telugu or Malayalam, any time of day.
                It can explain the scheme, check your status after OTP verification, register a grievance, or connect you
                to an officer. The voice call runs in your browser, so you don't need a phone.</p>
            </div>
            <div className="help__actions">
              <AskButton assistant={assistant} call className="btn btn--navy"><Icon name="phone" />Call the assistant</AskButton>
              <AskButton assistant={assistant} className="btn btn--primary"><Icon name="chat" />Chat with the assistant</AskButton>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container site-footer__inner">
          <div>
            <p className="site-footer__title">PM-KISAN (demonstration copy)</p>
            <p>Content summarised for the POC demo. Verify against the official scheme guidelines before use.</p>
          </div>
          <ul className="site-footer__links">
            <li><a href="#main">Accessibility statement</a></li><li><a href="#main">Privacy policy</a></li>
            <li><a href="#main">Terms of use</a></li><li><a href="#main">Help</a></li>
          </ul>
        </div>
      </footer>
    </>
  );
}
