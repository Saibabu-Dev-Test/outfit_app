// Web build: a browser can't read the SIM, so the user types the mobile number instead
// (LoginScreen shows a normal text field on web). The account is marked phoneVerified: false.
export const SIM_REQUIRED_MESSAGE = 'Enter your mobile number to continue';

export type SimPickResult =
  | { ok: true; number: string }
  | { ok: false; cancelled: boolean; message: string };

export const pickSimNumber = async (): Promise<SimPickResult> => ({
  ok: false,
  cancelled: false,
  message: SIM_REQUIRED_MESSAGE,
});
