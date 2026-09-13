/* ============================================================
   SOURCE MARKET SURVEY — Ricky Rampersad Branch
   Native rebuild of the Jotform "Market Survey 1.0" so a recruit
   has one place to work instead of a form in another tab.

   Fields and option labels are taken from the live form and its
   880 submissions, character for character, so the history in the
   existing sheet and anything submitted here stay comparable.

   Three things the data told us, which shaped this build:
     · Only 31% of 880 surveys captured a single referral name —
       and a survey WITH a referral scores 10 points higher.
       So the referral ask is given its own step, with the reason.
     · Only 65% carried a signed consent. Consent is mandatory here.
     · The GSAP qualifier block was the least-completed section
       (~75%) even though it is what feeds Income Potential and
       Form A. It now comes first, while the recruit is fresh.
   ============================================================ */

window.SURVEY = {
  version: '2.0',
  maxPoints: 100,

  /* ---------- option lists — verbatim from the live form ---------- */
  opts: {
    mode:        ['Physical', 'Virtual'],
    unitManager: ['Ricky', 'Kerwyn', 'Gary', 'Akaash'],
    source: [
      'School Friends', 'Friends of family', 'Neighbours', 'Known through spouse',
      'Known through children', 'Known through hobbies', 'Known through church',
      'Known through social groups', 'Known through community activities',
      'Known from past employment', 'Newly married persons', 'New parents',
      'New homeowners', 'New job or job location', 'People with Whom you do Business'
    ],
    income:  ['Under $25,000', '$25,000- $50000', '$50,000- $85,000', '$85,000 -$120,000', 'Over $120,000'],
    age:     ['Under 25', '25 - 34', '35 - 44', 'Over 45'],
    marital: ['Single, Divorced, or Widowed', 'Married', 'Children'],
    timeKnown:     ['More than 5 years', '2 – 5 years', 'Less than 2 years'],
    howWell:       ['Close friend', 'Casual friend', 'Speaking acquaintance'],
    howOften:      ['More than 5 times', '3 – 5 times', '1 – 2 times', 'Not at all'],
    couldApproach: ['Easily', 'Fairly easily', 'With difficulty', 'Probably not'],
    abilityRefer:  ['Excellent', 'Good', 'Fair', 'Poor'],
    wordAssoc:     ['Security', 'Expense', 'Confusing', 'Other'],
    ownsIns:       ['Yes', 'No', 'Not Sure'],
    insTypes:      ['Life', 'Health', 'Motor& Home', 'Pension', 'Critical Illness', 'Other'],
    confidence:    ['Very Confident', 'NotConfident'],
    mostImportant: ['Reliable advice', 'Affordable premiums', 'Comprehensive coverage', 'Easy claims process', 'Other'],
    yesNoUnsure:   ['Yes', 'No', 'Not Sure'],
    bestWay:       ['In-person visits', 'Phone calls', 'Community events', 'WhatsApp', 'Other'],
    communityValues: ['Security', 'Affordability', 'Personalization', 'Simplicity', 'Other'],
    willRefer:     ['Yes', 'No', 'Maybe Later'],
    relation:      ['Friend', 'Family', 'Colleague', 'Neighbour', 'Other']
  },

  /* ---------- the form, in the order it is actually conducted ---------- */
  steps: [
    {
      id: 'setup', title: 'Before you start', tag: 'Step 1',
      lede: 'Two details for the record. Everything after this is the conversation itself.',
      fields: [
        { k:'mode',        t:'choice', label:'How is this survey being done?', opts:'mode', req:true },
        { k:'unitManager', t:'select', label:'Your Unit Manager', opts:'unitManager', req:true }
      ]
    },
    {
      id: 'prospect', title: 'Who you spoke to', tag: 'Step 2',
      lede: 'Their details. The email matters — it is how we thank them, and it is how they become a client later if they want to be.',
      fields: [
        { k:'firstName',  t:'text',  label:'First name', req:true },
        { k:'lastName',   t:'text',  label:'Last name', req:true },
        { k:'email',      t:'email', label:'Email', hint:'Leave blank if they would rather not give it. No email means no thank-you note.' },
        { k:'phone',      t:'tel',   label:'Phone number' },
        { k:'occupation', t:'text',  label:'Occupation' },
        { k:'address',    t:'text',  label:'Area they live' }
      ]
    },
    {
      id: 'qualify', title: 'How you know them', tag: 'Step 3',
      lede: 'This is the block that feeds your Income Potential Analysis and the branch Form A. On the old form it was the least-completed section — and it is the one that decides how your market is scored.',
      fields: [
        { k:'source',        t:'select', label:'Source', opts:'source', req:true },
        { k:'income',        t:'select', label:'Approximate income', opts:'income', req:true },
        { k:'age',           t:'choice', label:'Age band', opts:'age', req:true },
        { k:'marital',       t:'select', label:'Marital status', opts:'marital', req:true },
        { k:'timeKnown',     t:'choice', label:'How long have you known them?', opts:'timeKnown', req:true },
        { k:'howWell',       t:'choice', label:'How well do you know them?', opts:'howWell', req:true },
        { k:'howOften',      t:'choice', label:'How often have you seen them in the last year?', opts:'howOften', req:true },
        { k:'couldApproach', t:'choice', label:'Could you approach them on business?', opts:'couldApproach', req:true },
        { k:'abilityRefer',  t:'choice', label:'Their ability to provide referrals', opts:'abilityRefer', req:true }
      ]
    },
    {
      id: 'needs', title: 'What they want', tag: 'Step 4',
      lede: 'Open questions. Write what they said, not what you wish they had said.',
      fields: [
        { k:'savingFor',   t:'area', rows:2, label:'What’s one thing you’re saving for, or would like to save for?' },
        { k:'wordAssoc',   t:'choice', label:'First thing that comes to mind when you hear the word “insurance”?', opts:'wordAssoc' },
        { k:'improveOne',  t:'area', rows:2, label:'If you could improve one thing about how financial services work, what would it be?' }
      ]
    },
    {
      id: 'cover', title: 'What they already have', tag: 'Step 5',
      lede: 'Where the commercial signal lives. Across 880 surveys, one in five owned nothing at all.',
      fields: [
        { k:'ownsIns',       t:'choice', label:'Do you own any types of insurance?', opts:'ownsIns', req:true },
        { k:'insTypes',      t:'multi',  label:'If yes, what types?', opts:'insTypes', showIf:['ownsIns','Yes'] },
        { k:'confidence',    t:'choice', label:'How confident are you in your current coverage?', opts:'confidence', showIf:['ownsIns','Yes'] },
        { k:'mostImportant', t:'choice', label:'What’s the most important thing an insurance provider should offer?', opts:'mostImportant' },
        { k:'changes',       t:'choice', label:'Are you considering any changes to your coverage in the future?', opts:'yesNoUnsure' }
      ]
    },
    {
      id: 'community', title: 'Their community', tag: 'Step 6',
      lede: 'This is market research the branch genuinely uses. Answers here shape how we prospect the area.',
      fields: [
        { k:'communityOpen',   t:'choice', label:'Are people in your community open to discussing insurance?', opts:'yesNoUnsure' },
        { k:'bestWay',         t:'choice', label:'Best way for an agent to connect with people in your area?', opts:'bestWay' },
        { k:'communityValues', t:'choice', label:'What do people in your community value most in financial planning?', opts:'communityValues' },
        { k:'advice',          t:'area', rows:3, label:'What advice would you give someone just starting in the insurance industry?' },
        { k:'qualities',       t:'area', rows:3, label:'What qualities make someone a great insurance agent?' }
      ]
    },
    {
      id: 'referrals', title: 'The ask', tag: 'Step 7',
      lede: 'Do not skip this. Only 31 out of every 100 surveys on the old form came back with a single name — and this is the entire point of the exercise. Ask it out loud, exactly as it is written.',
      script: 'Would you mind sharing the names of one or two people I could speak with, to get their thoughts on insurance and financial planning as I explore this career?',
      fields: [
        { k:'willRefer', t:'choice', label:'Their answer', opts:'willRefer', req:true },
        { k:'referrals', t:'referrals', label:'Names they gave you', showIf:['willRefer','Yes'] }
      ]
    },
    {
      id: 'close', title: 'Your read, and their consent', tag: 'Step 8',
      lede: 'Your own notes stay between you and your manager. The consent below is what makes this a legitimate orientation exercise rather than a sales call.',
      fields: [
        { k:'insights', t:'area', rows:4, label:'Your insights on this interview',
          hint:'What you noticed. If they are a live prospect, say so and say why — this is what your manager reads first.' },
        { k:'consent', t:'consent', label:'Their consent', req:true },
        { k:'contactOk', t:'check',
          label:'They are happy for the branch to contact them once I am contracted',
          hint:'Only tick this if you actually asked. If it is ticked and they gave an email, they get a short thank-you note today and nothing else until you are approved.' }
      ]
    }
  ],

  /* The consent wording, carried over from the live form. */
  consentText:
    'I understand that this conversation is part of an orientation exercise for the person named above, ' +
    'who is currently exploring a career in the insurance industry. This discussion was purely for learning ' +
    'purposes, and no products or services were offered or solicited. By signing below, I confirm that I ' +
    'participated in this friendly discussion and provided my feedback voluntarily.',

  /* ============================================================
     SCORING — 100 points, and the recruit sees it build live.
     The old form scored 0–161 with no visible rubric, so nobody
     knew what a good survey was until after it was graded.
     ============================================================ */
  rubric: [
    { k:'identity',  label:'Prospect identified',   max:12,
      hint:'Name, contact, occupation, area' },
    { k:'qualify',   label:'How you know them',     max:27,
      hint:'The nine GSAP qualifiers — 3 points each' },
    { k:'needs',     label:'What they want',        max:12 },
    { k:'cover',     label:'What they already have',max:15 },
    { k:'community', label:'Community insight',     max:14 },
    { k:'referrals', label:'Referrals secured',     max:16,
      hint:'8 points a name, up to two. The hardest points and the most valuable.' },
    { k:'insights',  label:'Your own read',         max:4 }
  ],

  score(a) {
    a = a || {};
    const has = k => { const v = a[k]; return Array.isArray(v) ? v.length > 0 : !!(v && String(v).trim()); };
    const words = k => String(a[k] || '').trim().split(/\s+/).filter(Boolean).length;

    /* identity — 12 */
    let identity = 0;
    if (has('firstName') && has('lastName')) identity += 3;
    if (has('email')) identity += 4;
    if (has('phone')) identity += 2;
    if (has('occupation')) identity += 2;
    if (has('address')) identity += 1;

    /* qualify — 27, three points each */
    const q = ['source','income','age','marital','timeKnown','howWell','howOften','couldApproach','abilityRefer'];
    const qualify = q.filter(has).length * 3;

    /* needs — 12. Free text needs to actually say something. */
    let needs = 0;
    if (words('savingFor') >= 3) needs += 5; else if (has('savingFor')) needs += 2;
    if (has('wordAssoc')) needs += 2;
    if (words('improveOne') >= 3) needs += 5; else if (has('improveOne')) needs += 2;

    /* cover — 15 */
    let cover = 0;
    if (has('ownsIns')) cover += 3;
    if (a.ownsIns === 'Yes' ? has('insTypes') : true) cover += 3;
    if (a.ownsIns === 'Yes' ? has('confidence') : true) cover += 3;
    if (has('mostImportant')) cover += 3;
    if (has('changes')) cover += 3;

    /* community — 14 */
    let community = 0;
    if (has('communityOpen')) community += 2;
    if (has('bestWay')) community += 2;
    if (has('communityValues')) community += 2;
    if (words('advice') >= 5) community += 4; else if (has('advice')) community += 1;
    if (words('qualities') >= 5) community += 4; else if (has('qualities')) community += 1;

    /* referrals — 16. A name with a contact number is worth full marks. */
    const refs = (a.referrals || []).filter(r => r && String(r.name || '').trim());
    let referrals = 0;
    refs.slice(0, 2).forEach(r => { referrals += String(r.mobile || '').trim() ? 8 : 4; });
    if (refs.length === 0 && a.willRefer === 'Maybe Later') referrals = 2;  /* credit for asking */

    /* insights — 4 */
    const insights = words('insights') >= 12 ? 4 : words('insights') >= 4 ? 2 : 0;

    const parts = { identity, qualify, needs, cover, community, referrals, insights };
    const total = Object.values(parts).reduce((x, y) => x + y, 0);
    return { total: Math.min(100, total), parts, band: this.band(total), referralNames: refs.length };
  },

  band(t) {
    if (t >= 85) return { key:'excellent', label:'Excellent survey' };
    if (t >= 70) return { key:'strong',    label:'Strong survey' };
    if (t >= 50) return { key:'fair',      label:'Fair — gaps to close' };
    /* Below 25 the recruit has usually just opened the form. Telling them at
       step 1 that it will not count for much is both true and useless. */
    if (t >= 25) return { key:'weak', label:'Thin — this one will not count for much' };
    return { key:'start', label:'Just getting started' };
  },

  /* A survey with no consent is not a survey. */
  valid(a) {
    return !!(a && a.consent && String(a.consent.name || '').trim() && a.firstName && a.lastName);
  }
};

