// Static national civic info from official Government of India sources (no network, no API key).
// Only numbers / links published on official .gov.in sites; benefit lines are kept short and
// general (the app links to the official site for current rules). Shapes match cleanGovt()
// (research.js): schemes {name, level, who, benefit, apply, website}, grievance {name, how, phone,
// website}, services {name, how, website}, helplines {name, number}.

export const NOT_AVAILABLE = 'Public info not available';

// National helplines (all India, toll-free)
export const HELPLINES = [
  { name: 'Emergency (Police / Fire / Ambulance) - ERSS', number: '112' },
  { name: 'Ambulance', number: '108' },
  { name: 'Women Helpline', number: '181' },
  { name: 'Childline (children in need)', number: '1098' },
  { name: 'Cyber Crime Helpline (report at cybercrime.gov.in)', number: '1930' },
  { name: 'Voter Helpline (Election Commission)', number: '1950' },
  { name: 'Ayushman Bharat PM-JAY Helpline', number: '14555' },
];

export const VOTER = { helpline: '1950', website: 'https://voters.eci.gov.in' };

export const CPGRAMS_URL = 'https://pgportal.gov.in';

export const GRIEVANCE = [
  {
    name: 'CPGRAMS - Centralised Public Grievance Redress and Monitoring System',
    how: 'Register a grievance online against any central / state government department and track it with the registration number.',
    phone: '',
    website: CPGRAMS_URL,
  },
  {
    name: 'National Cyber Crime Reporting Portal',
    how: 'Report online fraud / cyber crime online, or call 1930 immediately for financial fraud.',
    phone: '1930',
    website: 'https://cybercrime.gov.in',
  },
];

export const CENTRAL_SCHEMES = [
  {
    name: 'Ayushman Bharat - Pradhan Mantri Jan Arogya Yojana (PM-JAY)',
    level: 'central',
    who: 'Eligible poor and vulnerable families (SECC / state lists); check eligibility on the official site or call 14555.',
    benefit: 'Cashless hospital treatment up to Rs 5 lakh per family per year at empanelled hospitals.',
    apply: 'Ayushman card at an empanelled hospital (Arogya Mitra), Common Service Centre, or the official portal / app.',
    website: 'https://pmjay.gov.in',
  },
  {
    name: 'PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)',
    level: 'central',
    who: 'Land-holding farmer families (exclusions apply as per scheme rules).',
    benefit: 'Rs 6,000 per year income support, paid in three instalments to the bank account.',
    apply: 'Register on the PM-KISAN portal, through a Common Service Centre or the village agriculture office; e-KYC required.',
    website: 'https://pmkisan.gov.in',
  },
  {
    name: 'National Social Assistance Programme (NSAP) - old age, widow and disability pensions',
    level: 'central',
    who: 'BPL elderly persons, widows and persons with severe disability, as per scheme rules.',
    benefit: 'Monthly pension (central share; many states add a top-up) and family benefit on death of the breadwinner.',
    apply: 'Apply through the gram panchayat / municipality or the state social welfare department.',
    website: 'https://nsap.dord.gov.in',
  },
  {
    name: 'Pradhan Mantri Awas Yojana - Gramin (PMAY-G)',
    level: 'central',
    who: 'Houseless and kutcha-house rural families as per the eligibility lists.',
    benefit: 'Financial assistance to build a pucca house.',
    apply: 'Through the gram panchayat / block office; beneficiaries are selected from the official lists.',
    website: 'https://pmayg.dord.gov.in',
  },
  {
    name: 'Pradhan Mantri Awas Yojana - Urban (PMAY-U)',
    level: 'central',
    who: 'Urban EWS / LIG / MIG families without a pucca house, as per scheme rules.',
    benefit: 'Assistance / interest subsidy for a house in urban areas.',
    apply: 'Apply on the official PMAY-U portal or through the urban local body (municipality).',
    website: 'https://pmay-urban.gov.in',
  },
  {
    name: 'National Food Security Act (NFSA) - ration card',
    level: 'central',
    who: 'Priority households and Antyodaya (AAY) families identified by the state.',
    benefit: 'Free foodgrains every month through the ration shop (fair price shop); One Nation One Ration Card works across states.',
    apply: 'Apply for a ration card with the state food & civil supplies department / its portal.',
    website: 'https://nfsa.gov.in',
  },
];

export const CITIZEN_SERVICES = [
  { name: 'Voter ID (EPIC) - new / correction / search', how: 'Apply or check your name in the electoral roll online or call 1950.', website: 'https://voters.eci.gov.in' },
  { name: 'Aadhaar - update / download', how: 'Online services or the nearest Aadhaar Seva Kendra.', website: 'https://uidai.gov.in' },
  { name: 'DigiLocker - official digital documents', how: 'Get driving licence, Aadhaar, certificates etc. as valid digital copies.', website: 'https://www.digilocker.gov.in' },
  { name: 'Driving licence and vehicle services', how: 'Apply / renew licence and RC services online (Parivahan).', website: 'https://parivahan.gov.in' },
  { name: 'Passport', how: 'Apply online and book a Passport Seva Kendra appointment.', website: 'https://www.passportindia.gov.in' },
  { name: 'National Portal of India - all government services', how: 'Directory of central and state services and forms.', website: 'https://www.india.gov.in' },
];

/**
 * District Collector / SP: there is no free structured source, so the name is never guessed.
 * -> { collector, sp, hint } where hint points the user to the district's official website.
 */
export function districtOfficials(districtName = '', website = '') {
  const site = String(website || '').replace(/^http:/, 'https:');
  const place = String(districtName || '').trim();
  const hint = site
    ? `See the official ${place ? `${place} ` : ''}district website: ${site}`
    : `See the official district website${place ? ` of ${place}` : ''} (most are at <district>.<state>.gov.in / .nic.in)`;
  return { collector: NOT_AVAILABLE, sp: NOT_AVAILABLE, hint };
}

export const staticInfo = {
  NOT_AVAILABLE,
  HELPLINES,
  VOTER,
  CPGRAMS_URL,
  GRIEVANCE,
  CENTRAL_SCHEMES,
  CITIZEN_SERVICES,
  districtOfficials,
};
