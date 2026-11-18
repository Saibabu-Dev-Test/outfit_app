import { INDIA_STATES } from '../../constants/indiaStates';

export const stateByCodeApp = (code: string): string => INDIA_STATES.find(s => s.code === code)?.name || code;
