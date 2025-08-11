// utils/validate_ActNo_General.js

/**
 * Validate BudPay Account Number via your backend PHP API.
 * Calls your PHP endpoint which talks to BudPay's account verification API.
 * 
 * @param {Object} params
 * @param {string} params.bank_code
 * @param {string} params.account_number
 * @param {string} [params.currency='NGN']
 * @returns {Promise<{success: boolean, account_name?: string, error?: string}>}
 */
const API_URL = "https://techvibs.com/budpay/account_validation_bud_api.php";
const API_SECRET_KEY = "sk_live_ibdvzl1gcdc8qxzsfb15lwhvyr9yzavmnjtmr1o"; // In production, store securely

export async function validateBudPayAccount({ bank_code, account_number, currency = 'NGN' }) {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_SECRET_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        bank_code,
        account_number,
        currency
      })
    });
    const data = await res.json();
    if (data.success && typeof data.data === "string") {
      return { success: true, account_name: data.data };
    } else {
      return { success: false, error: data.message || "Unknown error" };
    }
  } catch (e) {
    return { success: false, error: e.message || "Network error" };
  }
}