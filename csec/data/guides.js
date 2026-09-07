/* CSEC Study Hub — guided method library
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
  id:'g-ma-linear', subj:'mathematics', strand:'ma-algebra', form:1,
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
  id:'g-ma-quad', subj:'mathematics', strand:'ma-algebra', form:3,
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
  id:'g-ma-simul', subj:'mathematics', strand:'ma-algebra', form:3,
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
  id:'g-ma-sets', subj:'mathematics', strand:'ma-sets', form:2,
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
  id:'g-ma-consumer', subj:'mathematics', strand:'ma-consumer', form:3,
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
  id:'g-ma-trig', subj:'mathematics', strand:'ma-geom', form:4,
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
  id:'g-ma-gradient', subj:'mathematics', strand:'ma-relations', form:3,
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
  id:'g-ea-summary', subj:'english-a', strand:'ea-summary', form:3,
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
  id:'g-ea-argue', subj:'english-a', strand:'ea-arg', form:4,
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
  id:'g-eb-pee', subj:'english-b', strand:'eb-essay', form:3,
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
  id:'g-hi-essay', subj:'history', strand:'hi-skills', form:4,
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
  id:'g-ph-formula', subj:'physics', strand:'ph-mech', form:3,
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
  id:'g-ch-balance', subj:'chemistry', strand:'ch-mole', form:3,
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
  id:'g-bi-punnett', subj:'biology', strand:'bi-genes', form:4,
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
  id:'g-ge-map', subj:'geography', strand:'ge-maps', form:2,
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
  id:'g-it-trace', subj:'information-technology', strand:'it-solve', form:4,
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
