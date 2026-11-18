// India's 28 states + 8 union territories (codes used across the civic tabs). Keep equal to
// src/constants/indiaStates.ts (__tests__/civicWorker.test.ts checks).
export const STATES = [
  { code: 'AP', name: 'Andhra Pradesh', type: 'state', capital: 'Amaravati' },
  { code: 'AR', name: 'Arunachal Pradesh', type: 'state', capital: 'Itanagar' },
  { code: 'AS', name: 'Assam', type: 'state', capital: 'Dispur' },
  { code: 'BR', name: 'Bihar', type: 'state', capital: 'Patna' },
  { code: 'CG', name: 'Chhattisgarh', type: 'state', capital: 'Raipur' },
  { code: 'GA', name: 'Goa', type: 'state', capital: 'Panaji' },
  { code: 'GJ', name: 'Gujarat', type: 'state', capital: 'Gandhinagar' },
  { code: 'HR', name: 'Haryana', type: 'state', capital: 'Chandigarh' },
  { code: 'HP', name: 'Himachal Pradesh', type: 'state', capital: 'Shimla' },
  { code: 'JH', name: 'Jharkhand', type: 'state', capital: 'Ranchi' },
  { code: 'KA', name: 'Karnataka', type: 'state', capital: 'Bengaluru' },
  { code: 'KL', name: 'Kerala', type: 'state', capital: 'Thiruvananthapuram' },
  { code: 'MP', name: 'Madhya Pradesh', type: 'state', capital: 'Bhopal' },
  { code: 'MH', name: 'Maharashtra', type: 'state', capital: 'Mumbai' },
  { code: 'MN', name: 'Manipur', type: 'state', capital: 'Imphal' },
  { code: 'ML', name: 'Meghalaya', type: 'state', capital: 'Shillong' },
  { code: 'MZ', name: 'Mizoram', type: 'state', capital: 'Aizawl' },
  { code: 'NL', name: 'Nagaland', type: 'state', capital: 'Kohima' },
  { code: 'OD', name: 'Odisha', type: 'state', capital: 'Bhubaneswar' },
  { code: 'PB', name: 'Punjab', type: 'state', capital: 'Chandigarh' },
  { code: 'RJ', name: 'Rajasthan', type: 'state', capital: 'Jaipur' },
  { code: 'SK', name: 'Sikkim', type: 'state', capital: 'Gangtok' },
  { code: 'TN', name: 'Tamil Nadu', type: 'state', capital: 'Chennai' },
  { code: 'TG', name: 'Telangana', type: 'state', capital: 'Hyderabad' },
  { code: 'TR', name: 'Tripura', type: 'state', capital: 'Agartala' },
  { code: 'UP', name: 'Uttar Pradesh', type: 'state', capital: 'Lucknow' },
  { code: 'UK', name: 'Uttarakhand', type: 'state', capital: 'Dehradun' },
  { code: 'WB', name: 'West Bengal', type: 'state', capital: 'Kolkata' },
  { code: 'AN', name: 'Andaman and Nicobar Islands', type: 'ut', capital: 'Sri Vijaya Puram' },
  { code: 'CH', name: 'Chandigarh', type: 'ut', capital: 'Chandigarh' },
  { code: 'DH', name: 'Dadra and Nagar Haveli and Daman and Diu', type: 'ut', capital: 'Daman' },
  { code: 'DL', name: 'Delhi', type: 'ut', capital: 'New Delhi' },
  { code: 'JK', name: 'Jammu and Kashmir', type: 'ut', capital: 'Srinagar / Jammu' },
  { code: 'LA', name: 'Ladakh', type: 'ut', capital: 'Leh' },
  { code: 'LD', name: 'Lakshadweep', type: 'ut', capital: 'Kavaratti' },
  { code: 'PY', name: 'Puducherry', type: 'ut', capital: 'Puducherry' },
];

export const stateByCode = code => STATES.find(s => s.code === code) || null;

// The Union Government (centre), used ONLY by the "previous vs present government" comparison
// (kind 'gcmp', state code 'IN'). Not a state: never in STATES, never in the state picker list.
export const CENTRE = { code: 'IN', name: 'Union Government of India (Centre)', type: 'centre', capital: 'New Delhi' };

// A state / UT by code, or the centre for the comparison kind
export const placeByCode = (code, kind) => (kind === 'gcmp' && code === 'IN' ? CENTRE : stateByCode(code));
