/**
 * MotorProduct.gs — what a MotorGuard policy actually gives you.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Portal.html carried six hand-written bullet points for comprehensive and
 * four for third party. They were close, but close is not good enough on
 * client-facing cover descriptions, and three were wrong:
 *
 *   - "step-back protection so one claim doesn't erase it" is false for a
 *     first- or second-year client. One claim takes 30% or 40% to ZERO.
 *     Step-back only starts once a third-year discount is earned.
 *
 *   - windscreen was offered to third-party clients as plain "windscreen
 *     cover". Third party can only buy FRONT AND BACK glass; ALL glass is
 *     comprehensive and fire-and-theft only.
 *
 *   - ten optional benefits exist. The portal offered two, and never
 *     mentioned that an individual policyholder is entitled to ONE OF
 *     Courtesy Car or Hospitalisation **free**.
 *
 * EVERY CLAIM HERE CARRIES ITS SOURCE in `src`, so anything that turns out to
 * be superseded can be found and corrected rather than hunted for. Two
 * documents, both in the branch's Motor folder:
 *
 *   W = GG-MOT-POL-APV-10/09   Private Motor Vehicle Policy wording
 *   P = GG-MOT-APV-PRO-09/2021 Private Motor Vehicle Insurance Proposal, Q19
 *
 * A KNOWN GAP, STATED RATHER THAN PAPERED OVER. The proposal is 2021; the
 * private wording is 2009. Three benefits on the 2021 proposal — Excess
 * Waiver, Mechanical Repair and Survivors Benefit — have no wording in the
 * folder at all, only a tick box. They are listed here as available because
 * the proposal offers them, and flagged `noWording: true` so nothing claims
 * to describe terms we have not read.
 *
 * WHAT THIS FILE WILL NOT DO
 * --------------------------
 * It does not price anything and it does not confirm what a client holds.
 * Cover1__c tells us the sum insured and Windscreen__c a glass limit, but
 * Waiver_of_Excess__c is the literal string "Waiver of Excess" on all 230
 * motor risks — a label, not a value — so the record cannot tell us whether
 * the client bought it. Anything offered is therefore phrased as "ask us
 * about", never "add this", and the portal must not pre-tick a benefit it
 * cannot confirm is absent.
 */

var MP = {
  /** Source documents, named once. */
  SRC: {
    W: 'Private Motor Vehicle Policy GG-MOT-POL-APV-10/09',
    P: 'Private Motor Insurance Proposal GG-MOT-APV-PRO-09/2021, Q19',
  },

  /**
   * Cover level from Motor_Vehicle_Coverage_Type__c.
   *
   * The commercial USE classes — Own Goods, General Cartage, Special Type —
   * say how the vehicle is used, not whether it is comprehensive or third
   * party. They map to 'unknown' on purpose: it is better to tell a client we
   * need to confirm their cover than to guess it and describe the wrong one.
   */
  LEVEL: {
    'Private Comprehensive':            'comp',
    'Commercial Comprehensive':         'comp',
    'Private Third Party Fire & Theft': 'tpft',
    'Private Third Party':              'tp',
    'Commercial Third Party':           'tp',
    'Commercial Motor Own Goods':       'unknown',
    'Commercial Motor General Cartage': 'unknown',
    'Commercial Motor Special Type':    'unknown',
  },

  LEVEL_NAME: {
    comp: 'Comprehensive', tpft: 'Third Party, Fire & Theft',
    tp: 'Third Party', unknown: 'cover to be confirmed',
  },
};

/* ==================== what you already have ==================== */

/**
 * Included benefits, per cover level.
 *
 * The split is the policy's own, from the front page of the wording:
 *   COMPREHENSIVE   Sections 1, 2, 3, 4, Section 6 sub-sections 1 and 2
 *   THIRD PARTY F&T Sections 1, 2, 3, Section 4 SUB-SECTION 5 ONLY
 *   THIRD PARTY     Sections 1, 3,    Section 4 SUB-SECTION 5 ONLY
 *
 * That is why medical expenses, personal accident, garage fire and luggage
 * are comprehensive only — they are sub-sections 1 to 4 of Section 4, and a
 * third-party policy is granted sub-section 5 alone. Listing them for a
 * third-party client would describe cover they have not bought.
 */
