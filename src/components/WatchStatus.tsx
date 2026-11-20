import { useEffect, useState } from 'react';
import type { WatchStatus as Status } from '../../modules/sabr-wear';
import { makeStyles } from '../theme';
import { watchStatus } from '../wear/sync';
import { Text } from './ui';

const list = (names: string[]) => names.join(', ');

/** Which watch the tile goes to, and whether the Sabr watch app is on it yet. */
export function WatchStatus() {
  const st = useStyles();
  const [status, setStatus] = useState<Status | null>(null);
  useEffect(() => {
    watchStatus()
      .then(setStatus)
      .catch(() => setStatus({ withSabr: [], others: [] }));
  }, []);

  let line: string;
  if (status == null) line = 'Looking for your watch...';
  else if (status.withSabr.length) line = `Sabr is installed on ${list(status.withSabr)}. Swipe to your tiles, scroll to the end, tap Add tiles and pick Sabr.`;
  else if (status.others.length)
    line = `${list(status.others)} is connected, but the Sabr watch app isn't on it yet (or it's older than 0.10). Install the latest sabr-watch APK from the Sabr website, then add the Sabr tile.`;
  else line = 'No watch connected right now. The watch needs the Sabr watch app installed (see the Sabr website for how), then add the Sabr tile.';
  return <Text style={st.hint}>{line}</Text>;
}

const useStyles = makeStyles((c) => ({
  hint: { fontSize: 13, color: c.muted, marginTop: 6, fontWeight: '600', lineHeight: 18 },
}));
