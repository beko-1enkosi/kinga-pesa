import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

export function useConnection() {
  const [connection, setConnection] = useState(navigator.onLine ? 'checking' : 'offline');
  const [healthEpoch, setHealthEpoch] = useState(0);
  const [reconnected, setReconnected] = useState(false);
  const lost = useRef(!navigator.onLine);
  const sequence = useRef(0);

  const reportFailure = useCallback((error) => {
    if (!['offline', 'network'].includes(error.kind)) return;
    sequence.current += 1;
    lost.current = true;
    setReconnected(false);
    setConnection(navigator.onLine ? 'weak' : 'offline');
  }, []);

  const checkConnection = useCallback(async () => {
    const request = ++sequence.current;
    if (!navigator.onLine) {
      lost.current = true;
      setConnection('offline');
      return;
    }
    setConnection('checking');
    try {
      const health = await api('/health');
      if (health.status !== 'ok') throw new Error('Unhealthy');
      if (request !== sequence.current) return;
      setConnection('online');
      setReconnected(lost.current);
      lost.current = false;
      setHealthEpoch(epoch => epoch + 1);
    } catch {
      if (request !== sequence.current) return;
      lost.current = true;
      setReconnected(false);
      setConnection(navigator.onLine ? 'weak' : 'offline');
    }
  }, []);

  useEffect(() => {
    const offline = () => reportFailure({ kind: 'offline' });
    window.addEventListener('offline', offline);
    window.addEventListener('online', checkConnection);
    checkConnection();
    return () => {
      sequence.current += 1;
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', checkConnection);
    };
  }, [checkConnection, reportFailure]);

  return { connection, reconnected, healthEpoch, checkConnection, reportFailure };
}
