// Laws tab: the acts covered, with their official source. Guidance only, not legal advice.
// BNS: every offence row of the BNSS First Schedule (bns.generated.ts). Other acts: the most used
// sections, written by hand from the official text on India Code (curated.ts). The structure takes
// any number of sections per act, so coverage can grow without app changes elsewhere.

export type ActId =
  | 'BNS'
  | 'BNSS'
  | 'BSA'
  | 'IT'
  | 'POCSO'
  | 'DOWRY'
  | 'DV'
  | 'MV'
  | 'CPA'
  | 'RTI'
  | 'SCST'
  | 'NDPS';

export interface Act {
  id: ActId;
  short: string;
  name: string;
  year: number;
  replaces?: string;
  source: string; // official text
}

// India Code home: search the act's name there for the official, up-to-date text.
export const INDIA_CODE = 'https://www.indiacode.nic.in/';

export const ACTS: Act[] = [
  {
    id: 'BNS',
    short: 'BNS',
    name: 'Bharatiya Nyaya Sanhita',
    year: 2023,
    replaces: 'Indian Penal Code, 1860 (IPC)',
    source: 'https://www.indiacode.nic.in/handle/123456789/20062',
  },
  {
    id: 'BNSS',
    short: 'BNSS',
    name: 'Bharatiya Nagarik Suraksha Sanhita',
    year: 2023,
    replaces: 'Code of Criminal Procedure, 1973 (CrPC)',
    source: INDIA_CODE,
  },
  {
    id: 'BSA',
    short: 'BSA',
    name: 'Bharatiya Sakshya Adhiniyam',
    year: 2023,
    replaces: 'Indian Evidence Act, 1872',
    source: INDIA_CODE,
  },
  { id: 'IT', short: 'IT Act', name: 'Information Technology Act', year: 2000, source: INDIA_CODE },
  {
    id: 'POCSO',
    short: 'POCSO',
    name: 'Protection of Children from Sexual Offences Act',
    year: 2012,
    source: INDIA_CODE,
  },
  { id: 'DOWRY', short: 'Dowry Act', name: 'Dowry Prohibition Act', year: 1961, source: INDIA_CODE },
  {
    id: 'DV',
    short: 'DV Act',
    name: 'Protection of Women from Domestic Violence Act',
    year: 2005,
    source: INDIA_CODE,
  },
  { id: 'MV', short: 'MV Act', name: 'Motor Vehicles Act (as amended in 2019)', year: 1988, source: INDIA_CODE },
  { id: 'CPA', short: 'Consumer Act', name: 'Consumer Protection Act', year: 2019, source: INDIA_CODE },
  { id: 'RTI', short: 'RTI', name: 'Right to Information Act', year: 2005, source: INDIA_CODE },
  {
    id: 'SCST',
    short: 'SC/ST Act',
    name: 'Scheduled Castes and Scheduled Tribes (Prevention of Atrocities) Act',
    year: 1989,
    source: INDIA_CODE,
  },
  {
    id: 'NDPS',
    short: 'NDPS',
    name: 'Narcotic Drugs and Psychotropic Substances Act',
    year: 1985,
    source: INDIA_CODE,
  },
];

export const actById = (id: ActId): Act => ACTS.find(a => a.id === id) || ACTS[0];

export const LAW_DISCLAIMER =
  'Guidance only, in simple words. It is not legal advice and not the full legal text. Punishments, bail and court can change with amendments and the facts of each case. Check the official text on India Code and consult a lawyer (free legal aid: NALSA 15100).';