function mpIncluded_(level) {
  var liability = [
    { t: 'Liability to others',
      d: 'Injury to third parties and damage to their property, including the ' +
         'claimant’s costs and expenses.', src: 'W s3.1' },
    { t: 'Your authorised drivers and passengers are covered too',
      d: 'Anyone driving with your permission, and passengers getting in or out, ' +
         'are indemnified on the same terms as you.', src: 'W s3.2' },
    { t: 'Legal costs',
      d: 'Representation at a coroner’s inquest and the defence of proceedings, ' +
         'at Guardian’s option and expense.', src: 'W s3.3' },
    { t: 'Legal defence for manslaughter proceedings',
      d: 'Arranged and paid for where the driver is an authorised driver aged 21 ' +
         'or over.', src: 'W s3.5' },
    { t: 'Emergency treatment does not cost you your discount',
      d: 'Where emergency treatment is the only payment, it is not counted as a ' +
         'claim for No Claim Discount purposes.', src: 'W s3.8' },
  ];

  var ownVehicle = [
    { t: 'Your own vehicle covered',
      d: 'Accidental loss, including theft, or damage — up to the sum insured, ' +
         'less your excess.', src: 'W s2.1' },
    { t: 'Towing to safety',
      d: 'If the vehicle is disabled by an insured loss, the reasonable cost of ' +
         'protection and removal to the nearest repairer or place of safety.', src: 'W s2.2' },
  ];

  var ownVehicleFT = [
    { t: 'Your vehicle covered for fire and theft only',
      d: 'Fire, explosion, self-ignition or lightning; and burglary, housebreaking ' +
         'or theft. Accident damage to your own vehicle is NOT included.', src: 'W s2.1 proviso' },
    { t: 'Towing to safety',
      d: 'If the vehicle is disabled by an insured loss, the reasonable cost of ' +
         'protection and removal.', src: 'W s2.2' },
  ];

  var extras = [
    { t: 'Medical expenses',
      d: 'Reasonable medical expenses for you, your driver or any passenger injured ' +
         'in connection with the vehicle.', src: 'W s4.2' },
    { t: 'Personal accident benefit for you and your spouse',
      d: 'Up to 100% of the limit for death, loss of sight or severance; and $50 a ' +
         'week while totally disabled, for up to 26 consecutive weeks. Payable for ' +
         'ages 17 to 65.', src: 'W s4.3' },
    { t: 'Damage to your garage by fire',
      d: 'Your private garage, where it is not covered by any other insurance.', src: 'W s4.1' },
    { t: 'Luggage and personal effects',
      d: 'Loss or damage while in or on the vehicle. Money, jewellery, watches, ' +
         'cameras, laptops, phones and trade goods are excluded.', src: 'W s4.4' },
  ];

  if (level === 'comp') return ownVehicle.concat(liability, extras);
  if (level === 'tpft') return ownVehicleFT.concat(liability);
  if (level === 'tp')   return liability.slice();
  return liability.slice();      // unknown: only what every cover level has
}

/* ==================== what you could add ==================== */

/**
 * The ten optional extra benefits, from the 2021 proposal.
 *
 * `free` marks the proposal's own note, verbatim: "Individual Policyholders
 * are entitled to one of (e) or (g) free." That is the most useful single
 * sentence in the document and the portal has never said it.
 */
