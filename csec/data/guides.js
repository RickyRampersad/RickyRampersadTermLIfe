/* SEA & CSEC Study Hub — guided method library
 *
 * Worked methods for the question types that carry the most marks. Each guide
 * is: when to use it, the method as numbered steps, one fully worked example
 * with every line explained, and the mistakes that actually lose marks.
 *
 * These are original walkthroughs written for this hub, tagged to the same
 * syllabus strands as the practice bank so a weak strand can offer its method.
 */
window.CSEC_GUIDES = [

/* ------------------------------ MATHEMATICS ------------------------------ */
{
  id:'g-ma-linear', subj:'mathematics', strand:'ma-algebra', level:6,
  title:'Solving a linear equation',
  when:'Any equation where the unknown appears to the power of one and there is a single answer.',
  steps:[
    {do:'Clear brackets first.', note:'Multiply everything inside by what is outside — including the sign.'},
    {do:'Collect the unknowns on one side.', note:'Move the smaller one across so you keep a positive coefficient.'},
    {do:'Collect the numbers on the other side.', note:'Whatever you do to one side, do to the other.'},
    {do:'Divide by the coefficient of the unknown.', note:'This is always the last step, never the first.'},
    {do:'Substitute your answer back in.', note:'Ten seconds, and it catches every sign error.'}
  ],
  worked:{
    problem:'Solve 3(x − 2) + 4 = 2x + 9',
    lines:[
      {work:'3x − 6 + 4 = 2x + 9', note:'Brackets cleared. Note 3 × (−2) = −6, not +6.'},
      {work:'3x − 2 = 2x + 9',      note:'Tidy the left side: −6 + 4 = −2.'},
      {work:'3x − 2x = 9 + 2',      note:'Unknowns left, numbers right. Each term changes sign as it crosses.'},
      {work:'x = 11',               note:'Coefficient is already 1, so no division needed.'},
      {work:'Check: 3(11 − 2) + 4 = 31 and 2(11) + 9 = 31 ✓', note:'Both sides agree, so the answer is right.'}
    ]
  },
  pitfalls:[
    'Forgetting to multiply the second term inside the bracket.',
    'Not changing the sign when a term crosses the equals sign.',
    'Dividing before all the unknowns are on one side.'
  ]
},
{
  id:'g-ma-quad', subj:'mathematics', strand:'ma-algebra', level:8,
  title:'Factorising a quadratic',
  when:'An expression of the form x² + bx + c that you need to write as two brackets.',
  steps:[
    {do:'Write down b and c.', note:'b is the number in front of x, c is the constant.'},
    {do:'Find two numbers that MULTIPLY to c and ADD to b.', note:'Multiply first — it gives you fewer options to test.'},
    {do:'Write the two brackets using those numbers.', note:'(x + first)(x + second).'},
    {do:'Expand to check.', note:'If it does not come back to the original, the pair is wrong.'}
  ],
  worked:{
    problem:'Factorise x² − 7x + 12',
    lines:[
      {work:'b = −7, c = +12',        note:'c is positive and b is negative, so both numbers are negative.'},
      {work:'Pairs for 12: 1×12, 2×6, 3×4', note:'Only three pairs to test — this is why you start with the product.'},
      {work:'−3 and −4: sum −7 ✓',    note:'(−3) × (−4) = +12 and (−3) + (−4) = −7. Both conditions met.'},
      {work:'(x − 3)(x − 4)',          note:'The answer.'},
      {work:'Check: x² − 4x − 3x + 12 = x² − 7x + 12 ✓', note:'Expanding returns the original.'}
    ]
  },
  pitfalls:[
    'Getting the signs the wrong way round — check c first: positive c means both signs match b.',
    'Stopping at the first pair that multiplies correctly without checking the sum.',
    'If the question says SOLVE rather than factorise, you must go on to set each bracket to zero.'
  ]
},
{
  id:'g-ma-simul', subj:'mathematics', strand:'ma-algebra', level:8,
  title:'Simultaneous equations by elimination',
  when:'Two equations, two unknowns, and you are asked for both values.',
  steps:[
    {do:'Label the equations (1) and (2).', note:'The examiner needs to follow which one you used.'},
    {do:'Look for a letter with the same coefficient.', note:'If none, multiply one equation to create one.'},
    {do:'Same signs subtract, opposite signs add.', note:'This is the whole trick.'},
    {do:'Solve for the remaining letter.', note:'You now have a simple linear equation.'},
    {do:'Substitute back into the simpler equation.', note:'Use whichever has the smaller numbers.'},
    {do:'Check in the equation you did NOT substitute into.', note:'That is a genuine check, not a repeat.'}
  ],
  worked:{
    problem:'Solve 2x + 3y = 16 and 4x − 3y = 8',
    lines:[
      {work:'(1) 2x + 3y = 16   (2) 4x − 3y = 8', note:'Labelled.'},
      {work:'y coefficients are +3 and −3',       note:'Opposite signs, so ADD to eliminate y.'},
      {work:'(1) + (2):  6x = 24',                 note:'3y and −3y cancel; 16 + 8 = 24.'},
      {work:'x = 4',                               note:'Divide by 6.'},
      {work:'Sub into (1): 2(4) + 3y = 16 → 3y = 8 → y = 8/3', note:'Substituting into the simpler equation.'},
      {work:'Check in (2): 4(4) − 3(8/3) = 16 − 8 = 8 ✓', note:'Checked in the OTHER equation.'}
    ]
  },
  pitfalls:[
    'Adding when the signs are the same — that doubles the term instead of removing it.',
    'Forgetting to multiply EVERY term when scaling an equation.',
    'Giving only one of the two values. Both carry marks.'
  ]
},
{
  id:'g-ma-sets', subj:'mathematics', strand:'ma-sets', level:7,
  title:'Venn diagram word problems',
  when:'A question gives totals for two groups, an overlap, and asks how many are in some region.',
  steps:[
    {do:'Draw two overlapping circles inside a rectangle.', note:'The rectangle is the universal set — do not leave it out.'},
    {do:'Fill the INTERSECTION first.', note:'Always. Everything else depends on it.'},
    {do:'Subtract the intersection from each total.', note:'That gives the "only" regions.'},
    {do:'Add all regions and subtract from the universal total.', note:'That gives the "neither" region.'},
    {do:'Read the question again and answer what was asked.', note:'"Only Spanish" and "Spanish" are different numbers.'}
  ],
  worked:{
    problem:'In a class of 40, 25 study Spanish, 18 study French and 7 study both. How many study neither?',
    lines:[
      {work:'Intersection = 7',            note:'Placed in the overlap first.'},
      {work:'Spanish only = 25 − 7 = 18',  note:'The 7 were already counted inside the 25.'},
      {work:'French only = 18 − 7 = 11',   note:'Same reasoning.'},
      {work:'In at least one = 18 + 7 + 11 = 36', note:'All three regions of the circles.'},
      {work:'Neither = 40 − 36 = 4',       note:'The region inside the rectangle but outside both circles.'}
    ]
  },
  pitfalls:[
    'Adding 25 + 18 and forgetting the 7 is counted twice.',
    'Answering "Spanish only" when the question asked for "Spanish".',
    'Omitting the universal rectangle, which loses the presentation mark.'
  ]
},
{
  id:'g-ma-consumer', subj:'mathematics', strand:'ma-consumer', level:8,
  title:'Consumer arithmetic — the multiplier method',
  when:'Discount, VAT, mark-up, depreciation, or simple interest on a price.',
  steps:[
    {do:'Decide whether the amount goes up or down.', note:'Up → multiplier is more than 1. Down → less than 1.'},
    {do:'Turn the percentage into a multiplier.', note:'Add 12.5% → ×1.125. Take off 20% → ×0.80.'},
    {do:'Multiply once.', note:'One operation instead of two removes half the errors.'},
    {do:'For several changes, multiply the multipliers.', note:'A 20% discount then 12.5% VAT is ×0.80 ×1.125.'},
    {do:'Round money to two decimal places at the END.', note:'Rounding early drifts the answer.'}
  ],
  worked:{
    problem:'A stove is marked $3 200. A 15% discount is given, then VAT of 12.5% is added. Find the final price.',
    lines:[
      {work:'Discount multiplier = 1 − 0.15 = 0.85', note:'Price goes down, so below 1.'},
      {work:'VAT multiplier = 1 + 0.125 = 1.125',    note:'Price goes up, so above 1.'},
      {work:'3 200 × 0.85 = 2 720',                  note:'Price after discount.'},
      {work:'2 720 × 1.125 = 3 060',                 note:'Price after VAT.'},
      {work:'Final price = $3 060.00',               note:'Rounded once, at the end.'}
    ]
  },
  pitfalls:[
    'Adding 15% back after taking it off and expecting the original — it does not return.',
    'Using ×0.15 instead of ×0.85 for a discount, which gives the saving, not the price.',
    'Rounding at every stage instead of only at the end.'
  ]
},
{
  id:'g-ma-trig', subj:'mathematics', strand:'ma-geom', level:9,
  title:'Right-angled triangles — choosing Pythagoras or trigonometry',
  when:'A right-angled triangle with a missing side or angle.',
  steps:[
    {do:'Mark the right angle and the hypotenuse.', note:'The hypotenuse is always opposite the right angle.'},
    {do:'Count what you are given.', note:'Three sides involved and no angle → Pythagoras. An angle involved → trigonometry.'},
    {do:'For trigonometry, label opposite, adjacent, hypotenuse relative to the angle.', note:'Relative to the angle you are USING, not the right angle.'},
    {do:'Pick the ratio with SOH CAH TOA.', note:'Choose the one containing the two things you know or want.'},
    {do:'Substitute, then rearrange.', note:'Substituting first keeps the algebra simple.'}
  ],
  worked:{
    problem:'A ladder leans against a wall at 65° to the ground. Its foot is 2.4 m from the wall. Find the length of the ladder.',
    lines:[
      {work:'Angle = 65°, adjacent = 2.4 m, hypotenuse = ladder', note:'2.4 m is next to the angle, so it is adjacent.'},
      {work:'Adjacent and hypotenuse → cosine',   note:'CAH: cos = adjacent ÷ hypotenuse.'},
      {work:'cos 65° = 2.4 ÷ L',                  note:'Substituted before rearranging.'},
      {work:'L = 2.4 ÷ cos 65°',                  note:'Rearranged.'},
      {work:'L = 2.4 ÷ 0.4226 = 5.68 m (3 s.f.)', note:'The ladder is longer than 2.4 m, which is sensible.'}
    ]
  },
  pitfalls:[
    'Labelling opposite and adjacent from the right angle instead of the working angle.',
    'Leaving the calculator in radians — check it shows DEG.',
    'An answer where the hypotenuse comes out shorter than a leg. That is always wrong.'
  ]
},
{
  id:'g-ma-gradient', subj:'mathematics', strand:'ma-relations', level:8,
  title:'Straight-line graphs — gradient and equation',
  when:'Two points, or a drawn line, and you need the gradient or the equation.',
  steps:[
    {do:'Label the points (x₁, y₁) and (x₂, y₂).', note:'It does not matter which is which, provided you stay consistent.'},
    {do:'Gradient m = (y₂ − y₁) ÷ (x₂ − x₁).', note:'y on top. Always.'},
    {do:'Substitute m and one point into y = mx + c.', note:'Use the point with the friendlier numbers.'},
    {do:'Solve for c.', note:'c is where the line crosses the y-axis.'},
    {do:'Write the full equation.', note:'y = mx + c, with the actual numbers in.'}
  ],
  worked:{
    problem:'Find the equation of the line through (1, 2) and (3, 8).',
    lines:[
      {work:'(x₁,y₁) = (1,2)  (x₂,y₂) = (3,8)', note:'Labelled and kept in that order.'},
      {work:'m = (8 − 2) ÷ (3 − 1) = 6 ÷ 2 = 3', note:'y difference on top.'},
      {work:'y = 3x + c',                        note:'Gradient substituted.'},
      {work:'2 = 3(1) + c → c = −1',              note:'Used the point (1,2).'},
      {work:'y = 3x − 1',                         note:'Check with (3,8): 3(3) − 1 = 8 ✓'}
    ]
  },
  pitfalls:[
    'Computing (x₂ − x₁) ÷ (y₂ − y₁), which inverts the gradient.',
    'Mixing the order of the points between numerator and denominator.',
    'Stopping at the gradient when the question asked for the equation.'
  ]
},

/* ------------------------------- ENGLISH A ------------------------------- */
{
  id:'g-ea-summary', subj:'english-a', strand:'ea-summary', level:8,
  title:'The summary — getting full marks in the word limit',
  when:'A passage with an instruction such as "in not more than 120 words".',
  steps:[
    {do:'Read the question BEFORE the passage.', note:'It tells you what to summarise — rarely the whole thing.'},
    {do:'Read once for sense, then again with a pencil.', note:'Underline only the main idea of each paragraph.'},
    {do:'Cross out examples, statistics, repetition and quotations.', note:'They support ideas; they are not ideas.'},
    {do:'Write one sentence per underlined idea, in your own words.', note:'Changing a couple of words is not "own words".'},
    {do:'Join into continuous prose. No bullets, no headings.', note:'The question asks for a paragraph.'},
    {do:'Count the words and write the total at the end.', note:'Over the limit loses marks however good it reads.'}
  ],
  worked:{
    problem:'Method applied to a passage arguing that mobile phones harm classroom learning.',
    lines:[
      {work:'Para 1 main idea: phones split attention',       note:'The anecdote about one student is an example — cut it.'},
      {work:'Para 2 main idea: notifications break concentration for several minutes', note:'The "23 minutes" figure is support — cut the number, keep the idea.'},
      {work:'Para 3 main idea: schools banning phones report better results', note:'Two named schools are examples — cut both.'},
      {work:'Draft: "Phones divide pupils’ attention in class. Each notification interrupts concentration for a long period afterwards. Schools that have banned them report improved performance."', note:'Three ideas, own words, continuous prose.'},
      {work:'Word count: 34 — well inside a 120 limit',        note:'Room left to develop, not to pad.'}
    ]
  },
  pitfalls:[
    'Copying whole sentences from the passage. That scores nothing for expression.',
    'Including examples and figures, which eats the word limit.',
    'Adding your own opinion. A summary reports the writer, not you.'
  ]
},
{
  id:'g-ea-argue', subj:'english-a', strand:'ea-arg', level:9,
  title:'The argumentative essay — a structure that scores',
  when:'"Write an essay arguing for or against…" in Paper 02 Section B.',
  steps:[
    {do:'Pick the side you have more evidence for, not the one you believe.', note:'You are marked on argument, not sincerity.'},
    {do:'Write a thesis a reasonable person could dispute.', note:'If nobody could disagree, it is not an argument.'},
    {do:'Plan three points before writing a word.', note:'Five minutes of planning saves the essay.'},
    {do:'One paragraph per point: claim, evidence, explanation.', note:'The explanation is where the marks are.'},
    {do:'Include one counter-argument and answer it.', note:'This single paragraph lifts a mid-band essay.'},
    {do:'Conclude by returning to the thesis, not by repeating the points.', note:'Say why it matters.'}
  ],
  worked:{
    problem:'"Secondary schools should ban mobile phones during class time." Argue for.',
    lines:[
      {work:'Thesis: schools should ban phones in class because they measurably reduce concentration.', note:'Arguable, and it signals the reason.'},
      {work:'Point 1 — attention: claim, then evidence, then why it follows.', note:'Strongest point first.'},
      {work:'Point 2 — equity: phones widen the gap between students who have them and those who do not.', note:'A second, different angle.'},
      {work:'Point 3 — behaviour: cyberbullying and filming during school hours.', note:'Third distinct ground.'},
      {work:'Counter: "phones are useful for research." Answer: schools can provide supervised devices.', note:'Conceded, then defeated.'},
      {work:'Conclusion: returns to concentration and says what is at stake.', note:'No new points in a conclusion.'}
    ]
  },
  pitfalls:[
    'Arguing both sides equally, which reads as having no position.',
    'Points that are three versions of the same idea.',
    'A conclusion that only lists what you already said.'
  ]
},

/* ------------------------------- ENGLISH B ------------------------------- */
{
  id:'g-eb-pee', subj:'english-b', strand:'eb-essay', level:8,
  title:'The literature paragraph — Point, Evidence, Explanation',
  when:'Any English B essay on poetry, prose or drama.',
  steps:[
    {do:'POINT: answer the question in your first sentence.', note:'Use the question’s own words so the link is visible.'},
    {do:'EVIDENCE: quote briefly and accurately.', note:'A few words embedded in your sentence beats three lines copied out.'},
    {do:'EXPLANATION: say what the writer DOES and what EFFECT it has.', note:'Name the technique, then explain the effect on the reader.'},
    {do:'LINK: tie it back to the question before moving on.', note:'One sentence is enough.'},
    {do:'Repeat for each point.', note:'Three developed paragraphs beat six thin ones.'}
  ],
  worked:{
    problem:'How does the poet present the sea as threatening?',
    lines:[
      {work:'POINT: The poet presents the sea as threatening by giving it animal appetite.', note:'Directly answers, using the question’s word "threatening".'},
      {work:'EVIDENCE: the sea is "a hungry dog".',   note:'Short, embedded, accurate.'},
      {work:'EXPLANATION: the metaphor transfers hunger and unpredictability to the water, so it is not merely powerful but actively wants something.', note:'Names the technique and gives the effect.'},
      {work:'EXPLANATION continued: "hungry" suggests a need that cannot be satisfied, implying the threat never ends.', note:'Zooms in on one word — this is what earns the top band.'},
      {work:'LINK: the reader is left uneasy rather than impressed, which is what makes the sea threatening rather than grand.', note:'Back to the question.'}
    ]
  },
  pitfalls:[
    'Retelling the story instead of analysing it.',
    'Naming a device without explaining its effect. "This is a metaphor" earns nothing on its own.',
    'Long quotations that fill the page and prove nothing.'
  ]
},

/* -------------------------------- HISTORY -------------------------------- */
{
  id:'g-hi-essay', subj:'history', strand:'hi-skills', level:9,
  title:'The History essay — cause, effect and evidence',
  when:'"Explain the reasons for…" or "Discuss the effects of…" in Paper 02.',
  steps:[
    {do:'Underline the command word and the date range.', note:'Writing outside the dates earns nothing, however good.'},
    {do:'Decide how many reasons the question wants.', note:'"TWO reasons" means exactly two, both developed.'},
    {do:'Plan each paragraph as: reason, specific evidence, why it caused the outcome.', note:'The third part is the one students skip.'},
    {do:'Use named people, places and dates.', note:'"Some planters" is a low-band answer; "Uriah Butler in the oilfields in 1937" is not.'},
    {do:'Rank your reasons if the question invites judgement.', note:'"Most important" questions require you to actually choose.'},
    {do:'Conclude with a judgement, not a summary.', note:'Answer the question that was asked.'}
  ],
  worked:{
    problem:'Explain TWO reasons for the growth of the trade union movement in Trinidad after 1937.',
    lines:[
      {work:'Reason 1: the 1937 oilfield disturbances exposed working conditions.', note:'A specific event, correctly dated.'},
      {work:'Evidence: Uriah "Buzz" Butler led protests in the southern oilfields; the Forster Commission followed.', note:'Named leader, named consequence.'},
      {work:'Why it caused growth: official inquiry legitimised organised labour and made unions harder to suppress.', note:'The causal link, stated explicitly.'},
      {work:'Reason 2: wartime and post-war economic pressure on wages.', note:'A different kind of cause — economic, not political.'},
      {work:'Evidence and link, then a judgement on which mattered more.', note:'Ranking, because the essay is stronger for it.'}
    ]
  },
  pitfalls:[
    'Narrating events in order instead of explaining causes.',
    'Giving three reasons when two were asked for — the third earns nothing and costs time.',
    'Vague evidence with no names or dates.'
  ]
},

/* -------------------------------- PHYSICS -------------------------------- */
{
  id:'g-ph-formula', subj:'physics', strand:'ph-mech', level:8,
  title:'Any physics calculation — the five-line method',
  when:'Every numerical question in Paper 02. Use the same five lines every time.',
  steps:[
    {do:'List what you are given, with units.', note:'Convert to SI now: grams to kilograms, cm to m.'},
    {do:'Write the formula in symbols.', note:'This earns a mark on its own, even if the arithmetic fails.'},
    {do:'Rearrange BEFORE substituting.', note:'Algebra with letters is easier than algebra with decimals.'},
    {do:'Substitute the numbers.', note:'Show this line — it is a separate mark.'},
    {do:'State the answer with a unit and sensible significant figures.', note:'A number with no unit is not a physics answer.'}
  ],
  worked:{
    problem:'A 500 g trolley accelerates at 2.5 m/s². Find the resultant force.',
    lines:[
      {work:'Given: m = 500 g = 0.5 kg, a = 2.5 m/s²', note:'Converted to kilograms immediately.'},
      {work:'Formula: F = ma',                          note:'Symbols first.'},
      {work:'No rearrangement needed — F is the subject.', note:'Say so; do not skip the line silently.'},
      {work:'F = 0.5 × 2.5',                            note:'Substitution shown.'},
      {work:'F = 1.25 N',                               note:'Unit given. Newtons, because mass was in kg.'}
    ]
  },
  pitfalls:[
    'Leaving mass in grams, which makes the answer 1000 times too large.',
    'Substituting before rearranging, then wrestling with decimals.',
    'Omitting the unit, which loses a mark on almost every calculation.'
  ]
},

/* ------------------------------- CHEMISTRY ------------------------------- */
{
  id:'g-ch-balance', subj:'chemistry', strand:'ch-mole', level:8,
  title:'Balancing a chemical equation',
  when:'Any equation that must obey conservation of mass.',
  steps:[
    {do:'Write the correct formulae first, and never change them.', note:'You balance with big numbers in front, not by editing subscripts.'},
    {do:'Count each element on both sides.', note:'A small table stops you losing track.'},
    {do:'Balance metals first, then non-metals, then hydrogen, then oxygen.', note:'Oxygen last — it appears in the most places.'},
    {do:'Use fractions if it helps, then double everything.', note:'Perfectly legitimate as working.'},
    {do:'Recount every element at the end.', note:'One recount catches almost every error.'}
  ],
  worked:{
    problem:'Balance: CH₄ + O₂ → CO₂ + H₂O',
    lines:[
      {work:'C: 1 left, 1 right ✓',          note:'Carbon is already balanced.'},
      {work:'H: 4 left, 2 right → put 2 before H₂O', note:'CH₄ + O₂ → CO₂ + 2H₂O. Hydrogen now 4 and 4.'},
      {work:'O: 2 left, now 2 + 2 = 4 right', note:'The 2H₂O added two oxygens.'},
      {work:'Put 2 before O₂',                note:'CH₄ + 2O₂ → CO₂ + 2H₂O.'},
      {work:'Recount: C 1/1, H 4/4, O 4/4 ✓', note:'Balanced.'}
    ]
  },
  pitfalls:[
    'Changing a subscript, which changes the substance. H₂O is water; H₂O₂ is not.',
    'Balancing oxygen early and having to redo it.',
    'Forgetting to recount after the last change.'
  ]
},

/* -------------------------------- BIOLOGY -------------------------------- */
{
  id:'g-bi-punnett', subj:'biology', strand:'bi-genes', level:9,
  title:'Genetics — the Punnett square',
  when:'Any monohybrid cross asking for offspring ratios or probabilities.',
  steps:[
    {do:'Define your symbols.', note:'Capital for dominant, the same letter in lower case for recessive. State it.'},
    {do:'Write both parent genotypes.', note:'Read the wording carefully: "pure-breeding" means homozygous.'},
    {do:'Split each parent into its two gametes.', note:'One letter per gamete.'},
    {do:'Draw the 2×2 grid and fill it.', note:'Capital letter first in every box, by convention.'},
    {do:'Count the phenotypes and give the ratio.', note:'Answer in the form the question asked — ratio, fraction or percentage.'}
  ],
  worked:{
    problem:'A heterozygous tall pea plant is crossed with a short plant. T is dominant. Give the expected ratio.',
    lines:[
      {work:'Let T = tall (dominant), t = short (recessive)', note:'Symbols defined — this carries a mark.'},
      {work:'Parents: Tt × tt',                       note:'Heterozygous tall is Tt; short must be tt.'},
      {work:'Gametes: T, t   and   t, t',             note:'Each parent contributes one allele.'},
      {work:'Grid gives: Tt, Tt, tt, tt',             note:'Four boxes filled.'},
      {work:'2 tall : 2 short = 1 : 1, so 50% tall',  note:'Ratio simplified and the percentage stated.'}
    ]
  },
  pitfalls:[
    'Not defining the symbols, which loses a mark before you start.',
    'Confusing genotype (Tt) with phenotype (tall).',
    'Giving the ratio unsimplified when the question asked for simplest form.'
  ]
},

/* ------------------------------- GEOGRAPHY ------------------------------- */
{
  id:'g-ge-map', subj:'geography', strand:'ge-maps', level:7,
  title:'Map work — grid references, scale and relief',
  when:'The map extract question that opens most Geography papers.',
  steps:[
    {do:'Read EASTINGS then NORTHINGS.', note:'Along the corridor, up the stairs. Say it out loud.'},
    {do:'For a six-figure reference, estimate tenths within the square.', note:'Two extra digits, one for each axis.'},
    {do:'Measure distance with the paper edge, then read against the scale line.', note:'Mark the start and end on the edge of your answer sheet.'},
    {do:'Check the contour interval in the key before describing relief.', note:'Never assume it is 20 m.'},
    {do:'Close contours mean steep; wide spacing means gentle.', note:'Describe the shape and quote heights.'}
  ],
  worked:{
    problem:'Give the six-figure reference of a school in square 4152, and describe the slope to its east.',
    lines:[
      {work:'Easting 41, northing 52',        note:'The square itself.'},
      {work:'School lies about 6/10 across and 3/10 up', note:'Estimated within the square.'},
      {work:'Reference: 416523',              note:'Three digits east, three north.'},
      {work:'Contours east of it: 100 m, 120 m, 140 m close together', note:'Interval read from the key as 20 m.'},
      {work:'Description: a steep slope rising eastwards from 100 m to 140 m over a short distance.', note:'Shape, direction and heights all stated.'}
    ]
  },
  pitfalls:[
    'Reversing eastings and northings, which places you somewhere else entirely.',
    'Describing relief as "hilly" with no heights quoted.',
    'Using a ruler in centimetres without converting through the scale.'
  ]
},

/* ------------------------ INFORMATION TECHNOLOGY ------------------------ */
{
  id:'g-it-trace', subj:'information-technology', strand:'it-solve', level:9,
  title:'Trace tables — following an algorithm by hand',
  when:'"Complete the trace table" or "state the output" for a piece of pseudocode.',
  steps:[
    {do:'Draw one column per variable, plus one for output.', note:'Include the loop counter as a variable.'},
    {do:'Write the initial value of every variable.', note:'A blank cell is not the same as zero.'},
    {do:'Work one line at a time. Do not skip ahead.', note:'The whole point is that you do not predict.'},
    {do:'Add a new ROW each time any value changes.', note:'Never overwrite — the examiner wants the trail.'},
    {do:'Check the loop condition at the right moment.', note:'A WHILE tests before; a REPEAT tests after. That changes the count.'}
  ],
  worked:{
    problem:'total ← 0; count ← 1; WHILE count <= 3 DO total ← total + count; count ← count + 1; ENDWHILE; PRINT total',
    lines:[
      {work:'Start: total = 0, count = 1',         note:'Initial values recorded.'},
      {work:'count 1 ≤ 3 → total = 0 + 1 = 1, count = 2', note:'First pass. New row.'},
      {work:'count 2 ≤ 3 → total = 1 + 2 = 3, count = 3', note:'Second pass.'},
      {work:'count 3 ≤ 3 → total = 3 + 3 = 6, count = 4', note:'Third pass. The condition was still true at 3.'},
      {work:'count 4 > 3 → exit loop. Output: 6',  note:'The test failing is what ends it.'}
    ]
  },
  pitfalls:[
    'Overwriting values instead of adding rows, which loses the method marks.',
    'Running the loop one time too few because <= was read as <.',
    'Forgetting that the counter increments before the next test.'
  ]
}
];

