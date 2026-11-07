// users/{uid}.role == 'admin' (set by hand in the Firebase console)
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getMyRole } from '../services/userApi';

export default function useIsAdmin(uid?: string | null): { isAdmin: boolean; checked: boolean } {
  const [isAdmin, setIsAdmin] = useState(false);
  const [checked, setChecked] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getMyRole(uid)
        .then(role => {
          if (alive) setIsAdmin(role === 'admin');
        })
        .catch(() => {})
        .finally(() => {
          if (alive) setChecked(true);
        });
      return () => {
        alive = false;
      };
    }, [uid]),
  );
  return { isAdmin, checked };
}
