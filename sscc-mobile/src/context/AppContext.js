import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

export const API_URL = 'https://sscc-backend.onrender.com';
const STALE_THRESHOLD = 15000;

function genVoltage(base, range) {
  return Math.round((base + (Math.random() - 0.5) * range) * 10) / 10;
}

function genInitialLogs(count) {
  const logs = [];
  const now = Date.now();
  for (let i = count - 1; i >= 0; i--) {
    const ts = new Date(now - i * 3200);
    const isRestart = i === Math.floor(count * 0.6);
    const isManual = i === Math.floor(count * 0.3);
    logs.push({
      timestamp: ts.toISOString(),
      type: isRestart ? 'FAN_DAILY_RESTART' : isManual ? 'FAN_MANUAL' : 'UPDATE',
      inputVoltage: genVoltage(225, 18),
      outputVoltage: genVoltage(220, 8),
      fanStatus: true,
    });
  }
  return logs;
}

export function AppProvider({ children }) {
  const [demoMode, setDemoMode] = useState(false);
  const [pollInterval, setPollInterval] = useState(3);
  const [state, setState] = useState({
    inputVoltage: 0, outputVoltage: 0, fanStatus: true, logs: [],
  });
  const [isOnline, setIsOnline] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [restartDoneToday, setRestartDoneToday] = useState(false);
  const restartDayRef = useRef(new Date().getDate());
  const [fanLoading, setFanLoading] = useState(false);
  const [fanResult, setFanResult] = useState(null);
  const [pendingFanStatus, setPendingFanStatus] = useState(null);
  const initialized = useRef(false);

  // Initialize demo data
  useEffect(() => {
    if (!initialized.current && demoMode) {
      const logs = genInitialLogs(12);
      const last = logs[logs.length - 1];
      setState({ inputVoltage: last.inputVoltage, outputVoltage: last.outputVoltage, fanStatus: true, logs });
      setIsOnline(true);
      setLastUpdate(new Date());
      initialized.current = true;
    }
  }, [demoMode]);

  // Persist restart status for the whole day
  useEffect(() => {
    const today = new Date();
    const day = today.getDate();
    if (restartDayRef.current !== day) {
      restartDayRef.current = day;
      setRestartDoneToday(false);
    }
    const todayStr = today.toDateString();
    const hasRestart = state.logs.some(
      l => l.type === 'FAN_DAILY_RESTART' &&
        new Date(l.timestamp).toDateString() === todayStr
    );
    if (hasRestart) setRestartDoneToday(true);
  }, [state.logs]);

  // Poll for live data
  useEffect(() => {
    const pollMs = pollInterval * 1000;

    const poll = async () => {
      if (demoMode) {
        setState(prev => {
          const inV = genVoltage(225, 16);
          const outV = genVoltage(220, 8);
          const newLog = {
            timestamp: new Date().toISOString(),
            type: Math.random() < 0.05 ? 'FAN_DAILY_RESTART' : Math.random() < 0.08 ? 'FAN_MANUAL' : 'UPDATE',
            inputVoltage: inV, outputVoltage: outV, fanStatus: prev.fanStatus,
          };
          return { ...prev, inputVoltage: inV, outputVoltage: outV, logs: [...prev.logs, newLog].slice(-50) };
        });
        setIsOnline(true);
        setLastUpdate(new Date());
      } else {
        try {
          const res = await fetch(API_URL + '/state', { signal: AbortSignal.timeout(8000) });
          const data = await res.json();
          setState(data);
          const isFresh = data.lastUpdate &&
            (Date.now() - new Date(data.lastUpdate).getTime() < STALE_THRESHOLD);
          setIsOnline(!!isFresh);
          setLastUpdate(data.lastUpdate ? new Date(data.lastUpdate) : null);
        } catch {
          setIsOnline(false);
        }
      }
    };

    poll();
    const id = setInterval(poll, pollMs);
    return () => clearInterval(id);
  }, [demoMode, pollInterval]);

  // Clear fanResult once ESP confirms
  useEffect(() => {
    if (pendingFanStatus !== null && state.fanStatus === pendingFanStatus) {
      setFanResult(null);
      setPendingFanStatus(null);
    }
  }, [state.fanStatus, pendingFanStatus]);

  // Timeout 'success' after 15 s
  useEffect(() => {
    if (fanResult === 'success') {
      const t = setTimeout(() => { setFanResult(null); setPendingFanStatus(null); }, 15000);
      return () => clearTimeout(t);
    }
  }, [fanResult]);

  const sendFanCommand = useCallback(async () => {
    if (fanLoading) return;
    const targetStatus = !state.fanStatus;
    const cmd = targetStatus ? 'ON' : 'OFF';

    if (demoMode) {
      setFanLoading(true); setFanResult(null);
      setTimeout(() => {
        setState(prev => {
          const newLog = {
            timestamp: new Date().toISOString(), type: 'FAN_MANUAL',
            inputVoltage: prev.inputVoltage, outputVoltage: prev.outputVoltage, fanStatus: targetStatus,
          };
          return { ...prev, fanStatus: targetStatus, logs: [...prev.logs, newLog].slice(-50) };
        });
        setFanLoading(false); setFanResult('success'); setPendingFanStatus(targetStatus);
      }, 600);
    } else {
      setFanLoading(true); setFanResult(null);
      try {
        const res = await fetch(API_URL + '/fan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: cmd }),
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) throw new Error('Server error');
        setFanLoading(false); setFanResult('success'); setPendingFanStatus(targetStatus);
      } catch {
        setFanLoading(false); setFanResult('failed'); setPendingFanStatus(null);
      }
    }
  }, [demoMode, state.fanStatus, fanLoading]);

  return (
    <AppContext.Provider value={{
      demoMode, setDemoMode,
      pollInterval, setPollInterval,
      state, isOnline, lastUpdate,
      restartDoneToday,
      fanLoading, fanResult,
      sendFanCommand,
    }}>
      {children}
    </AppContext.Provider>
  );
}
