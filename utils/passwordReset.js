// Base API endpoint
const API_URL = 'https://techvibs.com/bank/api_general/reset_credentials_api.php';

/**
 * Handles API requests for password/PIN reset.
 * @param {object} data - The payload to send to the API.
 * @returns {Promise<object>} - The JSON response from the API.
 * @throws {Error} - If the network request fails or the response is not OK.
 */
const makeApiRequest = async (data) => {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP error! Status: ${response.status}. Response: ${errorText}`);
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`Invalid JSON response: ${text.substring(0, 50)}...`);
  }
};

/**
 * Requests an OTP from the API.
 * @param {string} type - 'password' or 'pin'.
 * @param {string} userIdentifier - Account number or username.
 * @returns {Promise<object>} - The API response.
 */
export const requestOTP = async (type, userIdentifier) => {
  const data = {
    action: 'request_reset',
    type: type,
    user_identifier: userIdentifier,
  };
  return makeApiRequest(data);
};

/**
 * Verifies the entered OTP with the API.
 * @param {string} type - 'password' or 'pin'.
 * @param {string} userIdentifier - Account number or username.
 * @param {string} otp - The OTP entered by the user.
 * @returns {Promise<object>} - The API response.
 */
export const verifyOTP = async (type, userIdentifier, otp) => {
  const data = {
    action: 'verify_otp',
    type: type,
    user_identifier: userIdentifier,
    otp: otp,
  };
  return makeApiRequest(data);
};

/**
 * Resets the user's password or PIN.
 * @param {string} type - 'password' or 'pin'.
 * @param {string} userIdentifier - Account number or username.
 * @param {string} otp - The OTP entered by the user.
 * @param {string} newCredential - The new password or PIN.
 * @param {string} otherCredential - The current PIN or password for dual verification.
 * @returns {Promise<object>} - The API response.
 */
export const resetCredential = async (type, userIdentifier, otp, newCredential, otherCredential) => {
  const data = {
    action: 'reset',
    type: type,
    user_identifier: userIdentifier,
    otp: otp,
    new_credential: newCredential,
    other_credential: otherCredential, // This is still correctly passed to the 'reset' action
  };
  return makeApiRequest(data);
};

// The `verifyPin` function has been removed as it was making an API call
// for an action that does not exist on the PHP backend.
// The dual verification (using `other_credential`) is handled directly
// within the 'reset' action on the server side.