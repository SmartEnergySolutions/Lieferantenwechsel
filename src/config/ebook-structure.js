// E-Book structure definition used by batch generation and reporting
// Keep IDs stable; sections are human-readable titles
const { SEARCH_QUERIES } = require('./search-queries');

const defaultValidation = {
  requiredSections: 1,
  requireExamples: false,
  requireTechnicalTerms: false,
};

const CHAPTERS = [
  { id: '01-overview', title: 'Überblick Lieferantenwechsel', level: 'beginner', sections: [
    'ANMELD Nachricht – Struktur', 'Marktrollen und Datenflüsse', 'Fristen und Prozessüberblick'
  ], searchQueries: SEARCH_QUERIES['01-overview'], dependencies: [], validationCriteria: defaultValidation },
  { id: '02-contract-conclusion', title: 'Vertragsabschluss', level: 'beginner', sections: [
    'Vertragsdaten und Stammdaten', 'Kündigungsprozesse Altlieferant'
  ], searchQueries: SEARCH_QUERIES['02-contract-conclusion'], dependencies: ['01-overview'], validationCriteria: defaultValidation },
  { id: '03-notification', title: 'Meldungen und Bestätigungen', level: 'standard', sections: [
    'ANMELD Validierungen', 'Rückmeldungen und Fehlercodes'
  ], searchQueries: SEARCH_QUERIES['03-notification'], dependencies: ['01-overview','02-contract-conclusion'], validationCriteria: defaultValidation },
  { id: '04-switch-execution', title: 'Wechselumsetzung', level: 'standard', sections: [
    'Zeitliche Abwicklung', 'Messlokationsbezug'
  ], searchQueries: SEARCH_QUERIES['04-switch-execution'], dependencies: ['03-notification'], validationCriteria: defaultValidation },
  { id: '05-metering', title: 'Messwesen und Prozesse', level: 'standard', sections: [
    'Zählerstände und Ablesungen', 'Marktkommunikation MSB'
  ], searchQueries: SEARCH_QUERIES['05-metering'], dependencies: ['04-switch-execution'], validationCriteria: defaultValidation },
  { id: '06-billing', title: 'Abrechnung', level: 'standard', sections: [
    'Netz- und Lieferabrechnung', 'Sonderfälle'
  ], searchQueries: SEARCH_QUERIES['06-billing'], dependencies: ['05-metering'], validationCriteria: defaultValidation },
  { id: '07-quality', title: 'Qualität und Validierung', level: 'standard', sections: [
    'Plausibilitäten', 'ALOCAT Zuordnungsregeln'
  ], searchQueries: SEARCH_QUERIES['07-quality'], dependencies: ['06-billing'], validationCriteria: defaultValidation },
  { id: '08-appendix', title: 'Anhang', level: 'standard', sections: [
    'Glossar', 'Referenzen'
  ], searchQueries: SEARCH_QUERIES['08-appendix'], dependencies: [], validationCriteria: defaultValidation },
];

module.exports = { CHAPTERS };
