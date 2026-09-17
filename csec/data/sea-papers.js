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
     so no child ever meets the same prompt twice. Papers alternate narrative
     and expository, as the real paper is one or the other in any given year. */
  var WRITING = [
    { paper:1,  kind:'narrative', prompts:[
      'Write a story that ends with the words: "...and that was the day I stopped being afraid of the dark."',
      'Write a story about a child who finds something valuable on the way home from school.',
      'Write a story that begins: "The rain had not stopped for three days."' ] },
    { paper:2,  kind:'expository', prompts:[
      'Explain to a child who has just moved to Trinidad how to prepare for the SEA examination.',
      'Write a report for your principal explaining why your school needs a library.',
      'Explain the steps involved in preparing a meal that your family enjoys.' ] },
    { paper:3,  kind:'narrative', prompts:[
      'Write a story about a promise that was difficult to keep.',
      'Write a story that begins: "I knew the moment I opened the gate that something was wrong."',
      'Write a story about a day when everything went wrong, and how it ended well.' ] },
    { paper:4,  kind:'expository', prompts:[
      'Explain why it is important for young people to take part in sport.',
      'Write a report on the ways your community could reduce flooding.',
      'Explain to a visitor what makes Carnival important to Trinidad and Tobago.' ] },
    { paper:5,  kind:'narrative', prompts:[
      'Write a story about a journey that did not go as planned.',
      'Write a story that ends with the words: "...she never told anyone what she had seen."',
      'Write a story about an act of kindness from a stranger.' ] },
    { paper:6,  kind:'expository', prompts:[
      'Explain the effects of throwing rubbish into drains and rivers.',
      'Write a report explaining how your school could use technology better.',
      'Explain why it is important to respect people who are different from you.' ] },
    { paper:7,  kind:'narrative', prompts:[
      'Write a story about a competition you badly wanted to win.',
      'Write a story that begins: "The last bus had already gone."',
      'Write a story about a secret that could not be kept.' ] },
    { paper:8,  kind:'expository', prompts:[
      'Explain how a young person can stay healthy.',
      'Write a report on the most serious problem facing your community and how it could be solved.',
      'Explain why reading is important, even for someone who does not enjoy it.' ] },
    { paper:9,  kind:'narrative', prompts:[
      'Write a story about the day you had to be braver than you felt.',
      'Write a story that ends with the words: "...and the whole class stood up and cheered."',
      'Write a story about a misunderstanding between two friends.' ] },
    { paper:10, kind:'expository', prompts:[
      'Explain the importance of water and how it should be conserved.',
      'Write a report explaining what makes a good teacher.',
      'Explain how children your age can help an elderly neighbour.' ] },
    { paper:11, kind:'narrative', prompts:[
      'Write a story about something that was lost and then found.',
      'Write a story that begins: "Nobody believed me, not even my own brother."',
      'Write a story about a decision you had to make on your own.' ] },
    { paper:12, kind:'expository', prompts:[
      'Explain why some people find it hard to tell the truth.',
      'Write a report on how your school could encourage children to eat better.',
      'Explain what you would change about your community, and why.' ] },
    { paper:13, kind:'narrative', mock:1, prompts:[
      'Write a story about a moment that changed the way you saw someone.',
      'Write a story that ends with the words: "...it had been the right choice after all."',
      'Write a story about a storm and the people who came through it.' ] },
    { paper:14, kind:'expository', mock:2, prompts:[
      'Explain the part that family plays in a child’s success at school.',
      'Write a report explaining why your community should have a recreation ground.',
      'Explain how you would teach a younger child to swim, ride a bicycle, or play an instrument.' ] }
  ];

  global.CSEC_SEA = {
    blueprint: BLUEPRINT,
    practiceCount: PRACTICE,
    mockCount: MOCKS,
    writing: WRITING
  };
})(typeof window !== 'undefined' ? window : this);
