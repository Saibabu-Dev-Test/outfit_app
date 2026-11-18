// Hand-written entries for the Laws tab, from the official text (India Code). Guidance only.
//  - CURATED: the most used sections of the other acts (BNSS, BSA, IT, POCSO, Dowry, DV, MV,
//    Consumer, RTI, SC/ST, NDPS).
//  - BNS_DETAILS: simple meaning + examples added on top of the official BNS Schedule rows
//    (bns.generated.ts), keyed by the BNS section number.
// Fines under the MV Act are the central amounts; states may compound them at different amounts.
import type { ActId } from './acts';

export interface CuratedSection {
  act: ActId;
  section: string;
  title: string;
  summary: string; // one line
  punishment: string; // jail / fine, or what the section gives
  cognizable?: string;
  bailable?: string;
  court?: string;
  timeLimit?: string;
  meaning?: string;
  examples?: string[];
  oldRef?: string; // section in the old law it replaced
}

export const CURATED: CuratedSection[] = [
  // ── BNSS 2023 (procedure; replaced CrPC) ──
  {
    act: 'BNSS',
    section: '173',
    title: 'FIR: information in cognizable cases',
    summary: 'Police must register an FIR for a cognizable offence, at any police station (Zero FIR), also by e-FIR.',
    punishment: 'Procedure (no punishment). A free copy of the FIR must be given to the informant or victim.',
    meaning:
      'You can give information orally, in writing or electronically. A Zero FIR can be filed at any station whatever the place of the crime; it is then sent to the right station. For offences punishable with 3 to 7 years, the officer may do a preliminary enquiry within 14 days (with a senior officer\'s permission).',
    examples: ['Phone stolen in another city: file a Zero FIR at the nearest station.', 'If police refuse, send the complaint to the Superintendent of Police (s.173(4)) or approach the Magistrate.'],
    oldRef: 'CrPC 154',
    timeLimit: 'File as soon as possible; delay must be explained.',
  },
  {
    act: 'BNSS',
    section: '35',
    title: 'When police may arrest without warrant',
    summary: 'Police can arrest without a warrant only in the cases listed; for offences up to 7 years a notice to appear is the rule.',
    punishment: 'Procedure. For offences punishable up to 3 years, arrest of an infirm person or a person above 60 needs a senior officer\'s permission.',
    oldRef: 'CrPC 41, 41A',
  },
  {
    act: 'BNSS',
    section: '47',
    title: 'Grounds of arrest must be told',
    summary: 'The arrested person must be told the full grounds of arrest and, for bailable offences, the right to bail.',
    punishment: 'Procedure (a right of the arrested person).',
    oldRef: 'CrPC 50',
  },
  {
    act: 'BNSS',
    section: '58',
    title: 'Produce before Magistrate within 24 hours',
    summary: 'An arrested person cannot be kept in police custody beyond 24 hours (excluding travel) without a Magistrate\'s order.',
    punishment: 'Procedure (a right of the arrested person).',
    oldRef: 'CrPC 57',
  },
  {
    act: 'BNSS',
    section: '193',
    title: 'Police report (charge sheet) and its time',
    summary: 'Investigation must finish without delay; for rape and child sexual offences it must be completed within 2 months of the FIR.',
    punishment: 'Procedure. The informant / victim must be told the progress within 90 days.',
    oldRef: 'CrPC 173',
  },
  {
    act: 'BNSS',
    section: '478, 480, 482',
    title: 'Bail: bailable, non-bailable and anticipatory',
    summary: 'Bail is a right in bailable offences (478); in non-bailable offences the court decides (480); anticipatory bail before arrest (482).',
    punishment: 'Procedure.',
    oldRef: 'CrPC 436, 437, 438',
  },
  {
    act: 'BNSS',
    section: '479',
    title: 'Release of undertrials',
    summary: 'An undertrial who has spent half the maximum sentence in jail (one-third for a first-time offender) is to be released on bond.',
    punishment: 'Procedure. Not for offences punishable with death or life imprisonment.',
    oldRef: 'CrPC 436A',
  },
  {
    act: 'BNSS',
    section: '144',
    title: 'Maintenance of wife, children and parents',
    summary: 'A Magistrate can order a person with enough means to pay monthly maintenance to a wife, children or parents who cannot maintain themselves.',
    punishment: 'Civil order; unpaid amounts can be recovered and the person can be jailed for non-payment.',
    oldRef: 'CrPC 125',
  },
  {
    act: 'BNSS',
    section: '514',
    title: 'Time limit to take cognizance',
    summary: 'Court cannot take cognizance after: 6 months (fine only), 1 year (jail up to 1 year), 3 years (jail of 1 to 3 years).',
    punishment: 'Procedure. No limit for offences punishable with more than 3 years. Delay can be condoned in the interest of justice (s.517).',
    oldRef: 'CrPC 468',
  },
  {
    act: 'BNSS',
    section: '258',
    title: 'Judgment time in Sessions trials',
    summary: 'Judgment within 30 days of the end of arguments, extendable to 45 days for reasons recorded.',
    punishment: 'Procedure.',
    oldRef: 'CrPC 235 (no time limit before)',
  },

  // ── BSA 2023 (evidence; replaced Indian Evidence Act) ──
  {
    act: 'BSA',
    section: '23',
    title: 'Confession to police',
    summary: 'A confession made to a police officer, or in police custody (unless before a Magistrate), cannot be proved against the accused.',
    punishment: 'Rule of evidence.',
    oldRef: 'Evidence Act 25, 26',
  },
  {
    act: 'BSA',
    section: '26',
    title: 'Dying declaration and other statements of persons who cannot be called',
    summary: 'A statement by a person about the cause of their death is relevant evidence.',
    punishment: 'Rule of evidence.',
    oldRef: 'Evidence Act 32',
  },
  {
    act: 'BSA',
    section: '61, 63',
    title: 'Electronic records as evidence',
    summary: 'Electronic and digital records (WhatsApp chats, emails, CCTV) are admissible; s.63 needs a certificate in the form given in the Schedule.',
    punishment: 'Rule of evidence.',
    oldRef: 'Evidence Act 65B',
  },
  {
    act: 'BSA',
    section: '117, 118',
    title: 'Presumptions in suicide and dowry death of a married woman',
    summary: 'Within 7 years of marriage, if cruelty / dowry harassment is shown, the court may / shall presume abetment of suicide (117) or dowry death (118).',
    punishment: 'Rule of evidence.',
    oldRef: 'Evidence Act 113A, 113B',
  },

  // ── IT Act 2000 (cyber) ──
  {
    act: 'IT',
    section: '66',
    title: 'Computer related offences (hacking, data theft)',
    summary: 'Dishonestly or fraudulently doing any act in s.43 (unauthorised access, downloading data, virus, damage).',
    punishment: 'Up to 3 years jail, or fine up to ₹5 lakh, or both.',
    cognizable: 'Cognizable (IT Act s.77B).',
    bailable: 'Bailable (s.77B).',
    court: 'Magistrate',
    examples: ['Logging in to someone\'s email or social media without permission and copying data.'],
  },
  {
    act: 'IT',
    section: '66C',
    title: 'Identity theft',
    summary: 'Fraudulently using another person\'s password, electronic signature or other unique identity feature.',
    punishment: 'Up to 3 years jail and fine up to ₹1 lakh.',
    cognizable: 'Cognizable.',
    bailable: 'Bailable.',
    examples: ['Using someone\'s OTP or UPI PIN to move money.'],
  },
  {
    act: 'IT',
    section: '66D',
    title: 'Cheating by personation using a computer or phone',
    summary: 'Cheating by pretending to be someone else using a computer resource or communication device.',
    punishment: 'Up to 3 years jail and fine up to ₹1 lakh.',
    cognizable: 'Cognizable.',
    bailable: 'Bailable.',
    examples: ['Fake "bank officer" calls asking for card details; fake profiles asking for money.'],
  },
  {
    act: 'IT',
    section: '66E',
    title: 'Violation of privacy',
    summary: 'Capturing, publishing or sending images of a person\'s private area without consent.',
    punishment: 'Up to 3 years jail, or fine up to ₹2 lakh, or both.',
    cognizable: 'Cognizable.',
    bailable: 'Bailable.',
  },
  {
    act: 'IT',
    section: '67',
    title: 'Publishing or sending obscene material electronically',
    summary: 'Publishing or transmitting obscene material in electronic form.',
    punishment: 'First conviction: up to 3 years and fine up to ₹5 lakh. Later: up to 5 years and fine up to ₹10 lakh.',
    cognizable: 'Cognizable.',
  },
  {
    act: 'IT',
    section: '67A, 67B',
    title: 'Sexually explicit material; child sexual abuse material',
    summary: 'Publishing or sending sexually explicit material (67A) or material showing children in sexually explicit acts (67B).',
    punishment: 'First conviction: up to 5 years and fine up to ₹10 lakh. Later: up to 7 years and fine up to ₹10 lakh.',
    cognizable: 'Cognizable.',
    bailable: 'Non-bailable.',
  },
  {
    act: 'IT',
    section: '66A',
    title: 'Offensive messages (struck down)',
    summary: 'Struck down by the Supreme Court in Shreya Singhal v. Union of India (2015). No one can be booked under it.',
    punishment: 'Not in force.',
  },

  // ── POCSO 2012 ──
  {
    act: 'POCSO',
    section: '4',
    title: 'Penetrative sexual assault on a child',
    summary: 'Penetrative sexual assault on a person below 18.',
    punishment: 'At least 10 years, up to life, and fine. If the child is below 16: at least 20 years, up to life (rest of natural life), and fine.',
    cognizable: 'Cognizable.',
    bailable: 'Non-bailable.',
    court: 'Special Court (POCSO)',
    timeLimit: 'No time limit to report. Child\'s evidence to be recorded within 30 days of cognizance; trial to finish within 1 year as far as possible (s.35).',
  },
  {
    act: 'POCSO',
    section: '6',
    title: 'Aggravated penetrative sexual assault',
    summary: 'Penetrative assault by a police officer, relative, person in trust, on a child below 12, by a gang, etc.',
    punishment: 'At least 20 years, up to life (rest of natural life), and fine, or death.',
    cognizable: 'Cognizable.',
    bailable: 'Non-bailable.',
    court: 'Special Court (POCSO)',
  },
  {
    act: 'POCSO',
    section: '8',
    title: 'Sexual assault on a child',
    summary: 'Touching a child with sexual intent, without penetration.',
    punishment: '3 to 5 years jail and fine.',
    cognizable: 'Cognizable.',
    bailable: 'Non-bailable.',
    court: 'Special Court (POCSO)',
  },
  {
    act: 'POCSO',
    section: '10',
    title: 'Aggravated sexual assault on a child',
    summary: 'Sexual assault in aggravated cases (by a person in authority, relative, on a child below 12, etc.).',
    punishment: '5 to 7 years jail and fine.',
    cognizable: 'Cognizable.',
    bailable: 'Non-bailable.',
    court: 'Special Court (POCSO)',
  },
  {
    act: 'POCSO',
    section: '12',
    title: 'Sexual harassment of a child',
    summary: 'Sexual remarks, gestures, showing pornography, stalking a child with sexual intent.',
    punishment: 'Up to 3 years jail and fine.',
    cognizable: 'Cognizable.',
    bailable: 'Bailable.',
    court: 'Special Court (POCSO)',
  },
  {
    act: 'POCSO',
    section: '19, 21',
    title: 'Duty to report',
    summary: 'Anyone who knows of a child sexual offence must report it to the police or Special Juvenile Police Unit; not reporting is an offence.',
    punishment: 'Failure to report: up to 6 months, or fine, or both (s.21).',
  },

  // ── Dowry Prohibition Act 1961 ──
  {
    act: 'DOWRY',
    section: '3',
    title: 'Giving or taking dowry',
    summary: 'Giving, taking or helping to give or take dowry.',
    punishment: 'At least 5 years jail and fine of at least ₹15,000 or the value of the dowry, whichever is more.',
    cognizable: 'Cognizable (for investigation, s.8).',
    bailable: 'Non-bailable (s.8).',
  },
  {
    act: 'DOWRY',
    section: '4',
    title: 'Demanding dowry',
    summary: 'Directly or indirectly demanding dowry from the bride\'s or groom\'s parents or relatives.',
    punishment: '6 months to 2 years jail and fine up to ₹10,000.',
    cognizable: 'Cognizable (s.8).',
    bailable: 'Non-bailable (s.8).',
  },

  // ── Domestic Violence Act 2005 (civil protection) ──
  {
    act: 'DV',
    section: '12',
    title: 'Application to Magistrate',
    summary: 'A woman facing domestic violence (physical, sexual, verbal, emotional, economic) can apply for protection, residence, money or custody orders.',
    punishment: 'Civil remedy. Apply directly, through a Protection Officer or a service provider.',
    timeLimit: 'First hearing ordinarily within 3 days; the court should decide within 60 days of the first hearing.',
  },
  {
    act: 'DV',
    section: '18 to 22',
    title: 'Protection, residence, monetary relief, custody, compensation',
    summary: 'The Magistrate can stop violence, let the woman stay in the shared household, order maintenance and medical costs, give temporary custody of children and compensation.',
    punishment: 'Civil orders.',
  },
  {
    act: 'DV',
    section: '31',
    title: 'Breach of a protection order',
    summary: 'Disobeying a protection or interim protection order.',
    punishment: 'Up to 1 year jail, or fine up to ₹20,000, or both.',
    cognizable: 'Cognizable (s.32).',
    bailable: 'Non-bailable (s.32).',
    court: 'Magistrate of the first class',
  },

  // ── Motor Vehicles Act 1988 (2019 amounts) ──
  {
    act: 'MV',
    section: '181',
    title: 'Driving without a licence',
    summary: 'Driving without a valid driving licence (s.3), or underage driving (s.4).',
    punishment: 'Up to 3 months jail, or fine up to ₹5,000, or both.',
  },
  {
    act: 'MV',
    section: '183',
    title: 'Over-speeding',
    summary: 'Driving faster than the speed limit.',
    punishment: 'Light motor vehicle: ₹1,000 to ₹2,000. Medium / heavy: ₹2,000 to ₹4,000. Repeat: licence can be impounded.',
  },
  {
    act: 'MV',
    section: '184',
    title: 'Dangerous driving (including using a mobile while driving)',
    summary: 'Driving dangerously, jumping red lights, using a handheld phone while driving.',
    punishment: 'First: 6 months to 1 year jail, or fine ₹1,000 to ₹5,000, or both. Repeat within 3 years: up to 2 years, or fine up to ₹10,000, or both.',
  },
  {
    act: 'MV',
    section: '185',
    title: 'Drunken driving',
    summary: 'Driving with more than 30 mg alcohol per 100 ml of blood, or under drugs.',
    punishment: 'First: up to 6 months, or fine up to ₹10,000, or both. Repeat within 3 years: up to 2 years, or fine up to ₹15,000, or both.',
  },
  {
    act: 'MV',
    section: '194B, 194D',
    title: 'Seat belt and helmet',
    summary: 'Not wearing a seat belt (194B) or a helmet on a two-wheeler (194D).',
    punishment: 'Fine ₹1,000. Helmet: also licence disqualification for 3 months.',
  },
  {
    act: 'MV',
    section: '196',
    title: 'Driving an uninsured vehicle',
    summary: 'Driving a vehicle without valid third-party insurance.',
    punishment: 'First: up to 3 months, or fine ₹2,000, or both. Repeat: up to 3 months, or fine ₹4,000, or both.',
  },
  {
    act: 'MV',
    section: '199A',
    title: 'Offences by juveniles',
    summary: 'If a minor commits a traffic offence, the guardian or vehicle owner is deemed guilty.',
    punishment: 'Guardian / owner: up to 3 years jail and fine ₹25,000; vehicle registration cancelled for 12 months; the minor cannot get a licence till 25.',
  },
  {
    act: 'MV',
    section: '134A',
    title: 'Good Samaritan protection',
    summary: 'A person who helps an accident victim in good faith is not liable and cannot be forced to give their identity.',
    punishment: 'Protection (no punishment).',
  },

  // ── Consumer Protection Act 2019 ──
  {
    act: 'CPA',
    section: '35',
    title: 'Consumer complaint',
    summary: 'A consumer can complain about defective goods, deficient service, unfair trade practice or overcharging, online on e-Daakhil.',
    punishment: 'Civil remedy: replacement, refund, compensation. District Commission: claims up to ₹50 lakh; State: ₹50 lakh to ₹2 crore; National: above ₹2 crore (2021 rules).',
    timeLimit: 'Within 2 years of the cause of action (s.69).',
  },
  {
    act: 'CPA',
    section: '89',
    title: 'False or misleading advertisement',
    summary: 'A manufacturer or service provider making a false or misleading advertisement.',
    punishment: 'Up to 2 years and fine up to ₹10 lakh. Repeat: up to 5 years and fine up to ₹50 lakh.',
  },
  {
    act: 'CPA',
    section: '72',
    title: 'Not obeying a Consumer Commission order',
    summary: 'Failing to comply with an order of the District, State or National Commission.',
    punishment: '1 month to 3 years jail, or fine ₹25,000 to ₹1 lakh, or both.',
  },

  // ── RTI Act 2005 ──
  {
    act: 'RTI',
    section: '6',
    title: 'Asking for information',
    summary: 'Any citizen can ask a public authority for information in writing or online, without giving a reason.',
    punishment: 'Fee ₹10 for central bodies (state rules may differ); free for BPL card holders. Central: rtionline.gov.in.',
  },
  {
    act: 'RTI',
    section: '7',
    title: 'Time to reply',
    summary: 'The Public Information Officer must reply within 30 days; within 48 hours if it concerns life or liberty.',
    punishment: 'Duty of the PIO.',
    timeLimit: '30 days (+5 days if filed through an Assistant PIO).',
  },
  {
    act: 'RTI',
    section: '19',
    title: 'Appeals',
    summary: 'First appeal to the senior officer within 30 days; second appeal to the Information Commission within 90 days.',
    punishment: 'No fee for appeals under the central rules.',
  },
  {
    act: 'RTI',
    section: '20',
    title: 'Penalty on the PIO',
    summary: 'For refusing or delaying information without reason.',
    punishment: '₹250 per day, up to ₹25,000, on the officer.',
  },

  // ── SC/ST (Prevention of Atrocities) Act 1989 ──
  {
    act: 'SCST',
    section: '3(1)',
    title: 'Atrocities against SC/ST members',
    summary: 'Acts like intentional insult in public view, forcing obnoxious substances, wrongful land occupation, social or economic boycott, etc.',
    punishment: '6 months to 5 years jail and fine.',
    cognizable: 'Cognizable.',
    bailable: 'Non-bailable.',
    court: 'Exclusive Special Court / Special Court (s.14)',
  },
  {
    act: 'SCST',
    section: '3(2)(v)',
    title: 'Serious offences against SC/ST members',
    summary: 'An offence under the BNS punishable with 10 years or more, committed because the victim is SC/ST.',
    punishment: 'Imprisonment for life and fine.',
    cognizable: 'Cognizable.',
    bailable: 'Non-bailable.',
    court: 'Special Court',
  },
  {
    act: 'SCST',
    section: '18, 18A',
    title: 'No anticipatory bail',
    summary: 'Anticipatory bail is barred for offences under this Act; no preliminary enquiry is needed before the FIR.',
    punishment: 'Procedure.',
  },

  // ── NDPS Act 1985 ──
  {
    act: 'NDPS',
    section: '20, 21, 22',
    title: 'Ganja, drugs and psychotropic substances',
    summary: 'Producing, possessing, selling, transporting cannabis (20), manufactured drugs like heroin (21) or psychotropic substances (22).',
    punishment: 'Small quantity: up to 1 year, or fine up to ₹10,000, or both. Above small but below commercial: up to 10 years and fine up to ₹1 lakh. Commercial quantity: 10 to 20 years and fine ₹1 to 2 lakh.',
    cognizable: 'Cognizable (s.37).',
    bailable: 'Non-bailable (s.37); strict bail conditions for commercial quantity.',
    court: 'Special Court (s.36)',
  },
  {
    act: 'NDPS',
    section: '27',
    title: 'Consumption of drugs',
    summary: 'Consuming a narcotic drug or psychotropic substance.',
    punishment: 'Cocaine, morphine, heroin etc.: up to 1 year, or fine up to ₹20,000, or both. Others: up to 6 months, or fine up to ₹10,000, or both.',
  },
  {
    act: 'NDPS',
    section: '64A',
    title: 'Immunity for addicts who seek treatment',
    summary: 'A person charged only with consumption or small quantity who volunteers for de-addiction treatment is not prosecuted.',
    punishment: 'Protection.',
  },
];

