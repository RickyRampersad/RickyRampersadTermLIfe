/**
 * ==========================================================================
 *  VUMI CONTRACTING PACKET — field map + PDF fill engine
 * ==========================================================================
 *  One data object in, three completed PDFs out. The PDFs are the carrier's
 *  own originals (contracting/forms/*.pdf); every value is written into the
 *  real AcroForm field, so the result is the official form, filled — not a
 *  look-alike.
 *
 *  The maps below were generated from the PDFs themselves: each field ID was
 *  matched to its printed label by coordinate proximity, then verified
 *  against rendered pages. Field IDs are the carrier's own (TEXTO 1,
 *  CR515, ...) — cryptic, but they are what the PDFs contain.
 *
 *  Runs unchanged in the browser (window.VumiPacket) and in Node.
 * ==========================================================================
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VumiPacket = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ===================== data helpers ===================== */

  /** Read 'a.b.0.c' out of a nested object. Missing → ''. */
  function get(obj, path) {
    if (typeof path === 'function') return path(obj);
    var cur = obj;
    var parts = String(path).split('.');
    for (var i = 0; i < parts.length; i++) {
      if (cur === null || cur === undefined) return '';
      cur = cur[parts[i]];
    }
    return cur === null || cur === undefined ? '' : cur;
  }

  /** 'YYYY-MM-DD' → 'MMDDYYYY' (the order the split date boxes expect). */
  function dateDigits(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
    if (!m) {
      var digits = String(iso || '').replace(/\D/g, '');
      return digits.length === 8 ? digits : '';
    }
    return m[2] + m[3] + m[1];
  }

  /** 'YYYY-MM-DD' → 'MM-DD-YYYY' (the IRS spelling used on the W-8BEN). */
  function usDate(iso) {
    var d = dateDigits(iso);
    return d ? d.slice(0, 2) + '-' + d.slice(2, 4) + '-' + d.slice(4) : '';
  }

  /** Initials from a name: 'Ana María Pérez' → 'AMP' (max 4). */
  function initialsOf(name) {
    return String(name || '')
      .split(/\s+/)
      .filter(Boolean)
      .map(function (w) { return w.charAt(0).toUpperCase(); })
      .join('')
      .slice(0, 4);
  }

  /* ===================== shared field builders ===================== */

  /** A date split across 8 single-character boxes, left to right: M M D D Y Y Y Y. */
  function dateBoxes(ids, path) { return { ids: ids, path: path }; }

  /* ===================== SOLICITUD DE PRODUCTOR/AGENTE (11 pages) ===================== */

  var SOLICITUD = {
    id: 'solicitud',
    file: 'forms/solicitud-productor-agente.pdf',
    download: 'VUMI-Solicitud-Productor-Agente.pdf',
    pages: 11,

    text: {
      /* --- page 1: the applicant --- */
      'TEXTO 1': 'fullName',                       // 1. Nombre completo del Productor/Agente o Compañía
      'TEXTO 2011': 'spouseName',                  // 5. Nombre de su cónyuge
      'TEXTO 7': 'agencyName',                     // 6. Nombre de la agencia
      'TEXTO 9': 'producerName',                   // 7. Nombre que desea usar como Productor/Agente
      'TEXTO 11': 'home.address',                  // 8. Dirección de residencia
      'TEXTO 117': 'home.city',                    // 9. Ciudad
      'TEXTO 139': 'home.state',                   // 10. Provincia o estado
      'TEXTO 140': 'home.zip',                     // 11. Zona postal
      'TEXTO 141': 'home.country',                 // 12. País
      'TEXTO 12': 'office.address',                // 13. Dirección de oficina
      'TEXTO 146': 'office.city',                  // 14. Ciudad
      'TEXTO 147': 'office.state',                 // 15. Provincia o estado
      'TEXTO 148': 'office.zip',                   // 16. Zona postal
      'TEXTO 149': 'office.country',               // 17. País
      'TEXTO 13': 'mail.address',                  // 18. Dirección postal
      'TEXTO 150': 'mail.city',                    // 19. Ciudad
      'TEXTO 151': 'mail.state',                   // 20. Provincia o estado
      'TEXTO 152': 'mail.zip',                     // 21. Zona postal
      'TEXTO 153': 'mail.country',                 // 22. País
      'TEXTO 27': 'officePhone',                   // 23. Teléfono de oficina
      'TEXTO 28': 'mobile',                        // 24. Teléfono móvil
      'TEXTO 29': 'email',                         // 26. Correo electrónico
      'TEXTO 37': 'website',                       // 27. Página web
      'TEXTO 168': 'idNumber',                     // 28. Número de cédula de identidad o pasaporte
      'TEXTO 198': 'ssn',                          // 29. Número de seguro social
      'TEXTO 38': 'taxId',                         // 30. Número de identificación de impuestos
      'TEXTO 39': 'profession',                    // 31. Profesión
      'TEXTO 200': 'occupation',                   // 32. Ocupación
      'TEXTO 207': 'yearsInInsurance',             // 33. Tiempo en el campo de seguros
      'TEXTO 18': 'beneficiariesSummary',          // 34. Nombre de sus beneficiarios(as)

      /* personal reference 1 */
      'TEXTO 1010': 'personalRefs.0.name',
      'TEXTO 1011': 'personalRefs.0.phone',
      'TEXTO 1012': 'personalRefs.0.email',
      'TEXTO 158': 'personalRefs.0.address',
      'TEXTO 159': 'personalRefs.0.city',
      'TEXTO 160': 'personalRefs.0.state',
      'TEXTO 161': 'personalRefs.0.zip',
      'TEXTO 162': 'personalRefs.0.country',
      /* personal reference 2 */
      'TEXTO 1013': 'personalRefs.1.name',
      'TEXTO 1014': 'personalRefs.1.phone',
      'TEXTO 1015': 'personalRefs.1.email',
      'TEXTO 163': 'personalRefs.1.address',
      'TEXTO 164': 'personalRefs.1.city',
      'TEXTO 165': 'personalRefs.1.state',
      'TEXTO 166': 'personalRefs.1.zip',
      'TEXTO 167': 'personalRefs.1.country',

      /* --- page 2: bank references, carriers represented, market --- */
      'TEXTO 14': 'bankRefs.0.bankName',
      'TEXTO 15': 'bankRefs.0.bankPhone',
      'TEXTO 171': 'bankRefs.0.bankAddress',
      'TEXTO 172': 'bankRefs.0.bankCity',
      'TEXTO 173': 'bankRefs.0.bankState',
      'TEXTO 174': 'bankRefs.0.bankZip',
      'TEXTO 175': 'bankRefs.0.bankCountry',
      'TEXTO 17': 'bankRefs.0.refName',
      'TEXTO 181': 'bankRefs.0.refPhone',
      'TEXTO 176': 'bankRefs.0.refAddress',
      'TEXTO 177': 'bankRefs.0.refCity',
      'TEXTO 178': 'bankRefs.0.refState',
      'TEXTO 179': 'bankRefs.0.refZip',
      'TEXTO 180': 'bankRefs.0.refCountry',
      'TEXTO 187': 'bankRefs.1.bankName',
      'TEXTO 188': 'bankRefs.1.bankPhone',
      'TEXTO 182': 'bankRefs.1.bankAddress',
      'TEXTO 183': 'bankRefs.1.bankCity',
      'TEXTO 184': 'bankRefs.1.bankState',
      'TEXTO 185': 'bankRefs.1.bankZip',
      'TEXTO 186': 'bankRefs.1.bankCountry',
      'TEXTO 194': 'bankRefs.1.refName',
      'TEXTO 195': 'bankRefs.1.refPhone',
      'TEXTO 189': 'bankRefs.1.refAddress',
      'TEXTO 190': 'bankRefs.1.refCity',
      'TEXTO 191': 'bankRefs.1.refState',
      'TEXTO 192': 'bankRefs.1.refZip',
      'TEXTO 193': 'bankRefs.1.refCountry',
      'TEXTO 210': 'carriers.0.name',
      'TEXTO 211': 'carriers.0.policies',
      'TEXTO 212': 'carriers.0.premiums',
      'TEXTO 213': 'carriers.0.persistency',
      'TEXTO 214': 'carriers.1.name',
      'TEXTO 215': 'carriers.1.policies',
      'TEXTO 216': 'carriers.1.premiums',
      'TEXTO 217': 'carriers.1.persistency',
      'TEXTO 218': 'carriers.2.name',
      'TEXTO 219': 'carriers.2.policies',
      'TEXTO 220': 'carriers.2.premiums',
      'TEXTO 221': 'carriers.2.persistency',
      'TEXTO 196': 'regions',                      // regiones y ciudades donde piensa vender
      'TEXTO 197': 'otherInfo',                    // cualquier otra información pertinente

      /* --- page 3: disclosure notes (one per question) + signature block --- */
      'TEXTO 169': 'disclosureNotes.politicallyExposed',
      'TEXTO 170': 'disclosureNotes.familyContract',
      'TEXTO 203': 'disclosureNotes.familyEmployee',
      'TEXTO 226': 'disclosureNotes.workedForAgency',
      'TEXTO 227': 'disclosureNotes.thirdParty',
      'TEXTO 2010': 'disclosureNotes.otherContract',
      'TEXTO 228': 'disclosureNotes.codeRevoked',
      'TEXTO 267': 'signature.place',              // 2. Lugar y fecha

      /* --- page 4: code assigned by the carrier --- */
      'TEXTO 131': 'agency.agentCode',             // Código de identificación asignado

      /* --- page 9: execution block + payment details --- */
      'TEXTO 30': 'fullName',                      // 1. Nombre impreso Productor/Agente
      'TEXTO 223': 'signature.place',              // 3. Lugar y fecha
      'TEXTO 31': 'agency.generalAgentName',       // 4. Nombre impreso del Agente General/Directo
      'TEXTO 224': 'agency.signPlace',             // 6. Lugar y fecha
      /* 7-9 (VUMI representative) stay blank — the carrier signs those. */
      'TEXTO 1018': 'payment.ach.holder',
      'TEXTO 199': 'payment.ach.bank',
      'TEXTO 205': 'payment.ach.account',
      'TEXTO 1024': 'payment.wire.holder',
      'TEXTO 1026': 'payment.wire.bank',
      'TEXTO 206': 'payment.wire.account',
      'TEXTO 2012': 'payment.wire.swift',
      'TEXTO 208': 'payment.wire.country',
      'TEXTO 1025': 'payment.wire.intermediaryBank',
      'TEXTO 2013': 'payment.wire.wireRouting',

      /* --- page 10: Anexo 1, compensation schedule --- */
      'TEXTO 33': 'lastName',                      // 1. Apellidos
      'TEXTO 34': 'firstName',                     // 2. Nombres
      'TEXTO 35': 'agency.generalAgentName',       // 3. Agente general / Agente Directo
      'TEXTO 36': 'agency.generalAgentCode',       // 4. Código de Agente General / Directo
      'CR266': 'agency.effectiveText',             // "...efectivo para las pólizas escritas después de ___"
      'TEXTO 201': 'agency.requiredProduction',    // producción anual requerida US$
      'TEXTO 202': 'agency.requiredPersistency',   // persistencia mínima %
      'TEXTO 2043': 'agency.commissions.absolute.0',
      'TEXTO 2052': 'agency.commissions.absolute.1',
      'TEXTO 2048': 'agency.commissions.universal.0',
      'TEXTO 2057': 'agency.commissions.universal.1',
      'TEXTO 2051': 'agency.commissions.special.0',
      'TEXTO 2060': 'agency.commissions.special.1',
      'TEXTO 2044': 'agency.commissions.access.0',
      'TEXTO 2053': 'agency.commissions.access.1',
      'TEXTO 2049': 'agency.commissions.optimum.0',
      'TEXTO 2058': 'agency.commissions.optimum.1',
      'TEXTO 2045': 'agency.commissions.direct.0',
      'TEXTO 2054': 'agency.commissions.direct.1',
      'TEXTO 2050': 'agency.commissions.senior.0',
      'TEXTO 2059': 'agency.commissions.senior.1',
      'TEXTO 2046': 'agency.commissions.prime.0',
      'TEXTO 2055': 'agency.commissions.prime.1',
      'TEXTO 2047': 'agency.commissions.termLife.0',
      'TEXTO 2056': 'agency.commissions.termLife.1',
      'TEXTO 2061': 'agency.commissions.travel',

      /* --- page 11: Anexo 1 execution --- */
      'TEXTO 2062': 'agency.anexoNotes',           // 5. Observaciones
      'TEXTO 115': 'fullName',                     // 6. Nombre impreso del Productor/Agente
      'TEXTO 209': 'signature.place',              // 8. Lugar y fecha
      'TEXTO 204': 'agency.generalAgentName',      // 9. Nombre impreso del Agente General
      'TEXTO 222': 'agency.signPlace',             // 11. Lugar y fecha
      /* 12-14 (PARA USO DE PERSONAL AUTORIZADO) stay blank. */
    },

    dates: [
      // 2. Fecha de nacimiento / incorporación (page 1)
      dateBoxes(['CR515', 'CR514', 'CR5019', 'CR5018', 'CR5017', 'CR5016', 'CR5015', 'CR164'], 'dob'),
      // applicant signature date (page 3)
      dateBoxes(['CR5077', 'CR5076', 'CR5075', 'CR5074', 'CR5073', 'CR5072', 'CR5071', 'CR186'], 'signature.date'),
      // page 9 — producer, then general agent (VUMI's own date box stays blank)
      dateBoxes(['CR5034', 'CR5033', 'CR5032', 'CR5031', 'CR5030', 'CR5029', 'CR5028', 'CR168'], 'signature.date'),
      dateBoxes(['CR5041', 'CR5040', 'CR5039', 'CR5038', 'CR5037', 'CR5036', 'CR5035', 'CR170'], 'agency.signDate'),
      // page 11 — producer, then general agent
      dateBoxes(['CR5020', 'CR5014', 'CR5013', 'CR5012', 'CR5011', 'CR5010', 'CR509', 'CR166'], 'signature.date'),
      dateBoxes(['CR5027', 'CR5026', 'CR5025', 'CR5024', 'CR5023', 'CR5022', 'CR5021', 'CR167'], 'agency.signDate'),
    ],

    /* ACH routing number: nine single-character boxes (page 9). */
    digitRuns: [{
      ids: ['CR103027', 'CR103030', 'CR103024', 'CR103028', 'CR103031', 'CR103025', 'CR103029', 'CR103041', 'CR103026'],
      path: 'payment.ach.routing',
      length: 9,
    }],

    radios: {
      'SEXO': { path: 'sex', values: { M: '/0', F: '/1' } },
      // The carrier's PDF puts marital status AND preferred language in one
      // radio group, so only one of the two can be set through the field
      // itself. Marital status wins here; the language tick is drawn on the
      // page instead (see `marks` below) so both end up marked.
      'MARITAL STATUS': {
        path: 'maritalStatus',
        values: { single: '/0', married: '/1', domestic: '/2', divorced: '/4', widowed: '/6' },
      },
      'You or a family member is politically related ': { path: 'disclosures.politicallyExposed', values: { yes: '/0', no: '/1' } },
      'Do you have a family member under contract with VUMI®? ': { path: 'disclosures.familyContract', values: { yes: '/0', no: '/1' } },
      'Do you have a family member or acquaintance working at VUMI®? ': { path: 'disclosures.familyEmployee', values: { yes: '/0', no: '/1' } },
      'Have you ever worked for an agent or agency': { path: 'disclosures.workedForAgency', values: { yes: '/0', no: '/1' } },
      'You are representing a third party with this contract': { path: 'disclosures.thirdParty', values: { yes: '/0', no: '/1' } },
      'You have another registered agent contract under another name': { path: 'disclosures.otherContract', values: { yes: '/0', no: '/1' } },
      'Your code has been previously overridden at VUMI® or another company. ': { path: 'disclosures.codeRevoked', values: { yes: '/0', no: '/1' } },
      'Payment Method': { path: 'payment.method', values: { check: '/0', ach: '/1', wire: '/2' } },
    },

    /* Ticks drawn straight onto the page (widget rects taken from the PDF). */
    marks: [
      { page: 1, path: 'language', rects: { es: [336.4, 359.0, 347.5, 370.1], en: [418.7, 359.0, 429.8, 370.1], pt: [494.4, 359.0, 505.5, 370.1] } },
    ],

    checks: {
      'Casilla de verificación 10': 'docs.id',              // identificación con foto
      'Casilla de verificación 11': 'docs.incorporation',   // certificado de incorporación
      'Casilla de verificación 3': 'docs.w8ben',            // W-8BEN / W-8BEN-E
      'Casilla de verificación 12': 'docs.addressProof',    // comprobante de dirección
      'Casilla de verificación 4': 'docs.w9',               // W-9 (agentes en EE. UU.)
      'Casilla de verificación 13': 'docs.voidedCheck',     // cheque anulado / estado de cuenta
      'Casilla de verificación 7': 'docs.poa',              // poder de representación legal
      'Casilla de verificación 14': 'docs.references',      // referencia personal y bancaria
      'Casilla de verificación 8': 'docs.beneficiaryForm',  // designación de beneficiarios
      'Casilla de verificación 15': 'docs.carrierProof',    // prueba de compañías que representa
    },

    /* Signature widgets: the drawn signature is stamped at these rects. */
    signatures: [
      { page: 3, rect: [270, 481, 359, 496], path: 'signature.dataUrl' },   // solicitante
      { page: 9, rect: [250, 631, 349, 645], path: 'signature.dataUrl' },   // productor/agente
      { page: 9, rect: [250, 565, 349, 579], path: 'agency.signatureDataUrl' },
      { page: 11, rect: [250, 631, 349, 645], path: 'signature.dataUrl' },  // Anexo 1
      { page: 11, rect: [250, 593, 349, 607], path: 'agency.signatureDataUrl' },
    ],

    /* Agent initials on every page — the part everyone forgets. */
    initials: {
      agent: ['Text Field 101040.Página 1', 'Text Field 101040.Página 2', 'Text Field 101040.Página 3',
              'Text Field 101040.Página 4', 'Text Field 101040.Página 5', 'Text Field 101040.Página 6',
              'Text Field 101040.Página 7', 'Text Field 101040.Página 8', 'Text Field 101040.Página 9',
              'Text Field 101040.Página 10', 'Text Field 101040.Página 11'],
    },
  };

  /* ===================== FORMULARIO PARA DESIGNACIÓN DE BENEFICIARIO ===================== */

  var BENEFICIARIO = {
    id: 'beneficiario',
    file: 'forms/designacion-beneficiario.pdf',
    download: 'VUMI-Designacion-de-Beneficiario.pdf',
    pages: 1,

    text: {
      'TEXTO 29': 'lastName',                      // 1. Apellido(s)
      'TEXTO 38': 'firstName',                     // 2. Nombre(s)
      'TEXTO 222': 'agency.agentCode',             // 3. Código de Agente

      /* primary beneficiaries — name / relationship / percentage */
      'TEXTO 275': 'beneficiaries.primary.0.name',
      'TEXTO 266': 'beneficiaries.primary.0.relationship',
      'TEXTO 232': 'beneficiaries.primary.0.percent',
      'TEXTO 277': 'beneficiaries.primary.1.name',
      'TEXTO 267': 'beneficiaries.primary.1.relationship',
      'TEXTO 236': 'beneficiaries.primary.1.percent',
      'TEXTO 279': 'beneficiaries.primary.2.name',
      'TEXTO 268': 'beneficiaries.primary.2.relationship',
      'TEXTO 243': 'beneficiaries.primary.2.percent',
      'CR267': 'beneficiaries.primaryGuardian',    // tutor designado si es menor de edad

      /* contingent beneficiaries */
      'TEXTO 276': 'beneficiaries.contingent.0.name',
      'TEXTO 269': 'beneficiaries.contingent.0.relationship',
      'TEXTO 272': 'beneficiaries.contingent.0.percent',
      'TEXTO 278': 'beneficiaries.contingent.1.name',
      'TEXTO 270': 'beneficiaries.contingent.1.relationship',
      'TEXTO 273': 'beneficiaries.contingent.1.percent',
      'TEXTO 280': 'beneficiaries.contingent.2.name',
      'TEXTO 271': 'beneficiaries.contingent.2.relationship',
      'TEXTO 274': 'beneficiaries.contingent.2.percent',
      'CR268': 'beneficiaries.contingentGuardian',
    },

    dates: [
      dateBoxes(['CR573', 'CR572', 'CR571', 'CR570', 'CR569', 'CR568', 'CR567', 'CR179'], 'beneficiaries.primary.0.dob'),
      dateBoxes(['CR580', 'CR579', 'CR578', 'CR577', 'CR576', 'CR575', 'CR574', 'CR180'], 'beneficiaries.primary.1.dob'),
      dateBoxes(['CR587', 'CR586', 'CR585', 'CR584', 'CR583', 'CR582', 'CR581', 'CR181'], 'beneficiaries.primary.2.dob'),
      dateBoxes(['CR594', 'CR593', 'CR592', 'CR591', 'CR590', 'CR589', 'CR588', 'CR182'], 'beneficiaries.contingent.0.dob'),
      dateBoxes(['CR601', 'CR600', 'CR599', 'CR598', 'CR597', 'CR596', 'CR595', 'CR183'], 'beneficiaries.contingent.1.dob'),
      dateBoxes(['CR608', 'CR607', 'CR606', 'CR605', 'CR604', 'CR603', 'CR602', 'CR184'], 'beneficiaries.contingent.2.dob'),
      dateBoxes(['CR564', 'CR563', 'CR562', 'CR561', 'CR560', 'CR559', 'CR558', 'CR176'], 'signature.date'),
    ],

    signatures: [
      { page: 1, rect: [59, 151, 193, 165], path: 'signature.dataUrl' },
    ],
  };

  /* ===================== IRS FORM W-8BEN (Rev. 7-2017) ===================== */

  var W8BEN = {
    id: 'w8ben',
    file: 'forms/w-8ben.pdf',
    download: 'IRS-Form-W-8BEN.pdf',
    pages: 1,

    text: {
      'topmostSubform[0].Page1[0].f_1[0]': 'w8.name',              // 1 Name of individual
      'topmostSubform[0].Page1[0].f_2[0]': 'w8.citizenship',       // 2 Country of citizenship
      'topmostSubform[0].Page1[0].f_3[0]': 'w8.permAddress',       // 3 Permanent residence address
      'topmostSubform[0].Page1[0].f_4[0]': 'w8.permCity',          //   City/town, state/province, postal code
      'topmostSubform[0].Page1[0].f_5[0]': 'w8.permCountry',       //   Country
      'topmostSubform[0].Page1[0].f_6[0]': 'w8.mailAddress',       // 4 Mailing address
      'topmostSubform[0].Page1[0].f_7[0]': 'w8.mailCity',
      'topmostSubform[0].Page1[0].f_8[0]': 'w8.mailCountry',
      'topmostSubform[0].Page1[0].f_9[0]': 'w8.usTin',             // 5 U.S. TIN (SSN or ITIN)
      'topmostSubform[0].Page1[0].f_10[0]': 'w8.foreignTin',       // 6 Foreign tax identifying number
      'topmostSubform[0].Page1[0].f_11[0]': 'w8.referenceNumbers', // 7 Reference number(s)
      'topmostSubform[0].Page1[0].f_12[0]': function (d) { return usDate(get(d, 'w8.dob')); }, // 8 Date of birth
      'topmostSubform[0].Page1[0].f_13[0]': 'w8.treatyCountry',    // 9 resident of ___
      'topmostSubform[0].Page1[0].f_14[0]': 'w8.treatyArticle',    // 10 Article and paragraph
      'topmostSubform[0].Page1[0].f_15[0]': 'w8.treatyRate',       //    % rate of withholding
      'topmostSubform[0].Page1[0].f_16[0]': 'w8.treatyIncome',     //    type of income
      'topmostSubform[0].Page1[0].f_17[0]': 'w8.treatyExplain',    //    additional conditions
      'topmostSubform[0].Page1[0].f_21[0]': 'signature.printedName', // Print name of signer
      'topmostSubform[0].Page1[0].f_22[0]': 'w8.capacity',           // Capacity in which acting
      'topmostSubform[0].Page1[0].Date[0]': function (d) { return usDate(get(d, 'signature.date')); },
    },

    signatures: [
      { page: 1, rect: [108, 72, 425, 96], path: 'signature.dataUrl' },
    ],
  };

  var FORMS = [SOLICITUD, BENEFICIARIO, W8BEN];

  /* ===================== the fill engine ===================== */

  var MAX_FONT_SIZE = 11;        // never larger than the printed labels
  var MIN_FONT_SIZE = 4.5;       // still legible in print
  var MULTILINE_FONT_SIZE = 9;   // comment boxes

  function dataUrlToBytes(dataUrl) {
    var base64 = String(dataUrl).split(',')[1] || '';
    if (typeof atob === 'function') {
      var bin = atob(base64);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    }
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }

  /**
   * Pin a field to one type size.
   *
   * The carrier's design tool wrote each field's default-appearance string
   * with octal escapes ("\057MinionPro\055Regular 8 Tf"), which pdf-lib
   * cannot read — so it treats every field as auto-size and blows a
   * two-word answer up to fill the whole box. Writing a clean appearance
   * string over it settles the size. The font named here only has to parse;
   * the glyphs come from the font handed to updateFieldAppearances.
   */
  function applyFontSize(field, size) {
    var da = '/Helv ' + size.toFixed(2) + ' Tf 0 g';
    try { field.acroField.setDefaultAppearance(da); } catch (e) { /* ignore */ }
    try {
      field.acroField.getWidgets().forEach(function (widget) {
        widget.setDefaultAppearance(da);
      });
    } catch (e) { /* ignore */ }
  }

  /**
   * Write a value, sized to fit its box in both directions so every answer
   * reads like it was typed on the form.
   */
  function setText(form, name, value, font) {
    var v = String(value === null || value === undefined ? '' : value);
    if (!v) return;
    var f;
    try {
      f = form.getTextField(name);
      f.setText(v);
    } catch (e) { return; /* field absent in this revision of the PDF */ }

    try {
      var widget = f.acroField.getWidgets()[0];
      if (!widget) return;
      var rect = widget.getRectangle();
      var size;
      if (f.isMultiline()) {
        /* Rough area fit: enough to keep a long answer inside the box. */
        var capacity = (rect.width * rect.height) / 0.69;
        size = Math.min(MULTILINE_FONT_SIZE, Math.sqrt(capacity / Math.max(v.length, 1)));
      } else {
        size = Math.min(MAX_FONT_SIZE, rect.height * 0.68);
        var pad = Math.min(4, rect.width * 0.25); // narrow boxes get less padding
        var unitWidth = font.widthOfTextAtSize(v, 1);
        if (unitWidth > 0) size = Math.min(size, (rect.width - pad) / unitWidth);
      }
      applyFontSize(f, Math.max(MIN_FONT_SIZE, size));
    } catch (e) { /* leave the field on its own default size */ }
  }

  /**
   * Select a radio option by its PDF export value ('/0', '/1', ...).
   * pdf-lib's own `select()` matches the human-readable /Opt labels the
   * carrier's design tool wrote ("Elección1"...), which say nothing about
   * which button they are — the export value does, so we set it directly.
   */
  function selectRadio(form, name, exportValue) {
    try {
      var acro = form.getRadioGroup(name).acroField;
      var onValues = acro.getOnValues();
      for (var i = 0; i < onValues.length; i++) {
        if (String(onValues[i]) === exportValue) {
          acro.setValue(onValues[i]);
          return true;
        }
      }
    } catch (e) { /* group absent — skip */ }
    return false;
  }

  /** Give every empty signature widget a blank appearance stream (see flatten). */
  function giveSignaturesAnAppearance(PDFLib, pdfDoc, form) {
    var ctx = pdfDoc.context;
    form.getFields().forEach(function (field) {
      if (!PDFLib.PDFSignature || !(field instanceof PDFLib.PDFSignature)) return;
      field.acroField.getWidgets().forEach(function (widget) {
        var appearances = null;
        try { appearances = widget.getAppearances(); } catch (e) { /* malformed */ }
        if (appearances && appearances.normal) return;
        var rect = widget.getRectangle();
        var blank = ctx.formXObject([], {
          BBox: ctx.obj([0, 0, rect.width, rect.height]),
          Matrix: ctx.obj([1, 0, 0, 1, 0, 0]),
        });
        widget.setNormalAppearance(ctx.register(blank));
      });
    });
  }

  /**
   * Fill one form.
   * @param PDFLib   the pdf-lib module (browser global or require('pdf-lib'))
   * @param bytes    the original PDF as ArrayBuffer/Uint8Array
   * @param spec     one of SOLICITUD / BENEFICIARIO / W8BEN
   * @param data     the packet data object
   * @param opts     { flatten: true }
   */
  async function fillOne(PDFLib, bytes, spec, data, opts) {
    opts = opts || {};
    var flatten = opts.flatten !== false;

    var pdfDoc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
    var form = pdfDoc.getForm();
    var helv = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    var helvBold = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    var pages = pdfDoc.getPages();

    /* --- plain text fields --- */
    Object.keys(spec.text || {}).forEach(function (name) {
      setText(form, name, get(data, spec.text[name]), helv);
    });

    /* --- dates split across single-character boxes --- */
    (spec.dates || []).forEach(function (d) {
      var digits = dateDigits(get(data, d.path));
      if (digits.length !== 8) return;
      d.ids.forEach(function (id, i) { setText(form, id, digits.charAt(i), helv); });
    });

    /* --- other runs of single-character boxes (ACH routing) --- */
    (spec.digitRuns || []).forEach(function (run) {
      var digits = String(get(data, run.path) || '').replace(/\D/g, '');
      if (digits.length !== run.length) return;
      run.ids.forEach(function (id, i) { setText(form, id, digits.charAt(i), helv); });
    });

    /* --- radio groups --- */
    Object.keys(spec.radios || {}).forEach(function (name) {
      var cfg = spec.radios[name];
      var choice = String(get(data, cfg.path) || '');
      var target = cfg.values[choice];
      if (target) selectRadio(form, name, target);
    });

    /* --- checkboxes --- */
    Object.keys(spec.checks || {}).forEach(function (name) {
      if (!get(data, spec.checks[name])) return;
      try { form.getCheckBox(name).check(); } catch (e) { /* skip */ }
    });

    /* --- initials on every page --- */
    if (spec.initials && spec.initials.agent) {
      var ini = String(get(data, 'signature.initials') || '').trim() ||
                initialsOf(get(data, 'fullName'));
      if (ini) spec.initials.agent.forEach(function (name) { setText(form, name, ini, helv); });
    }

    /* Field appearances use a font we control, so accented Spanish text and
       the ñ render instead of throwing on an unmapped glyph. */
    try { form.updateFieldAppearances(helv); } catch (e) { /* best effort */ }

    /* Flattening bakes the values into the page: the packet cannot be edited
       after the applicant signs it, and it opens identically everywhere.

       The carrier's signature fields carry no appearance dictionary at all,
       and flatten() aborts on the first one it meets — silently dropping
       every field that comes after it in the form's order (on the W-8BEN
       that is the date and the signer's printed name). Giving each one an
       empty appearance first costs nothing visually and lets flatten() run
       over the whole form; the drawn signature is stamped on below. */
    if (flatten) {
      giveSignaturesAnAppearance(PDFLib, pdfDoc, form);
      try {
        form.flatten({ updateFieldAppearances: false });
      } catch (e) {
        // A malformed widget somewhere in the form: keep the filled fields
        // rather than losing the whole document.
      }
    }

    /* Everything below is painted straight onto the page, after flattening —
       a flattened widget draws its own opaque background, which would cover
       anything stamped earlier. */

    /* --- ticks we draw ourselves (see the marital/language note above) --- */
    (spec.marks || []).forEach(function (mark) {
      var choice = String(get(data, mark.path) || '');
      var rect = mark.rects[choice];
      if (!rect) return;
      var w = rect[2] - rect[0], h = rect[3] - rect[1];
      /* Mimic a selected radio: a filled dot centred in the circle. */
      pages[mark.page - 1].drawCircle({
        x: rect[0] + w / 2,
        y: rect[1] + h / 2,
        size: Math.min(w, h) * 0.28,
        color: PDFLib.rgb(0, 0, 0),
      });
    });

    /* --- signatures, stamped inside the signature widget --- */
    for (var i = 0; i < (spec.signatures || []).length; i++) {
      var sig = spec.signatures[i];
      var url = get(data, sig.path);
      if (!url || String(url).indexOf('data:image/png') !== 0) continue;
      var png = await pdfDoc.embedPng(dataUrlToBytes(url));
      var boxW = sig.rect[2] - sig.rect[0];
      var boxH = sig.rect[3] - sig.rect[1];
      var scale = Math.min(boxW / png.width, boxH / png.height);
      var sw = png.width * scale, sh = png.height * scale;
      pages[sig.page - 1].drawImage(png, {
        x: sig.rect[0] + (boxW - sw) / 2,
        y: sig.rect[1] + (boxH - sh) / 2,
        width: sw,
        height: sh,
      });
    }

    return await pdfDoc.save({ updateFieldAppearances: false });
  }

  /**
   * Fill the whole packet.
   * @param sources { solicitud: bytes, beneficiario: bytes, w8ben: bytes }
   * @returns [{ id, name, bytes }]
   */
  async function fillPacket(PDFLib, sources, data, opts) {
    var out = [];
    for (var i = 0; i < FORMS.length; i++) {
      var spec = FORMS[i];
      if (!sources[spec.id]) continue;
      out.push({
        id: spec.id,
        name: spec.download,
        bytes: await fillOne(PDFLib, sources[spec.id], spec, data, opts),
      });
    }
    return out;
  }

  /* ===================== completeness ===================== */

  /**
   * What is still missing, in the order the wizard asks for it. Used by the
   * progress bar, the review step, and the reminder emails — one definition
   * so the applicant and the follow-up email never disagree.
   */
  var REQUIRED = [
    { step: 'personal', path: 'fullName', label: { es: 'Nombre completo', en: 'Full name' } },
    { step: 'personal', path: 'lastName', label: { es: 'Apellido(s)', en: 'Last name(s)' } },
    { step: 'personal', path: 'firstName', label: { es: 'Nombre(s)', en: 'First name(s)' } },
    { step: 'personal', path: 'dob', label: { es: 'Fecha de nacimiento', en: 'Date of birth' } },
    { step: 'personal', path: 'sex', label: { es: 'Sexo', en: 'Sex' } },
    { step: 'personal', path: 'maritalStatus', label: { es: 'Estado civil', en: 'Marital status' } },
    { step: 'personal', path: 'language', label: { es: 'Idioma', en: 'Language' } },
    { step: 'personal', path: 'idNumber', label: { es: 'Cédula o pasaporte', en: 'ID or passport number' } },
    { step: 'personal', path: 'profession', label: { es: 'Profesión', en: 'Profession' } },
    { step: 'personal', path: 'occupation', label: { es: 'Ocupación', en: 'Occupation' } },
    { step: 'contact', path: 'email', label: { es: 'Correo electrónico', en: 'Email' } },
    { step: 'contact', path: 'mobile', label: { es: 'Teléfono móvil', en: 'Mobile phone' } },
    { step: 'contact', path: 'home.address', label: { es: 'Dirección de residencia', en: 'Home address' } },
    { step: 'contact', path: 'home.city', label: { es: 'Ciudad de residencia', en: 'Home city' } },
    { step: 'contact', path: 'home.country', label: { es: 'País de residencia', en: 'Home country' } },
    { step: 'refs', path: 'personalRefs.0.name', label: { es: 'Referencia personal 1', en: 'Personal reference 1' } },
    { step: 'refs', path: 'personalRefs.0.phone', label: { es: 'Teléfono de la referencia personal 1', en: 'Personal reference 1 phone' } },
    { step: 'refs', path: 'personalRefs.1.name', label: { es: 'Referencia personal 2', en: 'Personal reference 2' } },
    { step: 'refs', path: 'personalRefs.1.phone', label: { es: 'Teléfono de la referencia personal 2', en: 'Personal reference 2 phone' } },
    { step: 'banks', path: 'bankRefs.0.bankName', label: { es: 'Referencia bancaria 1', en: 'Bank reference 1' } },
    { step: 'banks', path: 'bankRefs.1.bankName', label: { es: 'Referencia bancaria 2', en: 'Bank reference 2' } },
    { step: 'disclosures', path: 'disclosures.politicallyExposed', label: { es: 'Pregunta: relación política', en: 'Question: politically related' } },
    { step: 'disclosures', path: 'disclosures.familyContract', label: { es: 'Pregunta: familiar con contrato', en: 'Question: family under contract' } },
    { step: 'disclosures', path: 'disclosures.familyEmployee', label: { es: 'Pregunta: familiar empleado', en: 'Question: family employee' } },
    { step: 'disclosures', path: 'disclosures.workedForAgency', label: { es: 'Pregunta: trabajó para una agencia', en: 'Question: worked for an agency' } },
    { step: 'disclosures', path: 'disclosures.thirdParty', label: { es: 'Pregunta: representa a un tercero', en: 'Question: representing a third party' } },
    { step: 'disclosures', path: 'disclosures.otherContract', label: { es: 'Pregunta: otro contrato', en: 'Question: another contract' } },
    { step: 'disclosures', path: 'disclosures.codeRevoked', label: { es: 'Pregunta: código anulado', en: 'Question: code revoked' } },
    { step: 'payment', path: 'payment.method', label: { es: 'Método de pago', en: 'Payment method' } },
    { step: 'beneficiaries', path: 'beneficiaries.primary.0.name', label: { es: 'Beneficiario primario', en: 'Primary beneficiary' } },
    { step: 'beneficiaries', path: 'beneficiaries.primary.0.relationship', label: { es: 'Parentesco del beneficiario primario', en: 'Primary beneficiary relationship' } },
    { step: 'beneficiaries', path: 'beneficiaries.primary.0.percent', label: { es: 'Porcentaje del beneficiario primario', en: 'Primary beneficiary percentage' } },
    { step: 'w8', path: 'w8.name', label: { es: 'W-8BEN: nombre', en: 'W-8BEN: name' } },
    { step: 'w8', path: 'w8.citizenship', label: { es: 'W-8BEN: país de ciudadanía', en: 'W-8BEN: country of citizenship' } },
    { step: 'w8', path: 'w8.permAddress', label: { es: 'W-8BEN: dirección permanente', en: 'W-8BEN: permanent address' } },
    { step: 'sign', path: 'signature.dataUrl', label: { es: 'Firma', en: 'Signature' } },
    { step: 'sign', path: 'signature.place', label: { es: 'Lugar de la firma', en: 'Place of signing' } },
    { step: 'sign', path: 'signature.date', label: { es: 'Fecha de la firma', en: 'Date of signing' } },
  ];

  /** Payment details are required only for the method the applicant picked. */
  function paymentRequirements(data) {
    var method = get(data, 'payment.method');
    if (method === 'ach') {
      return [
        { step: 'payment', path: 'payment.ach.holder', label: { es: 'Titular de la cuenta (ACH)', en: 'Account holder (ACH)' } },
        { step: 'payment', path: 'payment.ach.bank', label: { es: 'Banco (ACH)', en: 'Bank (ACH)' } },
        { step: 'payment', path: 'payment.ach.account', label: { es: 'Número de cuenta (ACH)', en: 'Account number (ACH)' } },
        { step: 'payment', path: 'payment.ach.routing', label: { es: 'Número de ruta ACH', en: 'ACH routing number' } },
      ];
    }
    if (method === 'wire') {
      return [
        { step: 'payment', path: 'payment.wire.holder', label: { es: 'Titular de la cuenta (transferencia)', en: 'Account holder (wire)' } },
        { step: 'payment', path: 'payment.wire.bank', label: { es: 'Banco (transferencia)', en: 'Bank (wire)' } },
        { step: 'payment', path: 'payment.wire.account', label: { es: 'Cuenta o IBAN', en: 'Account or IBAN' } },
        { step: 'payment', path: 'payment.wire.swift', label: { es: 'Código SWIFT', en: 'SWIFT code' } },
      ];
    }
    return [];
  }

  function completeness(data, lang) {
    lang = lang === 'en' ? 'en' : 'es';
    var checks = REQUIRED.concat(paymentRequirements(data));
    var missing = [];
    checks.forEach(function (req) {
      var v = get(data, req.path);
      if (v === '' || v === null || v === undefined) {
        missing.push({ step: req.step, path: req.path, label: req.label[lang] });
      }
    });
    var done = checks.length - missing.length;
    return {
      total: checks.length,
      done: done,
      percent: checks.length ? Math.round((done / checks.length) * 100) : 0,
      missing: missing,
      complete: missing.length === 0,
    };
  }

  /** Beneficiary percentages have to add up — the carrier rejects packets that don't. */
  function beneficiaryTotals(data) {
    function sum(list) {
      return (list || []).reduce(function (t, b) {
        var n = parseFloat(b && b.percent);
        return t + (isFinite(n) ? n : 0);
      }, 0);
    }
    return {
      primary: sum(get(data, 'beneficiaries.primary')),
      contingent: sum(get(data, 'beneficiaries.contingent')),
    };
  }

  return {
    FORMS: FORMS,
    SOLICITUD: SOLICITUD,
    BENEFICIARIO: BENEFICIARIO,
    W8BEN: W8BEN,
    REQUIRED: REQUIRED,
    fillPacket: fillPacket,
    fillOne: fillOne,
    completeness: completeness,
    beneficiaryTotals: beneficiaryTotals,
    get: get,
    dateDigits: dateDigits,
    usDate: usDate,
    initialsOf: initialsOf,
  };
}));
