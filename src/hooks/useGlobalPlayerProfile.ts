/**
 * Client-side hooks for global player profiles.
 *
 * The global `/players/{steamId64}` collection is readable by any
 * authenticated user.  These hooks provide convenient React access.
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { doc, getDoc, collection, getDocs, query, where, documentId } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { GlobalPlayerProfile } from '@/lib/player-profiles';

/**
 * Fetch a single global player profile by steamId64.
 */
export function useGlobalPlayerProfile(steamId: string | undefined) {
  const [profile, setProfile] = useState<GlobalPlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!steamId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'players', steamId));
        if (!cancelled && snap.exists()) {
          setProfile(snap.data() as GlobalPlayerProfile);
        }
      } catch (error) {
        console.error('Error fetching global player profile:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [steamId]);

  return { profile, loading };
}

/**
 * Fetch multiple global player profiles by steamId64 array.
 * Returns a Map keyed by steamId.
 */
export function useGlobalPlayerProfiles(steamIds: string[]) {
  const [profiles, setProfiles] = useState<Map<string, GlobalPlayerProfile>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (steamIds.length === 0) {
      setProfiles(new Map());
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const result = new Map<string, GlobalPlayerProfile>();

        // Firestore `in` query supports max 30 items at a time
        const chunks: string[][] = [];
        for (let i = 0; i < steamIds.length; i += 30) {
          chunks.push(steamIds.slice(i, i + 30));
        }

        for (const chunk of chunks) {
          // Use individual doc fetches — more reliable than `in` queries with document IDs
          const promises = chunk.map(id => getDoc(doc(db, 'players', id)));
          const snaps = await Promise.all(promises);
          for (const snap of snaps) {
            if (snap.exists()) {
              result.set(snap.id, snap.data() as GlobalPlayerProfile);
            }
          }
        }

        if (!cancelled) setProfiles(result);
      } catch (error) {
        console.error('Error fetching global player profiles:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [steamIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  return { profiles, loading };
}

/**
 * Utility function to get a single global player profile (non-hook).
 * For use in async functions within components.
 */
export async function fetchGlobalPlayerProfile(
  steamId: string
): Promise<GlobalPlayerProfile | null> {
  try {
    const snap = await getDoc(doc(db, 'players', steamId));
    if (snap.exists()) {
      return snap.data() as GlobalPlayerProfile;
    }
    return null;
  } catch (error) {
    console.error('Error fetching global player profile:', error);
    return null;
  }
}