/* ================= PRIMARY — worked methods for Standards 1 to 5 =================
 * Written to be read by a child, or read aloud to one. Same shape as the
 * secondary guides: when to use it, the order to work in, one fully worked
 * example with every line explained, and the mistakes that cost marks.
 */
window.CSEC_GUIDES.push(
{
  id:'g-pm-division', subj:'p-mathematics', strand:'pm-ops', level:4,
  title:'Long division, one step at a time',
  when:'Any sharing or dividing question where the number is too big to do in your head.',
  steps:[
    {do:'Write it out properly, with the bus stop.', note:'The big number goes inside, the one you are dividing by goes outside.'},
    {do:'Work from the LEFT, one digit at a time.', note:'This is the opposite of adding and subtracting, which start from the right.'},
    {do:'Ask: how many times does it go in?', note:'Write that number on top, directly above the digit you used.'},
    {do:'Multiply and take away to find what is left.', note:'Whatever is left over is carried to the next digit.'},
    {do:'Carry the remainder and repeat.', note:'Keep going until you run out of digits.'},
    {do:'Check by multiplying back.', note:'Answer × divisor should give you the number you started with.'}
  ],
  worked:{
    problem:'Work out 852 ÷ 6',
    lines:[
      {work:'6 into 8 goes 1, remainder 2', note:'Write 1 above the 8. Carry the 2 across to the next digit.'},
      {work:'The 2 carries, making 25', note:'The carried 2 goes in front of the 5.'},
      {work:'6 into 25 goes 4, remainder 1', note:'4 × 6 = 24, and 25 − 24 = 1. Write 4 above the 5.'},
      {work:'The 1 carries, making 12', note:'The carried 1 goes in front of the 2.'},
      {work:'6 into 12 goes 2, remainder 0', note:'Write 2 above the last digit. Nothing left over.'},
      {work:'Answer: 142.  Check: 142 × 6 = 852 ✓', note:'It comes back to where we started, so it is right.'}
    ]
  },
  pitfalls:[
    'Starting from the right. Division goes left to right.',
    'Forgetting to write a 0 on top when the divisor does not go in at all.',
    'Not carrying the remainder to the next digit.',
    'Never checking. One multiplication catches almost every mistake.'
  ]
},
{
  id:'g-pm-fractions', subj:'p-mathematics', strand:'pm-fractions', level:5,
  title:'Adding fractions when the bottoms are different',
  when:'Adding or subtracting two fractions whose bottom numbers do not match.',
  steps:[
    {do:'Look at the two bottom numbers.', note:'If they already match, just add the tops and stop.'},
    {do:'Find a number both bottoms go into.', note:'Often one bottom goes into the other. If not, multiply them together.'},
    {do:'Change each fraction so the bottoms match.', note:'Whatever you multiply the bottom by, multiply the top by the same.'},
    {do:'Now add or subtract ONLY the tops.', note:'The bottom stays as it is. This is the rule people break.'},
    {do:'Simplify if you can.', note:'Divide top and bottom by the same number until you cannot.'}
  ],
  worked:{
    problem:'Work out 2/3 + 1/4',
    lines:[
      {work:'Bottoms are 3 and 4 — they do not match', note:'So we cannot add yet.'},
      {work:'3 and 4 both go into 12', note:'12 is the smallest number they both divide into.'},
      {work:'2/3 becomes 8/12', note:'3 × 4 = 12, so the top is multiplied by 4 too: 2 × 4 = 8.'},
      {work:'1/4 becomes 3/12', note:'4 × 3 = 12, so 1 × 3 = 3.'},
      {work:'8/12 + 3/12 = 11/12', note:'Add only the tops. The bottom stays 12.'},
      {work:'11 and 12 share no factor, so 11/12 is the answer', note:'Nothing to simplify.'}
    ]
  },
  pitfalls:[
    'Adding the bottoms as well as the tops. 2/3 + 1/4 is not 3/7.',
    'Changing the bottom but forgetting to change the top by the same amount.',
    'Leaving the answer unsimplified when the question asks for simplest form.'
  ]
},
{
  id:'g-pm-area', subj:'p-mathematics', strand:'pm-area', level:4,
  title:'Perimeter or area? Knowing which one they want',
  when:'Any question about the distance around a shape or the space inside it.',
  steps:[
    {do:'Read the question and find the word.', note:'Around, fence, border, edge → perimeter. Cover, carpet, paint, surface → area.'},
    {do:'Check the units in the answer choices.', note:'Perimeter is in cm or m. Area is in cm² or m². This alone often tells you.'},
    {do:'For perimeter, add every side.', note:'For a rectangle you can do 2 × (length + width).'},
    {do:'For area of a rectangle, multiply length × width.', note:'For a square it is side × side.'},
    {do:'For an odd shape, cut it into rectangles.', note:'Find each area, then add them together.'},
    {do:'Write the correct unit.', note:'An area without the little ² can lose the mark.'}
  ],
  worked:{
    problem:'A garden is 9 m long and 6 m wide. Find (a) the fencing needed and (b) the grass needed.',
    lines:[
      {work:'(a) "Fencing" means around → perimeter', note:'The word tells you which one.'},
      {work:'2 × (9 + 6) = 2 × 15 = 30 m', note:'Thirty metres of fence. Unit is plain metres.'},
      {work:'(b) "Grass" means covering → area', note:'Covering the inside.'},
      {work:'9 × 6 = 54 m²', note:'Fifty-four square metres. Note the ² this time.'},
      {work:'Two different questions, two different answers', note:'Same shape, same numbers, completely different sums.'}
    ]
  },
  pitfalls:[
    'Multiplying when the question wanted adding, or the other way round.',
    'Writing cm when the answer is an area and should be cm².',
    'On a compound shape, forgetting one of the pieces.'
  ]
},
{
  id:'g-pm-percent', subj:'p-mathematics', strand:'pm-decimals', level:5,
  title:'Finding a percentage of an amount',
  when:'Discounts, VAT, test marks, or any question with a % sign in it.',
  steps:[
    {do:'Find 10% first — just divide by 10.', note:'Move the decimal point one place left. This is the easiest thing in the topic.'},
    {do:'Build the percentage you need from 10%.', note:'20% is double it. 5% is half it. 30% is three times it.'},
    {do:'For 50% halve it, for 25% halve it again.', note:'Half and quarter are quicker than going through 10%.'},
    {do:'If it is a discount, take it away.', note:'If it is VAT or a rise, add it on.'},
    {do:'Read the question again before writing the answer.', note:'Do they want the discount, or the new price?'}
  ],
  worked:{
    problem:'A bicycle costs TT$1 500. There is a 30% discount. What do you pay?',
    lines:[
      {work:'10% of 1 500 = 150', note:'Divide by 10. That is the whole trick.'},
      {work:'30% = 3 × 150 = 450', note:'Three lots of 10%.'},
      {work:'It is a discount, so take it off', note:'The price goes DOWN.'},
      {work:'1 500 − 450 = TT$1 050', note:'This is what you pay.'},
      {work:'Check: 1 050 is 70% of 1 500 ✓', note:'If 30% came off, 70% is left. 7 × 150 = 1 050.'}
    ]
  },
  pitfalls:[
    'Giving the discount (450) when the question asked for the price (1 050).',
    'Taking a percentage off and then adding the same percentage back, expecting the original. It does not return.',
    'Forgetting the dollar sign and the cents on money answers.'
  ]
},
{
  id:'g-pm-time', subj:'p-mathematics', strand:'pm-time', level:4,
  title:'Working out how long something takes',
  when:'Journey times, timetables, or any question giving a start and a finish.',
  steps:[
    {do:'Write down the start time and the finish time.', note:'Put them one under the other.'},
    {do:'Count up in whole hours first.', note:'Go as far as you can without passing the finish time.'},
    {do:'Then count the leftover minutes.', note:'From the last whole hour to the finish.'},
    {do:'Add the two parts together.', note:'That is your answer.'},
    {do:'Remember minutes stop at 59.', note:'Sixty minutes becomes one hour. Time does not work in tens.'}
  ],
  worked:{
    problem:'A journey starts at 10:40 a.m. and ends at 1:25 p.m. How long does it take?',
    lines:[
      {work:'10:40 → 11:40 → 12:40 → that is 2 hours', note:'Counting up in whole hours, stopping before we pass 1:25.'},
      {work:'12:40 → 1:25 is the leftover', note:'Now just the minutes.'},
      {work:'12:40 → 1:00 is 20 minutes', note:'Twenty minutes to reach the hour.'},
      {work:'1:00 → 1:25 is 25 minutes', note:'Then twenty-five more.'},
      {work:'20 + 25 = 45 minutes', note:'Adding the two parts of the leftover.'},
      {work:'Total: 2 hours 45 minutes', note:'Two whole hours plus forty-five minutes.'}
    ]
  },
  pitfalls:[
    'Subtracting like ordinary numbers: 1:25 − 10:40 does not work that way.',
    'Forgetting that the clock goes past 12 and starts again.',
    'Writing 2.45 instead of 2 hours 45 minutes. They are not the same.'
  ]
},
{
  id:'g-pel-comprehension', subj:'p-ela', strand:'pe-fiction', level:4,
  title:'Answering comprehension questions properly',
  when:'Any reading passage with questions after it.',
  steps:[
    {do:'Read the QUESTIONS first, quickly.', note:'Then you know what to look for while reading.'},
    {do:'Read the whole passage once, without stopping.', note:'Do not worry about words you do not know yet.'},
    {do:'Read it again with a pencil.', note:'Underline anything that looks like an answer.'},
    {do:'Answer in a full sentence, using the question’s words.', note:'"Why was Ria late?" → "Ria was late because..."'},
    {do:'Point to the evidence in the passage.', note:'Even when the question does not ask for it, it keeps you honest.'},
    {do:'Check you answered what was asked.', note:'Read your answer next to the question one last time.'}
  ],
  worked:{
    problem:'Question: "How do you know Ria was nervous?" The passage says: "Ria checked the gate three times and would not sit down."',
    lines:[
      {work:'The passage never says the word "nervous"', note:'So this is an inference question — you work it out.'},
      {work:'Find the clues: checking three times, not sitting', note:'These are things a nervous person does.'},
      {work:'Answer: "Ria was nervous because she checked the gate three times and would not sit down."', note:'Full sentence, uses the question’s word, includes the evidence.'},
      {work:'Not: "Because she was nervous."', note:'That repeats the question without proving anything.'},
      {work:'Not: "She checked the gate three times."', note:'That is evidence with no answer attached to it.'}
    ]
  },
  pitfalls:[
    'Answering in one word when the question needs a sentence.',
    'Copying a whole line from the passage without saying what it shows.',
    'Answering from your own head instead of from the passage.',
    'Running out of time because you read the passage three times before looking at the questions.'
  ]
},
{
  id:'g-pw-plan', subj:'p-ela-writing', strand:'pw-narrative', level:4,
  title:'Planning a story before you write it',
  when:'The SEA Writing paper, or any story you are asked to write.',
  steps:[
    {do:'Read all three items, then choose ONE.', note:'Pick the one you have most to say about, not the one that sounds nicest.'},
    {do:'Spend those first few minutes on a plan, and no more.', note:'Three boxes on the side of the page is enough.'},
    {do:'Box 1: how it starts.', note:'Who, where, and something already happening.'},
    {do:'Box 2: what goes wrong.', note:'Every story needs a problem. Without one nothing happens.'},
    {do:'Box 3: how it ends.', note:'Decide the ending BEFORE you start writing, so you do not run out.'},
    {do:'Now write, in paragraphs.', note:'New paragraph when the time, the place or the speaker changes.'},
    {do:'Leave the last two minutes to check.', note:'Capitals, full stops, and whether it actually ends.'}
  ],
  worked:{
    problem:'Item: "Write a story about a day when everything went wrong."',
    lines:[
      {work:'Box 1 — Start: I wake late, the yard is silent, no one called me', note:'Something is already wrong on the first line. No "one day I woke up".'},
      {work:'Box 2 — Problem: I miss the bus, and I am carrying the class project', note:'A clear problem with something at stake.'},
      {work:'Box 3 — Ending: I arrive as it finishes, but my teacher kept a seat', note:'Decided before writing, so the story lands instead of stopping.'},
      {work:'Opening line: "The yard was too quiet, and that was the first thing that was wrong."', note:'Starts inside the situation and raises a question.'},
      {work:'Four paragraphs: waking, the bus, the walk, arriving', note:'One paragraph per stage. The plan gave the shape.'}
    ]
  },
  pitfalls:[
    'Writing with no plan and running out of story halfway down the page.',
    'Ending with "and then I woke up and it was all a dream".',
    'One long block with no paragraphs — that loses organisation marks before a word is read.',
    'Spending a quarter of the paper planning. A few minutes is enough; the writing earns the marks.'
  ]
},
{
  id:'g-pw-check', subj:'p-ela-writing', strand:'pw-mechanics', level:5,
  title:'The two-minute check that finds free marks',
  when:'The last two minutes of any writing task, every single time.',
  steps:[
    {do:'Read it back in a whisper.', note:'Your ear catches what your eye slides past.'},
    {do:'Check every sentence starts with a capital.', note:'Go through with your finger. It is the cheapest mark on the paper.'},
    {do:'Check every sentence ends with a mark.', note:'Full stop, question mark or exclamation mark.'},
    {do:'Check names and places have capitals.', note:'Trinidad, Arima, Monday, Mummy when used as a name.'},
    {do:'Check you stayed in one tense.', note:'If you started in the past, stay in the past.'},
    {do:'Check the paragraphs are visible.', note:'The examiner should see them without looking for them.'}
  ],
  worked:{
    problem:'A pupil wrote: "i ran to the gate. the bus was leaving it drove off without me i was upset"',
    lines:[
      {work:'"i" should be "I" — always a capital', note:'The word I is always capital, anywhere in a sentence.'},
      {work:'"the bus" starts a sentence → "The bus"', note:'Capital after every full stop.'},
      {work:'"leaving it drove off" — two sentences run together', note:'Needs a full stop after "leaving".'},
      {work:'"without me i was upset" — same problem again', note:'Full stop after "me", then a capital I.'},
      {work:'Corrected: "I ran to the gate. The bus was leaving. It drove off without me. I was upset."', note:'Same words, four easy marks recovered.'}
    ]
  },
  pitfalls:[
    'Handing in the moment you finish writing. The last two minutes are worth more than the last two sentences.',
    'Checking silently. Reading aloud, even in a whisper, finds far more.',
    'Only checking spelling. Capitals and full stops are worth more and are easier to fix.'
  ]
}
);

