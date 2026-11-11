// Another user's name with their age: "Krishna Prasad (31)".
// Uses the age stored on the doc (userAge / voterAge / authorAge) or a DOB when given; otherwise
// looks up users/{uid} once (cached in services/userCache). Private profiles without a stored
// age show the plain name.
import React, { useEffect, useState } from 'react';
import { Text, TextProps } from 'react-native';
import { getUserLite } from '../services/userCache';
import { ageFromDobIST, cleanAge, nameWithAge } from '../utils/age';

export const useAgeOf = (uid?: string | null, storedAge?: unknown, dob?: string | null): number | null => {
  const known = dob ? ageFromDobIST(dob) : cleanAge(storedAge);
  const [looked, setLooked] = useState<number | null>(null);
  useEffect(() => {
    if (known !== null || !uid) return;
    let alive = true;
    getUserLite(uid)
      .then(u => {
        if (alive) setLooked(ageFromDobIST(u?.dob));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [uid, known]);
  return known !== null ? known : looked;
};

interface Props extends TextProps {
  uid?: string | null;
  name: string | null | undefined;
  age?: unknown;
  dob?: string | null;
}

export default function NameWithAge({ uid, name, age, dob, ...rest }: Props) {
  const a = useAgeOf(uid, age, dob);
  return <Text {...rest}>{nameWithAge(name, a)}</Text>;
}
