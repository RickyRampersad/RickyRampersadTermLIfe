/* SEA paper blueprint and the practice/mock paper set.
 *
 * Every figure here is taken from the Ministry's own ASSESSMENT FRAMEWORK FOR
 * THE SECONDARY ENTRANCE ASSESSMENT 2025-2028 (Tables 1-8), which is linked on
 * the Resources page. Nothing is invented and nothing is copied from a
 * commercial practice-test book: the blueprint is a published specification,
 * and the items that fill it are this hub's own.
 *
 * Structure the child actually sits:
 *   ELA Writing   50 min · 3 prompts offered, ONE answered · 4 scoring criteria
 *   Mathematics   75 min · 40 items · 75 marks · 3 sections
 *   ELA           75 min · 36 items · 64 marks · 2 sections
 *   Weighting     Mathematics 100 : ELA 60 : ELA Writing 40
 */
(function (global) {
  'use strict';

  var BLUEPRINT = {
    weighting: { 'p-mathematics': 100, 'p-ela': 60, 'p-ela-writing': 40 },
    order: ['p-ela-writing', 'p-mathematics', 'p-ela'],

    'p-mathematics': {
      subj: 'p-mathematics', name: 'Mathematics', minutes: 75, items: 40, marks: 75,
      /* Table 6 - items and marks per section */
      sections: [
        { n: 'I',   items: 20, perItem: 1,    marks: 20, note: 'One mark each. Answer every one — there is no penalty for a wrong answer.' },
        { n: 'II',  items: 16, perItem: '2-3', marks: 39, note: 'Two or three marks each. Show the working: method carries marks even when the answer is wrong.' },
        { n: 'III', items: 4,  perItem: 4,    marks: 16, note: 'Four marks each. These are the multi-step problems. Budget about four minutes each.' }
      ],
      /* Table 7a/7b - items and marks by strand, and which of our strands feed each */
      strands: [
        { key:'Number',      items:19, marks:34, from:['pm-place','pm-ops','pm-fractions','pm-decimals','pm-money'] },
        { key:'Geometry',    items:6,  marks:11, from:['pm-shapes','pm-angles'] },
        { key:'Measurement', items:9,  marks:18, from:['pm-time','pm-measure','pm-area'] },
        { key:'Statistics',  items:6,  marks:12, from:['pm-graphs','pm-average'] }
      ],
      /* Table 8 - thinking processes across the whole paper */
      thinking: [ { key:'Knowing', items:18, pct:45 }, { key:'Applying', items:14, pct:35 }, { key:'Reasoning', items:8, pct:20 } ]
    },

    'p-ela': {
      subj: 'p-ela', name: 'English Language Arts', minutes: 75, items: 36, marks: 64,
      sections: [
        { n: 'I',  items: 18, marks: 30, note: 'Spelling, punctuation, capitalisation and grammar — all set within a passage, not as isolated words.' },
        { n: 'II', items: 18, marks: 34, note: 'Reading comprehension across three text types. Read the questions first, then hunt.' }
      ],
      /* Table 4 - the six blocks that make up the paper */
      strands: [
        { key:'Spelling in context',            items:6, marks:12, section:'I',  from:['pe-spell'] },
        { key:'Punctuation & capitalisation',   items:6, marks:6,  section:'I',  from:['pe-punct'] },
        { key:'Grammar in context',             items:6, marks:12, section:'I',  from:['pe-grammar','pe-vocab'] },
        { key:'Fiction / non-fiction',          items:7, marks:13, section:'II', from:['pe-fiction','pe-nonfict'] },
        { key:'Poetry',                         items:7, marks:13, section:'II', from:['pe-poetry'] },
        { key:'Graphic text',                   items:4, marks:8,  section:'II', from:['pe-graphic'] }
      ],
      /* Table 5 - comprehension thinking processes */
      thinking: [ { key:'Literal', items:5, pct:28 }, { key:'Inferential', items:8, pct:44 }, { key:'Evaluation / Appreciation', items:5, pct:28 } ]
    },

    'p-ela-writing': {
      subj: 'p-ela-writing', name: 'ELA Writing', minutes: 50, items: 3, answer: 1,
      note: 'Three prompts are set — all three narrative, or all three expository. You answer ONE. Two examiners score it.',
      criteria: [
        { key:'Content',              what:'Ideas that fit the prompt, developed with detail rather than listed.' },
        { key:'Language Use',         what:'Word choice, sentence variety, and for a story, description and figurative language.' },
        { key:'Grammar and Mechanics',what:'Spelling, punctuation, capitalisation, agreement and tense.' },
        { key:'Organisation',         what:'A clear beginning, middle and end, with paragraphs that follow each other logically.' }
      ]
    }
  };

  /* ---------------------------------------------------------------------- *
   * The paper set: 12 practice papers and 2 mock examinations per subject.
   *
   * A mock is not a harder practice paper. It is sat under examination
   * conditions - full blueprint, full time, no feedback until the end - which
   * is why only two are set. Practice papers give feedback as you go.
   * ---------------------------------------------------------------------- */
  var PRACTICE = 12, MOCKS = 2;

  /* Writing is the one paper where the bank is not the limit: three prompts a
     paper, fourteen papers, forty-two prompts - all written out in full below,
     so no child ever meets the same prompt twice.

     The SHAPES come from the real papers, read page by page from the Ministry's
     own scans (2010, 2011, 2012, 2018, 2019; the 2013 scan is missing its topic
     page). Of the fifteen real topics that could be read, only four were a free
     story. Six were LETTERS to a named person, three were REPORTS to a teacher
     or principal, and two required given sentences to appear word for word.

     That is why every prompt below carries `form`, `to` and `must`: a child who
     writes a beautiful story when the paper asked for a report to the principal
     scores zero for Content and full marks for everything else. The paper names
     the form, the audience and what must appear, and those are the three things
     that get dropped. */
  var WRITING = [
    /* ---- narrative: a free story ---- */
    { paper:1, kind:'narrative', prompts:[
      { t:'Write a story about a day when you went somewhere unwillingly, and something surprising happened.',
        form:'story', must:['you must go somewhere UNWILLINGLY \u2014 show that you did not want to',
                            'something SURPRISING must happen after you get there'] },
      { t:'Write a story about a competition in your neighbourhood that did not go the way anyone expected.',
        form:'story', must:['a competition, in your own neighbourhood','it must NOT go as expected'] },
      { t:'Write a story about a promise you found hard to keep.',
        form:'story', must:['a promise YOU made','show why keeping it was hard'] } ] },

    { paper:3, kind:'narrative', prompts:[
      { t:'Write a story about the day the lights went out in your village.',
        form:'story', must:['the lights go out','it happens where you live, not somewhere invented'] },
      { t:'Write a story about something you lost and the person who returned it.',
        form:'story', must:['something of yours is lost','another person returns it \u2014 that person matters'] },
      { t:'Write a story about a neighbour everyone misjudged.',
        form:'story', must:['a neighbour','show the wrong opinion first, then what was really true'] } ] },

    { paper:5, kind:'narrative', prompts:[
      { t:'Write a story about a journey that had to be abandoned halfway.',
        form:'story', must:['a journey that starts','it must be given up partway \u2014 say why'] },
      { t:'Write a story about the day you were trusted with something important.',
        form:'story', must:['someone trusts YOU','what you were trusted with must matter'] },
      { t:'Write a story about an afternoon at the beach that turned frightening.',
        form:'story', must:['the beach, in the afternoon','it must start well and turn frightening'] } ] },

    { paper:7, kind:'narrative', prompts:[
      { t:'Write a story about a decision you had to make alone.',
        form:'story', must:['a real decision','you must be ALONE in making it'] },
      { t:'Write a story about a visitor who changed your household for a week.',
        form:'story', must:['a visitor','your household is different because of them'] },
      { t:'Write a story about the day you finally told the truth.',
        form:'story', must:['something was hidden first','you tell the truth, and something follows'] } ] },

    /* ---- narrative: the given words must appear, in those words ---- */
    { paper:9, kind:'narrative', prompts:[
      { t:'Write an exciting story that includes these words: "The gate was open. It had never been open before."',
        form:'story', must:['the words "The gate was open. It had never been open before." EXACTLY as given'] },
      { t:'Write a story that includes these words: "I counted the money twice. There was far too much of it."',
        form:'story', must:['the words "I counted the money twice. There was far too much of it." EXACTLY as given'] },
      { t:'Write a story that includes these words: "Everybody stopped talking when she walked in."',
        form:'story', must:['the words "Everybody stopped talking when she walked in." EXACTLY as given'] } ] },

    { paper:11, kind:'narrative', prompts:[
      { t:'Write a story that includes these words: "The lights went out. Somewhere below us, a door closed."',
        form:'story', must:['the words "The lights went out. Somewhere below us, a door closed." EXACTLY as given'] },
      { t:'Write a story that ENDS with these words: "...and I never walked that road alone again."',
        form:'story', must:['the words "...and I never walked that road alone again." as your LAST words'] },
      { t:'Write a story that includes these words: "He handed me the envelope and walked away without a word."',
        form:'story', must:['the words "He handed me the envelope and walked away without a word." EXACTLY as given'] } ] },

    { paper:13, kind:'narrative', mock:1, prompts:[
      { t:'Write a story that includes these words: "The rain had been falling for three days. Then the river came."',
        form:'story', must:['the words "The rain had been falling for three days. Then the river came." EXACTLY as given'] },
      { t:'Write a story that BEGINS with these words: "We were not supposed to be there at all."',
        form:'story', must:['the words "We were not supposed to be there at all." as your FIRST words'] },
      { t:'Write a story that includes these words: "\u201cDon\u2019t open it,\u201d she said. I opened it."',
        form:'story', must:['the words "\u201cDon\u2019t open it,\u201d she said. I opened it." EXACTLY as given'] } ] },

    /* ---- expository: a letter to a named person (2011, 2012 shape) ---- */
    { paper:2, kind:'expository', prompts:[
      { t:'Your community has no safe place for children to play. Write a letter to your Member of Parliament describing the problem and suggesting what could be done.',
        form:'letter', to:'your Member of Parliament',
        must:['laid out as a LETTER \u2014 greeting, body, closing','describe the problem','suggest what could be done'] },
      { t:'Write a letter to your Principal asking that the school library be opened at lunchtime, giving your reasons.',
        form:'letter', to:'your Principal',
        must:['laid out as a LETTER','a clear request','your reasons for it'] },
      { t:'Write a letter to your best friend telling them about a book you could not put down, and persuading them to read it.',
        form:'letter', to:'your best friend',
        must:['laid out as a LETTER','what the book was and why it held you','persuade them to read it'] } ] },

    { paper:4, kind:'expository', prompts:[
      { t:'Write a letter to the President of the P.T.A. explaining why your class should be allowed to keep a school garden.',
        form:'letter', to:'the President of the P.T.A.',
        must:['laid out as a LETTER','explain the benefits','address an adult in authority properly'] },
      { t:'Write a letter to your grandmother describing a family celebration she was not able to attend.',
        form:'letter', to:'your grandmother',
        must:['laid out as a LETTER','describe the celebration so she can picture it'] },
      { t:'Write a letter to a company thanking them for equipment they donated to your school, and saying how it will be used.',
        form:'letter', to:'the company',
        must:['laid out as a LETTER','THANK them','say how the equipment will be used'] } ] },

    { paper:6, kind:'expository', prompts:[
      { t:'Write a letter to your Principal suggesting one change that would make the school day better for everyone.',
        form:'letter', to:'your Principal',
        must:['laid out as a LETTER','ONE change, not a list','say why it helps everyone'] },
      { t:'Write a letter to a cousin abroad describing what Carnival is like where you live.',
        form:'letter', to:'your cousin abroad',
        must:['laid out as a LETTER','describe it for someone who has never seen it'] },
      { t:'Write a letter to the editor of a newspaper about litter in your district.',
        form:'letter', to:'the editor',
        must:['laid out as a LETTER','a formal tone \u2014 this one is printed in public','the problem, and what should change'] } ] },

    { paper:8, kind:'expository', prompts:[
      { t:'Write a letter to your class teacher explaining why you were absent and what you will do to catch up.',
        form:'letter', to:'your class teacher',
        must:['laid out as a LETTER','the reason for the absence','what you will do to catch up'] },
      { t:'Write a letter to a friend who has just moved away, telling them what has changed at school.',
        form:'letter', to:'your friend who moved away',
        must:['laid out as a LETTER','what has CHANGED, not just what happens'] },
      { t:'Write a letter to the Regional Corporation asking for a street light to be repaired, explaining why it matters.',
        form:'letter', to:'the Regional Corporation',
        must:['laid out as a LETTER','a formal tone','where the light is, and why it matters'] } ] },

    /* ---- expository: a report to a teacher or principal (2019 shape) ---- */
    { paper:10, kind:'expository', prompts:[
      { t:'Two students were injured when a shelf fell in the classroom. Write a report to your teacher about the incident.',
        form:'report', to:'your teacher',
        must:['written as a REPORT, not a story','the date, time and place','who was involved and what happened','what was done afterwards'] },
      { t:'Your class took part in a clean-up of the school grounds. Write a report to your principal about the day.',
        form:'report', to:'your principal',
        must:['written as a REPORT','the date, time and who took part','what was done','what the result was'] },
      { t:'Write a report to your teacher about a school outing, including where you went, what you learnt and who you met.',
        form:'report', to:'your teacher',
        must:['written as a REPORT','where you went','what you learnt','who you met'] } ] },

    { paper:12, kind:'expository', prompts:[
      { t:'A pipe burst in the school yard during the morning break. Write a report to your principal about what happened.',
        form:'report', to:'your principal',
        must:['written as a REPORT','the date, time and place','what happened and who was affected','what was done about it'] },
      { t:'Your class held a bake sale to raise funds. Write a report to your teacher on how it was organised and what was raised.',
        form:'report', to:'your teacher',
        must:['written as a REPORT','how it was organised','what was raised'] },
      { t:'Write a report to your principal about a visitor who spoke to your class, including what was said and what the class learnt.',
        form:'report', to:'your principal',
        must:['written as a REPORT','who the visitor was and when','what was said','what the class learnt'] } ] },

    { paper:14, kind:'expository', mock:2, prompts:[
      { t:'Write a report to your teacher about an accident you witnessed on the way to school.',
        form:'report', to:'your teacher',
        must:['written as a REPORT, not a story','the date, time and place','who was involved','what happened afterwards'] },
      { t:'Your school held a sports day. Write a report to your principal, including the date, the events and the results.',
        form:'report', to:'your principal',
        must:['written as a REPORT','the date','the events','the results'] },
      { t:'Write a report to your teacher about a competition your class entered on the theme \u201cKeeping Our Island Clean\u201d.',
        form:'report', to:'your teacher',
        must:['written as a REPORT','use the theme \u201cKeeping Our Island Clean\u201d as given','what the class did','what came of it'] } ] }
  ];

  global.CSEC_SEA = {
    blueprint: BLUEPRINT,
    practiceCount: PRACTICE,
    mockCount: MOCKS,
    writing: WRITING
  };
})(typeof window !== 'undefined' ? window : this);
