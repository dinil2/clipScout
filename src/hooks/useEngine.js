import { useState, useEffect, useCallback, useRef } from 'react';
import { defaultEngineClient } from '../api/engineClient.js';

export function useEngine() {
  const [isConnected, setIsConnected] = useState(true);
  const [healthData, setHealthData] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const failCountRef = useRef(0);

  const checkConnection = useCallback(async () => {
    setIsChecking(true);
    const res = await defaultEngineClient.checkHealth();
    if (res.ok) {
      failCountRef.current = 0;
      setIsConnected(true);
      setHealthData(res.data || null);
    } else {
      failCountRef.current += 1;
      // Require 3 consecutive failed checks (30+ seconds of downtime) before flipping isConnected to false
      if (failCountRef.current >= 3) {
        setIsConnected(false);
      }
    }
    setIsChecking(false);
    return res.ok;
  }, []);

  useEffect(() => {
    checkConnection();
    // Periodic check every 15s
    const interval = setInterval(checkConnection, 15000);
    return () => clearInterval(interval);
  }, [checkConnection]);

  return {
    isConnected,
    healthData,
    isChecking,
    checkConnection
  };
}

