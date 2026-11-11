// Type check only (tsc): every .web.ts replacement must export what the Android module exports,
// so the web bundle never imports a name that is missing. Never bundled.
import * as vault from '../src/native/sessionVault';
import * as vaultWeb from '../src/native/sessionVault.web';
import * as lock from '../src/native/appLock';
import * as lockWeb from '../src/native/appLock.web';
import * as hint from '../src/native/phoneHint';
import * as hintWeb from '../src/native/phoneHint.web';
import * as notif from '../src/native/notifications';
import * as notifWeb from '../src/native/notifications.web';
import * as gauth from '../src/services/googleAuth';
import * as gauthWeb from '../src/services/googleAuth.web';
import * as picker from '../src/utils/imagePicker';
import * as pickerWeb from '../src/utils/imagePicker.web';
import * as fb from '../src/config/firebaseConfig';
import * as fbWeb from '../src/config/firebaseConfig.web';
import * as kb from '../src/components/keyboard';
import * as kbWeb from '../src/components/keyboard.web';

type Same<A> = { [K in keyof A]: unknown };
export const parity: [
  Same<typeof vault>,
  Same<typeof lock>,
  Same<typeof hint>,
  Same<typeof notif>,
  Same<typeof gauth>,
  Same<typeof picker>,
  Same<typeof fb>,
  Same<typeof kb>,
] = [vaultWeb, lockWeb, hintWeb, notifWeb, gauthWeb, pickerWeb, fbWeb, kbWeb];