// Simple meaning + examples for the most used BNS sections (keyed by the main section number).
export const BNS_DETAILS: Record<string, { meaning: string; examples?: string[] }> = {
  '64': {
    meaning: 'Sexual intercourse with a woman without her free consent, or when she is under 18 (definition in s.63).',
    examples: ['Consent given under fear, threat or intoxication is not consent.'],
  },
  '69': { meaning: 'Sexual relations got by deceit, like a false promise of marriage with no intention to keep it, or a false promise of a job. New in BNS.' },
  '74': { meaning: 'Using force against a woman intending to outrage her modesty.' },
  '75': { meaning: 'Unwelcome physical contact, demanding sexual favours, showing pornography against her will, or sexually coloured remarks.' },
  '78': { meaning: 'Following a woman or repeatedly contacting her (also online) despite her clear disinterest.', examples: ['Repeated messages and calls after she blocked you.'] },
  '79': { meaning: 'Words, sounds, gestures or objects intended to insult the modesty of a woman.' },
  '80': { meaning: 'Death of a woman by burns or injury, or in unnatural circumstances, within 7 years of marriage, after dowry harassment.' },
  '85': {
    meaning: 'Cruelty by the husband or his relatives: conduct likely to drive her to suicide or cause grave injury, or harassment for dowry or property (cruelty defined in s.86).',
    examples: ['Beating or constant abuse for not bringing money from her parents.'],
  },
  '101': { meaning: 'Culpable homicide is murder when done with the intention of causing death or an injury likely to cause death (s.101). Punishment in s.103.' },
  '103': { meaning: 'Murder. Murder by a group of five or more on grounds of race, caste, sex, place of birth, language or belief (mob lynching) is s.103(2).' },
  '106': {
    meaning: 'Causing death by a rash or negligent act that is not culpable homicide. s.106(1) covers medical negligence (lower punishment for registered doctors).',
    examples: ['Death caused by careless driving or unsafe construction.'],
  },
  '108': { meaning: 'Helping, instigating or pushing someone to die by suicide.' },
  '109': { meaning: 'Doing an act with intention to kill, which would be murder if death resulted.' },
  '111': { meaning: 'Continuing unlawful activity by a gang or syndicate (kidnapping, extortion, land grabbing, cyber crime, trafficking, etc.) for money or benefit. New in BNS.' },
  '115': { meaning: 'Causing bodily pain, disease or infirmity on purpose.', examples: ['A slap or a punch without serious injury.'] },
  '117': { meaning: 'Causing grievous hurt: fracture, loss of sight or hearing, permanent disfigurement, or severe pain for 15 days, etc.' },
  '124': { meaning: 'Throwing or using acid causing permanent or partial damage, deformity or burns.' },
  '126': { meaning: 'Stopping a person from going where they have a right to go.' },
  '127': { meaning: 'Keeping a person confined so they cannot leave.' },
  '137': { meaning: 'Taking a child (or person of unsound mind) away from their lawful guardian without consent, or taking someone out of India without consent.' },
  '152': { meaning: 'Acts by words, signs, electronic means or financial means that excite secession, armed rebellion or subversive activities, or endanger the sovereignty, unity and integrity of India. New in BNS.' },
  '191': { meaning: 'An unlawful assembly of five or more using force or violence.' },
  '196': { meaning: 'Promoting enmity between groups on grounds of religion, race, place of birth, residence, language, caste or community.' },
  '281': { meaning: 'Driving or riding on a public way so rashly or negligently as to endanger human life.' },
  '303': {
    meaning: 'Dishonestly taking movable property out of someone\'s possession without consent. For a first theft below ₹5,000 with the property returned, community service is possible.',
    examples: ['Taking a bike or phone without the owner\'s consent.'],
  },
  '304': { meaning: 'Suddenly or quickly seizing or grabbing movable property from a person (chain or phone snatching). New in BNS.' },
  '308': { meaning: 'Putting a person in fear of injury to get money or property from them.' },
  '309': { meaning: 'Theft or extortion with violence or fear of instant death, hurt or restraint.' },
  '316': { meaning: 'Dishonestly misusing property or money entrusted to you.', examples: ['An employee spending company cash given for a purpose.'] },
  '318': {
    meaning: 'Deceiving a person to make them hand over property or do something they would not otherwise do, causing them harm.',
    examples: ['Selling a fake gold chain as real.', 'Online job fraud that collects a "registration fee".'],
  },
  '329': { meaning: 'Entering another\'s property (or house) with intent to commit an offence, intimidate, insult or annoy.' },
  '336': { meaning: 'Making a false document or electronic record, with intent to cause damage or support a false claim.' },
  '351': { meaning: 'Threatening injury to a person, their reputation or property, to cause alarm or force them to act.', examples: ['Threatening to harm someone unless they withdraw a complaint.'] },
  '352': { meaning: 'Intentionally insulting a person to provoke them to break the public peace.' },
  '356': { meaning: 'Making or publishing words or images that harm a person\'s reputation, except true statements for public good and other listed exceptions.' },
};
