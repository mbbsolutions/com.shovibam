import React, { createContext, useState, useEffect } from 'react';
import { Appearance } from 'react-native';
import { getTheme } from './theme';

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [scheme, setScheme] = useState(Appearance.getColorScheme() || 'light');

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setScheme(colorScheme || 'light');
    });
    return () => {
      if (subscription && typeof subscription.remove === 'function') {
        subscription.remove();
      }
    };
  }, []);

  const theme = getTheme(scheme);

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};