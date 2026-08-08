/**
 * ==========================================================================
 *  VUMI AGENT CONTRACTING — the wizard
 * ==========================================================================
 *  Asks for each piece of information once, then writes it into the three
 *  official PDFs (see packet.js). Progress is saved as you type, so an
 *  applicant can stop on the bus and finish at their desk; if a backend is
 *  configured the same progress follows them to another device and drives
 *  the follow-up reminders.
 *
 *  SETUP — see CONTRACTING-SETUP.md:
 *    API_URL: the Google Apps Script Web App URL (ends in /exec).
 *             Leave "" and the wizard still works end to end: everything is
 *             stored on the applicant's own device and the finished PDFs are
 *             downloaded rather than submitted.
 * ==========================================================================
 */
(function () {
  'use strict';

  var CONFIG = {
    API_URL: '', // e.g. "https://script.google.com/macros/s/XXXX/exec"
    RECRUITER_NAME: 'Ricky Rampersad',
    RECRUITER_EMAIL: 'ricky.rampersad@myguardiangroup.com',
    RECRUITER_PHONE: '(868) 678-5921',
    RECRUITER_WHATSAPP: '18686785921',

    /* Filled in on the applicant's behalf — these come from the agency, not
       from them. Anything left blank simply stays blank on the form. */
    AGENCY: {
      generalAgentName: 'Ricky Rampersad',
      generalAgentCode: '',
      agentCode: '',
      effectiveText: '',
      requiredProduction: '',
      requiredPersistency: '',
      commissions: {
        absolute: ['', ''], universal: ['', ''], special: ['', ''], access: ['', ''],
        optimum: ['', ''], direct: ['', ''], senior: ['', ''], prime: ['', ''],
        termLife: ['', ''], travel: '',
      },
    },

    MAX_UPLOAD_MB: 8,

    /* The companies an agent can contract with. Used when there is no
       backend; when there is one, the sign-in reply supplies the list.
       Add a carrier here and in packet.js once its forms exist. */
    CARRIERS: [
      { id: 'vumi', name: 'VUMI® Group', available: true },
      { id: 'bestdoctors', name: 'Best Doctors Insurance', available: false },
    ],
  };

  var CARRIER_BLURB = {
    vumi: {
      en: 'International health and life — the full 11-page packet, beneficiary form and W-8BEN.',
      es: 'Salud y vida internacional — el paquete completo de 11 páginas, beneficiario y W-8BEN.',
    },
    bestdoctors: {
      en: 'Coming soon — we are preparing their contracting forms.',
      es: 'Próximamente — estamos preparando sus formularios de contratación.',
    },
  };

  var P = window.VumiPacket;
  var PDFLib = window.PDFLib;

  /* ===================== copy ===================== */

  var T = {
    brandSub: { es: 'Firme una vez. Empiece a vender.', en: 'Sign once. Start selling.' },
    saved: { es: 'Guardado', en: 'Saved' },
    next: { es: 'Continuar', en: 'Continue' },
    back: { es: 'Atrás', en: 'Back' },
    finish: { es: 'Revisar y generar', en: 'Review and generate' },
    stepOf: { es: 'Paso {a} de {b}', en: 'Step {a} of {b}' },
    complete: { es: '<b>{p}%</b> completado', en: '<b>{p}%</b> complete' },
    required: { es: 'Obligatorio', en: 'Required' },
    savedToast: { es: 'Progreso guardado', en: 'Progress saved' },
    generating: { es: 'Generando sus formularios…', en: 'Generating your forms…' },
    genFailed: { es: 'No se pudieron generar los formularios', en: 'Could not generate the forms' },
    sending: { es: 'Enviando…', en: 'Sending…' },
    sameAsHome: { es: 'Igual que la residencia', en: 'Same as home address' },
    sameAsOffice: { es: 'Igual que la oficina', en: 'Same as office address' },
    copyFromPersonal: { es: 'Usar mis datos personales', en: 'Use my personal details' },
    clear: { es: 'Borrar', en: 'Clear' },
    yes: { es: 'Sí', en: 'Yes' },
    no: { es: 'No', en: 'No' },

    /* sign in */
    welcomeTitle: { es: 'Bienvenido a Contratación', en: 'Welcome to Contracting' },
    welcomeSub: {
      es: 'Entre con el número de agente y el código que le entregaron.',
      en: 'Sign in with the agent number and passcode you were given.',
    },
    agentNo: { es: 'Número de agente', en: 'Agent number' },
    passcode: { es: 'Código de acceso', en: 'Passcode' },
    signIn: { es: 'Entrar', en: 'Sign in' },
    signingIn: { es: 'Entrando…', en: 'Signing in…' },
    signOut: { es: 'Salir', en: 'Sign out' },
    needBoth: { es: 'Escriba su número de agente y su código.', en: 'Enter your agent number and passcode.' },
    badNumber: { es: 'No reconocemos ese número de agente.', en: "We don't recognise that agent number." },
    badPasscode: { es: 'Ese código no es correcto.', en: 'That passcode is not right.' },
    inactive: { es: 'Ese acceso está desactivado. Hable con su gerente.', en: 'That login is switched off. Speak to your manager.' },
    signOffline: { es: 'No pudimos entrar ahora mismo. Intente de nuevo en un momento.', en: "We couldn't sign you in just now. Try again in a moment." },
    noAccount: {
      es: '¿No tiene un número de agente? Escriba a {email} y se lo enviamos.',
      en: 'No agent number yet? Email {email} and we will send you one.',
    },
    noBackend: {
      es: 'Todavía no hay acceso configurado, así que puede entrar directo a la solicitud.',
      en: 'No sign-in is configured yet, so you can go straight to the application.',
    },
    continueAnyway: { es: 'Continuar a la solicitud', en: 'Continue to the application' },

    tagline: { es: 'Firme una vez. Empiece a vender.', en: 'Sign once. Start selling.' },
    orNew: { es: 'o', en: 'or' },
    newHere: { es: 'Soy nuevo — quiero mi número de agente', en: "I'm new here — get my agent number" },
    haveNumber: { es: 'Ya tengo un número', en: 'I already have a number' },
    joinTitle: { es: 'Vamos a darle su número', en: "Let's get you a number" },
    joinSub: {
      es: 'Tres datos y su número de agente es suyo en segundos.',
      en: 'Three details and your agent number is yours in seconds.',
    },
    fullName: { es: 'Nombre completo', en: 'Full name' },
    email: { es: 'Correo electrónico', en: 'Email' },
    mobile: { es: 'Teléfono móvil', en: 'Mobile' },
    getNumber: { es: 'Obtener mi número de agente', en: 'Get my agent number' },
    working: { es: 'Un momento…', en: 'One moment…' },
    joinNeed: { es: 'Escriba su nombre y su correo electrónico.', en: 'Enter your name and your email.' },
    joinBadEmail: { es: 'Revise su correo electrónico.', en: 'Check your email address.' },
    joinFailed: { es: 'No pudimos crearlo ahora mismo. Intente de nuevo.', en: "We couldn't set that up just now. Try again." },
    issuedTitle: { es: '¡Listo, {name}!', en: "You're in, {name}!" },
    issuedBack: { es: 'Ya tenía un número — aquí está.', en: 'You already had a number — here it is.' },
    issuedSub: {
      es: 'Guarde estos datos. Los necesita cada vez que entre. También se los enviamos por correo.',
      en: 'Keep these. You need them every time you sign in. We have emailed them to you as well.',
    },
    issuedGo: { es: 'Comenzar mi contratación', en: 'Start my contracting' },
    issuedFoot: {
      es: '¿Perdió su código? Escriba a {email} y se lo reenviamos.',
      en: 'Lost your passcode? Email {email} and we will resend it.',
    },

    /* carrier choice */
    pickTitle: { es: '¿Con quién desea contratarse?', en: 'Who are you applying to contract with?' },
    pickSub: {
      es: 'Elija la compañía. Añadiremos más a medida que estén listas.',
      en: 'Choose the company. More are being added as they are ready.',
    },
    comingSoon: { es: 'Próximamente', en: 'Coming soon' },
    resume: { es: 'Continuar donde quedó', en: 'Pick up where you left off' },
    startFresh: { es: 'Comenzar', en: 'Start' },
    staffTitle: { es: 'Bienvenido de nuevo, {name}', en: 'Welcome back, {name}' },
    staffSub: {
      es: '¿Qué desea hacer hoy?',
      en: 'What would you like to do today?',
    },
    inviteAgent: { es: 'Invitar a un agente', en: 'Invite an agent' },
    inviteAgentSub: {
      es: 'Le enviamos la carta de invitación con su número y su código.',
      en: 'Sends the invitation letter with their agent number and passcode.',
    },
    openPipeline: { es: 'Ver la lista de contrataciones', en: 'Open the contracting pipeline' },
    openPipelineSub: {
      es: 'Quién va por dónde, qué falta y a quién hay que empujar.',
      en: "Who is where, what's missing, and who needs a push.",
    },
    startForAgent: { es: 'Llenar una solicitud', en: 'Fill in an application' },
    startForAgentSub: {
      es: 'Complete el paquete de contratación con un agente al lado.',
      en: 'Work through the contracting packet with an agent beside you.',
    },
    roleManager: { es: 'Gerente de sucursal', en: 'Branch manager' },
    roleAssistant: { es: 'Asistente del gerente', en: "Branch manager's assistant" },
    roleAgent: { es: 'Agente', en: 'Agent' },
  };

  function t(key, vars) {
    var s = (T[key] && T[key][state.lang]) || key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.replace('{' + k + '}', vars[k]); });
    return s;
  }
  function L(obj) { return obj ? (obj[state.lang] || obj.es || '') : ''; }

  /* ===================== option lists ===================== */

  var YN = [
    { v: 'no', label: { es: 'No', en: 'No' } },
    { v: 'yes', label: { es: 'Sí', en: 'Yes' } },
  ];

  var ADDRESS_FIELDS = function (prefix, labelPrefix) {
    return [
      { k: prefix + '.address', t: 'text', w: 4, label: labelPrefix },
      { k: prefix + '.city', t: 'text', w: 1, label: { es: 'Ciudad', en: 'City' } },
      { k: prefix + '.state', t: 'text', w: 1, label: { es: 'Provincia o estado', en: 'State or province' } },
      { k: prefix + '.zip', t: 'text', w: 1, label: { es: 'Zona postal', en: 'Postal code' } },
      { k: prefix + '.country', t: 'text', w: 1, label: { es: 'País', en: 'Country' } },
    ];
  };

  function personRef(i) {
    var n = i + 1;
    return [
      { sub: { es: 'Referencia personal ' + n, en: 'Personal reference ' + n } },
      { k: 'personalRefs.' + i + '.name', t: 'text', label: { es: 'Nombre de quien provee la referencia', en: 'Name of the person giving the reference' } },
      { k: 'personalRefs.' + i + '.phone', t: 'tel', w: 1, label: { es: 'Teléfono', en: 'Phone' } },
      { k: 'personalRefs.' + i + '.email', t: 'email', w: 1, label: { es: 'Correo electrónico', en: 'Email' } },
      { k: 'personalRefs.' + i + '.address', t: 'text', w: 4, label: { es: 'Dirección', en: 'Address' } },
      { k: 'personalRefs.' + i + '.city', t: 'text', w: 1, label: { es: 'Ciudad', en: 'City' } },
      { k: 'personalRefs.' + i + '.state', t: 'text', w: 1, label: { es: 'Provincia o estado', en: 'State or province' } },
      { k: 'personalRefs.' + i + '.zip', t: 'text', w: 1, label: { es: 'Zona postal', en: 'Postal code' } },
      { k: 'personalRefs.' + i + '.country', t: 'text', w: 1, label: { es: 'País', en: 'Country' } },
    ];
  }

  function bankRef(i) {
    var n = i + 1;
    return [
      { sub: { es: 'Referencia bancaria ' + n, en: 'Bank reference ' + n } },
      { k: 'bankRefs.' + i + '.bankName', t: 'text', label: { es: 'Nombre del banco', en: 'Bank name' } },
      { k: 'bankRefs.' + i + '.bankPhone', t: 'tel', label: { es: 'Teléfono del banco', en: 'Bank phone' } },
      { k: 'bankRefs.' + i + '.bankAddress', t: 'text', w: 4, label: { es: 'Dirección física y/o postal del banco', en: 'Bank address' } },
      { k: 'bankRefs.' + i + '.bankCity', t: 'text', w: 1, label: { es: 'Ciudad', en: 'City' } },
      { k: 'bankRefs.' + i + '.bankState', t: 'text', w: 1, label: { es: 'Provincia o estado', en: 'State or province' } },
      { k: 'bankRefs.' + i + '.bankZip', t: 'text', w: 1, label: { es: 'Zona postal', en: 'Postal code' } },
      { k: 'bankRefs.' + i + '.bankCountry', t: 'text', w: 1, label: { es: 'País', en: 'Country' } },
      { k: 'bankRefs.' + i + '.refName', t: 'text', label: { es: 'Nombre de quien provee la referencia', en: 'Name of the person giving the reference' } },
      { k: 'bankRefs.' + i + '.refPhone', t: 'tel', label: { es: 'Teléfono', en: 'Phone' } },
      { k: 'bankRefs.' + i + '.refAddress', t: 'text', w: 4, label: { es: 'Dirección', en: 'Address' } },
      { k: 'bankRefs.' + i + '.refCity', t: 'text', w: 1, label: { es: 'Ciudad', en: 'City' } },
      { k: 'bankRefs.' + i + '.refState', t: 'text', w: 1, label: { es: 'Provincia o estado', en: 'State or province' } },
      { k: 'bankRefs.' + i + '.refZip', t: 'text', w: 1, label: { es: 'Zona postal', en: 'Postal code' } },
      { k: 'bankRefs.' + i + '.refCountry', t: 'text', w: 1, label: { es: 'País', en: 'Country' } },
    ];
  }

  function carrier(i) {
    var n = i + 1;
    return [
      { k: 'carriers.' + i + '.name', t: 'text', label: { es: 'Compañía aseguradora ' + n, en: 'Insurance company ' + n } },
      { k: 'carriers.' + i + '.policies', t: 'text', w: 1, label: { es: 'Número de pólizas', en: 'Number of policies' } },
      { k: 'carriers.' + i + '.premiums', t: 'text', w: 1, label: { es: 'Total en primas', en: 'Total premiums' } },
      { k: 'carriers.' + i + '.persistency', t: 'text', w: 2, label: { es: 'Índice de persistencia', en: 'Persistency rate' } },
    ];
  }

  function beneficiary(kind, i) {
    var n = i + 1;
    var esKind = kind === 'primary' ? 'primario' : 'contingente';
    var enKind = kind === 'primary' ? 'Primary' : 'Contingent';
    return [
      { k: 'beneficiaries.' + kind + '.' + i + '.name', t: 'text', label: { es: 'Beneficiario ' + esKind + ' ' + n + ' — nombre completo', en: enKind + ' beneficiary ' + n + ' — full name' } },
      { k: 'beneficiaries.' + kind + '.' + i + '.dob', t: 'date', w: 1, label: { es: 'Fecha de nacimiento', en: 'Date of birth' } },
      { k: 'beneficiaries.' + kind + '.' + i + '.relationship', t: 'text', w: 1, label: { es: 'Parentesco', en: 'Relationship' } },
      { k: 'beneficiaries.' + kind + '.' + i + '.percent', t: 'number', w: 2, label: { es: 'Porcentaje (número entero)', en: 'Percentage (whole number)' }, max: 100, min: 0 },
    ];
  }

  var DOC_ITEMS = [
    { k: 'docs.id', label: { es: 'Identificación con foto del solicitante', en: 'Photo ID of the applicant' } },
    { k: 'docs.addressProof', label: { es: 'Comprobante de dirección (recibo de servicio)', en: 'Proof of address (utility bill)' } },
    { k: 'docs.w8ben', label: { es: 'W-8BEN (se genera en esta solicitud)', en: 'W-8BEN (generated by this application)' } },
    { k: 'docs.w9', label: { es: 'W-9 — sólo agentes registrados en EE. UU.', en: 'W-9 — U.S.-registered agents only' } },
    { k: 'docs.voidedCheck', label: { es: 'Cheque anulado o estado de cuenta bancario', en: 'Voided cheque or bank statement' } },
    { k: 'docs.references', label: { es: 'Referencias personales y bancarias en físico', en: 'Personal and bank references (hard copy)' } },
    { k: 'docs.beneficiaryForm', label: { es: 'Designación de beneficiarios (se genera aquí)', en: 'Beneficiary designation (generated here)' } },
    { k: 'docs.carrierProof', label: { es: 'Prueba de las compañías que representa', en: 'Proof of the carriers you represent' } },
    { k: 'docs.incorporation', label: { es: 'Certificado de incorporación — sólo compañías', en: 'Certificate of incorporation — companies only' } },
    { k: 'docs.poa', label: { es: 'Poder de representación legal — sólo empresas', en: 'Power of attorney — companies only' } },
  ];

  /* ===================== the steps ===================== */

  var STEPS = [
    {
      id: 'start',
      nav: { es: 'Inicio', en: 'Start' },
      title: { es: 'Su contratación como Productor/Agente VUMI®', en: 'Your VUMI® Producer/Agent contracting' },
      lead: {
        es: 'Responda una sola vez y nosotros llenamos los tres formularios oficiales por usted. Puede detenerse cuando quiera: su progreso se guarda solo.',
        en: 'Answer once and we fill all three official forms for you. Stop whenever you like — your progress saves itself.',
      },
      custom: 'start',
    },
    {
      id: 'personal',
      nav: { es: 'Datos personales', en: 'Personal' },
      title: { es: 'Datos personales', en: 'Personal details' },
      lead: { es: 'Tal como aparecen en su identificación o pasaporte.', en: 'Exactly as they appear on your ID or passport.' },
      fields: [
        { k: 'fullName', t: 'text', w: 4, label: { es: 'Nombre completo del Productor/Agente o Compañía', en: 'Full name of the Producer/Agent or Company' } },
        { k: 'lastName', t: 'text', label: { es: 'Apellido(s)', en: 'Last name(s)' } },
        { k: 'firstName', t: 'text', label: { es: 'Nombre(s)', en: 'First name(s)' } },
        { k: 'dob', t: 'date', w: 1, label: { es: 'Fecha de nacimiento o incorporación', en: 'Date of birth or incorporation' } },
        { k: 'sex', t: 'seg', w: 3, label: { es: 'Sexo', en: 'Sex' }, options: [
          { v: 'M', label: { es: 'Masculino', en: 'Male' } },
          { v: 'F', label: { es: 'Femenino', en: 'Female' } },
        ] },
        { k: 'maritalStatus', t: 'seg', w: 4, rerender: true, after: clearSpouseIfSingle, label: { es: 'Estado civil', en: 'Marital status' }, options: [
          { v: 'single', label: { es: 'Soltero(a)', en: 'Single' } },
          { v: 'married', label: { es: 'Casado(a)', en: 'Married' } },
          { v: 'domestic', label: { es: 'Compañero(a) doméstico(a)', en: 'Domestic partner' } },
          { v: 'divorced', label: { es: 'Divorciado(a)', en: 'Divorced' } },
          { v: 'widowed', label: { es: 'Viudo(a)', en: 'Widowed' } },
        ] },
        { k: 'spouseName', t: 'text', label: { es: 'Nombre de su cónyuge', en: "Spouse's name" }, showIf: function (d) { return d.maritalStatus === 'married' || d.maritalStatus === 'domestic'; } },
        { k: 'language', t: 'seg', w: 4, label: { es: 'Idioma', en: 'Language' }, options: [
          { v: 'es', label: { es: 'Español', en: 'Spanish' } },
          { v: 'en', label: { es: 'Inglés', en: 'English' } },
          { v: 'pt', label: { es: 'Portugués', en: 'Portuguese' } },
        ] },
        { sub: { es: 'Identificación e impuestos', en: 'Identification and tax' } },
        { k: 'idNumber', t: 'text', w: 1, label: { es: 'Cédula de identidad o pasaporte', en: 'ID or passport number' } },
        { k: 'ssn', t: 'text', w: 1, label: { es: 'Seguro social (si procede)', en: 'Social security number (if any)' } },
        { k: 'taxId', t: 'text', w: 1, label: { es: 'Identificación de impuestos (si procede)', en: 'Tax ID number (if any)' } },
        { k: 'yearsInInsurance', t: 'text', w: 1, label: { es: 'Tiempo en el campo de seguros', en: 'Time in the insurance field' } },
        { k: 'profession', t: 'text', label: { es: 'Profesión', en: 'Profession' } },
        { k: 'occupation', t: 'text', label: { es: 'Ocupación', en: 'Occupation' } },
      ],
    },
    {
      id: 'contact',
      nav: { es: 'Contacto', en: 'Contact' },
      title: { es: 'Contacto y direcciones', en: 'Contact and addresses' },
      lead: { es: 'Usaremos su correo y móvil para enviarle el enlace de su solicitud.', en: 'We use your email and mobile to send you your application link.' },
      fields: [
        { k: 'email', t: 'email', label: { es: 'Correo electrónico', en: 'Email' } },
        { k: 'mobile', t: 'tel', label: { es: 'Teléfono móvil', en: 'Mobile phone' } },
        { k: 'officePhone', t: 'tel', label: { es: 'Teléfono de oficina', en: 'Office phone' } },
        { k: 'website', t: 'text', label: { es: 'Página web', en: 'Website' } },
        { sub: { es: 'Dirección de residencia', en: 'Home address' } },
      ].concat(ADDRESS_FIELDS('home', { es: 'Dirección de residencia', en: 'Home address' }), [
        { sub: { es: 'Dirección de oficina', en: 'Office address' } },
        { helper: [{ id: 'office-from-home', label: 'sameAsHome' }] },
      ], ADDRESS_FIELDS('office', { es: 'Dirección de oficina', en: 'Office address' }), [
        { sub: { es: 'Dirección postal', en: 'Mailing address' } },
        { helper: [
          { id: 'mail-from-home', label: 'sameAsHome' },
          { id: 'mail-from-office', label: 'sameAsOffice' },
        ] },
      ], ADDRESS_FIELDS('mail', { es: 'Dirección postal (si es diferente)', en: 'Mailing address (if different)' })),
    },
    {
      id: 'agency',
      nav: { es: 'Su negocio', en: 'Your business' },
      title: { es: 'Su agencia y experiencia', en: 'Your agency and experience' },
      lead: { es: 'Cuéntenos con qué compañías ha trabajado y dónde piensa vender.', en: 'Tell us which carriers you have worked with and where you plan to sell.' },
      fields: [
        { k: 'agencyName', t: 'text', label: { es: 'Nombre de la agencia', en: 'Agency name' } },
        { k: 'producerName', t: 'text', label: { es: 'Nombre que desea usar como Productor/Agente', en: 'Name you want to use as Producer/Agent' } },
        { sub: { es: 'Compañías que representa o ha representado', en: 'Carriers you represent or have represented' } },
      ].concat(carrier(0), carrier(1), carrier(2), [
        { sub: { es: 'Su mercado', en: 'Your market' } },
        { k: 'regions', t: 'textarea', w: 4, label: { es: 'Regiones y ciudades donde piensa vender nuestros productos', en: 'Regions and cities where you plan to sell our products' } },
        { k: 'otherInfo', t: 'textarea', w: 4, label: { es: 'Otra información pertinente: segmento de mercado, razón de su interés por VUMI®', en: 'Anything else relevant: market segment, why you want to sell VUMI®' } },
      ]),
    },
    {
      id: 'refs',
      nav: { es: 'Referencias', en: 'References' },
      title: { es: 'Referencias personales', en: 'Personal references' },
      lead: { es: 'Dos personas que puedan responder por usted. Se requieren respaldos en físico.', en: 'Two people who can vouch for you. Hard-copy letters are required.' },
      fields: personRef(0).concat(personRef(1)),
    },
    {
      id: 'banks',
      nav: { es: 'Bancos', en: 'Banks' },
      title: { es: 'Referencias bancarias', en: 'Bank references' },
      lead: { es: 'Dos bancos con los que mantiene relación. Se requieren respaldos en físico.', en: 'Two banks you hold a relationship with. Hard-copy letters are required.' },
      fields: bankRef(0).concat(bankRef(1)),
    },
    {
      id: 'disclosures',
      nav: { es: 'Declaraciones', en: 'Disclosures' },
      title: { es: 'Más información', en: 'More information' },
      lead: { es: 'Si responde “Sí”, explique brevemente en el recuadro de observaciones.', en: 'If you answer "Yes", explain briefly in the notes box.' },
      fields: [
        { k: 'disclosures.politicallyExposed', t: 'yn', note: 'disclosureNotes.politicallyExposed', label: { es: 'Usted o algún familiar está relacionado políticamente', en: 'You or a family member is politically connected' } },
        { k: 'disclosures.familyContract', t: 'yn', note: 'disclosureNotes.familyContract', label: { es: 'Tiene algún familiar con contrato en VUMI®', en: 'You have a family member under contract with VUMI®' } },
        { k: 'disclosures.familyEmployee', t: 'yn', note: 'disclosureNotes.familyEmployee', label: { es: 'Tiene algún familiar o conocido que trabaje en VUMI®', en: 'You have a family member or acquaintance working at VUMI®' } },
        { k: 'disclosures.workedForAgency', t: 'yn', note: 'disclosureNotes.workedForAgency', label: { es: 'Ha trabajado para algún agente o agencia', en: 'You have worked for an agent or agency' } },
        { k: 'disclosures.thirdParty', t: 'yn', note: 'disclosureNotes.thirdParty', label: { es: 'Está representando a un tercero con este contrato', en: 'You are representing a third party with this contract' } },
        { k: 'disclosures.otherContract', t: 'yn', note: 'disclosureNotes.otherContract', label: { es: 'Tiene otro contrato de agente registrado bajo otro nombre', en: 'You have another agent contract registered under another name' } },
        { k: 'disclosures.codeRevoked', t: 'yn', note: 'disclosureNotes.codeRevoked', label: { es: 'Se le ha anulado el código anteriormente en VUMI® u otra compañía', en: 'Your code has previously been revoked at VUMI® or another company' } },
      ],
    },
    {
      id: 'payment',
      nav: { es: 'Pago', en: 'Payment' },
      title: { es: 'Cómo quiere cobrar sus comisiones', en: 'How you want your commissions paid' },
      lead: { es: 'ACH es para cuentas dentro de Estados Unidos; la transferencia bancaria, para cuentas fuera.', en: 'ACH is for accounts inside the United States; wire transfer is for accounts outside.' },
      fields: [
        { k: 'payment.method', t: 'seg', w: 4, rerender: true, after: clearUnusedPaymentDetails, label: { es: 'Método de pago', en: 'Payment method' }, options: [
          { v: 'check', label: { es: 'Cheque', en: 'Cheque' } },
          { v: 'ach', label: { es: 'Depósito directo / ACH', en: 'Direct deposit / ACH' } },
          { v: 'wire', label: { es: 'Transferencia bancaria', en: 'Wire transfer' } },
        ] },
        { info: { es: 'El cheque se emitirá a nombre del agente registrado.', en: 'The cheque will be issued to the registered agent.' }, showIf: function (d) { return P.get(d, 'payment.method') === 'check'; } },
        { sub: { es: 'Depósito directo / ACH', en: 'Direct deposit / ACH' }, showIf: function (d) { return P.get(d, 'payment.method') === 'ach'; } },
        { k: 'payment.ach.holder', t: 'text', w: 4, label: { es: 'Nombre del titular de la cuenta bancaria', en: 'Bank account holder name' }, showIf: function (d) { return P.get(d, 'payment.method') === 'ach'; } },
        { k: 'payment.ach.bank', t: 'text', label: { es: 'Nombre del banco', en: 'Bank name' }, showIf: function (d) { return P.get(d, 'payment.method') === 'ach'; } },
        { k: 'payment.ach.account', t: 'text', w: 1, label: { es: 'Número de cuenta', en: 'Account number' }, showIf: function (d) { return P.get(d, 'payment.method') === 'ach'; } },
        { k: 'payment.ach.routing', t: 'text', w: 1, label: { es: 'Número de ruta ACH (9 dígitos)', en: 'ACH routing number (9 digits)' }, digits: 9, showIf: function (d) { return P.get(d, 'payment.method') === 'ach'; } },
        { sub: { es: 'Transferencia bancaria', en: 'Wire transfer' }, showIf: function (d) { return P.get(d, 'payment.method') === 'wire'; } },
        { k: 'payment.wire.holder', t: 'text', label: { es: 'Nombre del titular de la cuenta bancaria', en: 'Bank account holder name' }, showIf: function (d) { return P.get(d, 'payment.method') === 'wire'; } },
        { k: 'payment.wire.bank', t: 'text', label: { es: 'Nombre del banco', en: 'Bank name' }, showIf: function (d) { return P.get(d, 'payment.method') === 'wire'; } },
        { k: 'payment.wire.account', t: 'text', label: { es: 'Número de cuenta o IBAN', en: 'Account number or IBAN' }, showIf: function (d) { return P.get(d, 'payment.method') === 'wire'; } },
        { k: 'payment.wire.swift', t: 'text', w: 1, label: { es: 'Código SWIFT', en: 'SWIFT code' }, showIf: function (d) { return P.get(d, 'payment.method') === 'wire'; } },
        { k: 'payment.wire.country', t: 'text', w: 1, label: { es: 'País del banco', en: 'Bank country' }, showIf: function (d) { return P.get(d, 'payment.method') === 'wire'; } },
        { k: 'payment.wire.intermediaryBank', t: 'text', label: { es: 'Banco intermediario (si aplica)', en: 'Intermediary bank (if any)' }, showIf: function (d) { return P.get(d, 'payment.method') === 'wire'; } },
        { k: 'payment.wire.wireRouting', t: 'text', label: { es: 'Número de ruta wire', en: 'Wire routing number' }, showIf: function (d) { return P.get(d, 'payment.method') === 'wire'; } },
      ],
    },
    {
      id: 'beneficiaries',
      nav: { es: 'Beneficiarios', en: 'Beneficiaries' },
      title: { es: 'Designación de beneficiarios', en: 'Beneficiary designation' },
      lead: { es: 'Quién recibe sus comisiones si usted fallece o queda incapacitado. Los porcentajes de cada grupo deben sumar 100.', en: 'Who receives your commissions if you die or become incapacitated. Each group must add up to 100%.' },
      custom: 'beneficiaries',
      fields: [
        { sub: { es: 'Beneficiarios primarios', en: 'Primary beneficiaries' } },
      ].concat(beneficiary('primary', 0), beneficiary('primary', 1), beneficiary('primary', 2), [
        { k: 'beneficiaries.primaryGuardian', t: 'text', w: 4, label: { es: 'Si algún beneficiario es menor de edad, nombre del tutor designado', en: 'If any beneficiary is a minor, name of the designated guardian' } },
        { sub: { es: 'Beneficiarios contingentes', en: 'Contingent beneficiaries' } },
      ], beneficiary('contingent', 0), beneficiary('contingent', 1), beneficiary('contingent', 2), [
        { k: 'beneficiaries.contingentGuardian', t: 'text', w: 4, label: { es: 'Si algún beneficiario es menor de edad, nombre del tutor designado', en: 'If any beneficiary is a minor, name of the designated guardian' } },
        { k: 'beneficiariesSummary', t: 'text', w: 4, label: { es: 'Resumen de beneficiarios para la solicitud', en: 'Beneficiary summary for the application' }, hint: { es: 'Se completa solo con los nombres de arriba.', en: 'Filled in automatically from the names above.' } },
      ]),
    },
    {
      id: 'w8',
      nav: { es: 'W-8BEN', en: 'W-8BEN' },
      title: { es: 'Formulario W-8BEN', en: 'Form W-8BEN' },
      lead: { es: 'Declaración de condición de extranjero para el IRS. Casi todo se copia de sus datos personales.', en: 'IRS certificate of foreign status. Almost everything copies from your personal details.' },
      fields: [
        { helper: [{ id: 'w8-from-personal', label: 'copyFromPersonal' }] },
        { k: 'w8.name', t: 'text', label: { es: 'Nombre del beneficiario efectivo (línea 1)', en: 'Name of beneficial owner (line 1)' } },
        { k: 'w8.citizenship', t: 'text', label: { es: 'País de ciudadanía (línea 2)', en: 'Country of citizenship (line 2)' } },
        { k: 'w8.permAddress', t: 'text', w: 4, label: { es: 'Dirección permanente de residencia (línea 3) — no use apartado postal', en: 'Permanent residence address (line 3) — no P.O. box' } },
        { k: 'w8.permCity', t: 'text', label: { es: 'Ciudad, estado o provincia y código postal', en: 'City or town, state or province, postal code' } },
        { k: 'w8.permCountry', t: 'text', label: { es: 'País', en: 'Country' } },
        { k: 'w8.mailAddress', t: 'text', w: 4, label: { es: 'Dirección postal si es diferente (línea 4)', en: 'Mailing address if different (line 4)' } },
        { k: 'w8.mailCity', t: 'text', label: { es: 'Ciudad, estado o provincia y código postal', en: 'City or town, state or province, postal code' } },
        { k: 'w8.mailCountry', t: 'text', label: { es: 'País', en: 'Country' } },
        { k: 'w8.usTin', t: 'text', w: 1, label: { es: 'Número de identificación fiscal de EE. UU. — SSN o ITIN (línea 5)', en: 'U.S. taxpayer identification number — SSN or ITIN (line 5)' } },
        { k: 'w8.foreignTin', t: 'text', w: 1, label: { es: 'Número de identificación fiscal extranjero (línea 6)', en: 'Foreign tax identifying number (line 6)' } },
        { k: 'w8.referenceNumbers', t: 'text', w: 1, label: { es: 'Números de referencia (línea 7)', en: 'Reference number(s) (line 7)' } },
        { k: 'w8.dob', t: 'date', w: 1, label: { es: 'Fecha de nacimiento (línea 8)', en: 'Date of birth (line 8)' } },
        { sub: { es: 'Beneficios por tratado fiscal — opcional', en: 'Tax treaty benefits — optional' } },
        { info: { es: 'La mayoría de los agentes deja esta sección en blanco. Complétela sólo si reclama una tasa reducida bajo un tratado fiscal con Estados Unidos.', en: 'Most agents leave this section blank. Complete it only if you are claiming a reduced rate under a U.S. tax treaty.' } },
        { k: 'w8.treatyCountry', t: 'text', label: { es: 'País de residencia bajo el tratado (línea 9)', en: 'Country of residence under the treaty (line 9)' } },
        { k: 'w8.treatyArticle', t: 'text', w: 1, label: { es: 'Artículo y párrafo', en: 'Article and paragraph' } },
        { k: 'w8.treatyRate', t: 'text', w: 1, label: { es: 'Tasa de retención (%)', en: 'Rate of withholding (%)' } },
        { k: 'w8.treatyIncome', t: 'text', w: 4, label: { es: 'Tipo de ingreso', en: 'Type of income' } },
        { k: 'w8.treatyExplain', t: 'text', w: 4, label: { es: 'Condiciones adicionales que cumple', en: 'Additional conditions you meet' } },
        { k: 'w8.capacity', t: 'text', w: 4, label: { es: 'Capacidad en la que actúa (sólo si no firma el beneficiario efectivo)', en: 'Capacity in which acting (only if the beneficial owner is not signing)' } },
      ],
    },
    {
      id: 'docs',
      nav: { es: 'Documentos', en: 'Documents' },
      title: { es: 'Documentos requeridos', en: 'Required documents' },
      lead: { es: 'Marque lo que va a enviar y, si puede, adjúntelo aquí mismo desde su teléfono.', en: 'Tick what you are sending and, if you can, attach it right here from your phone.' },
      custom: 'docs',
    },
    {
      id: 'sign',
      nav: { es: 'Firma', en: 'Signature' },
      title: { es: 'Firme su solicitud', en: 'Sign your application' },
      lead: { es: 'Su firma se coloca en los tres formularios y sus iniciales en las 11 páginas del convenio.', en: 'Your signature goes on all three forms and your initials on all 11 pages of the agreement.' },
      custom: 'sign',
    },
    {
      id: 'review',
      nav: { es: 'Revisar', en: 'Review' },
      title: { es: 'Revise y envíe', en: 'Review and send' },
      lead: { es: 'Revise los formularios completados antes de enviarlos.', en: 'Check the completed forms before you send them.' },
      custom: 'review',
    },
  ];

  /* ===================== state ===================== */

  var state = {
    lang: 'en',
    step: 0,
    token: '',
    data: null,
    files: [],
    generated: null,
    submitting: false,
    session: null,   // { role, name, agentNumber, token, adminKey, carriers }
    carrier: '',
  };

  function blankData() {
    return {
      fullName: '', lastName: '', firstName: '', dob: '', sex: '', maritalStatus: '',
      spouseName: '', language: 'es', agencyName: '', producerName: '',
      home: {}, office: {}, mail: {},
      officePhone: '', mobile: '', email: '', website: '',
      idNumber: '', ssn: '', taxId: '', profession: '', occupation: '', yearsInInsurance: '',
      beneficiariesSummary: '',
      personalRefs: [{}, {}],
      bankRefs: [{}, {}],
      carriers: [{}, {}, {}],
      regions: '', otherInfo: '',
      disclosures: {}, disclosureNotes: {},
      payment: { method: '', ach: {}, wire: {} },
      docs: {},
      beneficiaries: {
        primary: [{}, {}, {}], primaryGuardian: '',
        contingent: [{}, {}, {}], contingentGuardian: '',
      },
      w8: {},
      signature: { dataUrl: '', initials: '', place: '', date: '', printedName: '' },
      agency: JSON.parse(JSON.stringify(CONFIG.AGENCY)),
    };
  }

  function setVal(path, value) {
    var parts = String(path).split('.');
    var cur = state.data;
    for (var i = 0; i < parts.length - 1; i++) {
      if (cur[parts[i]] === null || typeof cur[parts[i]] !== 'object') {
        cur[parts[i]] = /^\d+$/.test(parts[i + 1]) ? [] : {};
      }
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  }
  function getVal(path) { return P.get(state.data, path); }

  /* ===================== storage ===================== */

  function storageKey() { return 'vumi-contracting:' + (state.token || 'local'); }

  var saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 700);
  }

  function save() {
    try {
      localStorage.setItem(storageKey(), JSON.stringify({
        data: state.data, step: state.step, lang: state.lang,
        files: state.files, savedAt: new Date().toISOString(),
      }));
    } catch (e) { /* private mode or quota — the wizard still works in memory */ }
    flashSaved();
    syncToServer();
  }

  function loadLocal() {
    try {
      var raw = localStorage.getItem(storageKey());
      if (!raw) return false;
      var parsed = JSON.parse(raw);
      if (parsed && parsed.data) {
        state.data = Object.assign(blankData(), parsed.data);
        state.files = parsed.files || [];
        if (typeof parsed.step === 'number') state.step = parsed.step;
        if (parsed.lang) state.lang = parsed.lang;
        return true;
      }
    } catch (e) { /* corrupt entry — start fresh */ }
    return false;
  }

  var syncTimer = null;
  function syncToServer() {
    if (!CONFIG.API_URL || !state.token) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () {
      var progress = P.completeness(state.data, state.lang);
      post({
        action: 'save',
        token: state.token,
        name: state.data.fullName,
        email: state.data.email,
        mobile: state.data.mobile,
        percent: progress.percent,
        missing: progress.missing.map(function (m) { return m.label; }),
        data: state.data,
      }).catch(function () { /* offline — localStorage still holds it */ });
    }, 2500);
  }

  function post(payload) {
    return fetch(CONFIG.API_URL, {
      method: 'POST',
      /* text/plain keeps the request "simple" so Apps Script answers it
         without a CORS preflight it cannot handle. */
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    }).then(function (r) { return r.json(); });
  }

  /* ===================== small helpers ===================== */

  function el(tag, cls, html) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html !== undefined) node.innerHTML = html;
    return node;
  }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function makeToken() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var out = '';
    var rnd = new Uint8Array(10);
    (window.crypto || window.msCrypto).getRandomValues(rnd);
    for (var i = 0; i < 10; i++) out += chars[rnd[i] % chars.length];
    return out;
  }

  var toastTimer = null;
  function toast(msg, bad) {
    var node = document.getElementById('toast');
    node.textContent = msg;
    node.className = 'toast show' + (bad ? ' bad' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.className = 'toast'; }, 2600);
  }

  var savedTimer = null;
  function flashSaved() {
    var chip = document.getElementById('savechip');
    chip.classList.add('show');
    clearTimeout(savedTimer);
    savedTimer = setTimeout(function () { chip.classList.remove('show'); }, 1600);
  }

  /* ===================== rendering ===================== */

  function fieldVisible(f) { return !f.showIf || f.showIf(state.data); }

  function renderField(f) {
    if (!fieldVisible(f)) return null;

    if (f.sub) return el('div', 'subhead', esc(L(f.sub)));
    if (f.info) return el('div', 'note', esc(L(f.info)));

    if (f.helper) {
      var bar = el('div', 'helper');
      f.helper.forEach(function (h) {
        var b = el('button', null, esc(t(h.label)));
        b.type = 'button';
        b.dataset.helper = h.id;
        bar.appendChild(b);
      });
      return bar;
    }

    var wrap = el('div', 'f' + (f.w === 1 ? ' w1' : f.w === 4 ? ' w4' : ''));
    var missing = isRequired(f.k) && !getVal(f.k);
    var label = el('span', 'lbl', esc(L(f.label)) + (isRequired(f.k) ? ' <em>*</em>' : ''));
    wrap.appendChild(label);

    var value = getVal(f.k);

    if (f.t === 'seg' || f.t === 'yn') {
      var options = f.t === 'yn' ? YN : f.options;
      var seg = el('div', 'seg' + (f.t === 'yn' ? ' yn' : ''));
      options.forEach(function (o) {
        var id = f.k + '-' + o.v;
        var lab = el('label');
        lab.innerHTML = '<input type="radio" name="' + esc(f.k) + '" value="' + esc(o.v) + '" id="' + esc(id) + '"' +
          (value === o.v ? ' checked' : '') + '><span>' + esc(L(o.label)) + '</span>';
        seg.appendChild(lab);
      });
      seg.addEventListener('change', function (e) {
        if (e.target.name !== f.k) return;
        setVal(f.k, e.target.value);
        onChange(f);
      });
      wrap.appendChild(seg);

      if (f.note) {
        var noteWrap = el('div');
        noteWrap.style.marginTop = '8px';
        var noteInput = el('input');
        noteInput.type = 'text';
        noteInput.value = getVal(f.note) || '';
        noteInput.placeholder = state.lang === 'es' ? 'Observaciones (si respondió Sí)' : 'Notes (if you answered Yes)';
        noteInput.addEventListener('input', function () { setVal(f.note, noteInput.value); scheduleSave(); });
        noteWrap.appendChild(noteInput);
        wrap.appendChild(noteWrap);
      }
      return wrap;
    }

    var input;
    if (f.t === 'textarea') {
      input = el('textarea');
    } else {
      input = el('input');
      input.type = f.t === 'number' ? 'number' : f.t === 'date' ? 'date' : f.t === 'email' ? 'email' : f.t === 'tel' ? 'tel' : 'text';
      if (f.t === 'number') {
        if (f.min !== undefined) input.min = f.min;
        if (f.max !== undefined) input.max = f.max;
      }
      if (f.digits) { input.inputMode = 'numeric'; input.maxLength = f.digits; }
    }
    input.value = value === undefined || value === null ? '' : value;
    if (missing) input.classList.add('missing');
    input.id = 'field-' + f.k.replace(/\./g, '-');
    input.addEventListener('input', function () {
      var v = input.value;
      if (f.digits) { v = v.replace(/\D/g, '').slice(0, f.digits); input.value = v; }
      setVal(f.k, v);
      input.classList.remove('missing');
      onChange(f);
    });
    wrap.appendChild(input);
    if (f.hint) wrap.appendChild(el('span', 'hint', esc(L(f.hint))));
    return wrap;
  }

  /* Recomputed after every keystroke that could change a derived value. */
  function onChange(f) {
    if (f && (f.k === 'fullName' || f.k === 'firstName' || f.k === 'lastName')) deriveNames();
    if (f && f.k && f.k.indexOf('beneficiaries.') === 0) deriveBeneficiarySummary();
    if (f && f.after) f.after(state.data);
    scheduleSave();
    updateProgress();
    if (currentStep().custom === 'beneficiaries') updateBeneficiaryTotals();
    /* Some answers decide which questions come next — redraw so they appear. */
    if (f && f.rerender) { save(); render(); return; }
    renderStepNav();
  }

  /** Only the chosen payment route belongs on the form. */
  function clearUnusedPaymentDetails(d) {
    var method = P.get(d, 'payment.method');
    if (method !== 'ach') d.payment.ach = {};
    if (method !== 'wire') d.payment.wire = {};
  }

  function clearSpouseIfSingle(d) {
    if (d.maritalStatus !== 'married' && d.maritalStatus !== 'domestic') d.spouseName = '';
  }

  function deriveNames() {
    var d = state.data;
    if (!d.fullName && (d.firstName || d.lastName)) d.fullName = (d.firstName + ' ' + d.lastName).trim();
    if (!d.signature.printedName) d.signature.printedName = d.fullName;
    if (!d.signature.initials) d.signature.initials = P.initialsOf(d.fullName);
    if (!d.w8.name) d.w8.name = d.fullName;
  }

  function deriveBeneficiarySummary() {
    var names = (state.data.beneficiaries.primary || [])
      .map(function (b) { return b && b.name ? b.name + (b.relationship ? ' (' + b.relationship + ')' : '') : ''; })
      .filter(Boolean);
    if (names.length) state.data.beneficiariesSummary = names.join(', ');
  }

  function isRequired(key) {
    if (!key) return false;
    var required = P.REQUIRED.concat([]);
    for (var i = 0; i < required.length; i++) if (required[i].path === key) return true;
    var progress = P.completeness(state.data, state.lang);
    for (var j = 0; j < progress.missing.length; j++) if (progress.missing[j].path === key) return true;
    return false;
  }

  function currentStep() { return STEPS[state.step]; }

  function render() {
    var step = currentStep();
    var card = document.getElementById('card');
    card.innerHTML = '';

    card.appendChild(el('div', 'stepcount', esc(t('stepOf', { a: state.step + 1, b: STEPS.length }))));
    card.appendChild(el('h1', null, esc(L(step.title))));
    if (step.lead) card.appendChild(el('p', 'lead', esc(L(step.lead))));

    if (step.custom === 'start') renderStart(card);
    else if (step.custom === 'docs') renderDocs(card);
    else if (step.custom === 'sign') renderSign(card);
    else if (step.custom === 'review') renderReview(card);

    if (step.fields) {
      var grid = el('div', 'grid');
      step.fields.forEach(function (f) {
        var node = renderField(f);
        if (node) grid.appendChild(node);
      });
      card.appendChild(grid);
      grid.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-helper]');
        if (btn) runHelper(btn.dataset.helper);
      });
    }

    if (step.custom === 'beneficiaries') {
      var totals = el('div', 'warn');
      totals.id = 'bentotals';
      card.appendChild(totals);
      updateBeneficiaryTotals();
    }

    renderStepNav();
    updateProgress();
    updateFooter();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderStepNav() {
    var nav = document.getElementById('stepnav');
    nav.innerHTML = '';
    STEPS.forEach(function (s, i) {
      var b = el('button', null, (stepDone(s) ? '<span class="tick">✓</span>' : '') + esc(L(s.nav)));
      b.type = 'button';
      if (i === state.step) b.setAttribute('aria-current', 'true');
      b.addEventListener('click', function () { goto(i); });
      nav.appendChild(b);
    });
    var active = nav.querySelector('[aria-current="true"]');
    if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  /**
   * A tick means "nothing outstanding here". Steps that ask nothing
   * mandatory (the agency background, the document checklist) never tick —
   * a tick on a step you have not opened yet would be a lie.
   */
  function stepDone(step) {
    if (step.custom === 'start' || step.custom === 'review') return false;
    var owns = false;
    for (var i = 0; i < P.REQUIRED.length; i++) {
      if (P.REQUIRED[i].step === step.id) { owns = true; break; }
    }
    if (!owns) return false;
    var progress = P.completeness(state.data, state.lang);
    for (var j = 0; j < progress.missing.length; j++) {
      if (progress.missing[j].step === step.id) return false;
    }
    return true;
  }

  function updateProgress() {
    var progress = P.completeness(state.data, state.lang);
    document.getElementById('progressfill').style.width = progress.percent + '%';
    document.getElementById('pctlabel').innerHTML = t('complete', { p: progress.percent });
  }

  function updateFooter() {
    var back = document.getElementById('backbtn');
    var next = document.getElementById('nextbtn');
    back.style.visibility = state.step === 0 ? 'hidden' : 'visible';
    back.textContent = '← ' + t('back');
    if (state.step === STEPS.length - 1) {
      next.style.display = 'none';
    } else {
      next.style.display = '';
      next.textContent = (state.step === STEPS.length - 2 ? t('finish') : t('next')) + ' →';
    }
  }

  function goto(i) {
    state.step = Math.max(0, Math.min(STEPS.length - 1, i));
    save();
    render();
  }

  function updateBeneficiaryTotals() {
    var box = document.getElementById('bentotals');
    if (!box) return;
    var totals = P.beneficiaryTotals(state.data);
    var ok = (totals.primary === 100 || totals.primary === 0) && (totals.contingent === 100 || totals.contingent === 0);
    box.className = 'warn' + (ok ? '' : ' bad');
    box.innerHTML = state.lang === 'es'
      ? 'Primarios: <b>' + totals.primary + '%</b> · Contingentes: <b>' + totals.contingent + '%</b>' +
        (ok ? ' — los porcentajes cuadran.' : ' — cada grupo que use debe sumar exactamente 100%.')
      : 'Primary: <b>' + totals.primary + '%</b> · Contingent: <b>' + totals.contingent + '%</b>' +
        (ok ? ' — the percentages add up.' : ' — each group you use must total exactly 100%.');
  }

  /* ===================== helper buttons ===================== */

  function copyAddress(from, to) {
    ['address', 'city', 'state', 'zip', 'country'].forEach(function (part) {
      setVal(to + '.' + part, getVal(from + '.' + part) || '');
    });
    save();
    render();
  }

  function runHelper(id) {
    if (id === 'office-from-home') return copyAddress('home', 'office');
    if (id === 'mail-from-home') return copyAddress('home', 'mail');
    if (id === 'mail-from-office') return copyAddress('office', 'mail');
    if (id === 'w8-from-personal') {
      var d = state.data;
      setVal('w8.name', d.fullName || '');
      setVal('w8.citizenship', getVal('home.country') || '');
      setVal('w8.permAddress', getVal('home.address') || '');
      setVal('w8.permCity', [getVal('home.city'), getVal('home.state'), getVal('home.zip')].filter(Boolean).join(', '));
      setVal('w8.permCountry', getVal('home.country') || '');
      setVal('w8.mailAddress', getVal('mail.address') || '');
      setVal('w8.mailCity', [getVal('mail.city'), getVal('mail.state'), getVal('mail.zip')].filter(Boolean).join(', '));
      setVal('w8.mailCountry', getVal('mail.country') || '');
      setVal('w8.usTin', d.ssn || '');
      setVal('w8.foreignTin', d.taxId || '');
      setVal('w8.dob', d.dob || '');
      save();
      render();
    }
  }

  /* ===================== step: start ===================== */

  function renderStart(card) {
    var hero = el('div', 'hero-start');
    var items = [
      { n: 1, es: ['Solicitud de Productor/Agente', '11 páginas, con el convenio y el programa de comisiones.'],
        en: ['Producer/Agent application', '11 pages, including the agreement and commission schedule.'] },
      { n: 2, es: ['Designación de beneficiario', 'Quién cobra sus comisiones si usted falta.'],
        en: ['Beneficiary designation', 'Who receives your commissions if something happens to you.'] },
      { n: 3, es: ['Formulario W-8BEN del IRS', 'Su declaración de condición de extranjero.'],
        en: ['IRS Form W-8BEN', 'Your certificate of foreign status.'] },
    ];
    var list = el('div', 'packlist');
    items.forEach(function (item) {
      var copy = state.lang === 'es' ? item.es : item.en;
      var row = el('div');
      row.innerHTML = '<span class="num">' + item.n + '</span><span><b>' + esc(copy[0]) + '</b><span>' + esc(copy[1]) + '</span></span>';
      list.appendChild(row);
    });
    hero.appendChild(list);

    var note = el('div', 'note');
    note.innerHTML = state.lang === 'es'
      ? 'Tome unos <b>15 minutos</b>. Tenga a mano su identificación, sus datos bancarios y dos referencias personales y bancarias. Su progreso se guarda automáticamente en este dispositivo.'
      : 'Set aside about <b>15 minutes</b>. Have your ID, your bank details and two personal and bank references handy. Your progress saves automatically on this device.';
    hero.appendChild(note);

    var session = state.session || {};
    if (session.agentNumber) {
      var backNote = el('div', 'note');
      backNote.style.marginTop = '10px';
      backNote.innerHTML = state.lang === 'es'
        ? 'Puede cerrar esta página cuando quiera. Para volver, entre con su número de agente <b>' +
          esc(session.agentNumber) + '</b> y su código.'
        : 'Close this page whenever you like. To come back, sign in with your agent number <b>' +
          esc(session.agentNumber) + '</b> and your passcode.';
      hero.appendChild(backNote);
    }

    card.appendChild(hero);
  }

  /* ===================== step: documents ===================== */

  function renderDocs(card) {
    var grid = el('div', 'grid');

    var checks = el('div', 'checks');
    checks.style.gridColumn = '1/-1';
    DOC_ITEMS.forEach(function (item) {
      var lab = el('label');
      lab.innerHTML = '<input type="checkbox"' + (getVal(item.k) ? ' checked' : '') + '><span>' + esc(L(item.label)) + '</span>';
      lab.querySelector('input').addEventListener('change', function (e) {
        setVal(item.k, e.target.checked);
        scheduleSave();
      });
      checks.appendChild(lab);
    });
    grid.appendChild(checks);

    var drop = el('div', 'drop');
    drop.innerHTML = '<p style="font-weight:700;margin-bottom:4px">' +
      (state.lang === 'es' ? 'Adjunte sus documentos' : 'Attach your documents') + '</p>' +
      '<p style="color:var(--muted);font-size:.85rem;margin-bottom:12px">' +
      (state.lang === 'es'
        ? 'Fotos o PDF, hasta ' + CONFIG.MAX_UPLOAD_MB + ' MB cada uno. Las fotos se reducen automáticamente.'
        : 'Photos or PDFs, up to ' + CONFIG.MAX_UPLOAD_MB + ' MB each. Photos are shrunk automatically.') + '</p>';
    var pick = el('button', 'btn btn-teal btn-sm', state.lang === 'es' ? 'Elegir archivos' : 'Choose files');
    pick.type = 'button';
    var fileInput = el('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.accept = 'image/*,application/pdf';
    pick.addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () { addFiles(fileInput.files); });
    drop.appendChild(pick);
    drop.appendChild(fileInput);
    grid.appendChild(drop);

    var list = el('div', 'filelist');
    list.id = 'filelist';
    grid.appendChild(list);

    card.appendChild(grid);
    renderFileList();
  }

  function renderFileList() {
    var list = document.getElementById('filelist');
    if (!list) return;
    list.innerHTML = '';
    state.files.forEach(function (f, i) {
      var row = el('div', 'fileitem');
      row.innerHTML = '<span class="nm">' + esc(f.name) + '</span><span class="sz">' + Math.round(f.size / 1024) + ' KB</span>';
      var del = el('button', null, state.lang === 'es' ? 'Quitar' : 'Remove');
      del.type = 'button';
      del.addEventListener('click', function () { state.files.splice(i, 1); save(); renderFileList(); });
      row.appendChild(del);
      list.appendChild(row);
    });
  }

  function addFiles(fileList) {
    var files = Array.prototype.slice.call(fileList);
    var pending = files.length;
    if (!pending) return;
    files.forEach(function (file) {
      if (file.size > CONFIG.MAX_UPLOAD_MB * 1024 * 1024 && file.type.indexOf('image/') !== 0) {
        toast((state.lang === 'es' ? 'Archivo muy grande: ' : 'File too large: ') + file.name, true);
        if (--pending === 0) { save(); renderFileList(); }
        return;
      }
      readFile(file, function (result) {
        if (result) state.files.push(result);
        if (--pending === 0) { save(); renderFileList(); }
      });
    });
  }

  /** Photos of an ID come off a phone at 6 MB; shrink them before storing. */
  function readFile(file, done) {
    if (file.type.indexOf('image/') !== 0) {
      var reader = new FileReader();
      reader.onload = function () { done({ name: file.name, type: file.type, size: file.size, dataUrl: reader.result }); };
      reader.onerror = function () { done(null); };
      reader.readAsDataURL(file);
      return;
    }
    var img = new Image();
    var url = URL.createObjectURL(file);
    img.onload = function () {
      var maxSide = 1600;
      var scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      var canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      var dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      URL.revokeObjectURL(url);
      done({
        name: file.name.replace(/\.[^.]+$/, '') + '.jpg',
        type: 'image/jpeg',
        size: Math.round(dataUrl.length * 0.75),
        dataUrl: dataUrl,
      });
    };
    img.onerror = function () { URL.revokeObjectURL(url); done(null); };
    img.src = url;
  }

  /* ===================== step: signature ===================== */

  function renderSign(card) {
    if (!getVal('signature.date')) setVal('signature.date', todayISO());
    if (!getVal('signature.printedName')) setVal('signature.printedName', state.data.fullName || '');
    if (!getVal('signature.initials')) setVal('signature.initials', P.initialsOf(state.data.fullName));

    var grid = el('div', 'grid');

    var sigWrap = el('div', 'sigwrap');
    sigWrap.innerHTML = '<span class="lbl" style="font-size:.8rem;font-weight:700;display:block;margin-bottom:6px">' +
      (state.lang === 'es' ? 'Firme con el dedo o el ratón' : 'Sign with your finger or mouse') + ' <em style="color:var(--red);font-style:normal">*</em></span>';
    var pad = el('div', 'sigpad');
    var canvas = el('canvas');
    pad.appendChild(canvas);
    pad.appendChild(el('div', 'baseline'));
    pad.appendChild(el('div', 'ph', state.lang === 'es' ? 'Firme aquí' : 'Sign here'));
    sigWrap.appendChild(pad);

    var actions = el('div', 'sigactions');
    var clearBtn = el('button', 'btn btn-ghost btn-sm', t('clear'));
    clearBtn.type = 'button';
    actions.appendChild(clearBtn);
    sigWrap.appendChild(actions);
    grid.appendChild(sigWrap);

    [
      { k: 'signature.printedName', t: 'text', w: 4, label: { es: 'Nombre impreso del firmante', en: 'Printed name of signer' } },
      { k: 'signature.initials', t: 'text', w: 1, label: { es: 'Iniciales (van en las 11 páginas)', en: 'Initials (go on all 11 pages)' } },
      { k: 'signature.place', t: 'text', w: 1, label: { es: 'Lugar de la firma', en: 'Place of signing' } },
      { k: 'signature.date', t: 'date', w: 2, label: { es: 'Fecha de la firma', en: 'Date of signing' } },
    ].forEach(function (f) { grid.appendChild(renderField(f)); });

    var legal = el('div', 'note');
    legal.innerHTML = state.lang === 'es'
      ? 'Al firmar declara que la información es verdadera y completa, y autoriza a VUMI® a verificarla. Su firma se aplicará a la solicitud, al convenio, al Anexo 1, a la designación de beneficiario y al W-8BEN.'
      : 'By signing you declare the information is true and complete and authorise VUMI® to verify it. Your signature is applied to the application, the agreement, Annex 1, the beneficiary designation and the W-8BEN.';
    grid.appendChild(legal);

    card.appendChild(grid);
    initSignaturePad(canvas, pad, clearBtn);
  }

  function initSignaturePad(canvas, pad, clearBtn) {
    var ctx = canvas.getContext('2d');
    var ratio = window.devicePixelRatio || 1;
    var drawing = false, dirty = false, last = null;

    function resize() {
      var rect = canvas.getBoundingClientRect();
      var existing = dirty ? canvas.toDataURL('image/png') : null;
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#10233d';
      if (existing) {
        var img = new Image();
        img.onload = function () { ctx.drawImage(img, 0, 0, rect.width, rect.height); };
        img.src = existing;
      }
    }
    resize();
    window.addEventListener('resize', resize);

    var saved = getVal('signature.dataUrl');
    if (saved) {
      var img = new Image();
      img.onload = function () {
        var rect = canvas.getBoundingClientRect();
        var scale = Math.min(rect.width / img.width, rect.height / img.height, 1);
        ctx.drawImage(img, (rect.width - img.width * scale) / 2, (rect.height - img.height * scale) / 2,
          img.width * scale, img.height * scale);
      };
      img.src = saved;
      dirty = true;
      pad.classList.add('has');
    }

    function pos(e) {
      var rect = canvas.getBoundingClientRect();
      var point = e.touches ? e.touches[0] : e;
      return { x: point.clientX - rect.left, y: point.clientY - rect.top };
    }
    function start(e) { e.preventDefault(); drawing = true; last = pos(e); pad.classList.add('has'); }
    function move(e) {
      if (!drawing) return;
      e.preventDefault();
      var p = pos(e);
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last = p;
      dirty = true;
    }
    function end() {
      if (!drawing) return;
      drawing = false;
      if (dirty) { setVal('signature.dataUrl', trimmedSignature(canvas)); scheduleSave(); updateProgress(); }
    }

    canvas.addEventListener('pointerdown', start);
    canvas.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end);

    clearBtn.addEventListener('click', function () {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      dirty = false;
      pad.classList.remove('has');
      setVal('signature.dataUrl', '');
      save();
      updateProgress();
    });
  }

  /** Crop the transparent margin so the signature fills its box on the form. */
  function trimmedSignature(canvas) {
    var ctx = canvas.getContext('2d');
    var w = canvas.width, h = canvas.height;
    var pixels;
    try { pixels = ctx.getImageData(0, 0, w, h).data; } catch (e) { return canvas.toDataURL('image/png'); }
    var minX = w, minY = h, maxX = -1, maxY = -1;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        if (pixels[(y * w + x) * 4 + 3] > 8) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return '';
    var pad = 6;
    minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
    maxX = Math.min(w - 1, maxX + pad); maxY = Math.min(h - 1, maxY + pad);
    var out = document.createElement('canvas');
    out.width = maxX - minX + 1;
    out.height = maxY - minY + 1;
    out.getContext('2d').drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
    return out.toDataURL('image/png');
  }

  /* ===================== step: review ===================== */

  function renderReview(card) {
    var progress = P.completeness(state.data, state.lang);

    if (progress.missing.length) {
      var warn = el('div', 'warn bad');
      warn.style.marginTop = '18px';
      warn.innerHTML = state.lang === 'es'
        ? 'Faltan <b>' + progress.missing.length + '</b> datos. Puede generar los formularios igual, pero VUMI® necesita todo para procesar su contratación.'
        : '<b>' + progress.missing.length + '</b> answers are still missing. You can still generate the forms, but VUMI® needs everything to process your contracting.';
      card.appendChild(warn);

      var list = el('div', 'missinglist');
      progress.missing.slice(0, 14).forEach(function (m) {
        var b = el('button', null, '<span>' + esc(m.label) + '</span><span>→</span>');
        b.type = 'button';
        b.addEventListener('click', function () {
          var idx = STEPS.findIndex(function (s) { return s.id === m.step; });
          if (idx >= 0) {
            goto(idx);
            setTimeout(function () {
              var node = document.getElementById('field-' + m.path.replace(/\./g, '-'));
              if (node) { node.focus(); node.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
            }, 320);
          }
        });
        list.appendChild(b);
      });
      card.appendChild(list);
    } else {
      var ok = el('div', 'note');
      ok.style.marginTop = '18px';
      ok.innerHTML = state.lang === 'es'
        ? '<b>Todo listo.</b> Sus tres formularios están completos y firmados.'
        : '<b>All set.</b> Your three forms are complete and signed.';
      card.appendChild(ok);
    }

    var docs = el('div', 'doclist');
    [
      { id: 'solicitud', es: ['Solicitud de Productor/Agente', '11 páginas · convenio y Anexo 1'], en: ['Producer/Agent application', '11 pages · agreement and Annex 1'] },
      { id: 'beneficiario', es: ['Designación de beneficiario', '1 página'], en: ['Beneficiary designation', '1 page'] },
      { id: 'w8ben', es: ['Formulario W-8BEN', '1 página · IRS'], en: ['Form W-8BEN', '1 page · IRS'] },
    ].forEach(function (doc) {
      var copy = state.lang === 'es' ? doc.es : doc.en;
      var row = el('div', 'doc');
      row.innerHTML = '<span class="ic">PDF</span><span class="meta"><b>' + esc(copy[0]) + '</b><span>' + esc(copy[1]) + '</span></span>';
      var view = el('button', 'btn btn-ghost btn-sm', state.lang === 'es' ? 'Ver' : 'View');
      view.type = 'button';
      view.addEventListener('click', function () { showPreview(doc.id); });
      var dl = el('button', 'btn btn-ghost btn-sm', state.lang === 'es' ? 'Descargar' : 'Download');
      dl.type = 'button';
      dl.addEventListener('click', function () { downloadOne(doc.id); });
      row.appendChild(view);
      row.appendChild(dl);
      docs.appendChild(row);
    });
    card.appendChild(docs);

    var box = el('div', 'previewbox');
    box.id = 'previewbox';
    box.innerHTML = '<div class="previewtabs" id="previewtabs"></div><iframe id="previewframe" title="PDF"></iframe>';
    card.appendChild(box);

    var actions = el('div');
    actions.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;margin-top:22px';
    var all = el('button', 'btn btn-teal', state.lang === 'es' ? 'Descargar los 3 formularios' : 'Download all 3 forms');
    all.type = 'button';
    all.addEventListener('click', downloadAll);
    actions.appendChild(all);

    var send = el('button', 'btn btn-gold', state.lang === 'es' ? 'Enviar mi solicitud' : 'Send my application');
    send.type = 'button';
    send.id = 'sendbtn';
    send.addEventListener('click', submitPacket);
    actions.appendChild(send);
    card.appendChild(actions);

    var mailto = el('p', 'lead');
    mailto.style.marginTop = '14px';
    mailto.innerHTML = state.lang === 'es'
      ? '¿Prefiere enviarlos usted? Descárguelos y envíelos a <a href="mailto:' + esc(CONFIG.RECRUITER_EMAIL) + '">' + esc(CONFIG.RECRUITER_EMAIL) + '</a> o por WhatsApp al ' + esc(CONFIG.RECRUITER_PHONE) + '.'
      : 'Prefer to send them yourself? Download them and email <a href="mailto:' + esc(CONFIG.RECRUITER_EMAIL) + '">' + esc(CONFIG.RECRUITER_EMAIL) + '</a> or WhatsApp ' + esc(CONFIG.RECRUITER_PHONE) + '.';
    card.appendChild(mailto);
  }

  /* ===================== PDF generation ===================== */

  var sourceCache = null;
  function loadSources() {
    if (sourceCache) return sourceCache;
    sourceCache = Promise.all(P.FORMS.map(function (spec) {
      return fetch(spec.file).then(function (r) {
        if (!r.ok) throw new Error('missing ' + spec.file);
        return r.arrayBuffer();
      });
    })).then(function (buffers) {
      var out = {};
      P.FORMS.forEach(function (spec, i) { out[spec.id] = buffers[i]; });
      return out;
    });
    return sourceCache;
  }

  function generate() {
    toast(t('generating'));
    return loadSources()
      .then(function (sources) { return P.fillPacket(PDFLib, sources, state.data); })
      .then(function (files) {
        state.generated = files;
        return files;
      })
      .catch(function (err) {
        toast(t('genFailed'), true);
        throw err;
      });
  }

  function blobFor(file) { return new Blob([file.bytes], { type: 'application/pdf' }); }

  function downloadBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function fileName(file) {
    var who = (state.data.fullName || 'Agente').replace(/[^\w\sáéíóúñÁÉÍÓÚÑ-]/g, '').trim().replace(/\s+/g, '-');
    return file.name.replace(/\.pdf$/, '') + '-' + who + '.pdf';
  }

  function downloadOne(id) {
    generate().then(function (files) {
      var file = files.find(function (f) { return f.id === id; });
      if (file) downloadBlob(blobFor(file), fileName(file));
    }).catch(function () {});
  }

  function downloadAll() {
    generate().then(function (files) {
      files.forEach(function (file, i) {
        setTimeout(function () { downloadBlob(blobFor(file), fileName(file)); }, i * 500);
      });
    }).catch(function () {});
  }

  var previewUrls = [];
  function showPreview(id) {
    generate().then(function (files) {
      previewUrls.forEach(URL.revokeObjectURL);
      previewUrls = [];
      var box = document.getElementById('previewbox');
      var tabs = document.getElementById('previewtabs');
      var frame = document.getElementById('previewframe');
      if (!box) return;
      box.classList.add('show');
      tabs.innerHTML = '';
      files.forEach(function (file) {
        var url = URL.createObjectURL(blobFor(file));
        previewUrls.push(url);
        var b = el('button', null, esc(file.name.replace(/^VUMI-|^IRS-|\.pdf$/g, '').replace(/-/g, ' ')));
        b.type = 'button';
        if (file.id === id) { b.setAttribute('aria-pressed', 'true'); frame.src = url; }
        b.addEventListener('click', function () {
          tabs.querySelectorAll('button').forEach(function (x) { x.removeAttribute('aria-pressed'); });
          b.setAttribute('aria-pressed', 'true');
          frame.src = url;
        });
        tabs.appendChild(b);
      });
      box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(function () {});
  }

  /* ===================== submit ===================== */

  function submitPacket() {
    if (state.submitting) return;
    var btn = document.getElementById('sendbtn');

    if (!CONFIG.API_URL) {
      /* No backend wired up: hand the applicant the files and the address. */
      downloadAll();
      toast(state.lang === 'es'
        ? 'Descargados. Envíelos a ' + CONFIG.RECRUITER_EMAIL
        : 'Downloaded. Email them to ' + CONFIG.RECRUITER_EMAIL);
      return;
    }

    state.submitting = true;
    btn.disabled = true;
    btn.textContent = t('sending');

    generate().then(function (files) {
      var progress = P.completeness(state.data, state.lang);
      return post({
        action: 'submit',
        token: state.token,
        name: state.data.fullName,
        email: state.data.email,
        mobile: state.data.mobile,
        lang: state.lang,
        percent: progress.percent,
        missing: progress.missing.map(function (m) { return m.label; }),
        data: state.data,
        pdfs: files.map(function (f) { return { name: fileName(f), base64: bytesToBase64(f.bytes) }; }),
        uploads: state.files.map(function (f) { return { name: f.name, type: f.type, dataUrl: f.dataUrl }; }),
      });
    }).then(function (res) {
      if (!res || !res.ok) throw new Error(res && res.error ? res.error : 'submit failed');
      state.data.submittedAt = new Date().toISOString();
      state.data.trackingCode = res.code || '';
      save();
      renderSubmitted(res.code || '');
    }).catch(function () {
      toast(state.lang === 'es'
        ? 'No se pudo enviar. Descargue los formularios y envíelos por correo.'
        : 'Could not send. Download the forms and email them instead.', true);
      downloadAll();
    }).then(function () {
      state.submitting = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = state.lang === 'es' ? 'Enviar mi solicitud' : 'Send my application';
      }
    });
  }

  function renderSubmitted(code) {
    var card = document.getElementById('card');
    card.innerHTML = '';
    var es = state.lang === 'es';
    var box = el('div', 'center');
    box.style.padding = '20px 0';

    box.innerHTML =
      '<div style="font-size:3rem;line-height:1">✅</div>' +
      '<h1 style="margin-top:12px">' + (es ? '¡Gracias! Su solicitud fue enviada' : 'Thank you! Your application is sent') + '</h1>' +
      '<p class="lead" style="margin:10px auto 0;max-width:540px">' +
      (es
        ? 'Su paquete firmado ya va camino a VUMI®. Le enviamos su copia de los tres formularios a ' + esc(state.data.email) + '.'
        : 'Your signed packet is already on its way to VUMI®. Your copy of all three forms is on its way to ' + esc(state.data.email) + '.') +
      '</p>';

    /* The code is the thing they must not lose — give it the whole width. */
    if (code) {
      var codeBox = el('div');
      codeBox.style.cssText = 'background:var(--teal-50);border:1px solid #CBEAE8;border-radius:16px;' +
        'padding:22px;margin:24px auto 0;max-width:420px';
      codeBox.innerHTML =
        '<div style="font-size:.72rem;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:var(--teal-600)">' +
        (es ? 'Su código de seguimiento' : 'Your tracking code') + '</div>' +
        '<div style="font-size:2.1rem;font-weight:800;letter-spacing:.2em;color:var(--navy-900);margin:8px 0 4px">' +
        esc(code) + '</div>' +
        '<div style="font-size:.84rem;color:var(--muted)">' +
        (es ? 'Guárdelo. Con este código puede ver en qué punto va su contratación, cuando quiera.'
            : 'Keep it. This code shows you how far along your contracting is, any time.') + '</div>';
      box.appendChild(codeBox);

      var track = el('a', 'btn btn-gold', es ? 'Ver el avance de mi contratación' : 'Track my contracting');
      track.href = 'status.html?c=' + encodeURIComponent(code) + (es ? '' : '&lang=en');
      track.style.marginTop = '18px';
      box.appendChild(track);
    }

    var actions = el('div');
    actions.style.cssText = 'display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:14px';
    var dl = el('button', 'btn btn-ghost', es ? 'Descargar mi copia' : 'Download my copy');
    dl.type = 'button';
    dl.addEventListener('click', downloadAll);
    actions.appendChild(dl);
    box.appendChild(actions);

    card.appendChild(box);
    document.getElementById('nextbtn').style.display = 'none';
    document.getElementById('backbtn').style.visibility = 'hidden';
  }

  function bytesToBase64(bytes) {
    var chunk = 0x8000, parts = [];
    for (var i = 0; i < bytes.length; i += chunk) {
      parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + chunk)));
    }
    return btoa(parts.join(''));
  }

  /* ===================== sign in ===================== */

  var SESSION_KEY = 'vumi-contracting-session';

  function loadSession() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) state.session = JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return state.session;
  }

  function storeSession(session) {
    state.session = session;
    /* sessionStorage, not localStorage: closing the tab signs you out, which
       matters on the shared machines these get filled in on. */
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) { /* ignore */ }
  }

  function signOut() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
    state.session = null;
    state.carrier = '';
    location.reload();
  }

  var SCREENS = ['signin', 'join', 'issued', 'choose'];

  function showScreen(which) {
    document.getElementById('gate').style.display = which === 'wizard' ? 'none' : '';
    SCREENS.forEach(function (id) {
      var node = document.getElementById(id === 'choose' ? 'choosecard' : id === 'signin' ? 'signincard' : id + 'card');
      if (node) node.style.display = which === id ? '' : 'none';
    });
    document.getElementById('wizard').style.display = which === 'wizard' ? '' : 'none';
    document.getElementById('footbar').style.display = which === 'wizard' ? '' : 'none';
  }

  function renderSignIn() {
    showScreen('signin');
    var foot = document.getElementById('signfoot');
    document.getElementById('newhere').style.display = CONFIG.API_URL ? '' : 'none';
    document.querySelector('.orline').style.display = CONFIG.API_URL ? '' : 'none';
    if (CONFIG.API_URL) {
      foot.innerHTML = t('noAccount', {
        email: '<a href="mailto:' + esc(CONFIG.RECRUITER_EMAIL) + '">' + esc(CONFIG.RECRUITER_EMAIL) + '</a>',
      });
    } else {
      foot.innerHTML = esc(t('noBackend'));
      var go = el('button', 'btn btn-ghost', t('continueAnyway'));
      go.type = 'button';
      go.style.marginTop = '12px';
      go.addEventListener('click', function () {
        storeSession({ role: 'agent', name: '', agentNumber: '', token: state.token });
        renderChoose();
      });
      foot.appendChild(document.createElement('br'));
      foot.appendChild(go);
    }
    document.getElementById('agentno').focus();
  }

  function doSignIn(e) {
    if (e) e.preventDefault();
    var number = document.getElementById('agentno').value.trim();
    var pass = document.getElementById('passcode').value.trim();
    var err = document.getElementById('signerr');
    var btn = document.getElementById('signbtn');

    if (!number || !pass) { err.textContent = t('needBoth'); return; }
    err.textContent = '';
    btn.disabled = true;
    btn.textContent = t('signingIn');

    post({ action: 'login', agentNumber: number, passcode: pass })
      .then(function (res) {
        if (!res || !res.ok) {
          err.textContent = res && res.error === 'passcode' ? t('badPasscode')
            : res && res.error === 'inactive' ? t('inactive')
            : t('badNumber');
          return;
        }
        if (res.lang === 'es' || res.lang === 'en') { state.lang = res.lang; applyLang(); }
        storeSession({
          role: res.role, name: res.name, agentNumber: res.agentNumber,
          token: res.token || '', adminKey: res.adminKey || '', carriers: res.carriers || null,
        });
        if (res.token) {
          state.token = res.token;
          try { localStorage.setItem('vumi-contracting:last', res.token); } catch (e2) { /* ignore */ }
          state.data = blankData();
          loadLocal();
        }
        document.getElementById('passcode').value = '';
        renderChoose();
      })
      .catch(function () { err.textContent = t('signOffline'); })
      .then(function () { btn.disabled = false; btn.textContent = t('signIn'); });
  }

  /* ===================== a new agent signing themselves up ===================== */

  function renderJoin() {
    showScreen('join');
    document.getElementById('joinerr').textContent = '';
    document.getElementById('joinname').focus();
  }

  function doJoin(e) {
    if (e) e.preventDefault();
    var name = document.getElementById('joinname').value.trim();
    var email = document.getElementById('joinemail').value.trim();
    var mobile = document.getElementById('joinmobile').value.trim();
    var err = document.getElementById('joinerr');
    var btn = document.getElementById('joinbtn');

    if (!name || !email) { err.textContent = t('joinNeed'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { err.textContent = t('joinBadEmail'); return; }

    err.textContent = '';
    btn.disabled = true;
    btn.textContent = t('working');

    post({ action: 'register', name: name, email: email, mobile: mobile, lang: state.lang })
      .then(function (res) {
        if (!res || !res.ok) {
          err.textContent = res && res.error === 'email' ? t('joinBadEmail') : t('joinFailed');
          return;
        }
        renderIssued(res, name);
      })
      .catch(function () { err.textContent = t('signOffline'); })
      .then(function () { btn.disabled = false; btn.textContent = t('getNumber'); });
  }

  /** Show the number and passcode once, big, before they go any further. */
  function renderIssued(res, typedName) {
    showScreen('issued');
    document.getElementById('issuedtitle').textContent =
      t('issuedTitle', { name: firstWord(res.name || typedName) });
    document.getElementById('issuedsub').textContent =
      (res.returning ? t('issuedBack') + ' ' : '') + t('issuedSub');

    document.getElementById('creds').innerHTML =
      '<div class="pair"><span class="k">' + esc(t('agentNo')) + '</span>' +
      '<span class="v">' + esc(res.agentNumber) + '</span></div>' +
      '<div class="pair"><span class="k">' + esc(t('passcode')) + '</span>' +
      '<span class="v">' + esc(res.passcode) + '</span></div>';

    document.getElementById('issuedfoot').innerHTML = t('issuedFoot', {
      email: '<a href="mailto:' + esc(CONFIG.RECRUITER_EMAIL) + '">' + esc(CONFIG.RECRUITER_EMAIL) + '</a>',
    });

    var go = document.getElementById('issuedgo');
    go.textContent = t('issuedGo');
    go.onclick = function () {
      /* Straight in — they have just proved the email is theirs, and the
         passcode is on screen and in their inbox for next time. */
      document.getElementById('agentno').value = res.agentNumber;
      document.getElementById('passcode').value = res.passcode;
      doSignIn();
    };
  }

  /* ===================== who you are, and who you're contracting with ===================== */

  function initials(name) {
    return P.initialsOf(name) || 'RR';
  }

  function roleLabel(role) {
    return role === 'manager' ? t('roleManager') : role === 'assistant' ? t('roleAssistant') : t('roleAgent');
  }

  function renderChoose() {
    var session = state.session || {};
    var staff = session.role === 'manager' || session.role === 'assistant';
    showScreen('choose');

    var who = document.getElementById('whoami');
    if (session.name || session.agentNumber) {
      who.style.display = '';
      who.innerHTML = '<span class="av">' + esc(initials(session.name)) + '</span>' +
        '<span><b>' + esc(session.name || session.agentNumber) + '</b>' +
        '<span>' + esc(roleLabel(session.role)) +
        (session.agentNumber ? ' · ' + esc(session.agentNumber) : '') + '</span></span>';
      var out = el('button', null, t('signOut'));
      out.type = 'button';
      out.addEventListener('click', signOut);
      who.appendChild(out);
    } else {
      who.style.display = 'none';
    }

    var picker = document.getElementById('picker');
    picker.innerHTML = '';
    document.getElementById('choosefoot').textContent = '';

    if (staff) {
      document.getElementById('choosetitle').textContent = t('staffTitle', { name: firstWord(session.name) });
      document.getElementById('choosesub').textContent = t('staffSub');

      var pipeline = el('a', 'pick');
      pipeline.href = 'admin.html';
      pipeline.innerHTML = '<span class="mark">📋</span><span class="txt"><b>' + esc(t('openPipeline')) +
        '</b><span>' + esc(t('openPipelineSub')) + '</span></span><span class="arrow">→</span>';
      picker.appendChild(pipeline);

      var invite = el('a', 'pick');
      invite.href = 'admin.html#invite';
      invite.innerHTML = '<span class="mark">✉️</span><span class="txt"><b>' + esc(t('inviteAgent')) +
        '</b><span>' + esc(t('inviteAgentSub')) + '</span></span><span class="arrow">→</span>';
      picker.appendChild(invite);

      var fill = el('button', 'pick');
      fill.type = 'button';
      fill.innerHTML = '<span class="mark">✍️</span><span class="txt"><b>' + esc(t('startForAgent')) +
        '</b><span>' + esc(t('startForAgentSub')) + '</span></span><span class="arrow">→</span>';
      fill.addEventListener('click', renderCarriers);
      picker.appendChild(fill);
      return;
    }

    renderCarriers();
  }

  function renderCarriers() {
    showScreen('choose');
    document.getElementById('choosetitle').textContent = t('pickTitle');
    document.getElementById('choosesub').textContent = t('pickSub');

    var carriers = (state.session && state.session.carriers) || CONFIG.CARRIERS;
    var picker = document.getElementById('picker');
    picker.innerHTML = '';

    carriers.forEach(function (carrier) {
      var blurb = (CARRIER_BLURB[carrier.id] && CARRIER_BLURB[carrier.id][state.lang]) || '';
      var node = el('button', 'pick' + (carrier.available ? '' : ' soon'));
      node.type = 'button';
      node.disabled = !carrier.available;
      node.innerHTML = '<span class="mark">' + esc(shortMark(carrier.name)) + '</span>' +
        '<span class="txt"><b>' + esc(carrier.name) + '</b><span>' + esc(blurb) + '</span></span>' +
        (carrier.available
          ? '<span class="arrow">→</span>'
          : '<span class="soonchip">' + esc(t('comingSoon')) + '</span>');
      if (carrier.available) {
        node.addEventListener('click', function () { openWizard(carrier.id); });
      }
      picker.appendChild(node);
    });

    var progress = P.completeness(state.data, state.lang);
    document.getElementById('choosefoot').textContent = progress.percent > 0 && progress.percent < 100
      ? t('resume') + ' — ' + progress.percent + '%'
      : '';
  }

  /** "VUMI® Group" → "VUMI", "Best Doctors Insurance" → "BD" */
  function shortMark(name) {
    var clean = String(name || '').replace(/[^\w\s]/g, '').trim();
    var words = clean.split(/\s+/);
    if (words[0] && words[0].length <= 5) return words[0].toUpperCase();
    return words.slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toUpperCase();
  }

  function firstWord(name) {
    return String(name || '').trim().split(/\s+/)[0] || '';
  }

  function openWizard(carrierId) {
    state.carrier = carrierId || 'vumi';
    showScreen('wizard');
    render();
  }

  /* ===================== boot ===================== */

  function applyLang() {
    document.documentElement.lang = state.lang;
    document.getElementById('lang-es').setAttribute('aria-pressed', String(state.lang === 'es'));
    document.getElementById('lang-en').setAttribute('aria-pressed', String(state.lang === 'en'));
    document.querySelectorAll('[data-t]').forEach(function (node) {
      node.textContent = t(node.dataset.t);
    });
  }

  /** Redraw whichever screen is up — used after a language change. */
  function redraw() {
    if (document.getElementById('wizard').style.display !== 'none') render();
    else if (document.getElementById('choosecard').style.display !== 'none') renderChoose();
    else if (document.getElementById('joincard').style.display !== 'none') renderJoin();
    else if (document.getElementById('issuedcard').style.display !== 'none') return; // holding a passcode on screen
    else renderSignIn();
  }

  function init() {
    var params = new URLSearchParams(location.search);
    if (params.get('lang') === 'es') state.lang = 'es';

    state.token = (params.get('t') || params.get('token') || '').trim().toUpperCase();
    if (!state.token) {
      state.token = localStorage.getItem('vumi-contracting:last') || makeToken();
    }
    try { localStorage.setItem('vumi-contracting:last', state.token); } catch (e) { /* ignore */ }

    state.data = blankData();
    loadLocal();

    loadSession();
    if (state.session && state.session.token) state.token = state.session.token;

    /* The token may hold progress saved from another device. */
    var ready = Promise.resolve();
    if (CONFIG.API_URL && state.session && state.session.token) {
      ready = fetch(CONFIG.API_URL + '?action=load&token=' + encodeURIComponent(state.token))
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res && res.found && res.data) {
            state.data = Object.assign(blankData(), res.data);
            if (typeof res.step === 'number') state.step = res.step;
          }
        })
        .catch(function () { /* keep whatever is on this device */ });
    }

    ready.then(function () {
      applyLang();
      if (state.session) renderChoose();
      else renderSignIn();
    });

    document.getElementById('signform').addEventListener('submit', doSignIn);
    document.getElementById('joinform').addEventListener('submit', doJoin);
    document.getElementById('newhere').addEventListener('click', renderJoin);
    document.getElementById('backtosignin').addEventListener('click', renderSignIn);
    document.getElementById('agentno').addEventListener('input', function () {
      document.getElementById('signerr').textContent = '';
    });
    document.getElementById('lang-es').addEventListener('click', function () { state.lang = 'es'; applyLang(); redraw(); });
    document.getElementById('lang-en').addEventListener('click', function () { state.lang = 'en'; applyLang(); redraw(); });
    document.getElementById('backbtn').addEventListener('click', function () { goto(state.step - 1); });
    document.getElementById('nextbtn').addEventListener('click', function () { goto(state.step + 1); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}());
