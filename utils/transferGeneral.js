// utils/transferGeneral.js

/**
 * The base URL for your API.
 * IMPORTANT: Replace this with your actual API endpoint.
 * This should NOT be `http://localhost`. Use your server's public IP or domain.
 */
const API_URL = 'https://techvibs.com/bank/api_general/transfer_general.php'; 

/**
 * Fetches user details (balance and sender name) from the API.
 * @param {string} customerId The unique customer ID.
 * @returns {Promise<object>} An object containing the current balance and sender name, or an error.
 */
export const fetchUserDetails = async (customerId) => {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'user_details',
        customer_id: customerId,
      }),
    });

    const data = await response.json();
    
    // Check if the response was successful
    if (response.ok && data.success) {
      return {
        success: true,
        balance: data.current_balance,
        senderName: data.sender_name,
      };
    } else {
      // Handle API-specific errors
      return {
        success: false,
        error: data.error || 'Failed to fetch user details.',
      };
    }
  } catch (error) {
    // Handle network or other unexpected errors
    console.error('Network or fetch error:', error);
    return {
      success: false,
      error: 'Failed to connect to the server. Please check your network.',
    };
  }
};

/**
 * Submits a bank transfer request to the API.
 * @param {object} transferData The transfer details including currency, amount, etc.
 * @returns {Promise<object>} The server's response to the transfer request.
 */
export const transferGeneral = async (transferData) => {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'transfer',
        ...transferData,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      return data;
    } else {
      // Return the error from the server even if the HTTP status is not 200
      return data;
    }
  } catch (error) {
    console.error('Network or transfer error:', error);
    return {
      server_response: {
        success: false,
        server_message: 'Failed to connect to the server. Please try again later.',
      },
    };
  }
};