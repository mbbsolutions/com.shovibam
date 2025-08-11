// utils/AirtimeUtils.js
import axios from 'axios';

// --- Configuration ---
// CORRECTED API BASE URL: Pointing to api_general
const API_BASE_URL = 'https://techvibs.com/bank/api_general/airtime_general_api.php'; 

// --- Helper Function for API Calls ---
/**
 * Sends a request to the Airtime API endpoint (airtime_general_api.php).
 * This endpoint IS assumed to require authentication via authToken.
 * @param {string} action The API action (e.g., 'get_providers', 'topup_airtime').
 * @param {Object} [params={}] Optional parameters for the action.
 * @param {string} authToken The authentication token from the user session (REQUIRED for this API).
 * @returns {Promise<Object>} The parsed JSON response from the API.
 * @throws {Error} Throws an error if the request fails or the response is invalid JSON.
 */
const callAirtimeApi = async (action, params = {}, authToken) => { // Re-added authToken parameter
  // --- DEBUGGING LOGS (Re-introduced) ---
  console.log('AirtimeUtils: Received authToken for API call:', authToken ? 'TOKEN_RECEIVED' : 'TOKEN_NOT_RECEIVED');
  console.log('AirtimeUtils: Received authToken (partial) for API call:', authToken ? authToken.substring(0, 20) + '...' : 'N/A');
  // --- END DEBUGGING LOGS ---

  try {
    const payload = {
      action,
      ...params,
    };

    console.log('AirtimeUtils: Sending Request to', API_BASE_URL, 'with payload:', payload);

    const headers = {
      'Content-Type': 'application/json',
      'X-API-Request': 'true', // Required by your PHP endpoint
    };

    // Re-introducing the Authorization header
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
      // --- DEBUGGING LOG (Re-introduced) ---
      console.log('AirtimeUtils: Authorization Header set:', headers['Authorization'].substring(0, 30) + '...');
      // --- END DEBUGGING LOG ---
    } else {
      console.warn('AirtimeUtils: No authToken provided for API call. This API likely requires one!');
      // You might want to throw an error here if authToken is mandatory
      // throw new Error('Authentication token is required for this API endpoint.');
    }

    const response = await axios.post(API_BASE_URL, payload, {
      headers: headers,
    });

    // --- Original Debugging Logs (kept for general response check) ---
    console.log('AirtimeUtils: Received Raw Response Status:', response.status);
    console.log('AirtimeUtils: Received Raw Response Data:', JSON.stringify(response.data, null, 2));
    // --- End Original Debugging Logs ---

    const data = response.data;

    // ---- CUSTOM ERROR MESSAGE OVERRIDE (Optional, retained) ----
    if (data && typeof data === 'object') {
      if (
        data.message &&
        typeof data.message === 'string' &&
        (
          data.message.toLowerCase().includes('insufficient balance') ||
          data.message.toLowerCase().includes('topup your wallet')
        )
      ) {
        data.message = 'ISB. Contact us for assistance.';
      }
      if (
        data.data &&
        typeof data.data === 'object' &&
        data.data.message &&
        typeof data.data.message === 'string' &&
        (
          data.data.message.toLowerCase().includes('insufficient balance') ||
          data.data.message.toLowerCase().includes('topup your wallet')
        )
      ) {
        data.data.message = 'ISB. Contact us for assistance.';
      }
    }

    return data;
  } catch (error) {
    console.error('AirtimeUtils: API call failed:', error.response?.data || error.message);
    if (error.response) {
      // Provide more specific error if available from the API response
      const errorMessage = error.response.data?.message || `Unknown error from server (${error.response.status})`;
      throw new Error(`API Error: ${errorMessage}`);
    } else if (error.request) {
      throw new Error('Network Error: No response received from the server. Check your internet connection.');
    } else {
      throw new Error(`Request Setup Error: ${error.message}`);
    }
  }
};

/**
 * Fetches the list of available airtime providers.
 * authToken is now REQUIRED for this API endpoint.
 * @param {string} authToken The authentication token from the user session.
 * @returns {Promise<Object>} The API response containing provider data.
 */
export const getAirtimeProviders = async (authToken) => { // Re-added authToken parameter
  return await callAirtimeApi('get_providers', {}, authToken); // Pass authToken
};

/**
 * Initiates an airtime topup.
 * authToken is now REQUIRED for this API endpoint.
 * @param {Object} params - The parameters for the top-up.
 * @param {string} params.provider - The name/code of the provider.
 * @param {string} params.number - The phone number to top up.
 * @param {number|string} params.amount - The amount of airtime to purchase.
 * @param {string} [params.reference] - Optional unique reference.
 * @param {string} authToken - The authentication token from the user session.
 * @returns {Promise<Object>} The API response containing transaction details.
 */
export const topupAirtime = async ({ provider, number, amount, reference }, authToken) => { // Re-added authToken parameter
  if (!provider || !number || !amount) {
    throw new Error('Missing required parameters: provider, number, and amount are required.');
  }

  const params = {
    provider,
    number,
    amount: Number(amount),
  };

  if (reference && reference.trim() !== '') {
    params.reference = reference.trim();
  }

  return await callAirtimeApi('topup_airtime', params, authToken); // Pass authToken
};