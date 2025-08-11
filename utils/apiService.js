// your-project/utils/apiService.js

// --- API Endpoints ---
// Base URL for your general API operations (e.g., login, registration)
const GENERAL_API_URL = 'https://techvibs.com/bank/api_general/general_api.php';
// Base URL for device mapping operations
const DEVICE_MAPPINGS_API_URL = 'https://techvibs.com/bank/api_general/device_mappings_api.php';
// Base URL for account access specific operations (e.g., getting linked accounts)
const ACCESS_ACCOUNT_API_URL = 'https://techvibs.com/bank/api_general/access_account_general_local_api.php';

// --- General API Call Function ---

/**
 * A general-purpose function to make POST requests to any of your API endpoints.
 * Handles JSON serialization/deserialization and basic error handling.
 *
 * @param {string} url - The full URL of the API endpoint.
 * @param {object} payload - The data to send in the request body (will be JSON.stringified).
 * @param {object} [headers={}] - Additional headers to send with the request.
 * @returns {Promise<{success: boolean, data?: any, error?: string, message?: string}>}
 */
export const callApi = async (url, payload, headers = {}) => {
  console.log(`apiService: Calling API: ${url} with payload:`, JSON.stringify(payload));
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers, // Allow overriding or adding more headers
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text(); // Get raw text for better debugging
      console.error(`apiService: API call failed - Status: ${response.status}, URL: ${url}, Response: ${errorText}`);
      let errorMessage = `API call failed with status ${response.status}.`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch (jsonParseError) {
        // If responseText is not JSON, use the status text
        errorMessage = response.statusText || errorMessage;
      }
      return { success: false, error: errorMessage, message: errorMessage };
    }

    const data = await response.json();
    console.log(`apiService: API response from ${url}:`, data);

    // Assuming your PHP APIs consistently return { success: boolean, message?: string, data?: any }
    if (data.status === 'success') {
      return { success: true, data: data.data || data, message: data.message || 'Success' };
    } else {
      return { success: false, error: data.message || 'API reported an error.', message: data.message || 'API reported an error.' };
    }

  } catch (e) {
    console.error(`apiService: Network or unexpected error calling ${url}:`, e);
    return { success: false, error: 'Network error or unable to connect to server.', message: 'Network error or unable to connect to server.' };
  }
};

// --- Specific API Calls ---

/**
 * Fetches all linked accounts for a given Techvibes ID.
 * Required by AuthContext to populate linkedAccounts state.
 *
 * @param {string} techvibesId - The unique Techvibes ID of the primary user.
 * @returns {Promise<{success: boolean, accounts?: Array<object>, error?: string}>}
 */
export const getLinkedAccountsByTechvibesId = async (techvibesId) => {
  if (!techvibesId) {
    console.error("apiService: getLinkedAccountsByTechvibesId: techvibesId is required.");
    return { success: false, error: "Techvibes ID is missing." };
  }

  const payload = {
    action: 'get_accounts_by_techvibes_id', // Ensure this action matches your PHP API
    techvibes_id: techvibesId,
  };

  const result = await callApi(ACCESS_ACCOUNT_API_URL, payload);

  if (result.success && result.data && Array.isArray(result.data.accounts)) {
    return { success: true, accounts: result.data.accounts };
  } else {
    return { success: false, error: result.error || 'Failed to retrieve linked accounts or none found.' };
  }
};

/**
 * Example: Function for user login.
 * This can be called from your Login2.js screen.
 *
 * @param {string} username - User's username.
 * @param {string} password - User's password.
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const loginUser = async (username, password) => {
  const payload = {
    action: 'login', // Your PHP API login action
    username: username,
    password: password,
    // Add any other login parameters your API expects (e.g., device_fingerprint)
  };
  const result = await callApi(GENERAL_API_URL, payload);

  // Assuming login API returns user details on success in result.data
  return result;
};

/**
 * Example: Function for fetching general transaction history.
 * This can be used by historyTable_gen_local.
 *
 * @param {object} options - Options for fetching history (e.g., customerId, limit, fromDate, toDate).
 * @returns {Promise<{success: boolean, transactions?: Array<object>, error?: string}>}
 */
export const fetchGeneralTransactionHistory = async (options) => {
  const payload = {
    action: 'get_general_transactions', // Your PHP API action for general transactions
    customer_id: options.customerId,
    limit: options.limit || 10,
    from_date: options.fromDate, // YYYY-MM-DD format expected by PHP
    to_date: options.toDate,     // YYYY-MM-DD format expected by PHP
    // Add other filters as needed
  };

  const result = await callApi(GENERAL_API_URL, payload); // Or a specific history API URL

  if (result.success && result.data && Array.isArray(result.data.transactions)) {
    return { success: true, transactions: result.data.transactions };
  } else {
    return { success: false, error: result.error || 'Failed to retrieve transactions or none found.' };
  }
};

/**
 * Function for creating/updating device mapping on the server.
 * This can be called from your Login2.js or AuthContext if appropriate.
 * It's structured to match the payload you previously provided for this API.
 *
 * @param {object} userDetails - Object containing user and device information.
 * @returns {Promise<{success: boolean, message: string}>} Result of the API call.
 */
export const createOrUpdateDeviceMapping = async (userDetails) => {
  if (!userDetails || !userDetails.device_fingerprint) {
    console.error('apiService: createOrUpdateDeviceMapping: device_fingerprint is required.');
    return { success: false, message: 'Device fingerprint is missing.' };
  }

  // Ensure user_id is null if not provided, as per PHP API's expectation
  const userIdToSend = userDetails.id || userDetails.user_id || null;

  const payload = {
    action: 'create', // The PHP API uses 'create' for upsert logic
    device_fingerprint: userDetails.device_fingerprint,
    user_id: userIdToSend,
    username: userDetails.username || null,
    account_number: userDetails.account_number || null,
    techvibes_id: userDetails.techvibes_id || null,
    full_name: userDetails.fullName || userDetails.full_name || null,
    email: userDetails.email || null,
    phoneNo: userDetails.phoneNo || userDetails.phone_number || null,
    fintech: userDetails.fintech || null, // Assuming fintech is passed or can be derived elsewhere
    device_type: userDetails.device_type || null, // Should ideally be passed from platform detection
    os_version: userDetails.os_version || null,
    app_version: userDetails.app_version || null,
    login_method: userDetails.login_method || 'unknown',
    device_serial: userDetails.device_serial || null,
    device_ip: userDetails.device_ip || null,
    location: userDetails.location || null,
    source: userDetails.source || 'mobile_app',
    login_code: userDetails.login_code || null,
    account_name: userDetails.account_name || null,
    sub_account_number: userDetails.sub_account_number || null,
    role: userDetails.role || null,
    national_identity_no: userDetails.national_identity_no || null,
    nin_user_id: userDetails.nin_user_id || null,
    customer_id: userDetails.customer_id || null,
    order_ref: userDetails.order_ref || null,
    customer_image: userDetails.customer_image || null,
    customer_signature: userDetails.customer_signature || null,
    other_account_information_source: userDetails.other_account_information_source || null,
  };

  const result = await callApi(DEVICE_MAPPINGS_API_URL, payload);

  if (result.success) {
    return { success: true, message: result.message || 'Device mapping successful.' };
  } else {
    return { success: false, message: result.error || 'Failed to map device.' };
  }
};