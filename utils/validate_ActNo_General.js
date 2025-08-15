// utils/validate_ActNo_General.js

/**
 * Validate bank account number via your secure backend API.
 * This now calls your PHP endpoint which handles the actual validation with BudPay.
 * * @param {Object} params
 * @param {string} params.bank_code
 * @param {string} params.account_number
 * @param {string} [params.currency='NGN']
 * @returns {Promise<{success: boolean, account_name?: string, error?: string}>}
 */
const API_URL = "https://techvibs.com/budpay/account_validation_bud_api.php";

export async function validateBudPayAccount({ bank_code, account_number, currency = 'NGN' }) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Authorization is now handled by your backend's session/cookies
      },
      body: JSON.stringify({
        bank_code,
        account_number,
        currency
      })
    });

    const data = await response.json();

    if (!response.ok) {
      // Handles HTTP errors (e.g., 400, 500 status codes)
      return {
        success: false,
        error: data.message || "Validation request failed with non-OK HTTP status"
      };
    }

    if (data.success) {
      // Assumes 'data.success' is true for successful validation
      // and 'data.data' contains the account name
      return {
        success: true,
        account_name: data.data // Matches your API's response structure (data.data for the account name)
      };
    } else {
      // Handles API-specific errors where 'data.success' is false
      return {
        success: false,
        error: data.message || "Account validation failed"
      };
    }
  } catch (error) {
    // Catches network errors or issues with JSON parsing
    return {
      success: false,
      error: error.message || "Network error during validation"
    };
  }
}