/* ============ SEA CREATIVE WRITING — the fifty minutes that carry 40% ============
 * The SEA writing paper sets three topics and the child answers one, in fifty
 * minutes, on four criteria: Content, Language Use, Grammar and Mechanics, and
 * Organisation. Only Content is scored against the question. So a well-written
 * piece that answers a different topic takes nothing for Content and can still
 * take full marks on the other three, and that is the commonest way a capable
 * child loses marks here.
 *
 * Six of the fifteen topics on the papers we could read were letters and three
 * were reports, yet most practice at home is free story writing. These ten
 * methods cover the paper as it is actually set, in the order a child should
 * read them: how long it should be and how to spend the fifty minutes; reading
 * the topic before writing a word; the opening, the middle and the ending of a
 * story; showing instead of telling; punctuating speech; given sentences used
 * word for word; the letter; the report.
 *
 * They are one module, so they keep to one house style, and csec/tests/guides.js
 * holds them to it. One guide owns each fact: g-pw-shape alone states how the
 * fifty minutes are spent and how long each form runs (in paragraphs, never
 * lines); g-pw-topic alone explains the Content mark at length; g-pw-dialogue
 * alone teaches Creole in speech. One name for one thing: quotation marks, your
 * plan page, your list, the examiner, the Topic No. box. Mr. and Mrs. take a
 * full stop; the roofing sheet is galvanize. Every letter heading is punctuated
 * the same way, and the sign-off follows the greeting: a name gets Yours
 * sincerely, Dear Sir gets Yours faithfully. No guide prices a mark — never
 * "costs you a mark", never "half the Content mark" — because the rubric does
 * not, and a child copies a worked example letter for letter, so every model
 * sentence has to be correct Standard English. Edit with those in mind, and run
 * the suite.
 */
