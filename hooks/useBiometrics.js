// YourProjectName/hooks/useBiometrics.js

import { useState, useEffect, useCallback } from 'react';
// Correct the import path to point to your new BiometricService in utils/
import { checkBiometricAvailability, authenticateWithBiometrics } from '../utils/BiometricService';

export const useBiometrics = () => {
  const [biometricStatus, setBiometricStatus] = useState({
    isAvailable: false,
    biometricType: null,
    message: 'Checking biometrics...',
  });
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Memoize this function to prevent unnecessary re-creations
  const initBiometrics = useCallback(async () => {
    const status = await checkBiometricAvailability();
    setBiometricStatus(status);
  }, []); // Empty dependency array as checkBiometricAvailability is stable

  // Run initBiometrics once when the hook mounts
  useEffect(() => {
    initBiometrics();
  }, [initBiometrics]); // Depend on initBiometrics

  // Memoize the authentication function
  const authenticate = useCallback(async (promptMessage) => {
    setIsAuthenticating(true);
    const result = await authenticateWithBiometrics(promptMessage);
    setIsAuthenticating(false);
    return result;
  }, []); // Empty dependency array as authenticateWithBiometrics is stable

  return {
    biometricStatus,
    isAuthenticating,
    authenticate,
  };
};