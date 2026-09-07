/* CSEC Study Hub — curriculum registry
 * Subjects, syllabus strands and the Form 1-5 progression.
 *
 * Strands follow the CSEC syllabus section structure so that practice,
 * mastery and the daily plan all key off the same names the examiner uses.
 * `forms` marks the forms in which a strand is normally taught, which is what
 * lets Form 2 and Form 3 see a plan that is not full of Form 5 material.
 */
window.CSEC_CURRICULUM = {

  /* Which 14 subjects are selected by default. Editable in Settings -> Subjects. */
  defaultSelection: [
    'english-a','english-b','mathematics','spanish','french',
    'physics','chemistry','biology','geography','history',
    'social-studies','visual-arts','physical-education','information-technology'
  ],

  subjects: {
    'english-a': {
      name: 'English A', short: 'Eng A', icon: '✍️', group: 'Languages',
      blurb: 'Comprehension, summary and the four essay types.',
      papers: 'Paper 01 (60 MCQ) · Paper 02 (essays & summary) · SBA',
      strands: [
        { id:'ea-comp',   name:'Comprehension & Understanding', forms:[1,2,3,4,5], note:'Reading for literal, inferential and evaluative meaning.' },
        { id:'ea-summary',name:'Summary Writing',               forms:[2,3,4,5],   note:'Reducing a passage to its argument in your own words, to a word limit.' },
        { id:'ea-grammar',name:'Grammar & Mechanics',           forms:[1,2,3,4,5], note:'Agreement, tense, punctuation, sentence structure.' },
        { id:'ea-vocab',  name:'Vocabulary & Word Choice',      forms:[1,2,3,4,5],  note:'Register, connotation, precision.' },
        { id:'ea-narr',   name:'Narrative & Descriptive Writing',forms:[1,2,3,4,5], note:'Story and description — the Section B options.' },
        { id:'ea-arg',    name:'Argumentative & Expository Writing',forms:[3,4,5],  note:'Taking a position and defending it; explaining a process.' },
        { id:'ea-persuade',name:'Persuasive Writing & Register', forms:[4,5],       note:'Writing for a stated audience and purpose.' },
        { id:'ea-sba',    name:'School-Based Assessment',        forms:[4,5],       note:'Portfolio: plan of inquiry, artefacts, written report, reflections.' }
      ]
    },
    'english-b': {
      name: 'English B', short: 'Eng B', icon: '📖', group: 'Languages',
      blurb: 'Literature — poetry, prose and drama.',
      papers: 'Paper 02 (essays on set texts) · SBA',
      strands: [
        { id:'eb-poetry', name:'Poetry',              forms:[1,2,3,4,5], note:'Imagery, tone, mood, form, sound devices.' },
        { id:'eb-prose',  name:'Prose Fiction',       forms:[2,3,4,5],   note:'Novel study — plot, character, theme, setting, narrative voice.' },
        { id:'eb-drama',  name:'Drama',               forms:[3,4,5],     note:'Play study — conflict, stagecraft, dramatic irony.' },
        { id:'eb-short',  name:'Short Stories',       forms:[1,2,3,4,5], note:'Compression, twist, single effect.' },
        { id:'eb-devices',name:'Literary Devices',    forms:[1,2,3,4,5], note:'Metaphor, simile, personification, symbolism, irony.' },
        { id:'eb-essay',  name:'Literature Essay Craft',forms:[3,4,5],   note:'Point-Evidence-Explanation, quoting accurately, answering the question asked.' }
      ]
    },
    'mathematics': {
      name: 'Mathematics', short: 'Maths', icon: '📐', group: 'Core',
      blurb: 'The nine CSEC Mathematics sections.',
      papers: 'Paper 01 (60 MCQ) · Paper 02 (structured) · SBA',
      strands: [
        { id:'ma-number', name:'Number Theory & Computation', forms:[1,2,3,4,5], note:'Fractions, decimals, ratio, percentage, indices, standard form.' },
        { id:'ma-consumer',name:'Consumer Arithmetic',        forms:[2,3,4,5],   note:'Wages, discount, VAT, interest, hire purchase, currency.' },
        { id:'ma-sets',   name:'Sets',                        forms:[1,2,3,4,5], note:'Venn diagrams, union, intersection, complement, problem solving.' },
        { id:'ma-measure',name:'Measurement',                 forms:[1,2,3,4,5], note:'Perimeter, area, volume, scale, rates, compound shapes.' },
        { id:'ma-stats',  name:'Statistics',                  forms:[2,3,4,5],   note:'Mean, median, mode, tables, charts, cumulative frequency, probability.' },
        { id:'ma-algebra',name:'Algebra',                     forms:[1,2,3,4,5], note:'Expressions, equations, factorising, simultaneous, quadratics.' },
        { id:'ma-relations',name:'Relations, Functions & Graphs',forms:[3,4,5],  note:'Mapping, notation, linear and quadratic graphs, gradient, inequalities.' },
        { id:'ma-geom',   name:'Geometry & Trigonometry',     forms:[2,3,4,5],   note:'Angles, polygons, circles, transformations, Pythagoras, sine/cosine rule.' },
        { id:'ma-vectors',name:'Vectors & Matrices',          forms:[4,5],       note:'Vector notation and algebra, matrix operations, transformations.' }
      ]
    },
    'spanish': {
      name: 'Spanish', short: 'Span', icon: '🇪🇸', group: 'Languages',
      blurb: 'The four skills across the CSEC themes.',
      papers: 'Paper 01 (listening & reading) · Paper 02 (writing) · Paper 03 (oral)',
      strands: [
        { id:'sp-listen', name:'Listening Comprehension', forms:[1,2,3,4,5], note:'Understanding spoken Spanish at natural pace.' },
        { id:'sp-read',   name:'Reading Comprehension',   forms:[1,2,3,4,5], note:'Signs, notices, letters, articles.' },
        { id:'sp-speak',  name:'Oral & Pronunciation',    forms:[1,2,3,4,5], note:'Responding to situations, picture description, conversation.' },
        { id:'sp-write',  name:'Directed & Free Writing', forms:[2,3,4,5],   note:'Notes, letters, compositions to a word count.' },
        { id:'sp-gram',   name:'Grammar & Verb Tenses',   forms:[1,2,3,4,5], note:'Present, preterite, imperfect, future, subjunctive; ser vs estar.' },
        { id:'sp-themes', name:'Themes & Vocabulary',     forms:[1,2,3,4,5], note:'Personal ID, home, school, food, health, travel, work, environment.' }
      ]
    },
    'french': {
      name: 'French', short: 'Fren', icon: '🇫🇷', group: 'Languages',
      blurb: 'The four skills across the CSEC themes.',
      papers: 'Paper 01 (listening & reading) · Paper 02 (writing) · Paper 03 (oral)',
      strands: [
        { id:'fr-listen', name:'Listening Comprehension', forms:[1,2,3,4,5], note:'Understanding spoken French at natural pace.' },
        { id:'fr-read',   name:'Reading Comprehension',   forms:[1,2,3,4,5], note:'Signs, notices, letters, articles.' },
        { id:'fr-speak',  name:'Oral & Pronunciation',    forms:[1,2,3,4,5], note:'Responding to situations, picture description, conversation.' },
        { id:'fr-write',  name:'Directed & Free Writing', forms:[2,3,4,5],   note:'Notes, letters, compositions to a word count.' },
        { id:'fr-gram',   name:'Grammar & Verb Tenses',   forms:[1,2,3,4,5], note:'Présent, passé composé, imparfait, futur, subjonctif; avoir vs être.' },
        { id:'fr-themes', name:'Themes & Vocabulary',     forms:[1,2,3,4,5], note:'Personal ID, home, school, food, health, travel, work, environment.' }
      ]
    },
    'physics': {
      name: 'Physics', short: 'Phys', icon: '⚛️', group: 'Sciences',
      blurb: 'Mechanics through to the physics of the atom.',
      papers: 'Paper 01 (60 MCQ) · Paper 02 (structured & essay) · SBA',
      strands: [
        { id:'ph-measure',name:'Measurement & SI Units',      forms:[1,2,3,4,5], note:'Quantities, prefixes, significant figures, uncertainty.' },
        { id:'ph-mech',   name:'Mechanics',                   forms:[2,3,4,5],   note:'Motion, forces, Newton’s laws, moments, density, pressure, energy.' },
        { id:'ph-thermal',name:'Thermal Physics & Kinetic Theory',forms:[3,4,5], note:'Temperature, heat capacity, latent heat, gas laws, transfer.' },
        { id:'ph-waves',  name:'Waves & Optics',              forms:[2,3,4,5],   note:'Wave properties, sound, light, reflection, refraction, lenses.' },
        { id:'ph-elec',   name:'Electricity & Magnetism',     forms:[3,4,5],     note:'Circuits, Ohm’s law, electrostatics, magnetic effects, induction.' },
        { id:'ph-atom',   name:'The Physics of the Atom',     forms:[4,5],       note:'Atomic models, radioactivity, half-life, nuclear energy.' }
      ]
    },
    'chemistry': {
      name: 'Chemistry', short: 'Chem', icon: '🧪', group: 'Sciences',
      blurb: 'Principles, organic and inorganic chemistry.',
      papers: 'Paper 01 (60 MCQ) · Paper 02 (structured & essay) · SBA',
      strands: [
        { id:'ch-matter', name:'States of Matter & Separation',forms:[1,2,3,4,5], note:'Particle theory, mixtures, filtration, distillation, chromatography.' },
        { id:'ch-atomic', name:'Atomic Structure & Bonding',   forms:[2,3,4,5],   note:'Electron configuration, periodic table, ionic, covalent, metallic.' },
        { id:'ch-mole',   name:'The Mole Concept',             forms:[3,4,5],     note:'Formulae, equations, molar mass, concentration, titration.' },
        { id:'ch-acids',  name:'Acids, Bases & Salts',         forms:[2,3,4,5],   note:'pH, neutralisation, salt preparation, indicators.' },
        { id:'ch-redox',  name:'Oxidation-Reduction & Electrochemistry',forms:[4,5],note:'Redox, reactivity series, electrolysis, corrosion.' },
        { id:'ch-organic',name:'Organic Chemistry',            forms:[4,5],       note:'Hydrocarbons, homologous series, alcohols, acids, polymers.' },
        { id:'ch-inorg',  name:'Inorganic & Industrial Chemistry',forms:[4,5],    note:'Metals, non-metals, qualitative analysis, industrial processes.' }
      ]
    },
    'biology': {
      name: 'Biology', short: 'Bio', icon: '🧬', group: 'Sciences',
      blurb: 'Living organisms, life processes and continuity.',
      papers: 'Paper 01 (60 MCQ) · Paper 02 (structured & essay) · SBA',
      strands: [
        { id:'bi-cells',  name:'Cells & Cell Processes',      forms:[1,2,3,4,5], note:'Cell structure, diffusion, osmosis, active transport.' },
        { id:'bi-env',    name:'Living Organisms & the Environment',forms:[1,2,3,4,5],note:'Classification, ecosystems, food chains, cycles, conservation.' },
        { id:'bi-nutri',  name:'Nutrition & Transport',        forms:[2,3,4,5],   note:'Photosynthesis, digestion, circulation, transpiration.' },
        { id:'bi-resp',   name:'Respiration & Excretion',      forms:[3,4,5],     note:'Aerobic/anaerobic respiration, gas exchange, kidney, skin.' },
        { id:'bi-coord',  name:'Coordination & Movement',      forms:[3,4,5],     note:'Nervous system, hormones, skeleton, muscles, homeostasis.' },
        { id:'bi-repro',  name:'Reproduction & Growth',        forms:[2,3,4,5],   note:'Plant and human reproduction, fertilisation, development.' },
        { id:'bi-genes',  name:'Continuity & Variation',       forms:[4,5],       note:'Mitosis, meiosis, genetics, inheritance, natural selection.' },
        { id:'bi-health', name:'Disease & Its Impact',         forms:[3,4,5],     note:'Pathogens, transmission, immunity, lifestyle disease.' }
      ]
    },
    'geography': {
      name: 'Geography', short: 'Geog', icon: '🗺️', group: 'Humanities',
      blurb: 'Natural systems, human systems and map work.',
      papers: 'Paper 01 (60 MCQ) · Paper 02 (structured) · SBA fieldwork',
      strands: [
        { id:'ge-maps',   name:'Map Reading & Field Skills',  forms:[1,2,3,4,5], note:'Grid references, scale, contours, cross-sections, bearings.' },
        { id:'ge-tectonic',name:'Tectonic & Landform Processes',forms:[2,3,4,5], note:'Plates, earthquakes, volcanoes, weathering, rivers, coasts, karst.' },
        { id:'ge-weather',name:'Weather, Climate & Vegetation',forms:[1,2,3,4,5],note:'Elements of weather, instruments, Caribbean climate, hurricanes.' },
        { id:'ge-pop',    name:'Population & Settlement',      forms:[2,3,4,5],   note:'Density, migration, urbanisation, settlement patterns.' },
        { id:'ge-econ',   name:'Economic Activity',            forms:[3,4,5],     note:'Agriculture, fishing, mining, manufacturing, tourism in the Caribbean.' },
        { id:'ge-hazard', name:'Natural Hazards & Sustainability',forms:[3,4,5],  note:'Hazard risk, mitigation, resource use, environmental management.' }
      ]
    },
    'history': {
      name: 'History', short: 'Hist', icon: '🏛️', group: 'Humanities',
      blurb: 'Caribbean history — the CSEC themes.',
      papers: 'Paper 01 (60 MCQ) · Paper 02 (essays) · SBA',
      strands: [
        { id:'hi-indigenous',name:'Indigenous Peoples & Europeans',forms:[1,2,3,4,5],note:'Taino, Kalinago, encounter, conquest, early settlement.' },
        { id:'hi-slavery', name:'Caribbean Economy & Slavery',  forms:[2,3,4,5],  note:'Sugar revolution, the trade in enslaved Africans, plantation society.' },
        { id:'hi-resist',  name:'Resistance & Revolt',          forms:[2,3,4,5],  note:'Day-to-day resistance, maroons, Haitian Revolution, major revolts.' },
        { id:'hi-emanc',   name:'Movements Towards Emancipation',forms:[3,4,5],   note:'Abolitionists, apprenticeship, emancipation and its terms.' },
        { id:'hi-adjust',  name:'Adjustments to Emancipation',  forms:[3,4,5],    note:'Peasantry, indentureship, immigration, changing labour.' },
        { id:'hi-indep',   name:'Movements Towards Independence',forms:[4,5],     note:'Labour unrest, Federation, nationalism, independence.' },
        { id:'hi-society', name:'Caribbean Society 1900-1985',  forms:[4,5],      note:'US influence, migration, culture, regional integration.' },
        { id:'hi-skills',  name:'Source Analysis & Essay Craft',forms:[1,2,3,4,5],note:'Reading sources, cause and effect, structuring a history essay.' }
      ]
    },
    'social-studies': {
      name: 'Social Studies', short: 'Soc', icon: '🏘️', group: 'Humanities',
      blurb: 'Individual and society, development, integration.',
      papers: 'Paper 01 (60 MCQ) · Paper 02 (structured & essay) · SBA',
      strands: [
        { id:'ss-family', name:'Individual, Family & Society',  forms:[1,2,3,4,5], note:'Family types, socialisation, roles, institutions.' },
        { id:'ss-gov',    name:'Government & Citizenship',      forms:[2,3,4,5],   note:'Systems of government, elections, rights and responsibilities.' },
        { id:'ss-dev',    name:'Sustainable Development & Resources',forms:[3,4,5],note:'Resource use, development indicators, environment.' },
        { id:'ss-region', name:'Regional Integration',          forms:[3,4,5],     note:'CARICOM, CSME, benefits and challenges of integration.' },
        { id:'ss-issues', name:'Social Issues & Problems',      forms:[2,3,4,5],   note:'Crime, unemployment, poverty, health, responses.' },
        { id:'ss-research',name:'Research Methods & SBA',       forms:[4,5],       note:'Statement of problem, questionnaires, presenting findings.' }
      ]
    },
    'visual-arts': {
      name: 'Visual Arts', short: 'Art', icon: '🎨', group: 'Expressive',
      blurb: 'Drawing, design, craft and art history.',
      papers: 'Paper 01 (written) · Portfolio & studio pieces',
      strands: [
        { id:'va-draw',   name:'Drawing & Observation',        forms:[1,2,3,4,5], note:'Line, proportion, shading, perspective, still life, figure.' },
        { id:'va-elements',name:'Elements & Principles of Design',forms:[1,2,3,4,5],note:'Line, shape, colour, texture; balance, rhythm, contrast, unity.' },
        { id:'va-print',  name:'Print, Textile & Graphic Design',forms:[2,3,4,5],  note:'Lino, screen, batik, tie-dye, lettering, layout.' },
        { id:'va-3d',     name:'Ceramics & Sculpture',          forms:[2,3,4,5],   note:'Pinch, coil, slab, modelling, carving, construction.' },
        { id:'va-history',name:'Art History & Appreciation',    forms:[3,4,5],     note:'Caribbean and world art movements, critique vocabulary.' },
        { id:'va-portfolio',name:'Portfolio & Studio Practice', forms:[4,5],       note:'Theme development, sketchbook, reflection, presentation.' }
      ]
    },
    'physical-education': {
      name: 'Physical Education & Sport', short: 'PE', icon: '🏅', group: 'Expressive',
      blurb: 'Anatomy, fitness, nutrition and sport.',
      papers: 'Paper 01 (MCQ) · Paper 02 (structured) · Practical & SBA',
      strands: [
        { id:'pe-anatomy',name:'Anatomy & Physiology',         forms:[2,3,4,5],   note:'Skeleton, muscles, heart, lungs, energy systems.' },
        { id:'pe-fitness',name:'Fitness & Training Principles', forms:[1,2,3,4,5], note:'Components of fitness, FITT, training methods, testing.' },
        { id:'pe-nutri',  name:'Nutrition & Healthy Lifestyle', forms:[1,2,3,4,5], note:'Nutrients, energy balance, hydration, lifestyle disease.' },
        { id:'pe-injury', name:'Safety, Injury & First Aid',    forms:[2,3,4,5],   note:'Prevention, RICE, common sports injuries.' },
        { id:'pe-games',  name:'Games, Rules & Officiating',    forms:[1,2,3,4,5], note:'Skills, tactics, rules and officiating of chosen sports.' },
        { id:'pe-sport',  name:'Sport in Society',              forms:[3,4,5],     note:'History, organisation, ethics, doping, Caribbean sport.' }
      ]
    },
    'information-technology': {
      name: 'Information Technology', short: 'IT', icon: '💻', group: 'Technical',
      blurb: 'Hardware, problem solving, programming and productivity.',
      papers: 'Paper 01 (60 MCQ) · Paper 02 (structured) · Paper 03 SBA (practical)',
      strands: [
        { id:'it-hardware',name:'Fundamentals of Hardware & Software',forms:[1,2,3,4,5],note:'Input/output, storage, memory, system and application software.' },
        { id:'it-data',   name:'Data Representation & Networks',forms:[2,3,4,5],   note:'Binary, ASCII, file sizes, LAN/WAN, the internet.' },
        { id:'it-solve',  name:'Problem Solving & Program Design',forms:[3,4,5],   note:'IPO charts, algorithms, pseudocode, flowcharts, trace tables.' },
        { id:'it-program',name:'Programming',                   forms:[4,5],       note:'Pascal/C constructs, sequence, selection, iteration, arrays.' },
        { id:'it-productivity',name:'Word Processing & Spreadsheets',forms:[1,2,3,4,5],note:'Formatting, mail merge, formulae, functions, charts.' },
        { id:'it-database',name:'Database & Web Page Design',    forms:[3,4,5],     note:'Tables, queries, reports; HTML page structure.' },
        { id:'it-impact', name:'Implications of ICT',            forms:[1,2,3,4,5], note:'Ethics, security, privacy, careers, social impact.' }
      ]
    },

    /* ---- Offered by the school but not in the default 14. Switch on in Settings. ---- */
    'integrated-science': {
      name: 'Integrated Science', short: 'Int Sci', icon: '🔬', group: 'Sciences',
      blurb: 'Combined science for the lower forms.',
      papers: 'Paper 01 (MCQ) · Paper 02 (structured) · SBA',
      strands: [
        { id:'is-organism',name:'The Organism & Life Processes', forms:[1,2,3],  note:'Cells, systems, nutrition, respiration.' },
        { id:'is-home',   name:'The Home & Workplace',           forms:[1,2,3],  note:'Electricity, machines, safety, materials.' },
        { id:'is-env',    name:'The Environment',                forms:[1,2,3],  note:'Ecosystems, pollution, conservation, energy.' },
        { id:'is-method', name:'Scientific Method & Measurement',forms:[1,2,3],  note:'Variables, fair testing, recording, graphing.' }
      ]
    },
    'food-nutrition': {
      name: 'Food, Nutrition & Health', short: 'Food', icon: '🍲', group: 'Technical',
      blurb: 'Nutrition science and food management.',
      papers: 'Paper 01 (MCQ) · Paper 02 (structured) · SBA',
      strands: [
        { id:'fn-nutrients',name:'Nutrients & Nutrition',   forms:[1,2,3,4,5], note:'Macronutrients, micronutrients, deficiency, RDA.' },
        { id:'fn-meal',   name:'Meal Planning & Management',forms:[2,3,4,5],   note:'Dietary needs, budgeting, menus.' },
        { id:'fn-safety', name:'Food Safety & Hygiene',     forms:[1,2,3,4,5], note:'Contamination, storage, preservation.' },
        { id:'fn-prep',   name:'Food Preparation & Science',forms:[2,3,4,5],   note:'Cooking methods, effects of heat on nutrients.' }
      ]
    },
    'principles-of-business': {
      name: 'Principles of Business', short: 'POB', icon: '🏢', group: 'Business',
      blurb: 'Business organisation, production and finance.',
      papers: 'Paper 01 (60 MCQ) · Paper 02 (structured) · SBA',
      strands: [
        { id:'pb-nature', name:'Nature of Business',        forms:[3,4,5], note:'Types of business, ownership, stakeholders.' },
        { id:'pb-internal',name:'Internal Organisation',    forms:[3,4,5], note:'Management functions, structure, communication.' },
        { id:'pb-prod',   name:'Production & Marketing',    forms:[4,5],   note:'Factors of production, marketing mix, distribution.' },
        { id:'pb-finance',name:'Business Finance & Trade',  forms:[4,5],   note:'Sources of finance, banking, international trade.' }
      ]
    },
    'principles-of-accounts': {
      name: 'Principles of Accounts', short: 'POA', icon: '📒', group: 'Business',
      blurb: 'Double entry through to final accounts.',
      papers: 'Paper 01 (60 MCQ) · Paper 02 (structured) · SBA',
      strands: [
        { id:'pa-double', name:'Double Entry & Ledgers',    forms:[3,4,5], note:'Accounting equation, journals, ledgers, trial balance.' },
        { id:'pa-final',  name:'Final Accounts',            forms:[4,5],   note:'Trading, profit and loss, balance sheet, adjustments.' },
        { id:'pa-control',name:'Control & Reconciliation',  forms:[4,5],   note:'Bank reconciliation, control accounts, errors.' },
        { id:'pa-special',name:'Specialised Accounting',    forms:[5],     note:'Partnerships, companies, co-operatives, manufacturing.' }
      ]
    },
    'additional-mathematics': {
      name: 'Additional Mathematics', short: 'Add Ma', icon: '∫', group: 'Core',
      blurb: 'The bridge from CSEC Maths to CAPE.',
      papers: 'Paper 01 (MCQ) · Paper 02 (structured) · SBA',
      strands: [
        { id:'am-algebra',name:'Algebra & Functions',       forms:[4,5], note:'Quadratics, indices, logs, series, remainder theorem.' },
        { id:'am-coord',  name:'Coordinate Geometry & Trig',forms:[4,5], note:'Lines, circles, identities, radians.' },
        { id:'am-calc',   name:'Introductory Calculus',     forms:[5],   note:'Differentiation, integration, applications.' },
        { id:'am-stats',  name:'Statistics & Probability',  forms:[5],   note:'Data, permutations, combinations, probability.' }
      ]
    },
    'music': {
      name: 'Music', short: 'Music', icon: '🎼', group: 'Expressive',
      blurb: 'Performing, composing and listening.',
      papers: 'Paper 01 (listening) · Portfolio · Performance',
      strands: [
        { id:'mu-theory', name:'Music Theory & Notation',   forms:[1,2,3,4,5], note:'Pitch, rhythm, key signatures, intervals, chords.' },
        { id:'mu-listen', name:'Listening & Analysis',      forms:[1,2,3,4,5], note:'Texture, form, instrumentation, Caribbean genres.' },
        { id:'mu-perform',name:'Performance',               forms:[1,2,3,4,5], note:'Solo and ensemble, technique, interpretation.' },
        { id:'mu-compose',name:'Composing & Arranging',     forms:[3,4,5],     note:'Melody writing, harmony, arrangement.' }
      ]
    },
    'religious-education': {
      name: 'Religious Education', short: 'RE', icon: '🕊️', group: 'Humanities',
      blurb: 'World religions and ethics.',
      papers: 'Paper 01 (MCQ) · Paper 02 (structured) · SBA',
      strands: [
        { id:'re-world',  name:'World Religions',           forms:[1,2,3,4,5], note:'Beliefs, practices and festivals of the major faiths.' },
        { id:'re-texts',  name:'Sacred Texts & Teachings',  forms:[2,3,4,5],   note:'Scripture, interpretation, key figures.' },
        { id:'re-ethics', name:'Ethics & Moral Reasoning',  forms:[3,4,5],     note:'Right and wrong, conscience, applied ethics.' },
        { id:'re-society',name:'Religion in Caribbean Society',forms:[3,4,5],  note:'Plural society, tolerance, religion and social change.' }
      ]
    },
    'technical-drawing': {
      name: 'Technical Drawing', short: 'TD', icon: '📏', group: 'Technical',
      blurb: 'Geometric, mechanical and building drawing.',
      papers: 'Paper 01 (MCQ) · Paper 02 (drawing) · SBA',
      strands: [
        { id:'td-geometry',name:'Plane & Solid Geometry',   forms:[1,2,3,4,5], note:'Constructions, loci, tangents, development.' },
        { id:'td-ortho',  name:'Orthographic & Pictorial',  forms:[2,3,4,5],   note:'First/third angle, isometric, oblique, sectioning.' },
        { id:'td-mech',   name:'Mechanical Drawing',        forms:[4,5],       note:'Fasteners, assemblies, dimensioning conventions.' },
        { id:'td-build',  name:'Building Drawing',          forms:[4,5],       note:'Floor plans, elevations, symbols, site plans.' }
      ]
    },
    'agricultural-science': {
      name: 'Agricultural Science', short: 'Ag Sci', icon: '🌱', group: 'Sciences',
      blurb: 'Crop and animal production.',
      papers: 'Paper 01 (MCQ) · Paper 02 (structured) · SBA',
      strands: [
        { id:'ag-soil',   name:'Soils & Plant Nutrition',   forms:[1,2,3,4,5], note:'Soil types, pH, fertilisers, conservation.' },
        { id:'ag-crop',   name:'Crop Production',           forms:[2,3,4,5],   note:'Propagation, pests, disease, harvesting.' },
        { id:'ag-animal', name:'Animal Production',         forms:[3,4,5],     note:'Livestock, feeding, housing, health.' },
        { id:'ag-business',name:'Agribusiness & Environment',forms:[4,5],      note:'Farm records, marketing, sustainability.' }
      ]
    }
  },

  /* The whole spine, primary through to CSEC.
   *
   * Primary is listed but marked external: it is served by a separate site.
   * It sits here so the journey shows a student where they have come from, and
   * so the two can be joined later without reshaping this file — see README,
   * "Joining the primary site". */
  stages: [
    { key:'primary', label:'Primary school', years:'Infant 1 – Standard 5', exam:'SEA',
      external:true,
      note:'Seven years to the Secondary Entrance Assessment, which decides the secondary school. Covered by a separate site.' },
    { key:'lower', label:'Lower secondary', years:'Form 1 – Form 3', exam:'Subject selection',
      forms:[1,2,3],
      note:'Three years to build the base and to earn the right to choose. Form 3 results decide which CSEC subjects are open to you.' },
    { key:'upper', label:'Upper secondary', years:'Form 4 – Form 5', exam:'CSEC',
      forms:[4,5],
      note:'Two years on the CSEC syllabus itself, with School-Based Assessment running alongside from the start of Form 4.' }
  ],

  /* Form 1-5 roadmap, now term by term. Each form knows what its three terms
     are for, and which milestones fall in them, so the journey can tell a
     student what THIS term is for rather than what the next five years are. */
  roadmap: [
    { form:1, label:'Form 1', phase:'Foundations', stage:'lower',
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

    { form:2, label:'Form 2', phase:'Building', stage:'lower',
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

    { form:3, label:'Form 3', phase:'Choosing', stage:'lower',
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

    { form:4, label:'Form 4', phase:'CSEC Year One', stage:'upper',
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

    { form:5, label:'Form 5', phase:'Examination Year', stage:'upper',
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
