import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getItem, setItem } from '../utils/StorageService';

const INACTIVITY_TIMER_KEY = 'inactivityTimerMinutes';
const DEFAULT_INACTIVITY_MINUTES = 1;
const MIN_INACTIVITY_MINUTES = 1;
const MAX_INACTIVITY_MINUTES = 5;

const InactivityTimerContext = createContext({
  inactivityLimitMinutes: DEFAULT_INACTIVITY_MINUTES,
  setInactivityLimitMinutes: () => {},
  reloadLimit: async () => {},
});

export const useInactivityTimer = () => useContext(InactivityTimerContext);

export const InactivityTimerProvider = ({ children }) => {
  const [inactivityLimitMinutes, setLimit] = useState(DEFAULT_INACTIVITY_MINUTES);

  const reloadLimit = useCallback(async () => {
    const savedMinutes = await getItem(INACTIVITY_TIMER_KEY);
    if (
      savedMinutes !== null &&
      !isNaN(parseInt(savedMinutes, 10)) &&
      parseInt(savedMinutes, 10) >= MIN_INACTIVITY_MINUTES &&
      parseInt(savedMinutes, 10) <= MAX_INACTIVITY_MINUTES
    ) {
      setLimit(parseInt(savedMinutes, 10));
    } else {
      setLimit(DEFAULT_INACTIVITY_MINUTES);
    }
  }, []);

  useEffect(() => {
    reloadLimit();
  }, [reloadLimit]);

  const setInactivityLimitMinutes = useCallback(
    async (minutes) => {
      if (minutes < MIN_INACTIVITY_MINUTES || minutes > MAX_INACTIVITY_MINUTES) return;
      await setItem(INACTIVITY_TIMER_KEY, String(minutes));
      setLimit(minutes);
    },
    [],
  );

  return (
    <InactivityTimerContext.Provider value={{ inactivityLimitMinutes, setInactivityLimitMinutes, reloadLimit }}>
      {children}
    </InactivityTimerContext.Provider>
  );
};