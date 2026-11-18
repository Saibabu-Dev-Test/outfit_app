// Laws tab > "Whom to contact": national helplines (free calls) by situation, and what common legal
// steps cost. Numbers and amounts from the official portals named in `source`. Guidance only.

export interface Helpline {
  id: string;
  situation: string; // when to call
  who: string;
  number: string; // dialable
  web?: string;
  source: string;
}

export const HELPLINES: Helpline[] = [
  { id: 'emergency', situation: 'Any emergency: police, fire, ambulance', who: 'Emergency Response Support System', number: '112', source: 'https://112.gov.in' },
  { id: 'women', situation: 'Woman in distress, violence at home or outside', who: 'Women Helpline', number: '181', source: 'https://wcd.gov.in' },
  { id: 'child', situation: 'Child in danger, child labour, child marriage, abuse', who: 'Child Helpline', number: '1098', source: 'https://wcd.gov.in' },
  {
    id: 'cyber',
    situation: 'Online fraud, money lost by UPI / card, cyber harassment',
    who: 'National Cyber Crime Helpline',
    number: '1930',
    web: 'https://cybercrime.gov.in',
    source: 'https://cybercrime.gov.in',
  },
  {
    id: 'consumer',
    situation: 'Problem with a product, service, refund, overcharging',
    who: 'National Consumer Helpline',
    number: '1915',
    web: 'https://consumerhelpline.gov.in',
    source: 'https://consumerhelpline.gov.in',
  },
  {
    id: 'legalaid',
    situation: 'Need a free lawyer or legal advice',
    who: 'NALSA (Legal Services Authorities)',
    number: '15100',
    web: 'https://nalsa.gov.in',
    source: 'https://nalsa.gov.in',
  },
  { id: 'ambulance', situation: 'Medical emergency, ambulance', who: 'Emergency ambulance', number: '108', source: 'https://112.gov.in' },
  { id: 'fire', situation: 'Fire', who: 'Fire services', number: '101', source: 'https://112.gov.in' },
  { id: 'senior', situation: 'Senior citizen needing help', who: 'Elderline', number: '14567', source: 'https://socialjustice.gov.in' },
  { id: 'mental', situation: 'Stress, depression, suicidal thoughts', who: 'Tele-MANAS', number: '14416', source: 'https://telemanas.mohfw.gov.in' },
  { id: 'rail', situation: 'Problem on a train or at a station', who: 'Rail Madad', number: '139', web: 'https://railmadad.indianrailways.gov.in', source: 'https://railmadad.indianrailways.gov.in' },
  { id: 'highway', situation: 'Accident or breakdown on a national highway', who: 'NHAI helpline', number: '1033', source: 'https://nhai.gov.in' },
];

// Which department handles what (for "whom to contact in which situation")
export interface DeptContact {
  id: string;
  situation: string;
  whom: string;
  how: string;
  web?: string;
}

export const DEPT_CONTACTS: DeptContact[] = [
  { id: 'fir', situation: 'A crime happened (theft, assault, threat)', whom: 'Police station (any station: Zero FIR)', how: 'Give a written or oral complaint; ask for a free FIR copy. If refused, write to the SP or approach the Magistrate.' },
  { id: 'cyberfraud', situation: 'Money lost online', whom: 'Cyber crime cell', how: 'Call 1930 at once (within the "golden hour"), then file on cybercrime.gov.in and inform your bank.', web: 'https://cybercrime.gov.in' },
  { id: 'dv', situation: 'Violence at home', whom: 'Protection Officer (district), police, Women Helpline 181', how: 'Apply under the DV Act s.12 directly to the Magistrate or through the Protection Officer.' },
  { id: 'info', situation: 'Need information from a government office', whom: 'Public Information Officer (RTI)', how: 'File an RTI application (₹10 for central bodies); central: rtionline.gov.in.', web: 'https://rtionline.gov.in' },
  { id: 'consumer', situation: 'Shop / company / hospital service problem', whom: 'District Consumer Commission', how: 'Call 1915 first; then file on e-Daakhil.', web: 'https://edaakhil.nic.in' },
  { id: 'grievance', situation: 'Central government office not acting', whom: 'CPGRAMS (Public Grievances)', how: 'File a grievance online and track it.', web: 'https://pgportal.gov.in' },
  { id: 'corruption', situation: 'An official asks for a bribe', whom: 'State Anti-Corruption Bureau / Central Vigilance Commission', how: 'Complain to your state ACB, or to the CVC for central offices.', web: 'https://portal.cvc.gov.in' },
  { id: 'court', situation: 'Check a court case status', whom: 'eCourts services', how: 'Search by CNR number, party name or case number.', web: 'https://services.ecourts.gov.in' },
  { id: 'labour', situation: 'Salary not paid, workplace issue', whom: 'Labour Department / Labour Commissioner of your state', how: 'File a complaint with the district labour office.' },
  { id: 'land', situation: 'Land records, mutation, encroachment', whom: 'Tahsildar / Revenue office', how: 'Apply at the Mandal / Taluk office or the state land portal.' },
];

export interface CostItem {
  id: string;
  what: string;
  cost: string;
  note?: string;
  source: string;
}

export const COSTS: CostItem[] = [
  { id: 'fir', what: 'Filing an FIR', cost: 'Free', note: 'A copy of the FIR is free to the informant (BNSS s.173(2)).', source: 'BNSS 2023 s.173' },
  { id: 'rti', what: 'RTI application', cost: '₹10 (central)', note: 'Copies ₹2 per page; free for BPL. State rules can differ.', source: 'RTI Rules 2012 (central)' },
  { id: 'legalaid', what: 'Lawyer through legal aid', cost: 'Free', note: 'For women, children, SC/ST, persons with disability, people in custody, victims of disaster / trafficking, industrial workers and those below the income limit (Legal Services Authorities Act s.12).', source: 'https://nalsa.gov.in' },
  { id: 'consumer', what: 'Consumer complaint', cost: 'Free up to ₹5 lakh claim', note: 'Fee grows with the claim amount above that.', source: 'Consumer Protection (Consumer Commission Procedure) Regulations / Rules 2020' },
  { id: 'cyber', what: 'Cyber crime complaint', cost: 'Free', source: 'https://cybercrime.gov.in' },
  { id: 'courtfee', what: 'Court fees (civil cases)', cost: 'Depends on your state and the claim amount', note: 'Set by each state\'s Court Fees Act; criminal complaints by victims usually need only a small fixed fee. Ask the court\'s filing counter or your lawyer.', source: 'State Court Fees Acts' },
  { id: 'dv', what: 'Domestic violence application', cost: 'Usually no or a nominal fee', note: 'Protection Officers and legal aid help for free.', source: 'DV Act 2005' },
];
