// Utility to call your BudPay PHP transfer API from React Native

const API_URL = "https://techvibs.com/budpay/budpay_bank_transfer_api.php"; // <-- use HTTPS

/**
 * Initiate a payout using your PHP backend (which calls BudPay API under the hood).
 * @param {{
 *   currency: string,
 *   amount: string|number,
 *   bank_code: string,
 *   bank_name: string,
 *   account_number: string,
 *   narration: string,
 *   paymentMode?: string,
 *   meta_data?: object[],
 *   reference?: string
 * }} params
 * @returns {Promise<object>} Response from your backend (and BudPay)
 */
export async function initiateBudPayTransfer(params) {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
        // No need for auth headers here; your PHP backend handles BudPay security
      },
      body: JSON.stringify(params)
    });
    const data = await res.json();
    return data;
  } catch (e) {
    return { success: false, error: e.message || "Network error" };
  }
}