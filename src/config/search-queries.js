// Default search queries per chapter to bootstrap retrieval
const SEARCH_QUERIES = {
  '01-overview': [ 'Lieferantenwechsel Prozess Überblick', 'ANMELD Nachricht Grundlagen' ],
  '02-contract-conclusion': [ 'Vertragsabschluss neuer Lieferant', 'Kündigung Altlieferant Fristen' ],
  '03-notification': [ 'ANMELD Validierung', 'EDI Fehlercodes Marktkommunikation' ],
  '04-switch-execution': [ 'Lieferbeginn Terminierung', 'Messlokation Wechselprozess' ],
  '05-metering': [ 'Zählerstandsmeldung Prozesse', 'MSB Kommunikation Wechsel' ],
  '06-billing': [ 'Lieferabrechnung Schritte', 'Netznutzungsabrechnung Wechsel' ],
  '07-quality': [ 'ALOCAT Zuordnungsregeln', 'Plausibilitätsprüfungen Energiewirtschaft' ],
  '08-appendix': [ 'Energiemarkt Glossar', 'Marktrollen Referenzen' ],
};

module.exports = { SEARCH_QUERIES };