/* ============================================================
   THE BRIEFING — shown before Module 3's survey work, and
   available from the survey screen at any time.
   Every number in it is from the branch's own 880 submissions.
   ============================================================ */
window.SURVEY_BRIEFING = {
  title: 'How to run a Source Market Survey',
  intro:
    'This is not a sales call and you must never let it become one. You are a person exploring a career, ' +
    'asking someone you already know what they think about it. That framing is what makes people say yes — ' +
    'and it is what the consent paragraph at the end commits you to.',

  sections: [
    {
      h: 'Why the branch runs these',
      p: 'Three reasons, in order of how much they matter to you. First, you find out whether you can hold a ' +
         'financial conversation with someone you know — which is the whole job. Second, every survey is a name ' +
         'on your Project 100 and a step towards the Income Potential Analysis in your selection file. Third, the ' +
         'branch learns what the market actually thinks, and that shapes how we all sell.'
    },
    {
      h: 'The opening, word for word',
      quote: '“I’m looking at a career with Guardian Life, and part of the process is talking to people I know about ' +
             'how they see insurance and financial planning. It takes about fifteen minutes, nothing is being sold, ' +
             'and it would really help me. Can I ask you a few questions?”',
      p: 'Say it plainly and then stop talking. The pause is what gets the yes.'
    },
    {
      h: 'What the branch has learned from 880 of these',
      stats: [
        { n:'50%', t:'say the first word they think of is “security” — lead there, not with price' },
        { n:'39%', t:'want reliable advice above all; only 22% named affordable premiums' },
        { n:'43%', t:'are already considering a change to their cover' },
        { n:'20%', t:'own no insurance at all' },
        { n:'39%', t:'still say an in-person visit is the best way to reach them' },
        { n:'31%', t:'is how often we actually walk away with a referral — this is the number to beat' }
      ]
    },
    {
      h: 'The referral ask is where surveys are won and lost',
      p: 'Only 280 of 880 surveys came back with a single name. A survey with a referral scores ten points higher ' +
         'on average, and it is the only part of this exercise that builds you a market beyond the people you ' +
         'already know. Ask it out loud, in full, and then be quiet. If they hesitate, “maybe later” is a real ' +
         'answer — record it and ask again in a fortnight.'
    },
    {
      h: 'Three ways recruits lose marks',
      list: [
        'Skipping the nine "how you know them" questions. They are a quarter of the score and they feed your selection file.',
        'One-word answers in the open questions. Write what they said. "Expense" is not an answer; "he thinks it is money he will never see again" is.',
        'No consent signature. On the old form a third of surveys had none, and a survey without consent does not count.'
      ]
    },
    {
      h: 'After you submit',
      p: 'Your Unit Manager and the Branch Manager get it the same day. If the person gave an email and agreed to be ' +
         'contacted, they get a short thank-you from the branch explaining that you are in selection and that someone ' +
         'will reach out once you are contracted. You do not send that yourself and you must not chase them in the ' +
         'meantime — you are not licensed yet.'
    }
  ]
};