window.CSEC_GUIDES.push(
{
  id:'g-pw-shape', subj:'p-ela-writing', strand:'pw-organise', level:5,
  title:'How long it should be, and how to spend the fifty minutes',
  when:'Use this twice: at the very start, to set your clock and count your paragraphs before you write a word, and again in the middle of the paper, when you cannot tell whether you are behind.',
  steps:[
    {do:'The moment you turn the paper over, write the clock at the head of your plan page: about five minutes reading and planning, about forty minutes writing, the last five reading back. The last two of those five are the check.', note:'The paper is fifty minutes long and you answer one of the three topics. Nobody in the hall will tell you when to stop planning or when to stop writing, so the only clock you can obey is the one you wrote down. Write the real times beside it as well, the time you must be writing by and the time you must put the pen down, because in the middle of a page it is easier to read a time than to count minutes.'},
    {do:'Spend the first five minutes on three things only: read all three topics, choose one and write your list down your plan page. Then fill in the Topic No. box.', note:'All three printed topics are the same kind of writing, so you still have to check the form of the one you chose, because a letter and a report are both the second kind. Those five minutes are not writing time borrowed; they are what makes the forty minutes straight. The jobs on your list are what the Content mark is given for, and the topic guide explains that mark in full.'},
    {do:'Before your first sentence, count the paragraphs your answer will have and write that number at the top of your plan page. Count in paragraphs, never in lines.', note:'A paragraph is a few sentences that do one job, usually three or four. A story runs to about five or six paragraphs: an opening, three or four in the middle, and an ending. A letter has the heading and the greeting, then about four paragraphs of its own, and then the sign-off and your name. A report has its heading, one short paragraph saying why you are writing, then each bullet answered under its own small heading in one or two paragraphs, and a short last paragraph with one suggestion and your name. Knowing the number is what lets you tell, halfway down the page, whether you are behind.'},
    {do:'Number those paragraphs down the margin of your plan page and cross each number off as its paragraph is finished.', note:'Your hand cannot feel time passing, but it can see four numbers crossed off and two left. This is also the only way to catch the commonest fault in the paper, which is three paragraphs spent on the first thing that happens and none left for the last.'},
    {do:'At the halfway point of your writing time, look at the margin. Half the time gone should mean about half the paragraphs crossed off.', note:'Twenty minutes of writing and two paragraphs of six crossed off tells you, while you can still do something about it, that you are writing too much for the time you have. Twenty minutes and five of six crossed off tells you the opposite: you have room, so give the paragraphs still to come their full work rather than adding a new event the topic never asked about.'},
    {do:'If you are behind, take the time out of the middle. Make the paragraphs still to come plainer and shorter, and join two of them into one.', note:'Plain sentences in the middle still answer the question; a missing end does not. Cut the description, the second example and the third thing somebody says, not the jobs themselves. Two stages of a story told in one paragraph, or two bullets answered in one honest paragraph each, costs you far less than a page that stops before it finishes.'},
    {do:'Never buy time by cutting the end. The ending of a story, the sign-off and your name on a letter, and the last bullet of a report all stay, whatever the clock says.', note:'Those are the parts the examiner reaches last and the parts the topic was most clearly asking for. A report that never says what followed has left a piece of the question unanswered. A letter that stops without Yours sincerely, and a name is not finished writing, however good the paragraph above it is.'},
    {do:'When five minutes are left, stop writing where you are, close the event or the job you are in with one sentence, and write the ending you planned.', note:'A short ending written on purpose reads as a choice. A page that stops in the middle of an event because the bell went reads as a child who ran out of paper and time, and the shape of the whole piece goes with it: there is no end for the reader to arrive at. One sentence is enough to close what you are in. Say how it came out, and go to the end you planned in your five minutes.'},
    {do:'Give the last five minutes to reading back, and nothing else. The last two of them are the check, which has its own guide.', note:'Reading back is where a dropped word, a missing full stop and a greeting that does not agree with its sign-off are found, and they are found with your eyes, not with your pen. If you use this time to write one more paragraph, you have traded the whole of your reading-back for a few more sentences nobody has checked.'}
  ],
  worked:{
    problem:'The hall clock says nine o\'clock and the paper has just been turned over. Fifty minutes, three topics, one answer. This is everything written in the paper that is not the answer itself, in the order it was written: the clock, the plan page and the two decisions made with them. The three topics on this paper are all of the letter-and-report kind, and the one chosen, topic 2, is a report.',
    lines:[
      {work:'At the head of my plan page:\n\n5 read and plan\n40 write\n5 read back (last 2 = the check)\n\nwriting by 9:05\npen down 9:45\ncheck 9:48', note:'Written before I read a single topic. The three times on the right are the ones I will actually look at, because in the middle of a paragraph I can read a clock but I cannot count minutes.'},
      {work:'9:00 to 9:04. All three topics read, every one of them. Topic 1 is a letter and topic 2 is a report, so they are the same kind of writing and I still have to look at the form of the one I want. I choose topic 2, the report.', note:'Reading all three costs me under two minutes and it is the only way to know which I can answer best. A letter at topic 1 is no reason to stop reading.'},
      {work:'Topic No. 2', note:'Filled in on the booklet while I am still planning, not left for the end. The examiner has to know which topic to read my writing against.'},
      {work:'My list, down the plan page:\n1. date / time / place\n2. who was involved and what happened\n3. what followed', note:'The three bullets from the topic, in the topic\'s own order. This is the question, and it is what my paragraphs have to cover.'},
      {work:'Paragraphs: 6 (7 if one bullet needs two)\n1 heading (title, To:, From:, Date:)\n2 why I am writing\n3 bullet one, under its own small heading\n4 bullet two, under its own small heading\n5 bullet three, under its own small heading\n6 one suggestion, then my name', note:'Counted before my first sentence, and written where I can see it. Six paragraphs for forty minutes tells me about six or seven minutes each, so I know at once that one of them cannot have fifteen.'},
      {work:'If my three topics had been stories, the plan page would read: Paragraphs: 5 — 1 opening, 2, 3 and 4 the middle, 5 the ending. If topic 2 had been a letter: heading and Dear Sir, then 4 paragraphs — why I am writing, two jobs, a short close — then Yours faithfully, and my name.', note:'The same count made in the same minute, for the other two forms. A letter with no name given takes Dear Sir, and so it must end Yours faithfully, and the two ends have to agree.'},
      {work:'9:25. Paragraph 4 is where my pencil is. Numbers 1, 2 and 3 are crossed off in the margin.', note:'Half my writing time gone and about half my paragraphs done. Nothing to change. I write the time small in the margin so that I can see at a glance, later, how fast I was going.'},
      {work:'9:33, and I am still inside paragraph 3 of 6. Two decisions, written in the margin: paragraph 5 gets three plain sentences, not eight, and the suggestion in paragraph 6 becomes one sentence. No bullet is cut.', note:'This is what being behind looks like, caught while I can still do something about it. I take the time out of how fully I write, never out of what the topic asked for, because each bullet is a piece of the question.'},
      {work:'9:45. I had more to say about the last bullet. I stopped anyway, closed that paragraph with one sentence, and wrote the last paragraph I had planned: one sentence of suggestion, then a closing line. Then my name and my class underneath.', note:'A short last paragraph written on purpose. Had I kept writing about that bullet until the bell, my report would have stopped in the middle of it, with no suggestion and no name, and that is the part being read last.'},
      {work:'9:45 to 9:50: pen down on new writing. I read the whole report through once, slowly, and gave the last two minutes to the check.', note:'Five quiet minutes, and no new paragraph however short the page looks. The check itself is a job of its own and it has its own guide.'}
    ]
  },
  pitfalls:[
    'Spending the planning minutes on one beautiful first sentence, writing it and rubbing it out twice, so that the plan page is still blank when the writing time has already started. A first sentence can be improved later; a missing plan cannot be made up.',
    'A long run-up: three paragraphs before anything happens, or half a page describing the morning before the topic\'s first job is touched. The paper fills at the same speed whatever you put in it, and whatever is at the front pushes the end off.',
    'Making up lost time by dropping the very things that have to be there: the ending of a story, Yours sincerely, and your name on a letter, the last bullet of a report. Take it out of the detail in the middle instead.',
    'Starting over. Crossing out what you have written at twenty past and choosing a different topic leaves you with half the time, no plan and nothing to pace.',
    'Judging your length by how full the page looks, and squeezing a brand-new event in after the ending is already written. The reader then meets two endings, and the second one undoes the first. Length is counted in paragraphs, and you counted yours before you began.',
    'Writing on into the last five minutes because the hand is going well, so the paper is never read back once. Grammar and Mechanics is given for the writing itself, and a dropped word or a missing full stop is only ever found by reading.',
    'A letter or a report with every job crammed into one block: the heading, the greeting and the sign-off all correct, and nothing between them broken into paragraphs. The paragraphs you counted are the shape; use them.'
  ]
},
{
  id:'g-pw-topic', subj:'p-ela-writing', strand:'pw-organise', level:5,
  title:'Read the topic before you write',
  when:'Use it in those first few minutes in the hall, before you write one sentence of your answer.',
  steps:[
    {do:'Write the topic number in the Topic No. box. Do that first, before the plan and before the writing.', note:'The examiner has to know which of the three topics to mark you against, and the Topic No. box is where they look. Three seconds now, while you are still calm; once you are inside a story you forget the box exists.'},
    {do:'Read all three topics once. Then go back over all three with your pencil and underline the words that tell you to do something — tell, describe, suggest, write a report, use these words. Only after that, pick the one you will answer.', note:'The first read tells you what each topic is about. The underlining tells you what each one is asking you for, and those are two different things. Pick first, and you can land on the topic that wants two jobs and a sentence copied word for word. The one beside it may have wanted only the thing you had plenty to say about. All three topics on the paper are the same kind of writing — three stories, or three of the letter-and-report kind — but a letter and a report are both that second kind, so even after you have read all three you still have to check the form of the one you chose.'},
    {do:'On your plan page, copy out everything the topic hands you, one thing to a line: the form (a story; or a letter, which wants your address, the date, a greeting and a closing; or a report, which wants a To, From and Date heading), who it is written to, any person it names, the place it names, each job it gives you, and any small detail it planted. A sentence inside quotation marks goes down word for word.', note:'One thing to a line means you can count them. Six lines means six things that have to appear in your answer, and your eye cannot skip a line the way it skips a word in the middle of a long sentence. The list is your plan-page minute, and it is the best-spent minute of the paper.'},
    {do:'Count the lines that are jobs — the things the topic is actually asking you to do — and write that number at the top of your plan page.', note:'Topics often hand you two jobs at once: your concerns and your suggestions; thank the person and say how the equipment will be used. Content is the one of the four things marked that is given for answering the question, and its highest mark goes to writing that is a real response to the topic; Language Use, Organisation, and Grammar and Mechanics are given for the writing itself, whatever it happens to be about. So an answer that does one job and leaves the other out is not finished, however nicely it reads.'},
    {do:'Beside each line on the list write start, middle or end.', note:'Your plan is now built out of the topic itself. The order comes from the question, not from a shape you already knew, so nothing is left waiting for a paragraph that never comes. If you counted two jobs, you can see straight away that your middle has two halves.'},
    {do:'If you have a plan you know well from class, keep it, but bend it until every line on your list is used: change the opening sentence, change the place, change the people. The three boxes you may have learnt — start, what goes wrong, how it ends — are a story plan, so use them only once your list says this topic wants a story.', note:'A practised plan saves real thinking time. It turns against you only when it stays exactly as you learnt it and answers last year\'s question instead of this one. Six of the fifteen topics we could read were letters and three were reports, so a story shape does not fit nine of the fifteen at all.'},
    {do:'Write your answer with the list beside you, and tick each line the moment you have used it.', note:'Ticking as you go stops you reaching your last paragraph and finding a whole job untouched. Halfway down your second page you can still put it in; at the bell you cannot.'},
    {do:'Before you finish, go back to the list: read it line by line and find each ticked thing in what you have written, then look at the Topic No. box and see the number sitting there. Then give it the two-minute check.', note:'That pass is checking the topic, not checking the writing. Content is the mark given for answering the question, and nothing else in your answer can stand in for it: a letter that reads beautifully and does one of its two jobs is still a letter that did one of its two jobs.'}
  ],
  worked:{
    problem:'Topic 2. Write a letter to your Member of Parliament about the savannah in your neighbourhood. Tell him about your concerns and give him some suggestions for making it a better place for the children of the community.',
    lines:[
      {work:'In the Topic No. box: 2', note:'The first thing written on the paper, before the plan. Now the examiner knows it is Topic 2 they are marking me against, and does not have to work it out from my first paragraph.'},
      {work:'On the plan page, one thing to a line:\nForm: a LETTER, not a story\nTo: my M.P. (the topic does not name him, so I will call him Mr. Ramkissoon)\nPlace: the savannah in MY neighbourhood\nJob 1: my concerns\nJob 2: my suggestions\nFor whom: the children of the community', note:'Six lines, and everything on them came off the paper — except the name, which I have marked as mine, so that I never mistake something I made up for something the topic planted. A story about an old abandoned house would answer none of the six lines, however well it was written.'},
      {work:'At the top of the plan page: 2 jobs — concerns, suggestions\nMy class letter plan: why I am writing, what is wrong, what I want, thank you. I keep it, but I bend it to this list.', note:'I count before I plan the order, because the number of jobs is what decides the shape. Count after you have written, and the counting comes too late to be any use. The plan from class still helps me, but only once it has been bent: what is wrong becomes my concerns, what I want becomes my suggestions, and the savannah and the children of the community go into parts of it that last year\'s plan never had.'},
      {work:'Beside each line:\nTo: my M.P. → start (my address, the date, Dear Mr. Ramkissoon)\nPlace: the savannah → start, in the first paragraph\nJob 1: concerns → middle, first half\nJob 2: suggestions → middle, second half\nFor whom: the children → in the suggestions, and again at the end\nForm: letter → my address and the date, none for him; Yours sincerely at the foot', note:'The plan is made out of the topic now. Every line has somewhere to stand, so no job is left for a paragraph I never get to write. The two ends of a letter have to agree: I have given him a name and written Dear Mr. Ramkissoon, so I close with Yours sincerely. Had the topic given me no name and I had written Dear Sir, it would be Yours faithfully. My own address and the date go at the top; I do not need his.'},
      {work:'14 Pump Trace,\nSangre Grande.\n20th March, 2026.\n\nDear Mr. Ramkissoon,\n\nI am a pupil in Standard Five and I live two streets away from the Guaico savannah. I am writing to tell you what has happened to our savannah, and to give you some suggestions for making it a good place for the children here again.', note:'The heading, the greeting, the person, the place and both jobs are all there before the letter has properly begun, so four lines of my list are ticked already. The address takes a comma after each line and a full stop after the last, and the date sits on its own line with a full stop.'},
      {work:'When I was in Infants, the grass was cut so low that you could see the whole field from the road. Now it reaches my knees. Last Saturday my little brother ran in after a ball and came out with a cut on his heel from a broken bottle.', note:'Job 1 has started, and it is about the savannah and nothing else. I did not write that the savannah is in a bad condition; I wrote what cut his heel.'},
      {work:'Somebody has dumped a sheet of old galvanize behind the goalpost, and the water that sits in it smells like a stale drain. By six o\'clock the mosquitoes come out of it and nobody can stay. The pavilion steps are cracked, and there is no light at all once the sun goes down.\n\n(plan page, pencil, now: ✓ concerns)', note:'Still Job 1. Three concerns, each one a thing a person could walk up to and see. Then I tick the concerns line and stop, because the list says the second half of the middle belongs to Job 2. Galvanize is the ordinary name for that roofing sheet here, so it is the right word for the thing in a letter — it is a name, not loose speech, and there is no speech in this letter at all.'},
      {work:'I have three suggestions. First, could the grass be cut once a month, as it was before? Second, could the galvanize and the bottles be carried away, and a garbage bin be put at the gate so that people stop dumping there? Third, if one light could be put on the pavilion, the children could play until seven o\'clock and their parents would be able to see them from the road.', note:'This is Job 2. The topic asked for suggestions, so I gave more than one and numbered them, and every one of them comes back to the children of the community, which was the last line on my list.'},
      {work:'If these few things were done, the children of Guaico would have somewhere safe to play, and I believe the whole community would take better care of the savannah.\n\nYours sincerely,\nAnisa Mohammed', note:'The end does the last line of the list one more time. The closing and the signature finish the form, which was line one, and the closing is the one that matches Dear Mr. Ramkissoon.'},
      {work:'Back to the plan page: ✓ letter ✓ M.P. ✓ my savannah ✓ concerns ✓ suggestions ✓ the children — then one look at the Topic No. box: 2, still there.', note:'Six lines, six ticks, each one found in the letter and not just remembered. A tick I cannot find in the writing is a job I only meant to do.'}
    ]
  },
  pitfalls:[
    'A Topic No. box still carrying the number of the topic you began and then walked away from. If you change topics halfway, change the box in the same breath.',
    'Letting the first job eat the paper. A page and a half of concerns and two lines of suggestions is not two jobs done, and it is often the second job that suffers, because that is the one you reach when your hand is tired.',
    'Writing a story when the topic asked for a letter or a report. Six of the fifteen topics we could read were letters and three were reports. "Once upon a Friday afternoon" is neither of them, and good writing will not turn it into one.',
    'Rewriting a sentence the topic gave you inside quotation marks. Two of the fifteen topics we could read handed over words that had to be used exactly as printed: "I stood still and stared. Were my eyes deceiving me? I looked again. I wasn\'t dreaming." Same words, same order, every full stop and every question mark. Copy it onto your plan page first so that you are never writing it from memory.',
    'Letting a planted detail slip away, or swapping it for one of your own. If the topic says the parcel was left at your gate on a Sunday morning, it cannot reach you at school on Monday. If it says the savannah in your neighbourhood, it cannot turn into a savannah you saw on television. Four of the fifteen topics we could read were stories that fixed details like these.',
    'The learnt piece that nearly fits. The opening you memorised names a different place and a different person, it sounds lovely, so you keep it — and now your letter is about a beach when the topic was about a savannah. You will know it has happened because a line on your list has no tick beside it.',
    'Ending a letter in a way that does not match how you began it. Whether the topic gives you the person\'s name decides both ends: Dear Mr. Ramkissoon goes with Yours sincerely at the foot, and Dear Sir, where no name was given, goes with Yours faithfully. Read your greeting again before you write your closing.'
  ]
},
{
  id:'g-pw-opening', subj:'p-ela-writing', strand:'pw-narrative', level:5,
  title:'Write an opening that could only belong to your topic',
  when:'Use this when the three topics on your paper are stories and you have chosen one of them. All three topics on one paper are the same kind of writing — three stories, or three of the letter-and-report kind, never a mix — so a story at topic 1 is no reason to leave topics 2 and 3 unread: read all three, then look again at the form of the one you chose. Of the fifteen topics we could read across the papers, six were letters, three were reports with instructions set out in bullets, four were stories that still settled details you had to keep, and two handed you sentences to use word for word. If your three are letters or reports, opening them is a different job, so use the guide for letters or the one for reports instead of this one. This is not a stage of its own: it is the first part of your plan done properly, in those first few minutes, before the writing itself. The read-back at the end has its own guide.',
  steps:[
    {do:'Read your chosen topic twice. Underline every person, place, thing and time it names, and anything it says you must do. Write them down your plan page: that is your list.', note:'Content is the one of the four marked things that is given for answering the question you chose, so your list is what your opening has to show. Keep it short enough to read in one glance, because you will look at it again at the end.'},
    {do:'Write the number of your topic in the Topic No. box before you write any of the story.', note:'The examiner has three topics in front of them and has to know which one to mark you against. That box is where they look. Do it while you are still looking at the topic, because once the story starts you will forget it is there.'},
    {do:'Look at whether the topic hands you sentences to use. If it does, copy them exactly as they are printed, in the same order, and put them where the topic says to put them. Then go on from the proof step below.', note:'Two of the fifteen topics we could read did this, and there is a guide for that kind of topic on its own. Those sentences are not yours to improve: not a word, not a comma. Your own writing starts underneath them, so the proof step and the three-sentence stop are about your sentences, not the printed ones. The last step, bending the opening your class taught you, is not for you at all: your opening was decided for you.'},
    {do:'Find the part of the topic that says what happens, and start one breath before it.', note:'That is how you find your moment instead of guessing at it. In the old-lady topic below, the part that says what happens is "she invites you into her house". One breath before that is you standing at her gate with her mouth open to call you.'},
    {do:'On your plan page, write three different first sentences: (1) action, where somebody moves or something happens; (2) speech, one thing somebody says, inside quotation marks; (3) one sharp detail, one thing you can see, hear, smell or touch.', note:'Three quick tries mean you keep the best of them instead of being stuck with the first thing that came into your head. All three make you begin inside the topic, because you have to use the topic\'s own people, place and things to write any of them.'},
    {do:'If you choose the sharp detail, name one real thing and say what it smelt like, sounded like, or felt like under your hand.', note:'"Add description" is not something your pen can do. "Say what the air smelt like" is. One smell in the first three sentences does more for you than a paragraph of nice words later on.'},
    {do:'Put one of the words on your list into your first sentence.', note:'That word is your proof. From the first sentence the examiner can see that this is an answer to this topic and not a story you brought in with you. If it will not fit the first sentence, get it into the second, but the first is better.'},
    {do:'Stop your own opening after three sentences and go straight into what happened.', note:'Count them on your fingers: one, two, three. The fourth sentence has to move the story along. Sentences the topic handed you are not part of the three; the three are the ones you wrote yourself.'},
    {do:'Do the cover test. Put your hand over the topic, read your three sentences, and ask yourself whether they could sit on top of anybody else\'s story. If they could, write them again.', note:'An opening that fits every topic shows nothing about yours. If the topic handed you its own sentences, run this test on the sentence you added after them, not on the ones every child in the hall was given.'},
    {do:'If your class taught you an opening you like, keep its shape and change its words so they belong to this topic.', note:'The opening your class taught you is worth having and you were right to learn it. It stops working for you when it arrives word for word, because the examiner may read the same line a hundred times in one day. Bend it to the topic and it is yours again.'}
  ],
  worked:{
    problem:'Here is the kind of story topic that settles details for you. It is an example to work on, not a topic from a real paper: "An old lady lives alone with her dogs in your neighbourhood. One day she invites you into her house. Write a story about what happened." On the paper in front of me it is the second of the three topics, and all three are stories.',
    lines:[
      {work:'My list, written down my plan page: old lady — lives alone — her dogs — invites you into her house — what happened.', note:'Five things I have to keep. If I give her a husband, leave the dogs out, or meet her in the road instead of going inside, my story answers a question the paper did not set, however well the rest of it is written.'},
      {work:'Topic No. box: 2', note:'Filled in while I am still looking at the topic. I read all three before I chose, and this box is the only thing telling the examiner which one I am answering.'},
      {work:'The part that says what happens: "she invites you into her house". One breath before it: I am at her gate and she is opening her mouth to call me. That is sentence one. Not me waking up. Not me walking the whole road.', note:'The topic put me at her house, so that is where the story starts. I did not have to decide that; I found it in the topic.'},
      {work:'Three tries on my plan page.\nAction: The gate scraped open and two dogs came down the steps at me.\nSpeech: "Come, come. Don\'t mind them dogs, they only barking," Miss Lucille said.\nDetail: Miss Lucille\'s gate was tied shut with a piece of wire, and behind it two brown dogs stood still and watched me.', note:'Honestly: the speech try has Miss Lucille and the dogs, the detail try has her name and the dogs, and the action try has only the dogs. Not one of the three has her house in it yet. I pick the speech try, because it also gets her inviting me in.'},
      {work:'"Come, come. Don\'t mind them dogs, they only barking," Miss Lucille said. She was holding her gate open with one hand and an enamel cup in the other. Two brown dogs pushed past her legs and smelt my school shoes.', note:'Three sentences, and "dogs" from my list is in the first one. The words inside the quotation marks are the way Miss Lucille really talks; every sentence outside them is Standard English, and punctuating that speech has a guide of its own. The enamel cup is mine; nobody else in the hall will have it.'},
      {work:'Hand over the topic. Read: "Come, come. Don\'t mind them dogs, they only barking," Miss Lucille said. Could that sit on top of a story about Carnival, sports day or a flood? No. It could only be this one.', note:'That is the cover test passed, so I stop working on the opening and start the story.'},
      {work:'Fourth sentence: I stepped over the drain and followed her inside.', note:'Through the door by the fourth sentence. A half-page gate has not got the story started, and the topic says the story happens inside her house.'},
      {work:'My class opening was "On that Friday afternoon...". I keep the shape and change the words: It was a Friday afternoon, and for the first time Miss Lucille\'s gate was standing open.', note:'Same safe rhythm, but now it belongs to this topic. "Gate" is not on my list, so with this opening I would have to get "dogs" or "old lady" into the second sentence.'},
      {work:'If this topic had instead said: Begin your story with these words — "I stood still and stared. Were my eyes deceiving me? I looked again. I wasn\'t dreaming." — then those four sentences are my first four, copied exactly, and my own sentence one starts under them.', note:'Nothing in them is mine to change, and they do not count against my three. My own first sentence still has to carry a word from my list, because every child in the hall was handed those same four.'}
    ]
  },
  pitfalls:[
    'Starting so far back that the page runs out before the topic\'s own moment arrives: the bell, packing the bag, the whole walk home — and the old lady never gets to open her gate.',
    'Quietly dropping one of the topic\'s settled details because the story comes easier without it: no dogs, or a daughter living with her, or the two of you talking at the shop instead of inside her house. The topic settled those for you.',
    'An opening that could sit on top of anybody\'s story: the bright sunny morning with the birds singing, the alarm clock going off, "It was a day like any other day."',
    'Telling the whole story in the first sentence — "That was the day I made friends with the old lady and her dogs" — so there is nothing left for the reader to find out.',
    'Announcing the story instead of starting it: "In this story I am going to tell you about..." or "Hello, my name is...". Stand inside the story, not outside it talking about it.',
    'A speech opening where nobody knows who is talking. Name the speaker in the same sentence or in the very next one.',
    'Going back to redo the opening when the story is half written, crossing out and squeezing in new lines, so the page is a mess and there is no time left for the ending.'
  ]
},
{
  id:'g-pw-middle', subj:'p-ela-writing', strand:'pw-organise', level:5,
  title:'Building the middle, one paragraph at a time',
  when:'Reach for this once your opening is down and you have to get from there to your ending. The middle is nearly all of what you write, so it is where most of the marks sit. Use it on a story. Read all three printed topics before you choose: all three on one paper are the same kind of writing, either three stories or three of the letter-and-report kind, and because a letter and a report are both that second kind, you still have to check the form of the one you chose.',
  steps:[
    {do:'Before you write the next sentence, go back to your plan page. Under your list, write the stages of the middle, one short line each — four or five of them — the things that have to happen between the opening you have written and the ending you are heading for.', note:'You decide the order now, while you are still calm, instead of deciding it with the pen already moving. A middle chosen sentence by sentence turns into one long paragraph about the same moment, because the easiest thing to write next is always more of what you just wrote.'},
    {do:'Give one paragraph to one stage. As each paragraph is finished, put its number in the margin of your plan page.', note:'One paragraph to a stage means your story has a shape the examiner can see at a glance, before a single sentence is read. The numbers in the margin also tell you how far you have come and how much is still owed, which no amount of reading back over your own sentences will tell you.'},
    {do:'Start each paragraph with the sentence that says what has changed. Put the look, the sound and the smell of the place after that sentence, never instead of it.', note:'The first sentence of a paragraph is where a reader asks "what now?". Answer it and the story moves; describe the room again and the story stands still for the whole paragraph. Showing a feeling rather than naming it has a guide of its own, and one picture to a paragraph is plenty here.'},
    {do:'Before you keep a stage, ask yourself what is different now: the place, the time, who is there, or how much trouble you are in. If you cannot answer, cross that line off your plan page.', note:'That one question is the whole test of a middle. It catches the beautiful paragraph that moves nothing — the rain on the galvanize, described again — while it is still only a line on your plan page and costs you nothing to lose.'},
    {do:'Raise the trouble before you solve it. Nothing that helps — a parent, a neighbour, a telephone call, the rain stopping — may arrive until the worst stage has been written.', note:'Everything after the help is tidying up, so help that comes early leaves you with a middle that has nothing left to raise. Write the worst stage, then let the help in, and the help is worth reading about.'},
    {do:'Start a new paragraph the moment the place changes, the time jumps forward, or a new person comes into the scene.', note:'Those three are the breaks a reader is already expecting, so they land without you having to explain them. They also stop two stages from running into each other on the page, which is the commonest way a reader loses track of where you are standing.'},
    {do:'Keep your list beside you and tick each job the moment a paragraph has done it. Halfway through your stages, stop and read the list — not your sentences.', note:'Content is the one of the four marked things given for answering the question you chose, and the middle is where a job gets quietly dropped: the writing is going well, so you follow the part you are enjoying. Your own sentences cannot show you a job you never wrote. Only the list can, and halfway down there is still room to put it in.'},
    {do:'If a paragraph starts saying the same thing a second way, stop it there and start the next stage.', note:'A paragraph is finished when its stage is finished, not when the lines look long enough. Two more sentences about water you have already described are two sentences the stage after this one needed.'},
    {do:'When your worst stage is written and every job on your list is ticked, stop the middle and begin your ending as a new paragraph.', note:'An ending tucked into the last three lines of a middle paragraph reads as though you ran out of page. Writing the ending itself has its own guide, and so does reading the whole thing back at the end.'}
  ],
  worked:{
    problem:'A practice story topic, written the way the papers write them. On the paper it is Topic 3, and all three topics are stories. I am Darren Mohan and the flood in it is our own street in Penal, so the place is mine and I know it. My opening is already down: the water in the yard, level with the second step, and my mother standing in the doorway watching it.\n\nTopic 3\nRain fell heavily for three days. Write a story about the day the water came into your home. Say what your family did and how the neighbours helped.',
    lines:[
      {work:'My list, down my plan page: three days of rain — the water came into my home — what my family did — how the neighbours helped.', note:'Four things. The last two are jobs: the topic is asking for them, and Content is the mark for answering the question, so each one needs paragraphs in my middle and not a clause near the end.'},
      {work:'Stages, down the side of my plan page:\n1 the water comes under the front door\n2 lifting everything we can lift\n3 the current gone, the water at the beds\n4 the neighbours come up the street with a pirogue', note:'Four lines, so four paragraphs between my opening and my ending. I wrote them before I wrote a sentence of the middle, so the order is decided and my pen only has to get there.'},
      {work:'A line I crossed off: the rain still falling on the galvanize. Before it, rain on the roof. After it, rain on the roof. Nothing is different, so it was never a stage. The rain goes inside stage 3, in one sentence.', note:'That paragraph would have been the nicest writing on my page and it would still have moved nothing. A middle built of them reaches the bell with the neighbours never arriving.'},
      {work:'By seven o\'clock the water was coming under the front door in a brown line. My mother told me to take the school bags off the floor, and I put them on top of the wardrobe. My father pushed a rolled towel against the door, but the water came in around it.', note:'Stage 1, one paragraph. It opens on the thing that changed — the water moving — and not on how the room looked. Two of my list\'s lines have started: what came in, and what my family did.'},
      {work:'In the bedroom my father lifted one end of the bed and I lifted the other, and we stood its legs on four blocks. We put the stove up on the table. My grandmother sat on a chair with her feet drawn up and held the biscuit tin on her lap, because nobody could find anywhere dry to put it.', note:'New paragraph, because we have moved into the bedroom. A change of place, a jump in time or a new person in the scene is a new paragraph, and the tin on her lap is the one picture this stage needs.'},
      {work:'Test on stage 2. Before it, the water is at my ankles in the front room. After it, the bed and the stove are up on blocks and the water is at my knees. Something is different, so it stays.', note:'I run that question on every stage as I finish it. It is quicker than reading the paragraph back, and it is the only thing that tells me whether the story went anywhere.'},
      {work:'At about ten o\'clock the current went off and the house went dark. The water was over the blocks by then, and one corner of the mattress was wet. My grandmother could not walk far on her own, and the water in the passage was above her knees. For the first time that night my mother did not say anything.', note:'Stage 3, and it is the worst one. No help has come yet. If a neighbour had arrived back in stage 2, this paragraph would have had nothing left to raise and the rest of the page would have been tidying up.'},
      {work:'Then we heard men shouting in the road, and a light swung across the window. Two neighbours from the corner had brought a pirogue up the street. One of them carried my grandmother out through the passage, and the other handed our bags and the biscuit tin down to me in the boat.', note:'Stage 4, and the third job ticked with a paragraph of its own. There is a real corner in Penal behind that sentence, which is why I can see the light swing across the window. The trouble was at its worst in the paragraph before, so what the neighbours did means something when they do it.'},
      {work:'I stop and read my plan page, not my sentences: three days of rain ✓ (in my opening), the water came into my home ✓, what my family did ✓, how the neighbours helped ✓.', note:'Four stages written, every line ticked, and my ending still to come. Had one line been bare, I would have given it two honest sentences here, where there is still room for them.'},
      {work:'What I did not write: four paragraphs of rising water, each one prettier than the last, and then "The neighbours helped us and we went to my aunt" in the last two lines.', note:'That is how a middle swallows a story: a job the topic asked about, squeezed into one clause because the page ran out. My ending starts on the line under stage 4, as a new paragraph.'}
    ]
  },
  pitfalls:[
    'Running the whole middle together as one block of writing, with no break where you left the front room for the bedroom, so there is nothing on the page for a reader to see your stages by.',
    'A middle made of bare actions — "Then we lifted the bed. Then we put up the stove. Then the current went off." — with not one real thing to look at anywhere in it.',
    'A middle that never leaves one moment: the rain on the galvanize described four different ways while the water, the family and the neighbours stay exactly where they were.',
    'A whole job of the topic given one clause near the bottom of the page — "The neighbours helped us too" — when the topic asked you how they helped.',
    'A stage that contradicts an earlier one: the current gone in one paragraph and the television on two paragraphs later. Once you have turned something off, it stays off.',
    'Somebody who was never mentioned arriving at the worst moment and putting everything right — the uncle with the big truck, out of nowhere. Bring him in earlier or let the people already there do it.',
    'Jumping backwards in the middle of the middle — "Earlier that morning..." — when the reader is already in the boat with you, and now has to work out where you are.'
  ]
},
{
  id:'g-pw-ending', subj:'p-ela-writing', strand:'pw-organise', level:5,
  title:'Three endings, and how to reach the one you chose',
  when:'Open this on your plan page if the topic you chose is a story, and open it again when your story is nowhere near its end and the time is nearly gone. All three printed topics are the same kind of writing: some papers print three stories, others print three of the letter-and-report kind — of the fifteen topics we could read, six were letters and three were reports. So read all three, then check the form of the one you chose. If it is a letter or a report, this guide is not for you; those end in their own way, and the letter and report guides show you how.',
  steps:[
    {do:'Fill in the Topic No. box. Then, on your plan page, write the last picture of your story before you write paragraph one.', note:'The examiner has to know which of the three topics to mark you against, and the Topic No. box is the only place that tells them. Leave it blank and nobody can be sure which question you answered. The last picture costs you a moment of your plan-page minute, and the ending is the part children run out of time for.'},
    {do:'Choose one of three endings and write its name on your plan page in one word: RESOLVED, LESSON or RETURN.', note:'RESOLVED means the thing that went wrong is sorted out. LESSON means we see the person changed by what they do or say. RETURN means you come back to the picture you opened with. Three is few enough to choose between in a moment, and each one gives you a shape to walk towards. Language Use, Organisation, and Grammar and Mechanics are all given for the writing itself, whatever it is about, so an ending you have already chosen is simply one you can still get written when the clock is against you.'},
    {do:'If you chose RETURN, put one thing you can see, hear or smell into paragraph one, and name the same thing again at the end, changed.', note:'Not “it was a lovely morning”, but a ticking galvanize roof, the smell of fresh paint on the lane lines, a full prize table. One named thing is enough. When it comes back at the end, the reader feels the story close like a door, and you did not have to explain anything.'},
    {do:'If you chose LESSON, write down the action that shows it, not the sentence that says it. Ask yourself: what does this person now do that they would not have done in paragraph one?', note:'A reader believes what a person does. She shouts her friend’s name, or carries the chair inside, or hands over the last doubles. Said out loud instead — “I learnt that day that friends matter more than prizes” — the same idea goes flat and sounds like somebody else’s voice.'},
    {do:'When there is only enough time left for your ending and for reading back, stop where you are, finish the event you are in with one sentence, and go straight to the ending on your plan page.', note:'Stop dead where you are and the reader is left standing in the middle of a race that never finishes. One sentence to get out of the event, and then the paragraph you planned at the start — that costs you far less than a story with no last paragraph at all. The event you are in can always be left early; the ending cannot be left out.'},
    {do:'At that same stop, with your plan page beside you, read the topic again and check that the thing the topic told you to put in is still there in the second half of your story, not only in the first.', note:'This is the Content check, Content being the mark given for answering the question you chose. It asks that your writing be an answer to the topic, not that the detail turn up in your very last sentence. So do not throw away a good ending because the extra prizes will not fit inside it. But if those prizes have vanished out of the whole second half, you have drifted onto a different question, and that is worth two seconds of checking.'},
    {do:'Read your last two sentences in your head. If there is a sentence sitting after the one that lands, cross it out — then give the whole piece the two-minute check.', note:'Most endings are spoiled by three extra sentences explaining what we have just read. The strong line is usually a small action or a plain picture. Stop there. Checking the writing itself is a job of its own, and it belongs in the last two minutes, not here.'}
  ],
  worked:{
    problem:'Every year your school holds its sports day. This year there were more prizes to be won. Write a story about what happened on sports day.',
    lines:[
      {work:'In the Topic No. box: 2.\nOn my plan page: END — RETURN.\nLast picture: the empty cloth with fourteen pressed circles on it, and me carrying my chair inside.', note:'I chose the shape and the last picture in my plan-page minute, before a single sentence of the story, so now I know where I am walking to. The box is filled in too, so there is no doubt that topic 2 is the one I am answering.'},
      {work:'Paragraph one: “The prize table was already set out when I reached the school yard at seven o’clock. Fourteen trophies. Last year there were only six. The galvanize roof of the pavilion was ticking in the sun, and the whole yard smelt of fresh paint on the lane lines.”', note:'I planted three things I can come back to: the full table, the ticking galvanize, the paint smell. A RETURN ending needs only one of them, so now I have a choice.'},
      {work:'Plan for the middle: same relay team as Jalisa — baton dropped in the heat — Mr. Alleyne puts me in the final anyway.', note:'Those are plan words, not story sentences. The story itself is told in the past tense, and it stays there to the last line. The middle can go how it likes, as long as it is walking towards that empty cloth.'},
      {work:'The one place I let us talk the way we talk: “Hand it and go!” Jalisa said. “Doh mind the heat.”', note:'The Creole stays inside the quotation marks, because that is how Jalisa really speaks; every sentence outside them is me telling the story, and the telling stays in Standard English.'},
      {work:'At the stop I was still in the last lap, so I closed the event in one sentence: “Jalisa took the baton out of my hand and she was gone, and the shouting went up behind her like rain on galvanize.”', note:'I did not try to tell the rest of the race. One sentence closes the event, and then I go straight to the paragraph I planned at the start, instead of being caught with my pen still moving when time is called.'},
      {work:'Then, with my plan page beside me, I checked the topic words: “more prizes to be won”. Fourteen trophies stood on that cloth this morning. Last year there were six. The extra prizes are still there in my second half, so I have not drifted onto another question.', note:'That is the Content check. My ending is not about a monster or an abandoned house. It is about this sports day and these extra prizes.'},
      {work:'Last paragraph, first half: “The table was empty when I came back for my chair. Fourteen pale circles were pressed into the tablecloth, where each trophy had stood all morning. I counted them before Mr. Alleyne lifted the cloth off and folded it.”', note:'The table comes back, empty this time, so the ending stands on the very picture the story opened with. The circles are pressed into the cloth by the trophies that stood there since seven o’clock, and I count them before the cloth is folded away.'},
      {work:'Last paragraph, second half: “I had no trophy. I had a second-place ribbon squeezed wet in my fist, and Jalisa’s name still in my mouth from shouting it the whole last lap. The galvanize was ticking. I picked up my chair and carried it inside.”', note:'The galvanize is still ticking at the end, as it was in paragraph one. I never wrote the word lesson, and I did not need to: you can see it, because I counted somebody else’s prizes without minding, and I shouted my friend’s name till my voice went.'},
      {work:'I read my last two sentences again. I had written one more after them — “That was the best sports day of my life.” I crossed it out. Then I gave the whole piece the two-minute check.', note:'“I picked up my chair and carried it inside” is the line that lands. Anything after it is me explaining my own story to somebody who has just finished reading it.'}
    ]
  },
  pitfalls:[
    'An ending that arrives while the problem is still sitting there: the dog goes missing in paragraph two, and the last paragraph has the family eating lunch and feeling better. The reader is still waiting for the dog. Before you write the ending, say in your head what went wrong in this story, and make sure your last paragraph meets it.',
    'A last paragraph that slides into a different tense. The story has been in the past — I ran, she shouted, the rain came — and then the ending turns into the present: “So now I always check my bag before I leave the house.” Grammar and Mechanics is given for the writing itself, so the tense you chose is being read right down to the last line. End in the tense you told it in.',
    'A brand-new person walking in at the last minute to fix everything: an uncle nobody has mentioned arrives with the money, a stranger turns up holding the dog. Nothing earlier in your story earned it, so the reader feels cheated. Let somebody who is already in the story do the fixing.',
    'An ending that changes who is telling the story. You have been “I” for seven paragraphs, and the last one steps outside and looks at you from across the yard: “The girl picked up her chair and carried it inside.” Whoever started the story has to be the one who finishes it, so stay inside the same pair of eyes.',
    '“To be continued.” That is not an ending, it is a promise to write one later, and there is no later. “And that is all I have to say about sports day” is the same thing in politer clothes. However little time is left, give the reader one last picture instead of a promise.'
  ]
},
{
  id:'g-pw-senses', subj:'p-ela-writing', strand:'pw-language', level:4,
  title:'Show the feeling instead of naming it',
  when:'When you have written "I was frightened" or "She was happy" and the sentence sits flat on the page — in a story, or in the part of a letter where the reader is meant to feel something. Read all three printed topics before you choose. All three are the same kind of writing, either three stories or three of the letter-and-report kind, so a story at topic 1 is no reason to stop reading; and once you have chosen, check the form of the one you chose, because a letter and a report are both the second kind. Then show the thing that topic asked about. Showing only counts when it answers the question in front of you, and a beautiful paragraph about something else is still about something else.',
  steps:[
    {do:'Choose the two or three moments worth showing. Tell the rest plainly.', note:'Practise this loop at home until it is quick. In the paper, those first few minutes go on reading the three topics and planning the one you choose, and the last two minutes go on the read-back another guide teaches. There is no room to show every sentence, and a story where every sentence is slowed down never gets anywhere.'},
    {do:'Write the flat sentence down your plan page first, feeling word and all.', note:'You cannot fix what is not on the page. Put "I was frightened" on the plan page and mend it there. Do not sit waiting for a better sentence to arrive, and do not try the showing straight into your writing, where you cannot change your mind cleanly.'},
    {do:'Circle the feeling word on your plan page, then cross it out with one neat line.', note:'Frightened, happy, excited, sad, angry — those are the words that tell the reader instead of showing. One clean line through the word is enough wherever it sits; a scribble makes a mess of a page you cannot write over again. Crossing it out leaves a gap, and filling that gap is the whole job.'},
    {do:'Say what your body did.', note:'Legs, hands, breath, stomach, voice. A reader believes a body. "My legs would not move" says frightened without using the word, and the examiner can see it happening.'},
    {do:'Give the reader one thing to hear.', note:'A dog, a maxi horn, rain on galvanize, somebody calling a name. One sound makes a place real faster than any describing word can.'},
    {do:'Add one more sense: something you smell, or something the skin feels.', note:'Say what the air smelt like. Say whether the railing was cold or the galvanize too hot to lean on. Smell and touch are the two senses easiest to forget, and they are the ones that put the reader beside you.'},
    {do:'One sound and one other sense is the whole count. Body detail as much as you like.', note:'Five senses in one paragraph becomes a list, and a list is not a story. Two chosen well beat five crammed in. Legs, hands, breath and stomach are never part of the count, so write as much of the body as the moment needs.'},
    {do:'Add ONE comparison, then test it before you keep it.', note:'A comparison is saying one thing is like another. Ask yourself whether the picture has the same mood as the moment: a frightening moment needs a frightening picture. A picture with the wrong mood pulls the reader the wrong way, so cross it out and let the moment stand plainly instead.'},
    {do:'One describing word before a noun, not three. Put a fact where the others were.', note:'"The old, dark, scary house" only claims it. "The house with no glass in its windows" proves it. The fact is worth more and takes fewer words.'},
    {do:'Read the paragraph back and hunt for the feeling word.', note:'If it crept back in beside your showing, delete it. "My legs would not move because I was so frightened" throws away the best sentence you wrote, because the showing was already doing that word\'s work.'}
  ],
  worked:{
    problem:'The question was: "Write a story which includes the following words: I stood still and stared. Were my eyes deceiving me? I looked again. I wasn\'t dreaming." The moment chosen here is coming out of school late and finding the maxi stand empty. The last three lines take the same loop into a letter.',
    lines:[
      {work:'First try, down the plan page: "I was very, very frightened. The maxi stand was empty and it was a horrible, dark, frightening place." Circle frightened and draw one neat line through it.', note:'There is nothing here a reader can see or hear. "Frightened" tells, and "very, very" does not make it any more frightening. Crossing the word out leaves a gap, and every sentence you write next has to do that word\'s work.'},
      {work:'"My legs would not move. My hand kept twisting the strap of my bag."', note:'The body first, because it is the easiest thing to find. Ask what your legs and your hands did, and write that. None of it is part of the count.'},
      {work:'"Far down the road a horn blew once and then stopped."', note:'One thing to hear, and it does what the empty words could not: the reader is standing in a real road now.'},
      {work:'"The air smelt of fried fish and of rain on the way."', note:'That is the one sound and the one other sense, so the count is full. Do not go hunting for a taste as well.'},
      {work:'"The stand stretched out in front of me, as wide and as quiet as the Oval with nobody in it."\nNOT: "The stand was as bright and as busy as Carnival Tuesday."', note:'The first picture has the mood of the moment: a big place with nobody in it. The second is happy and crowded inside a frightening, empty moment, so the reader feels the wrong thing and the paragraph falls apart.'},
      {work:'Cut "horrible, dark, frightening" and write: "The stand had no maxi in it and nobody calling for passengers."', note:'Three describing words out, one fact in. The fact proves what the three only claimed, and the sentence reads faster.'},
      {work:'Finished, the showing part: "My legs would not move. The stand had no maxi in it and nobody calling for passengers. My hand kept twisting the strap of my bag. Far down the road a horn blew once and then stopped. The air smelt of fried fish and of rain on the way. It stretched out in front of me, as wide and as quiet as the Oval with nobody in it."', note:'The word frightened is gone and the reader is frightened instead. Body, one sound, one smell, one comparison, and a fact doing the work three describing words were doing.'},
      {work:'The given sentences may sit at the start, in the middle or at the end: "I stood still and stared. Were my eyes deceiving me? I looked again. I wasn\'t dreaming. The stand had no maxi in it and nobody calling for passengers."', note:'They must appear word for word, so choose their place on your plan page and you will not copy them in twice or leave them out. If somebody speaks in your story, the Creole goes inside the quotation marks, and punctuating speech has a guide of its own.'},
      {work:'The same loop in a letter:\n\n14 Pump Trace,\nSangre Grande.\n20th March, 2026.\n\nDear Sir,\n\nI am writing to ask for a crossing guard at the gate of our school.', note:'Letters come up often: six of the fifteen topics we could read were letters. Copy the heading and the greeting exactly as they are set out here. The showing goes in the paragraph where you give your reason, never in the address or the greeting, which stay plain — and opening and closing a letter is the letter guide\'s own job.'},
      {work:'"Yesterday I stood at the edge of the road for eleven minutes. My books were slipping and I could not step off the pavement. The quarry trucks went past one behind the other, and the ground shook under my shoes."\n\nYours faithfully,\n\nShanice Williams', note:'A body detail, one sense — the ground shaking under her shoes — and a fact, eleven minutes. No comparison is needed. Dear Sir, with no name given, takes Yours faithfully, because the two ends must agree. A letter asking for something stays plain and polite, and every word of it is Standard English.'}
    ]
  },
  pitfalls:[
    'Explaining your own picture: "as quiet as the Oval with nobody in it, which showed how frightened I was." If the picture works, the explaining spoils it. If the picture does not work, change the picture instead of adding a sentence to prop it up.',
    'A comparison borrowed from a book set somewhere else — snow, autumn leaves, a castle on a hill. Use what is around you: galvanize, a mango tree, the Oval, a maxi pulling off. It will sound true because it is.',
    'A sense detail nobody in the moment could notice — the smell of flowers while your character is running, or a whisper heard across a noisy junction. Pick the one sound or smell the person in the scene would really catch.',
    'A body copied out of a book: her heart jumped out of her chest, his hair stood on end, his blood ran cold. No real body does those things. Your own legs, hands, breath or stomach are stranger and truer than the phrase you remember.',
    'The tense slipping where the moment gets exciting: "I stood still and stared ... then I see the stand is empty and I am running." Choose the past tense, as the given sentences do, and hold it to the last full stop.',
    'Putting the given sentences in your own words. "Were my eyes playing tricks?" is not the sentence the question gave you. Copy those sentences exactly — the commas, the question mark, the apostrophe and all.',
    'Dropping in the paragraph you learnt by heart whatever the question says. The giveaway is that the paragraph names nothing from the question: no maxi stand, no crossing, no rain. Bend your practised writing to the topic you picked.'
  ]
},
{
  id:'g-pw-dialogue', subj:'p-ela-writing', strand:'pw-mechanics', level:4,
  title:'Punctuating what people say',
  when:'Any story where somebody speaks, and the moment matters more if you let the person say it in their own words.',
  steps:[
    {do:'Pick two or three moments where somebody speaks. Not more.', note:'Speech is for the moments that count — the invitation, the warning, the apology. If everybody talks all the way down the page, the reader loses the story. One moment can run to several turns, her line and then yours and then hers again; that is still one moment.'},
    {do:'Say the words in your head first, then write down only those words.', note:'Quotation marks go around the words that came out of the mouth, and nothing else. Never around she called or I asked. That bit — she called, I asked, she whispered, the part that tells the reader who spoke — is what this guide calls the said-part, from here to the end.'},
    {do:'Give the first word of what is spoken a capital letter.', note:'Even in the middle of your line: She called, "Come in." The capital tells the reader a voice has started. One exception: if you break one spoken sentence in two, the second half carries on with a small letter — "Come in," she called, "and shut the gate."'},
    {do:'Put the full stop, comma, question mark or exclamation mark INSIDE the closing quotation marks.', note:'"Come in, child." The full stop is inside. "Come in, child," she called. The comma is inside. Whichever mark it is, it never sits outside the quotation marks. Grammar and Mechanics is one of the four things marked, and it is given for the writing itself, whatever your story is about.'},
    {do:'When the said-part comes after the speech, end the speech with a comma, not a full stop.', note:'"Come in, child," she called. Not "Come in, child." she called. A question mark or an exclamation mark stays as it is, and no comma follows it: "Are you sure?" I asked.'},
    {do:'When the said-part comes first, put a comma before you open the quotation marks.', note:'She called, "Come in, child." The comma goes after called, outside the quotation marks, and the first word spoken still takes a capital. Both orders are correct, and moving between them stops every line of your page beginning the same way.'},
    {do:'New speaker, new line — and the speaker\'s own actions stay on that line.', note:'Every time somebody different speaks, start a new paragraph and indent it, so nobody has to guess who is talking. If I speak, my hands and my face go on my line; hers go on hers. That is how the reader knows a line belongs to one person.'},
    {do:'Use said when said is right, and a stronger verb when the feeling needs carrying.', note:'called, whispered, muttered, begged, warned. One strong verb beats said loudly and angrily. Using said three times is better than reaching for three strange verbs. A laugh or a chuckle is something a person does, not a way of saying words, so it gets a sentence of its own.'},
    {do:'Inside the quotation marks, let the person talk the way they really talk.', note:'Miss Lucille can say, "The dogs ain\'t go trouble you." She can say, "Is only me and them dogs here so." That is her voice, and her voice belongs inside the quotation marks. Outside them every word of your own writing stays in Standard English: She pushed the gate wider, never She push the gate wider. A local word for a thing is no trouble out there — galvanize, parlour, pot hound — it is the grammar that stays Standard English.'},
    {do:'Read each speech back the moment you have written it.', note:'Five questions, each one wanting yes. Capital on the first word spoken? Every mark inside the closing quotation marks? A comma before the quotation marks where the said-part came first? A new line for each new speaker? Did I change the verb anywhere the feeling needed carrying? Five quick looks down the speech you have just written — then, at the end, the whole piece gets the two-minute check.'}
  ],
  worked:{
    problem:'Topic: "There is an old lady in your neighbourhood who lives alone with her dogs. One day she invites you into her house. Write a story about what happened."',
    lines:[
      {work:'On my plan page: speaking moments — (1) she calls me in at the gate, (2) inside the front room, she tells me how long the house has been quiet.', note:'Two moments in the whole story. Each one runs to a few turns, so two moments give me five speeches, not five moments. Everything else I tell in my own words. The topic tells me what I must keep: she lives alone, the dogs are hers, and she invites me into the house.'},
      {work:'Her words first, with no marks on them yet: Come in, child. The dogs ain\'t go trouble you.', note:'Get the words down before you worry about the marks. It stops you putting quotation marks round half a sentence.'},
      {work:'"Come in, child. The dogs ain\'t go trouble you."', note:'Quotation marks round her words only. Capital C on the first word she speaks, and the full stop at the end sits inside the closing quotation marks.'},
      {work:'"Come in, child," she called. "The dogs ain\'t go trouble you."', note:'The said-part here is she called, and it comes after, so her first sentence now ends in a comma — inside the quotation marks. Her second sentence gets quotation marks of its own and a capital of its own, and it stays on her line.'},
      {work:'I held the bag of oranges against my chest. "Are you sure, Miss Lucille?" I asked.', note:'My turn, so a new line, indented. The question mark goes inside the quotation marks and no comma follows it. My hands go on my line, because they are my hands.'},
      {work:'"Sure, sure. Is only me and them dogs here so." She chuckled and pushed the gate wider.', note:'Her turn again, so another new line. A chuckle is something she does, not a way of saying words, so her speech ends in a full stop and the chuckle starts a sentence of its own. No comma before and: one person, two things she does.'},
      {work:'Inside, the front room was cool and dark. The galvanize roof ticked above us.\nShe said quietly, "This house ain\'t hear a child voice in a long time."', note:'Moment two, indoors, where my plan said it would be. The said-part comes first this time, so there is a comma after quietly, before the quotation marks open, and the first word spoken still takes a capital. Plain said is right here — quietly is doing the work.'},
      {work:'"You have me today," I said.\nShe laughed, and the dogs lifted their heads.', note:'My turn closes the second moment. This sentence does take a comma before and, because two different people are acting: she laughs, the dogs lift their heads. In the line above, one person did both things, so there was no comma.'},
      {work:'Looking back over the speech: capitals ✓ every mark inside the closing quotation marks ✓ comma where the said-part came first ✓ five speeches, five separate lines ✓ said twice, and called where the feeling needed it ✓', note:'Five quick looks, taken as I wrote each speech rather than saved up for the end. Nothing here needed rewriting, only looking at.'}
    ]
  },
  pitfalls:[
    'Quotation marks opened and never closed. The reader cannot see where the voice stops, so the rest of the paragraph reads as though the old lady said that too.',
    'Starting the speech at hello. "Good morning." "Good morning." "How are you?" moves nothing. Open the quotation marks on the line that changes something — the invitation, the warning, the answer.',
    'Saying it twice: "I ain\'t fraid them dogs," I said. I was not afraid of the dogs at all. If the speech has said it, your own sentence should do something else.',
    'A new paragraph in the middle of one person\'s turn, which makes the reader count a speaker who is not there. Her two sentences at the gate belong on one line, however many sets of quotation marks they need.',
    'Making the old lady talk like a textbook: "I shall not permit the dogs to trouble you." Nobody on her step speaks like that, and the one thing speech is for — her own voice — is gone.',
    'Half a paragraph inside one set of quotation marks, with no breath in it. Say it out loud; if you run out of air, cut it, or let the other person answer in the middle of it.',
    'Bringing in a conversation you practised in class that this topic never asked for. Six of the fifteen topics we could read across the papers asked for a letter and three asked for a report, and on a paper like that there is often nothing at all to put inside quotation marks, so check the form of the topic you chose. Content is the one of the four marked things that is given for answering the question.'
  ]
},
{
  id:'g-pw-given', subj:'p-ela-writing', strand:'pw-narrative', level:5,
  title:'When the topic gives you words you must use',
  when:'Reach for this when your chosen topic hands you a sentence or a few sentences and tells you to begin with them, end with them, or put them somewhere in your story. It is not the commonest kind of topic: two of the fifteen topics we could read across the papers gave sentences that had to be used word for word. But when one comes up, those printed words decide more about your story than anything else on the page.',
  steps:[
    {do:'Read all three printed topics, then write the number of the one you choose in the Topic No. box before you write anything else.', note:'All three topics on one paper are the same kind of writing — three stories, or three of the letter-and-report kind, never a mix — so a story at topic 1 is no reason to leave topics 2 and 3 unread: one of them may be the one that hands you sentences. Then check the form of the one you chose, because that is what tells you how it has to be set out. Content is the one of the four marked things that is given for answering the question you chose, so the examiner has to know which of the three that was. One number, two seconds.'},
    {do:'Copy the given words onto your plan page exactly as they are printed: every word, every capital letter, every full stop, every apostrophe, every question mark.', note:'Your plan page is the space in the booklet meant for planning, not the lined pages your story goes on. This copy is your master copy. Later you will copy from your own careful copy instead of from memory, and memory is where “wasn\'t” quietly becomes “was not”.'},
    {do:'Underline the word in the topic that says where the given words must go: begin, end, include, anywhere.', note:'Words copied perfectly but set down in the wrong place do not answer the topic. “Begin your story with” means those words are your very first words, before any weather, any date and any “One Friday afternoon”.'},
    {do:'Look at the given words and write down what they lock for the rest of your story.', note:'The given words are not only words: they are rules. “I” locks first person, so you are in the story and you say I, me, my all the way to the last line. “stood” and “looked” are past tense, so the whole story stays in the past. “my eyes” locks the surprise to something you SEE, not something you hear or smell.'},
    {do:'Decide the one moment in your story when the given words will be said. If the topic lets you put them anywhere, put them at the moment of the biggest surprise.', note:'Given words dropped in just to get rid of them read as if they were pasted on. Given words placed at the surprise do the work of a whole paragraph for you.'},
    {do:'Plan backwards and forwards from that moment, and give the given words their own box in your plan.', note:'Backwards: why was I walking there, and why did I not expect this? Forwards: what did my eyes actually see, and what did I do about it? A plan built to reach the given sentence never has to be bent around it at the last minute.'},
    {do:'If the topic gives you more than one sentence, decide on your plan page whether they stay together as one run or are spread out, and keep them in the printed order either way.', note:'Four sentences like the ones below were printed as one run and work as one run: one stare, one doubt, one second look, one answer. Spread them and the doubt can arrive after the answer, which makes nonsense of both. If you do spread them, number them 1, 2, 3, 4 on your plan page beside the box each one belongs in, so none is dropped and none is swapped.'},
    {do:'When you reach the given words in your story, stop, copy them off your plan page one word at a time, then read your line and the plan page against each other before you write anything else.', note:'Do not write them from memory while your hand is going fast. Copy the apostrophe in “wasn\'t”. The second given sentence here is a question, so it ends in a question mark: copy that too. Keep the full stop on each short sentence instead of joining them up with commas. The read-back takes ten seconds, and it is the moment when the printed words and your words are side by side with time to put a word back.'},
    {do:'Keep the lock to the very end: same person, same tense.', note:'Every event in your story already happened, so the whole story stays in the past, the last line included. If you want to say what changed afterwards, say that in the past too: “The next Divali I lit the first deya on his wall.” A story that opens “I stood still and stared” and then slides into “he”, or into “now she is running”, stops being the story the printed words began, and the slide sits there in the writing itself, which is what Language Use and Grammar and Mechanics are given for.'},
    {do:'Spend those first few minutes on reading the topic and planning, give the writing the long middle of the paper, and leave it the two-minute check at the end.', note:'The check at the end is another guide\'s work, not this one\'s. The checking this guide asks of you is the read-back in step 8, done the moment the given sentences land on the page, while the printed topic is still open in front of you.'}
  ],
  worked:{
    problem:'A practice topic, written the way the papers write them. The four sentences are ones a real paper gave; the topic number and the wording round them are made up for practice. — Topic No. 2. Write a story which includes the following sentences. You may use them anywhere in your story. “I stood still and stared. Were my eyes deceiving me? I looked again. I wasn\'t dreaming.” Your story must be interesting and well organised.',
    lines:[
      {work:'Writes 2 in the Topic No. box. Then, at the top of the plan page, copies the printed sentences exactly:\nI stood still and stared. Were my eyes deceiving me? I looked again. I wasn\'t dreaming.', note:'The box first, so the examiner knows which of the three topics this story answers. The copy at the top of the plan page is the master copy: everything after it is built to reach it, and it is what the written sentences will be checked against.'},
      {work:'Under the copy, writes the locks:\n“I” = I am in the story (I, me, my).\n“stood”, “looked” = it already happened, so past tense all through.\n“my eyes” = the surprise is something I SEE.\n“Were my eyes deceiving me?” = it has to be hard to believe.', note:'Four short notes, and half the planning is done. The topic has already chosen the person, the tense and the kind of event.'},
      {work:'Plan, five boxes down the plan page:\n1 Divali evening, lamp oil finished, Ma\'s hand in a cast, she sent me to the shop.\n2 Walking back up the dark trace, mud, angry: our yard would be black that night.\n3 Round the bend I lifted my head. GIVEN SENTENCES HERE.\n4 Yard full of deyas, Mr. Hosein on the step with matches and his own oil.\n5 He said Ma could not bend. Next Divali I lit his wall first.', note:'Box 3 is the given words, written in capitals so they cannot be forgotten. Boxes 1 and 2 build a reason for the surprise; boxes 4 and 5 pay it off. Every box is written in the past, because box 3 is. Box 4 gives Mr. Hosein his own oil, so the empty bottle in box 1 and the hundred lit deyas do not contradict each other.'},
      {work:'It was Divali evening, and the lamp oil had run out. Ma was standing by the stove with her right hand in its white cast, telling me to run down to Sookoo\'s shop before it closed. The rain had just stopped. The whole trace smelt of wet dust and curry mango, and water was still running off our galvanize in one thin line. I took the five dollars and went.', note:'First person and past tense from the first line, because the given sentences demand both. The smells are named — wet dust, curry mango — instead of being called a lovely smell.'},
      {work:'Coming back up the trace was the worst part. The street lamp by the samaan tree had not worked since the year before, and my slippers kept sliding in the mud. I had the bottle of oil in one hand, and I was angry, because every other yard would have deyas that night and ours would be black. I came round the bend with my head down, counting my steps. Then I lifted my head.', note:'The dark, the mud and the anger are there to make the surprise hard to believe. “Then I lifted my head” hands the story straight to the given words.'},
      {work:'I stood still and stared. Were my eyes deceiving me? I looked again. I wasn\'t dreaming.', note:'Copied off the plan page one word at a time, and set down as its own short paragraph. Nothing added, nothing taken out, nothing reworded, and no quotation marks round it, because nobody is saying it out loud.'},
      {work:'The read-back, straight away. Suppose the hand had gone fast. WRONG, what reached the lined page: “I stood and stared. Were my eyes deceiving me? I looked again. I was not dreaming.” Pencil tip on the plan page, pencil tip on the story, word by word. Two slips. RIGHT: “still” goes back into the first sentence, and “was not” becomes “wasn\'t”.', note:'Two words put right in ten seconds, and the given sentences are word for word again. The version marked WRONG is there to be hunted, never copied: the only wording that may reach your lined page is the one on your plan page. Check the marks as well as the words. The question mark belongs to the whole question, “Were my eyes deceiving me?”, and the apostrophe belongs to “wasn\'t”.'},
      {work:'Our yard was burning with light. Deyas, the small clay ones we bought ten for a dollar, were sitting all along the front wall, up both sides of the steps, on the window ledge, on the water tank, even on the flat part of the gate post. There must have been a hundred of them.', note:'Now the eyes report what they saw, because that is the question the given sentences asked. Counted things and named places — gate post, water tank, window ledge — are what make a reader believe it.'},
      {work:'The little flames bent in the breeze and stood up again, and the whole yard smelt of ghee and wet earth. On the top step Mr. Hosein from next door was kneeling with a box of matches, and a gallon of lamp oil he had carried over stood beside him. His two daughters were behind him, holding a tray.', note:'One long block of description is harder to follow than two, so the yard is given two paragraphs. The gallon he carried over is one clause, and it answers the careful reader who was about to ask how a hundred deyas were lit in a yard that had run out of oil.'},
      {work:'“Your mother can\'t bend with that hand, Rishi,” he said, and he did not even look up. “So we come and bend for her.” Ma was in the doorway with her cast held against her chest, and she did not say one word. I put the bottle of oil down on the step. We did not need it. The next Divali I lit the first deya on Mr. Hosein\'s wall before I lit one of our own.', note:'The only Creole here is inside the quotation marks, where Mr. Hosein is speaking; everything outside them is Standard English. The story keeps the past to the last line — “The next Divali I lit”, not “every Divali I light” — and no lesson is announced: the last action says it.'}
    ]
  },
  pitfalls:[
    'Nearly copying. “I stood and stared” instead of “I stood still and stared”, “was not” instead of “wasn\'t”, “Was my eyes” instead of “Were my eyes”. Given words have to be word for word, with their own punctuation.',
    'Putting the words in the wrong place. If the topic says begin, they are your first words; if it says end, they are your last. Do not put a sentence or two of your own in front of a given opening.',
    'Sliding out of first person or out of the past. It happens in the last two lines. Endings tempt you into “and now every Divali I light a deya for him”. The given words say I stood and I looked, so it has all happened: finish it in the past, as “The next Divali I lit the first deya on his wall.”',
    'Giving the words a surprise that does not fit them. If the given sentence says my eyes, the surprise cannot be a shout from the kitchen or a smell of smoke. The words name the sense, and your surprise has to arrive through that sense.',
    'Dropping the words in and never saying what happened. If you write “Were my eyes deceiving me?” you owe the reader the thing your eyes saw, described closely enough for them to see it too.',
    'Putting quotation marks round the given words as if somebody is saying them out loud. They are your own telling of the story, not speech, so they sit in the paragraph bare.',
    'Letting the Creole out of the quotation marks. “So we come and bend for her” is right inside the marks, in a person\'s mouth. Outside them, write it the way the given sentences are written: the lamp oil had run out, I was angry.'
  ]
},
{
  id:'g-pw-letter', subj:'p-ela-writing', strand:'pw-expository', level:5,
  title:'Writing a letter when the topic asks for one',
  when:'The topic says “write a letter to” somebody — your principal, your teacher, the P.T.A. President, the editor of a newspaper, a company that gave your school something, a cousin abroad, a best friend.',
  steps:[
    {do:'Write the number of the topic you chose in the Topic No. box, before you write a single word of the letter.', note:'Three topics are printed and you answer one. The examiner has to know which one you chose, because the Content mark is given for answering that question. It takes a second, and it is the one thing on the paper nobody can work out for you afterwards.'},
    {do:'Read all three topics, then read the one you chose twice and underline every job it gives you.', note:'All three topics on one paper are the same kind of writing — three stories, or three of the letter-and-report kind — so what you see at topic 1 is never a reason to stop reading topics 2 and 3. A letter and a report are both that second kind, so look again at the form of the one you chose: does it want a letter to a person, or a report with instructions? Then write the jobs down your plan page as your list. Letter topics often give two jobs joined by “and”: your worry AND your suggestions, your thanks AND how the gift will be used. Of the fifteen topics that could be read across these papers, six asked for a letter to a person the topic named.'},
    {do:'At the top of your plan page write who you are writing to, and how you would talk to that person.', note:'Your principal is not your cousin. To a principal, a manager or an editor: polite, full words, no slang, no short forms like “don’t”. To a cousin or a friend: warm and chatty. The facts stay the same; only the voice changes. Language Use is one of the four things marked, and it is given for the writing itself.'},
    {do:'Settle your greeting and your sign-off together, from one question: do you know the person’s name?', note:'You know the name (your principal, your teacher, your grandmother): Dear Mrs. Boodram, at the start and Yours sincerely, at the end. You do not know it (the editor of a newspaper, a company, the Regional Corporation): Dear Sir, at the start and Yours faithfully, at the end — which is exactly right for somebody you cannot name, not stiff and not wrong. A friend or somebody in your family: Dear and their first name, then Your friend, or Love. Never invent a surname. Write both of your choices on your plan page, so the second one cannot slip your mind by the time you reach the bottom of the page.'},
    {do:'Plan one paragraph for each job, with an opening before them and a closing after.', note:'Write it down the plan page as Paragraph 1, Paragraph 2, Paragraph 3, Paragraph 4, and put two or three real details beside each one. When each job sits in a paragraph of its own, both jobs can be seen at a glance and neither can be missed.'},
    {do:'Set it out so that it looks like a letter from across the room.', note:'Your own address and the date at the top right: a comma after each line of the address except the last, which takes a full stop, and a full stop after the date.\n14 Pump Trace,\nSangre Grande.\n20th March, 2026.\nThen the greeting on the left, a blank line, the body, the sign-off and your name. A letter set out like a story does not look like a letter, and the examiner can see that at once. Organisation is one of the four things marked, and it is given for the writing itself, whatever the writing is about.'},
    {do:'Open by saying who you are and why you are writing.', note:'Never “This is a letter about”. One or two sentences: your name or your class, where you are writing from, and the matter. The person you are writing to should know in five seconds why your letter is on their desk.'},
    {do:'Do job one with things a person can see, hear or smell.', note:'Not “the yard is in a bad condition”. Say how high the grass is, what is lying in it, what the drain smells like after rain, which sheet of galvanize is loose. Three real details beat a page of “very bad”.'},
    {do:'Do job two in its own paragraph, and number your points inside it.', note:'“May I suggest three things? First… Second… Third…” The second half of the topic is what the examiner looks for next, so make it impossible to miss. Give exactly as many points as you promised: if the sentence says three, write three. The same goes for job one — if you announce a first concern and a second concern, every concern in that paragraph needs its number.'},
    {do:'Close with what you would like to happen, sign off, write your full name — then touch the six parts only a letter has.', note:'After Dear Mrs. Boodram, comes Yours sincerely, and then your first and last name. After Dear Sir, comes Yours faithfully. To a friend, Your friend, and your first name alone. Then run your pencil down the six: address and date, greeting, job one, job two, sign-off, name. Put right anything that is missing, and hand the letter on to the two-minute check.'}
  ],
  worked:{
    problem:'Topic 2: Write a letter to your Principal, Mrs. Boodram, telling her about a problem in your school yard and suggesting what could be done about it.',
    lines:[
      {work:'Topic No. box: 2', note:'Filled in before the plan, so the examiner knows which of the three topics to read this letter against. All three topics on this paper were of the letter-and-report kind, so I read topic 2 again to be sure mine wanted a letter and not a report.'},
      {work:'Underlined: “a problem in your school yard” … “suggesting what could be done about it”.\n\nMy list:\n1. the problem\n2. what could be done', note:'Two jobs, written down the plan page as my list. The problem has to be in my own school yard — something I can describe, not a problem in general.'},
      {work:'Who: Mrs. Boodram, my Principal. I know her name, so: Dear Mrs. Boodram, and Yours sincerely. If the topic had named nobody: Dear Sir, and Yours faithfully. Voice: polite, full words, no slang, no short forms.', note:'Greeting, sign-off and voice all settled on the plan page before the first sentence, so the ending cannot disagree with the beginning.'},
      {work:'Plan:\nParagraph 1 — who I am, why I am writing.\nParagraph 2 — the problem: loose galvanize, no garbage bin, high grass.\nParagraph 3 — three suggestions.\nParagraph 4 — what I am asking for.', note:'One paragraph for each job, three details under job one and three under job two. Reading the topics, underlining and planning filled those first few minutes.'},
      {work:'14 Pump Trace,\nSangre Grande.\n20th March, 2026.\n\nDear Mrs. Boodram,', note:'My own address and the date at the top right, a comma after the first line, a full stop after Sangre Grande and a full stop after the date. Then the greeting on the left and a blank line under it. From across the room it is already a letter.'},
      {work:'My name is Kavi Singh and I am a pupil in Standard Five. I am writing to you about the state of our school yard because the children on my street play in it every afternoon after school.', note:'Who and why, in two sentences. It is “a pupil in Standard Five”, not “of”, and “the children on my street”, not “of my street” — a pupil is in a class but of a school.'},
      {work:'My first concern is the shed. A sheet of galvanize has come loose, and its rusty edge hangs at shoulder height. My second concern is that there is no garbage bin beside the benches, so at lunchtime the wrappers blow across the yard. My third concern is the far end of the field, where the grass is waist high and broken bottles lie in it.', note:'Job one in its own paragraph, with first, second and third — three concerns promised in the plan and three numbered here. Each one is something you could point at: the rusty edge, the wrappers, the bottles.'},
      {work:'May I suggest three things? First, the loose sheet of galvanize could be nailed down before it falls. Second, if a garbage bin were put beside the benches, the wrappers would not blow about. Third, if the grass at the far end were cut once a month, we would be able to see the ground we are running on.', note:'Job two, its own paragraph, First / Second / Third. The first sentence asks something, so it ends with a question mark — Grammar and Mechanics is one of the four things marked.'},
      {work:'I would be very grateful if you could walk through the yard and see these three things for yourself. Our team plays the school from Arima next term, and we would like to practise on a field that is safe. Thank you for reading my letter.\n\nYours sincerely,\nKavi Singh', note:'What he is asking for, then the sign-off that goes with Dear Mrs. Boodram, and his full name under it. Writing to a friend, this would end Your friend, and then Kavi.'},
      {work:'Suppose a topic gave you no name at all — a letter to the editor of a newspaper, or to a company that helped your school. Only the two ends change:\n\nDear Sir,\n\n(the opening, job one, job two and the closing, exactly as above)\n\nYours faithfully,\nKavi Singh', note:'I cannot name the editor, so I do not invent a surname. Dear Sir, goes with Yours faithfully, every time, and both of my names still go at the end.'}
    ]
  },
  pitfalls:[
    'Doing one job and not the other: all your worries and no suggestions, or thanks for the gift with nothing about how it will be used. The topic asked for both halves.',
    'Writing a story instead of a letter. If the opening you planned begins “On that Friday afternoon…”, do not use it here: this answer starts with your address, the date and the greeting.',
    'Mixing both jobs together in one long block, so the examiner has to hunt through it for the second one.',
    'Two ends that disagree: Dear Sir, at the top and Yours sincerely, at the foot, or your grandmother greeted by name and then Yours faithfully.',
    'Putting the other person’s address at the top, the way a business letter does. The address at the top right is your own, because that is where the reply has to go.',
    'Borrowing a grown-up phrase you would never say — “kindly be informed that same is in a deplorable state”. A letter in your own best Standard English reads better than a borrowed phrase used wrongly.',
    'Telling the person what they already know: explaining to your own Principal where your school is, or to your cousin who you are. The opening is for your name and your reason, and nothing else.'
  ]
},
{
  id:'g-pw-report', subj:'p-ela-writing', strand:'pw-expository', level:5,
  title:'Writing a report when the paper asks for one',
  when:'Reach for this when the topic says "write a report" to a Principal, a teacher or another named adult, and lists in bullets what your report must include.',
  steps:[
    {do:'Before you write one word, fill in the Topic No. box on the front of your booklet with the number of the topic you chose.', note:'The examiner has to know which of the three topics to mark your writing against, and that number is what tells them. The box is on the booklet, not on the question paper, so you have to look for it on purpose.'},
    {do:'Read the bullets under the topic and copy them down your plan page as your list. Tick each one only after you have written it.', note:'Those bullets are the question. In the three report topics we could read, they asked for things of this kind: the date, the time and the place; who was involved and what happened; what followed. Content is the mark for answering the question, so a bullet you never wrote about is a piece of the question you never answered, however good your sentences are.'},
    {do:'Head your report like a real one, written down the page: the title in capitals, then To:, then From:, then Date:, each on its own line.', note:'The heading fixes in your own mind that you are writing to one adult about one thing, and that keeps your voice steady for the whole page. Put your own name and class on the From: line, and the day you are writing on the Date: line, which may be the day after the thing you are reporting.'},
    {do:'Make your first sentence say why you are writing. Nothing else.', note:'A report has no build-up. "I am writing to report an accident that happened in the school yard during the lunch break yesterday" does the whole job. If your first line sets a scene instead, your hand has gone into story mode and it is hard to pull it back.'},
    {do:'Put the date, the time and the place in your next sentence, all three together, and be as exact as you can.', note:'This bullet is easy to leave half done: children give the day and forget the hour, or write "in the yard" without saying which part of it. Write "on Monday 13th May, at about half past twelve, in the paved yard beside the galvanize shed". Galvanize is our own word for the sheeting and it is the right word for a real yard here; it is not licence to write the rest of the page the way we speak. Being exact is what makes writing sound factual.'},
    {do:'Under a small heading, name every person involved, give their class, and say what each one did, in the order it happened.', note:'A report has to let the adult reading it see who to speak to. "Three pupils of Standard Five were involved", and then each name, is far stronger than "some children". Order it first, next, then. Never jump back in time, because somebody checking your facts has to be able to follow you.'},
    {do:'Write only what you saw or were told, and say which it was.', note:'Use "I saw", "I heard" and "Mrs. Joseph told me". If you do not know something, say so: "I do not know who spilled the juice." Nothing marks a report out as a report more clearly than this. Hold to it in the last paragraph too, where most of what you are writing about happened out of your sight.'},
    {do:'Give what followed as its own short paragraph: what happened to the people, and what the school did about it.', note:'This is the last bullet and the easiest one to run out of time for, so keep it short and keep it factual: who was hurt, who was told, who was punished, what was cleaned or fixed. Write it before you go back to improve anything earlier.'},
    {do:'Finish with one helpful suggestion, then sign your full name and your class.', note:'A report to a Principal is meant to be useful, not only truthful. One sentence, "I suggest that a garbage bin be placed near the shed", shows that you thought about the problem. Then your name and class, because the adult reading it has to know who wrote it.'},
    {do:'The moment your last paragraph is done, and before the two-minute check, read your list instead of your sentences.', note:'Reading your own sentences at that moment cannot show you a bullet you never wrote; only your list can. If one is unticked, give it two honest sentences now. Then give the page the two-minute check.'}
  ],
  worked:{
    problem:'A practice topic, written in the words the papers use. On the paper it would be one of three to choose from, and all three would be the same kind of writing as this one, so another of them could be a letter: read the form of the one you choose before you start. Here it is Topic 2.\n\nTopic 2\nAn accident happened in your school yard during the lunch break. Your Principal has asked you to write a report about it. In your report, include:\n• the date, time and place of the accident;\n• who was involved and what happened;\n• the consequences of the accident.',
    lines:[
      {work:'Topic No. 2', note:'The first mark my pencil makes, before any writing. The box is on the booklet and not on the question paper, so I look for it on purpose.'},
      {work:'Down the side of my plan page:\n1. date / time / place\n2. who + what\n3. consequences', note:'Three bullets, so three ticks to collect. My plan page is not a story mountain today; it is this list.'},
      {work:'REPORT ON AN ACCIDENT IN THE SCHOOL YARD DURING LUNCH BREAK\n\nTo: The Principal\nFrom: Anushka Mohammed, Standard Five\nDate: 14th May', note:'Four lines, written down the page, and anyone picking it up knows what it is and who it is to. The date is the day I am writing, which is the day after the accident.'},
      {work:'I am writing to report an accident that happened in the school yard during the lunch break yesterday. I was standing near the shed and I saw it happen.', note:'Why I am writing, and that I saw it myself. I do not open by setting a scene. That is a fine way to begin a story, but here it would start me telling one.'},
      {work:'When and where it happened\n\nThe accident happened on Monday 13th May, at about half past twelve in the afternoon. It happened in the paved yard beside the galvanize shed where Standard Five eats lunch, close to the step by the pipe.', note:'Bullet one, ticked. Date, time and place in two sentences, and the place is exact enough for the Principal to walk to it.'},
      {work:'Who was involved and what happened\n\nThree pupils of Standard Five were involved: Kerron Charles, Diya Persad and I. At about half past twelve, Kerron was running from the shed towards the pipe. There was a spill of orange juice on the paving near the step. I do not know who spilled it.', note:'Every person named, each with a class, and "and I", because that list is the three pupils themselves. Where I do not know something I say so, instead of filling the gap with a guess.'},
      {work:'Kerron stepped in the spill, slipped and fell forward onto the step. Diya was walking just behind him and she had to jump aside so that she would not fall on him. She was not hurt. Kerron could not get up by himself, so I held his arm while Diya ran to call Mrs. Joseph, who was the teacher on duty.', note:'Bullet two, ticked. Step by step, in the order it happened. I leave out "Suddenly, to my horror": a report does not try to frighten the person reading it.'},
      {work:'The consequences\n\nKerron had a deep cut on his right knee and it was bleeding. Mrs. Joseph told me that she had cleaned the cut in the sick bay and that the office had telephoned his mother. I saw his mother come for him at about one o\'clock.', note:'Here I was not in the sick bay, so I do not pretend I was. "Mrs. Joseph told me" for what she told me, and "I saw" only for the part I watched myself.'},
      {work:'I heard that he was taken to the health centre. He was not at school today. I was told that the caretaker had mopped the spill before the bell rang. Mrs. Joseph also spoke to our class about running on the paving by the shed.', note:'Bullet three, ticked. What happened to the person, who was told, what the school did. Facts and times, and no feelings in this paragraph: how frightened we all were is not what followed.'},
      {work:'A suggestion\n\nI suggest that a garbage bin be placed near the shed, because there is nowhere to put empty juice boxes and they are often left on the step.\n\nI hope this report is useful.\n\nAnushka Mohammed\nStandard Five', note:'One useful idea, then my name and my class. Then I read my plan page: all three bullets ticked. I do not add a lesson I learnt that day; that belongs to a story, and it would tell the Principal something she never asked for.'}
    ]
  },
  pitfalls:[
    'Ending with "I learnt a valuable lesson that day". That is a storybook ending. A report ends with what followed, one suggestion if you have one, and your name.',
    'Letting two different times into one report, because you invented the hour halfway down instead of at the start: half past twelve in one paragraph and "after lunch, around one" in the next. Fix your day and your hour in the first paragraph and keep them.',
    'Writing out conversation: "Oh gosh, Miss, my knee!" he shouted. Leave it out of a report; report it instead, as in "Mrs. Joseph told me that she had cleaned the cut." In a story, words like those are fine inside the quotation marks, and the writing around them stays Standard English.',
    'Writing the consequences as how everybody felt — "we were all very frightened and sad" — instead of what followed. Being frightened is not a consequence; a cut knee, a telephone call home and a mopped yard are.',
    'To: and From: filled in the wrong way round, so the report seems to come from the Principal, or no name at the foot of the page at all. A report from nobody cannot be acted on, and neither can one that appears to come from the adult you are writing to.',
    'Turning the suggestion into a complaint about an adult: "I suggest that the teacher on duty should watch the yard properly." Your suggestion is about the place or the rule, not about somebody\'s work — where a bin goes, where a class eats, which gate is used.',
    'Telling the middle like a film, scene by scene, until the page is nearly full and the last bullet never gets written. Plain sentences in the middle are what buy you the room for the end.'
  ]
}
);
