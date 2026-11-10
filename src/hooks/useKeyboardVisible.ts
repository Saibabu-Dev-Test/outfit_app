// true while the soft keyboard is open (Android: did* events; iOS: will* events, earlier and smoother).
import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export default function useKeyboardVisible(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(show, () => setOpen(true));
    const b = Keyboard.addListener(hide, () => setOpen(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);
  return open;
}
