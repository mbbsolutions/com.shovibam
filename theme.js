import { Appearance, Platform } from 'react-native';

const lightColors = {
  background: '#f7fbff',
  card: '#fff',
  text: '#222',
  textSecondary: '#166088',
  primary: '#166088',
  accent: '#34b233',
  border: '#b6c8e9',
  error: '#e74c3c',
  success: '#34b233',
  warning: '#ffc107',
  info: '#0056b3',
  disabled: '#ccc',
  surface: '#f0f4f8',
};

const darkColors = {
  background: '#181a20',
  card: '#232c3d',
  text: '#fff',
  textSecondary: '#90caf9',
  primary: '#90caf9',
  accent: '#66bb6a',
  border: '#333',
  error: '#ef5350',
  success: '#66bb6a',
  warning: '#ffd54f',
  info: '#1976d2',
  disabled: '#444',
  surface: '#22252a',
};

export const spacing = {
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
};

export const typography = {
  fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  fontSize: 16,
  fontWeight: '400',
  headingWeight: 'bold',
  headingSize: 20,
};

export const getTheme = (scheme = Appearance.getColorScheme()) => ({
  colors: scheme === 'dark' ? darkColors : lightColors,
  spacing,
  typography,
  scheme,
});