function mpOptional_(level) {
  var all = [
    { k: 'a', t: 'Special Perils',
      d: 'Flood, hurricane, windstorm, tornado, earthquake, volcanic eruption or ' +
         'any other convulsion of nature. Without it these are excluded — ' +
         'which in Trinidad mainly means flood.',
      levels: ['comp'], src: 'P 19(a); W s7.2(a) deleted by OEB 1' },

    { k: 'b', t: 'Windscreen and ALL glass damage',
      d: 'A glass-only claim carries no excess and does not affect your No Claim ' +
         'Discount. A replacement reinstates the cover free once in a period, up ' +
         'to $2,500.',
      levels: ['comp', 'tpft'], limitField: 'Windscreen__c',
      src: 'P 19(b); W OEB 2' },

    { k: 'c', t: 'Windscreen — front and back glass only',
      d: 'The third-party version. Front and back glass, not all glass. Same ' +
         'no-excess, no-effect-on-discount treatment for a glass-only claim.',
      levels: ['tp'], limitField: 'Windscreen__c', src: 'P 19(c)' },

    { k: 'd', t: 'Personal accident benefit for un-named passengers',
      d: '$5,000 per person or $35,000 in aggregate, for the full seating capacity, ' +
         'ages 17 to 65. If more people are in the vehicle than its stated seating ' +
         'capacity, the benefit is paid pro rata.',
      levels: ['comp', 'tpft', 'tp', 'unknown'], src: 'P 19(d); W OEB 3' },

    { k: 'e', t: 'Courtesy car or loss of use', free: true,
      d: 'A substitute vehicle while yours is being repaired, or up to $100 a day ' +
         'towards a rental, for a maximum of 10 days.',
      levels: ['comp'], src: 'P 19(e); W OEB 4' },

    { k: 'f', t: 'Agreed Value',
      d: 'On a total loss the sum insured is paid rather than market value, less ' +
         'pre-agreed depreciation of 15% a year. It requires a written valuation ' +
         'from an approved valuator at each renewal — without one, Guardian pays ' +
         'market value or the sum insured, whichever is LESS.',
      levels: ['comp', 'tpft'], src: 'P 19(f); W OEB 5' },

    { k: 'g', t: 'Hospitalisation benefit', free: true,
      d: 'Up to $15,000 in any 12 months for surgery, room and board, intensive ' +
         'care and ambulance. Halves at 65 and stops at 70. Needs a health ' +
         'questionnaire, and pre-existing conditions are excluded.',
      levels: ['comp', 'tpft', 'tp', 'unknown'], src: 'P 19(g); W OEB 6' },

    { k: 'h', t: 'Excess waiver', noWording: true,
      d: 'Removes your excess contribution when you claim.',
      levels: ['comp', 'tpft', 'tp', 'unknown'], src: 'P 19(h)' },

    { k: 'i', t: 'Mechanical repair benefit', noWording: true,
      d: 'Three levels: $3,000, $5,000 or $8,000.',
      levels: ['comp', 'tpft', 'tp', 'unknown'], src: 'P 19(i)' },

    { k: 'j', t: 'Survivors benefit', noWording: true,
      d: 'Offered on the proposal form.',
      levels: ['comp', 'tpft', 'tp', 'unknown'], src: 'P 19(j)' },
  ];

  return all.filter(function (b) { return b.levels.indexOf(level) > -1; });
}

/** The proposal's free-choice note, where it applies. */
function mpFreeChoice_(level) {
  var free = mpOptional_(level).filter(function (b) { return b.free; });
  if (free.length < 2) return null;     // only comprehensive gets both
  return {
    t: 'One of these two is free',
    d: 'The proposal form states that an individual policyholder is entitled to ' +
       'one of ' + free[0].t.toLowerCase() + ' or ' + free[1].t.toLowerCase() +
       ' at no additional cost. Tell us which you would rather have and we will ' +
       'ask Guardian General to add it.',
    options: free.map(function (b) { return { k: b.k, t: b.t, d: b.d }; }),
    src: MP.SRC.P,
  };
}

/* ==================== the No Claim Discount, honestly ==================== */

/**
 * The real scale, and what one claim actually costs.
 *
 * Comprehensive runs 30/40/50/60; third party and fire-and-theft run
 * 15/20/25/35. Step-back applies only "after You earn at least a third year
 * discount" — so at 30% or 40% a single claim wipes the discount out
 * completely. The portal's blanket "step-back protection" promise was wrong
 * for exactly the clients least able to absorb it.
 */
