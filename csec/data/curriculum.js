/* CSEC Study Hub — curriculum registry
 * Subjects, syllabus strands and the Form 1-5 progression.
 *
 * Strands follow the CSEC syllabus section structure so that practice,
 * mastery and the daily plan all key off the same names the examiner uses.
 * `forms` marks the forms in which a strand is normally taught, which is what
 * lets Form 2 and Form 3 see a plan that is not full of Form 5 material.
 */
window.CSEC_CURRICULUM = {

  /* Default subject ticks, by stage. A Standard 3 has no business being handed
     a fourteen-subject CSEC timetable, so the picker seeds from the stage the
     student is actually in. Editable in Settings -> Subjects either way. */
  defaultPrimary: [
    'p-mathematics','p-ela','p-ela-writing','p-science','p-social-studies'
  ],

  /* Which 14 subjects are selected by default at secondary. */
  defaultSelection: [
    'english-a','english-b','mathematics','spanish','french',
    'physics','chemistry','biology','geography','history',
    'social-studies','visual-arts','physical-education','information-technology'
  ],

  subjects: {

    /* ===================== PRIMARY — Standards 1 to 5 =====================
     * The three SEA papers first, then the rest of the primary curriculum.
     * Strand names follow the Ministry's SEA Assessment Framework 2025-2028:
     * Mathematics is assessed across Number, Measurement, Geometry and
     * Statistics; English Language Arts across Spelling, Punctuation and
     * Capitalisation, Standard English Grammar and Reading Comprehension; and
     * ELA Writing is one narrative or expository response, scored on Content,
     * Language Use, Grammar and Mechanics, and Organisation.
     */
    'p-mathematics': {
      name:'Mathematics', short:'Maths', icon:'\u{1F522}', group:'SEA papers', stage:'primary',
      blurb:'The four strands SEA tests: Number, Measurement, Geometry, Statistics.',
      papers:'SEA Mathematics \u2014 40 items',
      strands:[
        { id:'pm-place',   name:'Whole Numbers & Place Value', levels:[1,2,3,4,5], note:'Reading, writing, ordering and rounding numbers.' },
        { id:'pm-ops',     name:'The Four Operations',         levels:[1,2,3,4,5], note:'Adding, subtracting, multiplying and dividing, including word problems.' },
        { id:'pm-fractions',name:'Fractions',                  levels:[2,3,4,5],   note:'Equivalent fractions, comparing, adding and subtracting, fractions of a quantity.' },
        { id:'pm-decimals',name:'Decimals & Percent',          levels:[4,5],       note:'Place value in decimals, converting, percent of a quantity.' },
        { id:'pm-money',   name:'Money',                       levels:[1,2,3,4,5], note:'Buying, change, bills, profit and loss.' },
        { id:'pm-time',    name:'Time',                        levels:[1,2,3,4,5], note:'Telling time, 24-hour clock, duration, timetables.' },
        { id:'pm-measure', name:'Length, Mass & Capacity',     levels:[1,2,3,4,5], note:'Units, estimating, converting, measuring accurately.' },
        { id:'pm-area',    name:'Perimeter, Area & Volume',    levels:[3,4,5],     note:'Squares, rectangles, compound shapes, cuboids.' },
        { id:'pm-shapes',  name:'Solids & Plane Shapes',       levels:[1,2,3,4,5], note:'Naming, properties, faces, edges, vertices, nets.' },
        { id:'pm-angles',  name:'Lines, Angles & Symmetry',    levels:[3,4,5],     note:'Types of lines and angles, symmetry, simple transformations.' },
        { id:'pm-graphs',  name:'Tables, Pictographs & Bar Graphs', levels:[2,3,4,5], note:'Reading and drawing graphs, answering questions from data.' },
        { id:'pm-average', name:'Mean, Mode & Median',         levels:[4,5],       note:'Finding and using averages from a small data set.' }
      ]
    },
    'p-ela': {
      name:'English Language Arts', short:'ELA', icon:'\u{1F4D6}', group:'SEA papers', stage:'primary',
      blurb:'Spelling, punctuation, grammar and reading comprehension.',
      papers:'SEA English Language Arts \u2014 36 items, 64 marks',
      strands:[
        { id:'pe-spell',   name:'Spelling',                     levels:[1,2,3,4,5], note:'The common words, spelling patterns, and words that are always got wrong.' },
        { id:'pe-punct',   name:'Punctuation & Capitalisation',  levels:[1,2,3,4,5], note:'Full stops, capitals, commas, question marks, speech marks, apostrophes.' },
        { id:'pe-grammar', name:'Standard English Grammar',      levels:[1,2,3,4,5], note:'Nouns, verbs, tense, agreement, pronouns, adjectives and adverbs.' },
        { id:'pe-vocab',   name:'Vocabulary in Context',         levels:[3,4,5],     note:'Working out a word from the sentence around it \u2014 tested inside comprehension.' },
        { id:'pe-fiction', name:'Comprehension \u2014 Fiction',  levels:[2,3,4,5],   note:'Story passages: what happened, why, and what the writer implies.' },
        { id:'pe-nonfict', name:'Comprehension \u2014 Non-fiction', levels:[3,4,5],  note:'Reports and articles: finding facts and following an explanation.' },
        { id:'pe-poetry',  name:'Comprehension \u2014 Poetry',   levels:[3,4,5],     note:'Reading a poem for meaning, feeling and word choice.' },
        { id:'pe-graphic', name:'Comprehension \u2014 Graphic Text', levels:[4,5],   note:'Charts, labels, advertisements and diagrams as reading material.' }
      ]
    },
    'p-ela-writing': {
      name:'ELA Writing', short:'Writing', icon:'\u{270D}', group:'SEA papers', stage:'primary',
      blurb:'One story or report, written under time and marked by two people.',
      papers:'SEA ELA Writing \u2014 three items, one answered',
      strands:[
        { id:'pw-narrative',name:'Narrative Writing',          levels:[2,3,4,5], note:'A story with a beginning, a middle and an end that actually ends.' },
        { id:'pw-expository',name:'Expository Writing',        levels:[4,5],     note:'A report that explains, using factual detail rather than story.' },
        { id:'pw-language', name:'Descriptive & Figurative Language', levels:[3,4,5], note:'Sensory detail and comparison that earn their place.' },
        { id:'pw-organise', name:'Organisation & Paragraphing', levels:[3,4,5],  note:'Planning first, one idea per paragraph, a shape the reader can follow.' },
        { id:'pw-mechanics',name:'Grammar & Mechanics in Writing', levels:[2,3,4,5], note:'The marks lost to capitals, full stops and agreement in your own writing.' }
      ]
    },
    'p-science': {
      name:'Science', short:'Science', icon:'\u{1F52C}', group:'Primary', stage:'primary',
      blurb:'The primary science curriculum. Not tested at SEA, but it builds Form 1.',
      papers:'School assessment',
      strands:[
        { id:'ps-living', name:'Living Things',        levels:[1,2,3,4,5], note:'Plants, animals, habitats, life cycles, classification.' },
        { id:'ps-body',   name:'The Human Body',       levels:[2,3,4,5],   note:'Systems, senses, teeth, nutrition, keeping healthy.' },
        { id:'ps-matter', name:'Matter & Materials',   levels:[2,3,4,5],   note:'Solids, liquids, gases, properties, changes of state.' },
        { id:'ps-energy', name:'Energy & Forces',      levels:[3,4,5],     note:'Light, sound, heat, electricity, magnets, pushes and pulls.' },
        { id:'ps-earth',  name:'Earth & Space',        levels:[3,4,5],     note:'Weather, water cycle, soil, the solar system.' }
      ]
    },
    'p-social-studies': {
      name:'Social Studies', short:'Soc St', icon:'\u{1F3DD}', group:'Primary', stage:'primary',
      blurb:'Self, community, country and citizenship.',
      papers:'School assessment',
      strands:[
        { id:'pss-self',   name:'Self, Family & School',        levels:[1,2,3],     note:'Who I am, my family, my school and the rules we keep.' },
        { id:'pss-comm',   name:'Our Community & Nation',       levels:[2,3,4,5],   note:'Services, leaders, national symbols, how a country is run.' },
        { id:'pss-geog',   name:'Geography of Trinidad & Tobago',levels:[3,4,5],    note:'Maps, regions, landforms, weather, natural resources.' },
        { id:'pss-history',name:'History & Heritage',           levels:[3,4,5],     note:'The First Peoples, settlement, emancipation, arrival, independence.' },
        { id:'pss-citizen',name:'Citizenship & Values',         levels:[1,2,3,4,5], note:'Rights, responsibilities, respect and living in a plural society.' }
      ]
    },
    'p-spanish': {
      name:'Spanish (Primary)', short:'Spanish', icon:'\u{1F1EA}\u{1F1F8}', group:'Primary', stage:'primary',
      blurb:'First words and phrases, ahead of secondary Spanish.',
      papers:'School assessment',
      strands:[
        { id:'psp-greet', name:'Greetings & Introductions', levels:[1,2,3,4,5], note:'Saying hello, your name, your age, how you are.' },
        { id:'psp-number',name:'Numbers, Colours & Days',   levels:[1,2,3,4,5], note:'Counting, colours, days, months.' },
        { id:'psp-family',name:'Family, School & Food',     levels:[3,4,5],     note:'Everyday vocabulary for the things around you.' }
      ]
    },
    'p-vapa': {
      name:'Visual & Performing Arts', short:'VAPA', icon:'\u{1F3A8}', group:'Primary', stage:'primary',
      blurb:'Drawing, music, dance and drama.',
      papers:'School assessment',
      strands:[
        { id:'pv-draw',  name:'Drawing & Colour',      levels:[1,2,3,4,5], note:'Line, shape, colour mixing, drawing from observation.' },
        { id:'pv-music', name:'Music & Rhythm',        levels:[1,2,3,4,5], note:'Beat, rhythm, singing, simple notation, local forms.' },
        { id:'pv-drama', name:'Drama & Movement',      levels:[1,2,3,4,5], note:'Role play, performance, dance and expression.' }
      ]
    },
    'p-pe': {
      name:'Physical Education (Primary)', short:'PE', icon:'\u{26BD}', group:'Primary', stage:'primary',
      blurb:'Movement, games and healthy habits.',
      papers:'School assessment',
      strands:[
        { id:'ppe-move', name:'Movement & Coordination', levels:[1,2,3,4,5], note:'Running, throwing, catching, balance, agility.' },
        { id:'ppe-games',name:'Games & Fair Play',       levels:[1,2,3,4,5], note:'Rules, teamwork, winning and losing well.' },
        { id:'ppe-health',name:'Healthy Habits',         levels:[1,2,3,4,5], note:'Exercise, food, sleep, hygiene, water.' }
      ]
    },

    /* ===================== SECONDARY — Forms 1 to 5 ===================== */
    'english-a': {
      name: 'English A', short: 'Eng A', icon: '✍️', group: 'Languages',
      blurb: 'Comprehension, summary and the four essay types.',
      papers: 'Paper 01 (60 MCQ) · Paper 02 (essays & summary) · SBA',
      strands: [
        { id:'ea-comp',   name:'Comprehension & Understanding', levels:[6,7,8,9,10], note:'Reading for literal, inferential and evaluative meaning.' },
        { id:'ea-summary',name:'Summary Writing',               levels:[7,8,9,10],   note:'Reducing a passage to its argument in your own words, to a word limit.' },
        { id:'ea-grammar',name:'Grammar & Mechanics',           levels:[6,7,8,9,10], note:'Agreement, tense, punctuation, sentence structure.' },
        { id:'ea-vocab',  name:'Vocabulary & Word Choice',      levels:[6,7,8,9,10],  note:'Register, connotation, precision.' },
        { id:'ea-narr',   name:'Narrative & Descriptive Writing',levels:[6,7,8,9,10], note:'Story and description — the Section B options.' },
        { id:'ea-arg',    name:'Argumentative & Expository Writing',levels:[8,9,10],  note:'Taking a position and defending it; explaining a process.' },
        { id:'ea-persuade',name:'Persuasive Writing & Register', levels:[9,10],       note:'Writing for a stated audience and purpose.' },
        { id:'ea-sba',    name:'School-Based Assessment',        levels:[9,10],       note:'Portfolio: plan of inquiry, artefacts, written report, reflections.' }
      ]
    },
    'english-b': {
      name: 'English B', short: 'Eng B', icon: '📖', group: 'Languages',
      blurb: 'Literature — poetry, prose and drama.',
      papers: 'Paper 02 (essays on set texts) · SBA',
      strands: [
        { id:'eb-poetry', name:'Poetry',              levels:[6,7,8,9,10], note:'Imagery, tone, mood, form, sound devices.' },
        { id:'eb-prose',  name:'Prose Fiction',       levels:[7,8,9,10],   note:'Novel study — plot, character, theme, setting, narrative voice.' },
        { id:'eb-drama',  name:'Drama',               levels:[8,9,10],     note:'Play study — conflict, stagecraft, dramatic irony.' },
        { id:'eb-short',  name:'Short Stories',       levels:[6,7,8,9,10], note:'Compression, twist, single effect.' },
        { id:'eb-devices',name:'Literary Devices',    levels:[6,7,8,9,10], note:'Metaphor, simile, personification, symbolism, irony.' },
        { id:'eb-essay',  name:'Literature Essay Craft',levels:[8,9,10],   note:'Point-Evidence-Explanation, quoting accurately, answering the question asked.' }
      ]
    },
    'mathematics': {
      name: 'Mathematics', short: 'Maths', icon: '📐', group: 'Core',
      blurb: 'The nine CSEC Mathematics sections.',
      papers: 'Paper 01 (60 MCQ) · Paper 02 (structured) · SBA',
      strands: [
        { id:'ma-number', name:'Number Theory & Computation', levels:[6,7,8,9,10], note:'Fractions, decimals, ratio, percentage, indices, standard form.' },
        { id:'ma-consumer',name:'Consumer Arithmetic',        levels:[7,8,9,10],   note:'Wages, discount, VAT, interest, hire purchase, currency.' },
        { id:'ma-sets',   name:'Sets',                        levels:[6,7,8,9,10], note:'Venn diagrams, union, intersection, complement, problem solving.' },
        { id:'ma-measure',name:'Measurement',                 levels:[6,7,8,9,10], note:'Perimeter, area, volume, scale, rates, compound shapes.' },
        { id:'ma-stats',  name:'Statistics',                  levels:[7,8,9,10],   note:'Mean, median, mode, tables, charts, cumulative frequency, probability.' },
        { id:'ma-algebra',name:'Algebra',                     levels:[6,7,8,9,10], note:'Expressions, equations, factorising, simultaneous, quadratics.' },
        { id:'ma-relations',name:'Relations, Functions & Graphs',levels:[8,9,10],  note:'Mapping, notation, linear and quadratic graphs, gradient, inequalities.' },
        { id:'ma-geom',   name:'Geometry & Trigonometry',     levels:[7,8,9,10],   note:'Angles, polygons, circles, transformations, Pythagoras, sine/cosine rule.' },
        { id:'ma-vectors',name:'Vectors & Matrices',          levels:[9,10],       note:'Vector notation and algebra, matrix operations, transformations.' }
      ]
    },
    'spanish': {
      name: 'Spanish', short: 'Span', icon: '🇪🇸', group: 'Languages',
      blurb: 'The four skills across the CSEC themes.',
      papers: 'Paper 01 (listening & reading) · Paper 02 (writing) · Paper 03 (oral)',
      strands: [
        { id:'sp-listen', name:'Listening Comprehension', levels:[6,7,8,9,10], note:'Understanding spoken Spanish at natural pace.' },
        { id:'sp-read',   name:'Reading Comprehension',   levels:[6,7,8,9,10], note:'Signs, notices, letters, articles.' },
        { id:'sp-speak',  name:'Oral & Pronunciation',    levels:[6,7,8,9,10], note:'Responding to situations, picture description, conversation.' },
        { id:'sp-write',  name:'Directed & Free Writing', levels:[7,8,9,10],   note:'Notes, letters, compositions to a word count.' },
        { id:'sp-gram',   name:'Grammar & Verb Tenses',   levels:[6,7,8,9,10], note:'Present, preterite, imperfect, future, subjunctive; ser vs estar.' },
        { id:'sp-themes', name:'Themes & Vocabulary',     levels:[6,7,8,9,10], note:'Personal ID, home, school, food, health, travel, work, environment.' }
      ]
    },
    'french': {
      name: 'French', short: 'Fren', icon: '🇫🇷', group: 'Languages',
      blurb: 'The four skills across the CSEC themes.',
      papers: 'Paper 01 (listening & reading) · Paper 02 (writing) · Paper 03 (oral)',
      strands: [
        { id:'fr-listen', name:'Listening Comprehension', levels:[6,7,8,9,10], note:'Understanding spoken French at natural pace.' },
        { id:'fr-read',   name:'Reading Comprehension',   levels:[6,7,8,9,10], note:'Signs, notices, letters, articles.' },
        { id:'fr-speak',  name:'Oral & Pronunciation',    levels:[6,7,8,9,10], note:'Responding to situations, picture description, conversation.' },
        { id:'fr-write',  name:'Directed & Free Writing', levels:[7,8,9,10],   note:'Notes, letters, compositions to a word count.' },
        { id:'fr-gram',   name:'Grammar & Verb Tenses',   levels:[6,7,8,9,10], note:'Présent, passé composé, imparfait, futur, subjonctif; avoir vs être.' },
        { id:'fr-themes', name:'Themes & Vocabulary',     levels:[6,7,8,9,10], note:'Personal ID, home, school, food, health, travel, work, environment.' }
      ]
    },
    'physics': {
      name: 'Physics', short: 'Phys', icon: '⚛️', group: 'Sciences',
      blurb: 'Mechanics through to the physics of the atom.',
      papers: 'Paper 01 (60 MCQ) · Paper 02 (structured & essay) · SBA',
      strands: [
        { id:'ph-measure',name:'Measurement & SI Units',      levels:[6,7,8,9,10], note:'Quantities, prefixes, significant figures, uncertainty.' },
        { id:'ph-mech',   name:'Mechanics',                   levels:[7,8,9,10],   note:'Motion, forces, Newton’s laws, moments, density, pressure, energy.' },
        { id:'ph-thermal',name:'Thermal Physics & Kinetic Theory',levels:[8,9,10], note:'Temperature, heat capacity, latent heat, gas laws, transfer.' },
        { id:'ph-waves',  name:'Waves & Optics',              levels:[7,8,9,10],   note:'Wave properties, sound, light, reflection, refraction, lenses.' },
        { id:'ph-elec',   name:'Electricity & Magnetism',     levels:[8,9,10],     note:'Circuits, Ohm’s law, electrostatics, magnetic effects, induction.' },
        { id:'ph-atom',   name:'The Physics of the Atom',     levels:[9,10],       note:'Atomic models, radioactivity, half-life, nuclear energy.' }
      ]
    },
    'chemistry': {
      name: 'Chemistry', short: 'Chem', icon: '🧪', group: 'Sciences',
      blurb: 'Principles, organic and inorganic chemistry.',
      papers: 'Paper 01 (60 MCQ) · Paper 02 (structured & essay) · SBA',
      strands: [
        { id:'ch-matter', name:'States of Matter & Separation',levels:[6,7,8,9,10], note:'Particle theory, mixtures, filtration, distillation, chromatography.' },
        { id:'ch-atomic', name:'Atomic Structure & Bonding',   levels:[7,8,9,10],   note:'Electron configuration, periodic table, ionic, covalent, metallic.' },
        { id:'ch-mole',   name:'The Mole Concept',             levels:[8,9,10],     note:'Formulae, equations, molar mass, concentration, titration.' },
        { id:'ch-acids',  name:'Acids, Bases & Salts',         levels:[7,8,9,10],   note:'pH, neutralisation, salt preparation, indicators.' },
        { id:'ch-redox',  name:'Oxidation-Reduction & Electrochemistry',levels:[9,10],note:'Redox, reactivity series, electrolysis, corrosion.' },
        { id:'ch-organic',name:'Organic Chemistry',            levels:[9,10],       note:'Hydrocarbons, homologous series, alcohols, acids, polymers.' },
        { id:'ch-inorg',  name:'Inorganic & Industrial Chemistry',levels:[9,10],    note:'Metals, non-metals, qualitative analysis, industrial processes.' }
      ]
    },
    'biology': {
      name: 'Biology', short: 'Bio', icon: '🧬', group: 'Sciences',
      blurb: 'Living organisms, life processes and continuity.',
      papers: 'Paper 01 (60 MCQ) · Paper 02 (structured & essay) · SBA',
      strands: [
        { id:'bi-cells',  name:'Cells & Cell Processes',      levels:[6,7,8,9,10], note:'Cell structure, diffusion, osmosis, active transport.' },
        { id:'bi-env',    name:'Living Organisms & the Environment',levels:[6,7,8,9,10],note:'Classification, ecosystems, food chains, cycles, conservation.' },
        { id:'bi-nutri',  name:'Nutrition & Transport',        levels:[7,8,9,10],   note:'Photosynthesis, digestion, circulation, transpiration.' },
        { id:'bi-resp',   name:'Respiration & Excretion',      levels:[8,9,10],     note:'Aerobic/anaerobic respiration, gas exchange, kidney, skin.' },
        { id:'bi-coord',  name:'Coordination & Movement',      levels:[8,9,10],     note:'Nervous system, hormones, skeleton, muscles, homeostasis.' },
        { id:'bi-repro',  name:'Reproduction & Growth',        levels:[7,8,9,10],   note:'Plant and human reproduction, fertilisation, development.' },
        { id:'bi-genes',  name:'Continuity & Variation',       levels:[9,10],       note:'Mitosis, meiosis, genetics, inheritance, natural selection.' },
        { id:'bi-health', name:'Disease & Its Impact',         levels:[8,9,10],     note:'Pathogens, transmission, immunity, lifestyle disease.' }
      ]
    },
    'geography': {
      name: 'Geography', short: 'Geog', icon: '🗺️', group: 'Humanities',
      blurb: 'Natural systems, human systems and map work.',
      papers: 'Paper 01 (60 MCQ) · Paper 02 (structured) · SBA fieldwork',
      strands: [
        { id:'ge-maps',   name:'Map Reading & Field Skills',  levels:[6,7,8,9,10], note:'Grid references, scale, contours, cross-sections, bearings.' },
        { id:'ge-tectonic',name:'Tectonic & Landform Processes',levels:[7,8,9,10], note:'Plates, earthquakes, volcanoes, weathering, rivers, coasts, karst.' },
        { id:'ge-weather',name:'Weather, Climate & Vegetation',levels:[6,7,8,9,10],note:'Elements of weather, instruments, Caribbean climate, hurricanes.' },
        { id:'ge-pop',    name:'Population & Settlement',      levels:[7,8,9,10],   note:'Density, migration, urbanisation, settlement patterns.' },
        { id:'ge-econ',   name:'Economic Activity',            levels:[8,9,10],     note:'Agriculture, fishing, mining, manufacturing, tourism in the Caribbean.' },
        { id:'ge-hazard', name:'Natural Hazards & Sustainability',levels:[8,9,10],  note:'Hazard risk, mitigation, resource use, environmental management.' }
      ]
    },
    'history': {
      name: 'History', short: 'Hist', icon: '🏛️', group: 'Humanities',
      blurb: 'Caribbean history — the CSEC themes.',
      papers: 'Paper 01 (60 MCQ) · Paper 02 (essays) · SBA',
      strands: [
        { id:'hi-indigenous',name:'Indigenous Peoples & Europeans',levels:[6,7,8,9,10],note:'Taino, Kalinago, encounter, conquest, early settlement.' },
        { id:'hi-slavery', name:'Caribbean Economy & Slavery',  levels:[7,8,9,10],  note:'Sugar revolution, the trade in enslaved Africans, plantation society.' },
        { id:'hi-resist',  name:'Resistance & Revolt',          levels:[7,8,9,10],  note:'Day-to-day resistance, maroons, Haitian Revolution, major revolts.' },
        { id:'hi-emanc',   name:'Movements Towards Emancipation',levels:[8,9,10],   note:'Abolitionists, apprenticeship, emancipation and its terms.' },
        { id:'hi-adjust',  name:'Adjustments to Emancipation',  levels:[8,9,10],    note:'Peasantry, indentureship, immigration, changing labour.' },
        { id:'hi-indep',   name:'Movements Towards Independence',levels:[9,10],     note:'Labour unrest, Federation, nationalism, independence.' },
        { id:'hi-society', name:'Caribbean Society 1900-1985',  levels:[9,10],      note:'US influence, migration, culture, regional integration.' },
        { id:'hi-skills',  name:'Source Analysis & Essay Craft',levels:[6,7,8,9,10],note:'Reading sources, cause and effect, structuring a history essay.' }
      ]
    },
    'social-studies': {
      name: 'Social Studies', short: 'Soc', icon: '🏘️', group: 'Humanities',
      blurb: 'Individual and society, development, integration.',
      papers: 'Paper 01 (60 MCQ) · Paper 02 (structured & essay) · SBA',
      strands: [
        { id:'ss-family', name:'Individual, Family & Society',  levels:[6,7,8,9,10], note:'Family types, socialisation, roles, institutions.' },
        { id:'ss-gov',    name:'Government & Citizenship',      levels:[7,8,9,10],   note:'Systems of government, elections, rights and responsibilities.' },
        { id:'ss-dev',    name:'Sustainable Development & Resources',levels:[8,9,10],note:'Resource use, development indicators, environment.' },
        { id:'ss-region', name:'Regional Integration',          levels:[8,9,10],     note:'CARICOM, CSME, benefits and challenges of integration.' },
        { id:'ss-issues', name:'Social Issues & Problems',      levels:[7,8,9,10],   note:'Crime, unemployment, poverty, health, responses.' },
        { id:'ss-research',name:'Research Methods & SBA',       levels:[9,10],       note:'Statement of problem, questionnaires, presenting findings.' }
      ]
    },
    'visual-arts': {
      name: 'Visual Arts', short: 'Art', icon: '🎨', group: 'Expressive',
      blurb: 'Drawing, design, craft and art history.',
      papers: 'Paper 01 (written) · Portfolio & studio pieces',
      strands: [
        { id:'va-draw',   name:'Drawing & Observation',        levels:[6,7,8,9,10], note:'Line, proportion, shading, perspective, still life, figure.' },
        { id:'va-elements',name:'Elements & Principles of Design',levels:[6,7,8,9,10],note:'Line, shape, colour, texture; balance, rhythm, contrast, unity.' },
        { id:'va-print',  name:'Print, Textile & Graphic Design',levels:[7,8,9,10],  note:'Lino, screen, batik, tie-dye, lettering, layout.' },
        { id:'va-3d',     name:'Ceramics & Sculpture',          levels:[7,8,9,10],   note:'Pinch, coil, slab, modelling, carving, construction.' },
        { id:'va-history',name:'Art History & Appreciation',    levels:[8,9,10],     note:'Caribbean and world art movements, critique vocabulary.' },
        { id:'va-portfolio',name:'Portfolio & Studio Practice', levels:[9,10],       note:'Theme development, sketchbook, reflection, presentation.' }
      ]
    },
    'physical-education': {
      name: 'Physical Education & Sport', short: 'PE', icon: '🏅', group: 'Expressive',
      blurb: 'Anatomy, fitness, nutrition and sport.',
      papers: 'Paper 01 (MCQ) · Paper 02 (structured) · Practical & SBA',
      strands: [
        { id:'pe-anatomy',name:'Anatomy & Physiology',         levels:[7,8,9,10],   note:'Skeleton, muscles, heart, lungs, energy systems.' },
        { id:'pe-fitness',name:'Fitness & Training Principles', levels:[6,7,8,9,10], note:'Components of fitness, FITT, training methods, testing.' },
        { id:'pe-nutri',  name:'Nutrition & Healthy Lifestyle', levels:[6,7,8,9,10], note:'Nutrients, energy balance, hydration, lifestyle disease.' },
        { id:'pe-injury', name:'Safety, Injury & First Aid',    levels:[7,8,9,10],   note:'Prevention, RICE, common sports injuries.' },
        { id:'pe-games',  name:'Games, Rules & Officiating',    levels:[6,7,8,9,10], note:'Skills, tactics, rules and officiating of chosen sports.' },
        { id:'pe-sport',  name:'Sport in Society',              levels:[8,9,10],     note:'History, organisation, ethics, doping, Caribbean sport.' }
      ]
    },
    'information-technology': {
      name: 'Information Technology', short: 'IT', icon: '💻', group: 'Technical',
      blurb: 'Hardware, problem solving, programming and productivity.',
      papers: 'Paper 01 (60 MCQ) · Paper 02 (structured) · Paper 03 SBA (practical)',
      strands: [
        { id:'it-hardware',name:'Fundamentals of Hardware & Software',levels:[6,7,8,9,10],note:'Input/output, storage, memory, system and application software.' },
        { id:'it-data',   name:'Data Representation & Networks',levels:[7,8,9,10],   note:'Binary, ASCII, file sizes, LAN/WAN, the internet.' },
        { id:'it-solve',  name:'Problem Solving & Program Design',levels:[8,9,10],   note:'IPO charts, algorithms, pseudocode, flowcharts, trace tables.' },
        { id:'it-program',name:'Programming',                   levels:[9,10],       note:'Pascal/C constructs, sequence, selection, iteration, arrays.' },
        { id:'it-productivity',name:'Word Processing & Spreadsheets',levels:[6,7,8,9,10],note:'Formatting, mail merge, formulae, functions, charts.' },
        { id:'it-database',name:'Database & Web Page Design',    levels:[8,9,10],     note:'Tables, queries, reports; HTML page structure.' },
        { id:'it-impact', name:'Implications of ICT',            levels:[6,7,8,9,10], note:'Ethics, security, privacy, careers, social impact.' }
      ]
    },

    /* ---- Offered by the school but not in the default 14. Switch on in Settings. ---- */
    'integrated-science': {
      name: 'Integrated Science', short: 'Int Sci', icon: '🔬', group: 'Sciences',
      blurb: 'Combined science for the lower forms.',
      papers: 'Paper 01 (MCQ) · Paper 02 (structured) · SBA',
      strands: [
        { id:'is-organism',name:'The Organism & Life Processes', levels:[6,7,8],  note:'Cells, systems, nutrition, respiration.' },
        { id:'is-home',   name:'The Home & Workplace',           levels:[6,7,8],  note:'Electricity, machines, safety, materials.' },
        { id:'is-env',    name:'The Environment',                levels:[6,7,8],  note:'Ecosystems, pollution, conservation, energy.' },
        { id:'is-method', name:'Scientific Method & Measurement',levels:[6,7,8],  note:'Variables, fair testing, recording, graphing.' }
      ]
    },
    'food-nutrition': {
      name: 'Food, Nutrition & Health', short: 'Food', icon: '🍲', group: 'Technical',
      blurb: 'Nutrition science and food management.',
      papers: 'Paper 01 (MCQ) · Paper 02 (structured) · SBA',
      strands: [
        { id:'fn-nutrients',name:'Nutrients & Nutrition',   levels:[6,7,8,9,10], note:'Macronutrients, micronutrients, deficiency, RDA.' },
        { id:'fn-meal',   name:'Meal Planning & Management',levels:[7,8,9,10],   note:'Dietary needs, budgeting, menus.' },
        { id:'fn-safety', name:'Food Safety & Hygiene',     levels:[6,7,8,9,10], note:'Contamination, storage, preservation.' },
        { id:'fn-prep',   name:'Food Preparation & Science',levels:[7,8,9,10],   note:'Cooking methods, effects of heat on nutrients.' }
      ]
    },
    'principles-of-business': {
      name: 'Principles of Business', short: 'POB', icon: '🏢', group: 'Business',
      blurb: 'Business organisation, production and finance.',
      papers: 'Paper 01 (60 MCQ) · Paper 02 (structured) · SBA',
      strands: [
        { id:'pb-nature', name:'Nature of Business',        levels:[8,9,10], note:'Types of business, ownership, stakeholders.' },
        { id:'pb-internal',name:'Internal Organisation',    levels:[8,9,10], note:'Management functions, structure, communication.' },
        { id:'pb-prod',   name:'Production & Marketing',    levels:[9,10],   note:'Factors of production, marketing mix, distribution.' },
        { id:'pb-finance',name:'Business Finance & Trade',  levels:[9,10],   note:'Sources of finance, banking, international trade.' }
      ]
    },
    'principles-of-accounts': {
      name: 'Principles of Accounts', short: 'POA', icon: '📒', group: 'Business',
      blurb: 'Double entry through to final accounts.',
      papers: 'Paper 01 (60 MCQ) · Paper 02 (structured) · SBA',
      strands: [
        { id:'pa-double', name:'Double Entry & Ledgers',    levels:[8,9,10], note:'Accounting equation, journals, ledgers, trial balance.' },
        { id:'pa-final',  name:'Final Accounts',            levels:[9,10],   note:'Trading, profit and loss, balance sheet, adjustments.' },
        { id:'pa-control',name:'Control & Reconciliation',  levels:[9,10],   note:'Bank reconciliation, control accounts, errors.' },
        { id:'pa-special',name:'Specialised Accounting',    levels:[10],     note:'Partnerships, companies, co-operatives, manufacturing.' }
      ]
    },
    'additional-mathematics': {
      name: 'Additional Mathematics', short: 'Add Ma', icon: '∫', group: 'Core',
      blurb: 'The bridge from CSEC Maths to CAPE.',
      papers: 'Paper 01 (MCQ) · Paper 02 (structured) · SBA',
      strands: [
        { id:'am-algebra',name:'Algebra & Functions',       levels:[9,10], note:'Quadratics, indices, logs, series, remainder theorem.' },
        { id:'am-coord',  name:'Coordinate Geometry & Trig',levels:[9,10], note:'Lines, circles, identities, radians.' },
        { id:'am-calc',   name:'Introductory Calculus',     levels:[10],   note:'Differentiation, integration, applications.' },
        { id:'am-stats',  name:'Statistics & Probability',  levels:[10],   note:'Data, permutations, combinations, probability.' }
      ]
    },
    'music': {
      name: 'Music', short: 'Music', icon: '🎼', group: 'Expressive',
      blurb: 'Performing, composing and listening.',
      papers: 'Paper 01 (listening) · Portfolio · Performance',
      strands: [
        { id:'mu-theory', name:'Music Theory & Notation',   levels:[6,7,8,9,10], note:'Pitch, rhythm, key signatures, intervals, chords.' },
        { id:'mu-listen', name:'Listening & Analysis',      levels:[6,7,8,9,10], note:'Texture, form, instrumentation, Caribbean genres.' },
        { id:'mu-perform',name:'Performance',               levels:[6,7,8,9,10], note:'Solo and ensemble, technique, interpretation.' },
        { id:'mu-compose',name:'Composing & Arranging',     levels:[8,9,10],     note:'Melody writing, harmony, arrangement.' }
      ]
    },
    'religious-education': {
      name: 'Religious Education', short: 'RE', icon: '🕊️', group: 'Humanities',
      blurb: 'World religions and ethics.',
      papers: 'Paper 01 (MCQ) · Paper 02 (structured) · SBA',
      strands: [
        { id:'re-world',  name:'World Religions',           levels:[6,7,8,9,10], note:'Beliefs, practices and festivals of the major faiths.' },
        { id:'re-texts',  name:'Sacred Texts & Teachings',  levels:[7,8,9,10],   note:'Scripture, interpretation, key figures.' },
        { id:'re-ethics', name:'Ethics & Moral Reasoning',  levels:[8,9,10],     note:'Right and wrong, conscience, applied ethics.' },
        { id:'re-society',name:'Religion in Caribbean Society',levels:[8,9,10],  note:'Plural society, tolerance, religion and social change.' }
      ]
    },
    'technical-drawing': {
      name: 'Technical Drawing', short: 'TD', icon: '📏', group: 'Technical',
      blurb: 'Geometric, mechanical and building drawing.',
      papers: 'Paper 01 (MCQ) · Paper 02 (drawing) · SBA',
      strands: [
        { id:'td-geometry',name:'Plane & Solid Geometry',   levels:[6,7,8,9,10], note:'Constructions, loci, tangents, development.' },
        { id:'td-ortho',  name:'Orthographic & Pictorial',  levels:[7,8,9,10],   note:'First/third angle, isometric, oblique, sectioning.' },
        { id:'td-mech',   name:'Mechanical Drawing',        levels:[9,10],       note:'Fasteners, assemblies, dimensioning conventions.' },
        { id:'td-build',  name:'Building Drawing',          levels:[9,10],       note:'Floor plans, elevations, symbols, site plans.' }
      ]
    },
    'agricultural-science': {
      name: 'Agricultural Science', short: 'Ag Sci', icon: '🌱', group: 'Sciences',
      blurb: 'Crop and animal production.',
      papers: 'Paper 01 (MCQ) · Paper 02 (structured) · SBA',
      strands: [
        { id:'ag-soil',   name:'Soils & Plant Nutrition',   levels:[6,7,8,9,10], note:'Soil types, pH, fertilisers, conservation.' },
        { id:'ag-crop',   name:'Crop Production',           levels:[7,8,9,10],   note:'Propagation, pests, disease, harvesting.' },
        { id:'ag-animal', name:'Animal Production',         levels:[8,9,10],     note:'Livestock, feeding, housing, health.' },
        { id:'ag-business',name:'Agribusiness & Environment',levels:[9,10],      note:'Farm records, marketing, sustainability.' }
      ]
    }
  },

  /* The ladder, as one continuous run of levels.
   *
   * Everything in the hub gates on this number: strands, questions, guides, the
   * daily plan, coverage and the journey. Levels 1-5 are the Standards, 6-10 the
   * Forms, so a single integer comparison spans primary and secondary and no
   * code needs to know which side of SEA a student is on.
   *
   * Profiles created before this existed stored `form` 1-5; they are migrated on
   * read to `level` = form + 5. See migrateLevel() in csec.js.
   */
  levels: [
    { n:1,  label:'Standard 1', short:'Std 1', stage:'primary', age:7  },
    { n:2,  label:'Standard 2', short:'Std 2', stage:'primary', age:8  },
    { n:3,  label:'Standard 3', short:'Std 3', stage:'primary', age:9  },
    { n:4,  label:'Standard 4', short:'Std 4', stage:'primary', age:10 },
    { n:5,  label:'Standard 5', short:'Std 5', stage:'primary', age:11 },
    { n:6,  label:'Form 1',     short:'F1',    stage:'lower',   age:12 },
    { n:7,  label:'Form 2',     short:'F2',    stage:'lower',   age:13 },
    { n:8,  label:'Form 3',     short:'F3',    stage:'lower',   age:14 },
    { n:9,  label:'Form 4',     short:'F4',    stage:'upper',   age:15 },
    { n:10, label:'Form 5',     short:'F5',    stage:'upper',   age:16 }
  ],

  /* Two examinations, two countdowns. SEA is written in March of Standard 5;
     CSEC in May and June of Form 5. `examMonth` is 0-based for Date(). */
  stages: [
    { key:'primary', label:'Primary school', years:'Standard 1 - Standard 5',
      exam:'SEA', levels:[1,2,3,4,5], examLevel:5, examMonth:2, examDay:1,
      note:'Five years to the Secondary Entrance Assessment. The SEA mark decides which secondary school a child is placed in, so Standard 5 carries more weight than any single year that follows it.' },
    { key:'lower', label:'Lower secondary', years:'Form 1 - Form 3',
      exam:'Subject selection', levels:[6,7,8],
      note:'Three years to build the base and to earn the right to choose. Form 3 results decide which CSEC subjects are open to you.' },
    { key:'upper', label:'Upper secondary', years:'Form 4 - Form 5',
      exam:'CSEC', levels:[9,10], examLevel:10, examMonth:4, examDay:1,
      note:'Two years on the CSEC syllabus itself, with School-Based Assessment running alongside from the start of Form 4.' }
  ],

  /* Form 1-5 roadmap, now term by term. Each form knows what its three terms
     are for, and which milestones fall in them, so the journey can tell a
     student what THIS term is for rather than what the next five years are. */
  roadmap: [
    { level:1, label:'Standard 1', phase:'Starting out', stage:'primary',
      focus:'Reading, writing and number every day. At this age the habit matters more than the marks.',
      goals:['Read aloud every night, even for ten minutes','Know number bonds and the times tables to 5','Write a full sentence with a capital and a full stop','Enjoy it — this is the year that decides whether school feels possible'],
      terms:[
        { n:1, title:'Settling in', aim:'Get used to school having homework.',
          do:['Read together every night','Practise writing letters and numbers neatly','Count, sort and compare real things at home'] },
        { n:2, title:'Building number sense', aim:'Make numbers automatic, not effortful.',
          do:['Number bonds to 10, then to 20','Times tables 2, 5 and 10','Tell the time on the hour and half hour'] },
        { n:3, title:'Putting it together', aim:'Read a short passage and answer questions about it.',
          do:['Read a short story and say what happened','Write three sentences that go together','Add and subtract without counting on fingers'] }
      ],
      milestones:[] },

    { level:2, label:'Standard 2', phase:'Building', stage:'primary',
      focus:'Fractions start, writing gets longer, and reading moves from decoding to understanding.',
      goals:['Times tables to 10','Read a page and answer questions about it','Write a short story with a beginning, middle and end','Spell the common words correctly every time'],
      terms:[
        { n:1, title:'Fluency first', aim:'Stop the basics costing thinking time.',
          do:['Times tables to 10, both ways','Spelling list every week','Read something every single night'] },
        { n:2, title:'Fractions and longer writing', aim:'Meet halves and quarters, write a paragraph.',
          do:['Halves, quarters and thirds with real objects','Write a paragraph that stays on one idea','Start using full stops and capitals without being told'] },
        { n:3, title:'Reading for meaning', aim:'Answer questions the text does not state outright.',
          do:['Say why a character did something','Find the word in the passage that means the same','Check your own work before handing it in'] }
      ],
      milestones:[] },

    { level:3, label:'Standard 3', phase:'Turning point', stage:'primary',
      focus:'The year the work gets real. What is shaky now is what will hurt at SEA.',
      goals:['All four operations, confidently, including with fractions','Read and answer inference questions','Write a narrative with description in it','Fix any gap now — there are only two years left'],
      terms:[
        { n:1, title:'Close the gaps', aim:'Find what is weak while there is still time.',
          do:['Test all four operations honestly','Identify the two topics that always go wrong','Read a longer book, not just short passages'] },
        { n:2, title:'Fractions and measurement', aim:'The two topics that decide SEA maths.',
          do:['Equivalent fractions, adding and subtracting them','Perimeter and area of squares and rectangles','Money problems with change'] },
        { n:3, title:'Writing with detail', aim:'Move from what happened to how it felt.',
          do:['Use describing words that earn their place','Plan before writing — beginning, middle, end','Read your writing aloud to hear the mistakes'] }
      ],
      milestones:[
        { term:1, what:'The last comfortable year', why:'Standard 4 and 5 are SEA preparation. A gap fixed in Standard 3 costs an evening; the same gap in Standard 5 costs a school placement.' }
      ] },

    { level:4, label:'Standard 4', phase:'SEA preparation begins', stage:'primary',
      focus:'SEA content starts properly. Decimals, percent, area and volume all arrive this year.',
      goals:['Decimals and percent','Perimeter, area and volume','Write both narrative and expository pieces','Start working past SEA papers to time'],
      terms:[
        { n:1, title:'The SEA syllabus starts', aim:'Meet the topics SEA actually tests.',
          do:['Decimals — place value, adding, subtracting','Read the four maths strands and find your weakest','Start a corrections book and use it'] },
        { n:2, title:'Percent, area and volume', aim:'The heavy marks in SEA maths.',
          do:['Percent of a quantity, and back again','Area of compound shapes','Volume of cuboids'] },
        { n:3, title:'Timed practice begins', aim:'Learn what forty questions in seventy-five minutes feels like.',
          do:['Sit a full maths paper to time','Write one narrative and one expository piece a week','Mark your own work against the scheme'] }
      ],
      milestones:[
        { term:1, what:'SEA syllabus begins in earnest', why:'Most of what SEA tests is taught in Standards 4 and 5. Falling behind here is very hard to recover in one year.' }
      ] },

    { level:5, label:'Standard 5', phase:'SEA year', stage:'primary',
      focus:'One examination in March decides the secondary school. Finish the syllabus, then practise to time.',
      goals:['Finish the syllabus by Christmas','Work full past papers to time every week','Write confidently in both narrative and expository styles','Arrive rested, not crammed'],
      terms:[
        { n:1, title:'Finish the content', aim:'Close the syllabus before the new year.',
          do:['Complete every remaining maths strand','Drill spelling, punctuation and grammar daily','Read a passage and answer under time'] },
        { n:2, title:'Papers, to time, every week', aim:'Turn knowledge into marks under pressure. SEA is written this term.',
          do:['A full past paper every week, marked properly','Practise the writing paper — one item, two markers','Sleep properly in the week before'] },
        { n:3, title:'After SEA', aim:'Keep reading, and get ready for Form 1.',
          do:['Keep reading daily — the habit is the point','Look at what Form 1 will bring','Rest. This year was hard.'] }
      ],
      milestones:[
        { term:2, what:'SEA examination', why:'Written in March. Three papers — Mathematics, English Language Arts, and ELA Writing — in one morning. The mark decides secondary school placement.' }
      ] },

    { level:6, label:'Form 1', phase:'Foundations', stage:'lower',
      focus:'Settle the habits. Neat notes, homework done the day it is set, reading every night.',
      goals:['Build a study routine you can keep','Master number and grammar basics','Read one book a month for English B','Learn how to take notes that you can revise from'],
      terms:[
        { n:1, title:'Settling in', aim:'Get organised before the work gets hard.',
          do:['Set a fixed time and place for homework','Start one notebook per subject and keep it neat','Ask in class the first time something does not make sense'] },
        { n:2, title:'Finding your footing', aim:'Turn effort into marks.',
          do:['Learn what each teacher actually marks','Practise number and grammar until they are automatic','Start the vocabulary book for Spanish and French'] },
        { n:3, title:'First full exams', aim:'Learn how to revise, not just how to work.',
          do:['Revise from your own notes, not the textbook','Sit past school papers to time','Find out which subjects you enjoy — it matters by Form 3'] }
      ],
      milestones:[] },

    { level:7, label:'Form 2', phase:'Building', stage:'lower',
      focus:'Widen the base. This is the year the sciences and languages start to separate.',
      goals:['Keep every subject above 60%','Start a vocabulary book for Spanish and French','Learn algebra properly — it carries Forms 3 to 5','Practise timed questions once a week'],
      terms:[
        { n:1, title:'Widen the base', aim:'Meet the new subjects properly.',
          do:['Get algebra right early — everything after it depends on it','Keep up in both languages; a term behind is hard to recover','Start using the guided methods for question types you fumble'] },
        { n:2, title:'Where the gaps show', aim:'Find your weak strands while they are still small.',
          do:['Work the daily plan every night','Sit a timed test in Maths and English once a month','Fix anything under 50% before it becomes a Form 3 topic'] },
        { n:3, title:'Looking ahead', aim:'Start thinking about Form 3 and subject choice.',
          do:['Notice which subjects you are actually good at','Push two subjects towards 75%','Read the CSEC syllabus for one subject you are curious about'] }
      ],
      milestones:[] },

    { level:8, label:'Form 3', phase:'Choosing', stage:'lower',
      focus:'The subject-choice year. Your Form 3 marks decide which CSEC subjects are open to you.',
      goals:['Identify your strongest 8-10 subjects','Fix any weak strand before it becomes a CSEC topic','Sit past-paper style questions in Maths and English','Choose CSEC subjects with evidence, not guesswork'],
      terms:[
        { n:1, title:'Audit yourself honestly', aim:'Know where you stand in all fourteen.',
          do:['Get every subject onto the KPI board with real practice behind it','Rank your subjects by readiness, not by which teacher you like','Start the weakest three now — there is still time this year'] },
        { n:2, title:'Build the evidence', aim:'Mid-year results are what the school will look at.',
          do:['Push your likely CSEC subjects hardest','Sit timed tests in the subjects you intend to keep','Talk to teachers about what each CSEC subject actually demands'] },
        { n:3, title:'Choose, then close the gaps', aim:'Pick your CSEC subjects and go into Form 4 ready.',
          do:['Choose 8-10 subjects on evidence from this hub and from school reports','Clear every strand under 50% in the subjects you have chosen','Download the CSEC syllabus for each chosen subject'] }
      ],
      milestones:[
        { term:3, what:'CSEC subject selection', why:'The school asks you to choose the 8-10 subjects you will sit. It is very hard to change later, so choose on evidence.' }
      ] },

    { level:9, label:'Form 4', phase:'CSEC Year One', stage:'upper',
      focus:'The syllabus starts for real. Half of CSEC content is covered this year.',
      goals:['Start SBA work early — do not leave it to Form 5','Cover the Form 4 half of each syllabus','Begin working through specimen papers','Keep a corrections book of every mistake'],
      terms:[
        { n:1, title:'The syllabus begins', aim:'Get onto the real CSEC content and start the SBA.',
          do:['Read the syllabus for every subject in the first month','Find out the SBA requirement for each subject and start','Set up a corrections book and use it after every test'] },
        { n:2, title:'Half the syllabus', aim:'Keep pace and gather SBA data.',
          do:['Collect SBA data and evidence now, while there is time','Work specimen papers section by section','Keep coverage climbing — the KPI board shows where you have not been'] },
        { n:3, title:'Consolidate', aim:'Finish Form 4 with drafts done and no gaps behind you.',
          do:['Have a full SBA draft for every subject that needs one','Sit a full timed paper in your two hardest subjects','Fix everything still under 50% before the holidays'] }
      ],
      milestones:[
        { term:1, what:'School-Based Assessment begins', why:'SBA counts towards the final CSEC grade in most subjects. Students who leave it to Form 5 lose marks they could have had.' }
      ] },

    { level:10, label:'Form 5', phase:'Examination Year', stage:'upper',
      focus:'Finish the syllabus, then practise under time until the paper holds no surprises.',
      goals:['Complete and submit every SBA on time','Work past papers to time, then mark against the scheme','Target Grade I in your strongest subjects','Rest properly in the week before the exam'],
      terms:[
        { n:1, title:'Finish the content', aim:'Close the syllabus and finish the SBA.',
          do:['Complete the remaining syllabus in every subject','Finish every SBA to submission standard','Start working whole past papers to time'] },
        { n:2, title:'Papers, to time, every week', aim:'Turn knowledge into marks under pressure.',
          do:['Submit every SBA by the deadline','Work a full past paper each week and mark it against the scheme','Use the corrections book — repeat mistakes are the cheapest marks to win back'] },
        { n:3, title:'The examinations', aim:'Arrive rested and practised.',
          do:['Revise from your corrections book, not from scratch','Keep sitting timed papers until the format is dull','Sleep properly in the week before — it is worth more than one more night of cramming'] }
      ],
      milestones:[
        { term:2, what:'SBA submission deadline', why:'SBA marks are submitted to CXC during the second term. A late or missing SBA costs a grade outright.' },
        { term:3, what:'CSEC examinations', why:'Written in May and June. Everything from Form 1 has been building to these weeks.' }
      ] }
  ],

  /* Verified official and reputable sources. Checked reachable 7 Sep 2026.
     Nothing copyrighted is copied into this repository — these are links out. */
  resources: {
    official: [
      { name:'CXC Store — Syllabuses & Subject Reports', url:'https://cxc-store.com/syllabuses-subject-reports',
        cost:'Free', note:'The official CSEC syllabus for every subject, plus specimen papers, mark schemes and subject reports. This is the document the examiner works from — download the syllabus for each of your subjects first.' },
      { name:'CXC Store — CSEC Past Papers', url:'https://cxc-store.com/past-papers/csec',
        cost:'Paid eBooks', note:'The only official source of complete CSEC past papers. CXC sells them as eBooks; they are copyright CXC, which is why this hub links to them rather than hosting copies.' },
      { name:'CXC — Caribbean Examinations Council', url:'https://www.cxc.org/',
        cost:'Free', note:'Examination timetables, registration information and candidate notices.' },
      { name:'MOE T&T — School Learning Management System', url:'https://learn.moe.gov.tt/',
        cost:'Free', note:'The Ministry’s own platform. Carries CSEC past-paper worked solutions and CPDD activity sheets for Trinidad and Tobago students, including Form 5 Mathematics.' },
      { name:'MOE T&T — Secondary School Resources', url:'https://www.moe.gov.tt/secondary-resources/',
        cost:'Free', note:'Ministry resource index for secondary students.' },
      { name:'MOE T&T — Curriculum Resources', url:'https://www.moe.gov.tt/curriculum-resources/',
        cost:'Free', note:'National curriculum documents by subject and form — this is what the Form 1-3 school syllabus is built on.' },
      { name:'MOE T&T — Examinations Portal', url:'https://exams.moe.gov.tt/',
        cost:'Free', note:'Local examination administration, registration and results.' },
      { name:'MOE T&T — Resources Index', url:'https://www.moe.gov.tt/resources/',
        cost:'Free', note:'Top-level index of every Ministry resource page.' }
    ],
    school: [
      { name:'Lakshmi Girls’ Hindu College', url:'https://www.lakshmigirlshindu.com/',
        cost:'Free', note:'School site — calendar, notices and the subject offering. St Augustine, Trinidad.' }
    ],
    /* PRIMARY / SEA. Unlike CXC, which sells its past papers, the Ministry of
       Education publishes SEA past papers free. For a Standard 5 this is the
       single most valuable thing on the page. All checked 13 Sep 2026. */
    sea: [
      { name:'MoE \u2014 SEA 2024 & 2025 Past Papers', url:'https://moe.gov.tt/sea-2024-and-2025-past-papers/',
        cost:'Free', note:'The real thing, free from the Ministry: Mathematics 2024 and 2025, English Language Arts 2024 and 2025, and the ELA Writing paper 2025. Work them to time in Standard 5 \u2014 nothing else prepares a child for the pace.' },
      { name:'MoE SLMS \u2014 SEA Specimen Papers & Mark Schemes', url:'https://learn.moe.gov.tt/course/section.php?id=335805',
        cost:'Free', note:'Specimen papers with the mark schemes, on the Ministry\u2019s own learning platform. The mark scheme matters as much as the paper: it shows exactly where marks are given and lost.' },
      { name:'MoE SLMS \u2014 SEA Mathematics Past Papers & Activity Sheets', url:'https://learn.moe.gov.tt/course/section.php?id=335804',
        cost:'Free', note:'CPDD activity sheets and past papers for Standard 5 Mathematics, prepared by the Ministry\u2019s own curriculum division.' },
      { name:'MoE \u2014 SEA Assessment Framework 2025\u20132028', url:'https://storage.moe.gov.tt/wpdevelopment/2023/10/ASSESSMENT-FRAMEWORK-FOR-SEA-2025-2028.pdf',
        cost:'Free', note:'The document the examination is built from. It names the four Mathematics strands, the English sections and their marks, and how the Writing paper is scored. This hub\u2019s primary strands were taken from it.' },
      { name:'MoE \u2014 SEA 2026 Information Booklet', url:'https://storage.moe.gov.tt/guides/SEA-2026-Information-Booklet.pdf',
        cost:'Free', note:'What happens on the day: the three papers, working time, and what a candidate may bring. Worth reading with your child a fortnight before.' },
      { name:'MoE \u2014 Primary School Resources', url:'https://www.moe.gov.tt/primary-school-resources/',
        cost:'Free', note:'The Ministry\u2019s index of primary material, including the national curriculum guides for every primary subject.' }
    ],

    /* International, free, and genuinely useful for CSEC even though none of it
       is written for CXC. Alignment is noted honestly on each one — a Form 3
       student sent to a US or UK course that does not match the syllabus wastes
       the evening. All checked reachable 7 Sep 2026. */
    international: [
      { name:'Khan Academy', url:'https://www.khanacademy.org/', cost:'Free', subj:'Maths, Sciences, Economics',
        note:'Guided practice with step-by-step hints and video for every topic. Strongest match to CSEC in Mathematics — algebra, geometry, trigonometry and statistics map almost directly. Built on the US curriculum, so skip the US-history and SAT sections.' },
      { name:'BBC Bitesize — GCSE', url:'https://www.bbc.co.uk/bitesize', cost:'Free', subj:'All core subjects',
        note:'Short revision pages with a quiz at the end of each. GCSE sits at almost the same level as CSEC and the science and maths content overlaps heavily. English literature texts differ, so use it for technique rather than set texts.' },
      { name:'PhET Interactive Simulations', url:'https://phet.colorado.edu/', cost:'Free', subj:'Physics, Chemistry, Biology, Maths',
        note:'University of Colorado simulations — circuits, forces, waves, gas laws, acids and bases. The fastest way to understand a science topic you cannot picture, and useful preparation before a school laboratory session.' },
      { name:'OpenStax', url:'https://openstax.org/', cost:'Free', subj:'Sciences, Maths',
        note:'Full peer-reviewed textbooks as free PDFs. Pitched above CSEC in places, but excellent when a school textbook explains something badly and you want a second explanation.' },
      { name:'Desmos Graphing Calculator', url:'https://www.desmos.com/calculator', cost:'Free', subj:'Mathematics',
        note:'Plot any function instantly. Use it to check graph questions and to see what changing a coefficient actually does — that intuition is what Relations, Functions and Graphs is testing.' },
      { name:'GeoGebra', url:'https://www.geogebra.org/', cost:'Free', subj:'Mathematics',
        note:'Geometry, transformations and constructions you can drag. Particularly good for the Geometry and Trigonometry section and for seeing why a construction works.' },
      { name:'LibreTexts', url:'https://libretexts.org/', cost:'Free', subj:'Sciences, Maths',
        note:'Very large open library of chemistry, physics and biology explanations. Best used to look up one specific concept rather than to read through.' },
      { name:'Project Gutenberg', url:'https://www.gutenberg.org/', cost:'Free', subj:'English B',
        note:'Free out-of-copyright literature. Useful for background reading and for older set texts, though most current CSEC set texts are still in copyright and will not be here.' },
      { name:'CommonLit', url:'https://www.commonlit.org/', cost:'Free', subj:'English A, English B',
        note:'Graded passages with comprehension questions — close to the English A comprehension format, and good practice at reading for inference.' },
      { name:'Wolfram Alpha', url:'https://www.wolframalpha.com/', cost:'Free tier', subj:'Mathematics, Sciences',
        note:'Checks an answer and shows the steps on the free tier for many problems. Use it to check work you have already attempted, never to produce work you have not.' },
      { name:'MIT OpenCourseWare', url:'https://ocw.mit.edu/', cost:'Free', subj:'Maths, Sciences',
        note:'University-level material. Well beyond CSEC, but worth knowing about for a Form 5 student deciding whether to take a subject at CAPE.' },
      { name:'Save My Exams', url:'https://www.savemyexams.com/', cost:'Free & paid', subj:'Sciences, Maths',
        note:'Revision notes and topic questions written for UK exam boards. Structure and question style are close enough to be useful practice; the syllabus is not identical, so check against the CSEC syllabus before relying on it.' }
    ],
    community: [
      { name:'Kerwin Springer — Student Support', url:'https://www.kerwinspringer.com/',
        cost:'Free & paid', note:'Widely used Trinidadian CSEC tutorials and worked past-paper solutions. Not affiliated with CXC.' }
    ]
  }
};
