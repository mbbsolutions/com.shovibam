import { useState, useCallback } from 'react';
import * as Crypto from 'expo-crypto'; // Assuming Crypto is available via expo-crypto

const API_BASE_URL = 'https://techvibs.com/bank/api_general/access_account_general_local_api.php';
const AUTO_CHECK_MIN_LENGTH = 4;

/**
 * Custom hook for verifying username, account number, or Techvibes ID against the API.
 * It handles the API call, internal loading states, and provides the verification result.
 *
 * @param {function} setPayloadData - Function to update debug payload data in the parent component (e.g., Login1).
 * @param {function} getOrCreateDeviceFingerprintInternal - Function to get or create the device fingerprint.
 * @returns {object} An object containing:
 * - {boolean} isChecking: True if verification is in progress.
 * - {string} verificationMessage: Message indicating the status of the verification.
 * - {object|null} verifiedUserData: The user's data if verification is successful, otherwise null.
 * - {function} verifyIdentifier: A function to call to initiate the verification process with an identifier.
 */
export const useUserAccountVerification = (setPayloadData, getOrCreateDeviceFingerprintInternal) => {
  const [isChecking, setIsChecking] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState('');
  const [verifiedUserData, setVerifiedUserData] = useState(null);

  /**
   * Internal helper function to make the actual API call to get user data.
   * @param {Array<object>} query - An array of query objects (e.g., [{ field: 'username', value: 'test' }]).
   * @returns {object} An object with `status` ('success' or 'error') and `data` or `message`.
   */
  const getUserData = useCallback(async (query) => {
    try {
      const requestBody = {
        action: 'query_account',
        checks: Array.isArray(query) ? query : [query],
      };

      // Update payloadData for debug purposes (sent request)
      setPayloadData(prev => ({
        ...prev,
        url: API_BASE_URL,
        lastApiCall: 'autoVerification',
        sent: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody,
        }
      }));

      const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const rawResponseText = await response.text();
      let jsonResponse = {};
      try {
        jsonResponse = JSON.parse(rawResponseText);
      } catch (e) {
        console.error('UserAccountVerification: Failed to parse JSON from getUserData:', e);
        // Update payloadData for debug purposes (received raw text if JSON parsing fails)
        setPayloadData(prev => ({
          ...prev,
          received: { status: response.status, text: rawResponseText, json: null }
        }));
        return { status: 'error', message: 'Invalid JSON response from server.' };
      }

      // Update payloadData for debug purposes (received parsed JSON)
      setPayloadData(prev => ({
        ...prev,
        received: { status: response.status, text: rawResponseText, json: jsonResponse }
      }));

      if (!response.ok) {
        console.error('API Error:', response.status, jsonResponse);
        return { status: 'error', message: jsonResponse.message || 'An unexpected API error occurred.' };
      }

      if (jsonResponse.status === 'success') {
        return { status: 'success', data: jsonResponse.data };
      } else {
        // If API returns success: false, it's still a valid JSON response but indicates an error.
        return jsonResponse; // This already contains status 'error' and message
      }
    } catch (error) {
      console.error('Fetch Error:', error);
      return { status: 'error', message: 'Could not connect to the server. Please check your internet connection.' };
    }
  }, [setPayloadData]); // Dependency: setPayloadData from parent

  /**
   * Initiates the user account verification process.
   * @param {string} identifierToVerify - The username, account number, or Techvibes ID to verify.
   */
  const verifyIdentifier = useCallback(async (identifierToVerify) => {
    // Reset states if identifier is too short or empty
    if (identifierToVerify.length < AUTO_CHECK_MIN_LENGTH) {
      setVerificationMessage('');
      setVerifiedUserData(null);
      return;
    }

    setIsChecking(true);
    try {
      const response = await getUserData([
        { field: 'username', value: identifierToVerify.trim() },
        { field: 'account_number', value: identifierToVerify.trim() },
        { field: 'techvibes_id', value: identifierToVerify.trim() },
      ]);

      if (response.status === 'error') {
        setVerificationMessage(response.message || 'Verification failed. Please try again.');
        setVerifiedUserData(null);
        return;
      }

      const responseData = response.data; // Access the 'data' property for successful responses

      if (responseData && Array.isArray(responseData)) {
        let foundUser = null;
        for (const check of responseData) {
          if (check.exists && check.data) {
            foundUser = check.data;
            break; // Found a user, stop checking
          }
        }

        if (foundUser) {
          // Get or create device fingerprint and attach it to the found user data
          const currentDeviceFingerprint = await getOrCreateDeviceFingerprintInternal();
          if (currentDeviceFingerprint) {
            foundUser.device_fingerprint = currentDeviceFingerprint;
            console.log("UserAccountVerification: Added device_fingerprint to foundUser:", currentDeviceFingerprint);
          } else {
            console.warn("UserAccountVerification: Could not get device fingerprint to add to foundUser.");
            foundUser.device_fingerprint = null;
          }

          setVerificationMessage(`Verification successful! Account found for: ${foundUser.fullName || foundUser.username || 'User'}.`);
          setVerifiedUserData(foundUser);
          console.log("UserAccountVerification: Verified User Data (with fingerprint):", foundUser);
        } else {
          setVerificationMessage('No account found matching the provided identifier.');
          setVerifiedUserData(null);
        }
      } else {
        setVerificationMessage('An unexpected response was received from the account general API.');
        setVerifiedUserData(null);
      }
    } catch (error) {
      console.error('UserAccountVerification: Verification error:', error);
      setVerificationMessage('An internal error occurred during verification.');
      setVerifiedUserData(null);
    } finally {
      setIsChecking(false);
    }
  }, [getUserData, getOrCreateDeviceFingerprintInternal]); // Dependencies: getUserData and getOrCreateDeviceFingerprintInternal

  return { isChecking, verificationMessage, verifiedUserData, verifyIdentifier };
};