function mpNcd_(level) {
  var comp = (level === 'comp');
  return {
    max: comp ? 60 : 35,
    scale: comp
      ? [{ yrs: 1, pct: 30, stepBackTo: 0 }, { yrs: 2, pct: 40, stepBackTo: 0 },
         { yrs: 3, pct: 50, stepBackTo: 30 }, { yrs: 4, pct: 60, stepBackTo: 40 }]
      : [{ yrs: 1, pct: 15 }, { yrs: 2, pct: 20 },
         { yrs: 3, pct: 25 }, { yrs: 4, pct: 35 }],
    stepBack: comp,
    stepBackNote: comp
      ? 'Step-back only applies once you have earned at least a third-year ' +
        'discount. Below that, one claim takes the discount to nothing.'
      : '',
    protectedNote: comp
      ? 'After two or more consecutive years at the maximum discount, one claim ' +
        'does not affect it — but a second claim in the following three years ' +
        'disallows it.'
      : '',
    // Why we cannot show the client their own number.
    ownKnown: false,
    ownNote: 'We cannot show you your own discount — it is not recorded on your ' +
             'record. Ask us and we will confirm it from your schedule.',
    src: comp ? 'W s6.2' : 'W s6.3',
  };
}

/* ==================== worth knowing ==================== */

/** Exclusions a motor client is most likely to be caught by. */
function mpWatchOuts_(level) {
  var out = [
    { t: 'Glass is not covered as standard',
      d: 'A cracked or broken windscreen or window is excluded unless it came from ' +
         'theft, impact or a malicious act — or unless you have added the glass ' +
         'benefit.', src: 'W s2 excl 4' },
    { t: 'Flood and storm are not covered as standard',
      d: 'Flood, hurricane, windstorm, tornado, earthquake and volcanic eruption are ' +
         'excluded unless Special Perils is added.', src: 'W s7.2(a)' },
    { t: 'Keys left in the vehicle',
      d: 'You must not leave an ignition key, card or keyless device in the vehicle ' +
         'while it is unoccupied.', src: 'W s8.1(c)' },
    { t: 'Tell Guardian when things change',
      d: 'A replacement vehicle, modifications away from the manufacturer’s ' +
         'specification, a new use, or a change of address or where the vehicle is ' +
         'kept — all must be notified during the period of insurance.', src: 'W s8.10' },
  ];
  if (level === 'comp' || level === 'tpft') {
    out.splice(1, 0, {
      t: 'You cannot be paid more than the vehicle is worth',
      d: 'A settlement is the market value at the time of loss, or the sum insured, ' +
         'whichever is LESS — which is why the figure you insure for matters.',
      src: 'W s2.4.1' });
    out.push({
      t: 'Tyres and breakdown',
      d: 'Tyre damage is not covered unless the vehicle is damaged at the same time, ' +
         'and mechanical or electrical breakdown and wear and tear are excluded.',
      src: 'W s2 excl 2, 3' });
  }
  return out;
}

/* ==================== one call for the portal ==================== */

/**
 * Everything the page needs for one risk.
 *
 * `held` reports only what the record can actually evidence. The windscreen
 * limit is a real figure and varies by vehicle; the excess waiver is a label
 * on every record and tells us nothing, so it is reported as unknown rather
 * than as absent. A benefit we cannot confirm is missing must never be
 * offered as though it were.
 */
function mpForRisk(coverageType, risk) {
  risk = risk || {};
  var level = MP.LEVEL[coverageType] || 'unknown';
  var ws = Number(risk.Windscreen__c) || 0;

  return {
    coverageType: coverageType || '',
    level: level,
    levelName: MP.LEVEL_NAME[level],
    levelKnown: level !== 'unknown',
    included: mpIncluded_(level),
    optional: mpOptional_(level).filter(function (b) {
      // Do not offer glass to someone who demonstrably already has it.
      return !(b.limitField === 'Windscreen__c' && ws > 0);
    }),
    held: {
      windscreenLimit: ws,
      excessWaiver: 'unknown',   // the field is a label, not a value
      excess: null,              // Deductible__c is empty on all 230 motor risks
      ncdOwn: null,              // NCD__c is populated on 1 of 230
    },
    freeChoice: mpFreeChoice_(level),
    ncd: mpNcd_(level),
    watchOuts: mpWatchOuts_(level),
    sources: MP.SRC,
  };
}
