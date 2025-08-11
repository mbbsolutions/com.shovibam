import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { loginWithPassword } from '../services/AuthService';

/**
 * Checks if biometric authentication is available and enrolled on the device.
 * @returns {object} An object with isAvailable (boolean), biometricType (number, 1=Fingerprint, 2=Face, etc.), and message.
 */
export const checkBiometricAvailability = async () => {
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    const biometricTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
    return {
      isAvailable: compatible && enrolled,
      biometricType: biometricTypes.length > 0 ? biometricTypes[0] : null,
      message: compatible
        ? enrolled ? 'Biometrics ready' : 'No biometrics enrolled'
        : 'Biometric hardware not available',
    };
  } catch (error) {
    console.error('Error checking biometrics:', error);
    return {
      isAvailable: false,
      biometricType: null,
      message: 'Failed to check biometric availability.',
    };
  }
};

/**
 * Stores the password securely after a successful login.
 * @param {string} userId The user ID to associate with the password.
 * @param {string} password The password to store.
 * @returns {boolean} True if stored successfully, false otherwise.
 */
export const storePassword = async (userId, password) => {
  try {
    await SecureStore.setItemAsync(`password_${userId}`, password);
    return true;
  } catch (error) {
    console.error('Error storing password:', error);
    return false;
  }
};

/**
 * Retrieves the stored password for a user.
 * @param {string} userId The user ID to fetch the password for.
 * @returns {object} An object with success (boolean), password (string or null), and message.
 */
export const getStoredPassword = async (userId) => {
  try {
    const password = await SecureStore.getItemAsync(`password_${userId}`);
    if (password) {
      return { success: true, password, message: 'Password retrieved successfully' };
    }
    return { success: false, password: null, message: 'No stored password found' };
  } catch (error) {
    console.error('Error retrieving password:', error);
    return { success: false, password: null, message: 'Failed to retrieve password' };
  }
};

/**
 * Deletes the stored password for a user (e.g., after password change or logout).
 * @param {string} userId The user ID whose password should be deleted.
 * @returns {boolean} True if deleted successfully, false otherwise.
 */
export const deleteStoredPassword = async (userId) => {
  try {
    await SecureStore.deleteItemAsync(`password_${userId}`);
    return true;
  } catch (error) {
    console.error('Error deleting stored password:', error);
    return false;
  }
};

/**
 * Prompts the user for biometric authentication and logs in using the stored password.
 * @param {string} promptMessage The message displayed during authentication.
 * @param {string} userId The user ID to fetch the password for.
 * @returns {object} An object with success (boolean), message, and userData (if successful).
 */
export const authenticateWithBiometrics = async (promptMessage = 'Authenticate to access', userId) => {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: 'Use Passcode',
      disableDeviceFallback: false,
    });

    if (result.success) {
      console.log('Biometric authentication successful');

      // Retrieve the stored password
      const passwordResponse = await getStoredPassword(userId);
      if (passwordResponse.success) {
        // Use the stored password to log in
        const loginResponse = await loginWithPassword({
          identifier: userId,
          password: passwordResponse.password,
        });

        if (loginResponse.success) {
          return { success: true, message: 'Login successful', userData: loginResponse.account, userToken: loginResponse.userToken };
        } else {
          // If login fails, likely due to password change
          await deleteStoredPassword(userId); // Clear outdated password
          return { success: false, message: 'Login failed. Please log in manually with new password.', errorType: 'login_error' };
        }
      } else {
        return { success: false, message: passwordResponse.message || 'No stored password found. Please log in manually.', errorType: 'fetch_error' };
      }
    } else if (result.error === 'user_fallback') {
      console.log('User chose fallback (passcode)');
      return { success: false, message: 'Authentication cancelled or fallback chosen', errorType: 'user_fallback' };
    } else if (result.error === 'user_cancel') {
      console.log('User cancelled biometric authentication');
      return { success: false, message: 'Authentication cancelled by user', errorType: 'user_cancel' };
    } else {
      console.log('Biometric authentication failed:', result.error);
      return { success: false, message: `Authentication failed: ${result.error}`, errorType: result.error };
    }
  } catch (error) {
    console.error('Error during biometric authentication:', error);
    return { success: false, message: `Authentication error: ${error.message}`, errorType: 'system_error' };
  }
};