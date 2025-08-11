// utils/bankList_general.js
// Utility functions for fetching bank list from local API (robust to all response shapes)

const BANK_LIST_API_URL = 'https://techvibs.com/bank/api_general/bankList_general_local_db_api.php';

/**
 * Fetches the bank list.
 * @param {string} [query] - Optional search query (bank name or code)
 * @param {number} [limit=100] - Maximum number of results to return
 * @returns {Promise<{banks: Array, error: string|null}>}
 */
export async function fetchBankList(query = '', limit = 100) {
  try {
    // Only search if at least 3 characters are provided
    if (query && query.length > 0 && query.length < 3) {
      return { banks: [], error: null };
    }
    const body = { query, limit };
    const res = await fetch(BANK_LIST_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      return { banks: [], error: 'Response is not valid JSON' };
    }
    // Accept nested .data.banks (new), .data (array, legacy), or .banks (fallback)
    let banks = [];
    if (data.success) {
      if (data.data && Array.isArray(data.data.banks)) {
        banks = data.data.banks;
      } else if (Array.isArray(data.data)) {
        banks = data.data;
      } else if (Array.isArray(data.banks)) {
        banks = data.banks;
      }
    }
    if (banks.length > 0) {
      return { banks, error: null };
    }
    return { banks: [], error: data.error || 'No banks found' };
  } catch (err) {
    return { banks: [], error: err.message || 'Network error' };
  }
}

/**
 * Fetch a single bank by code
 * @param {string} bankCode
 * @returns {Promise<{bank: Object|null, error: string|null}>}
 */
export async function fetchBankByCode(bankCode) {
  if (!bankCode) return { bank: null, error: 'No bank code provided' };
  const { banks, error } = await fetchBankList(bankCode, 1);
  if (error || !banks.length) return { bank: null, error: error || 'Bank not found' };
  return { bank: banks[0], error: null };
}