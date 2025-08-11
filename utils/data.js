const BASE_URL = 'https://techvibs.com/bank/api_general/data_general_api.php';

/**
 * Fetches the list of internet providers from the API.
 * @returns {Promise<object>} A promise that resolves to the API response.
 */
export async function fetchProviders() {
  const url = `${BASE_URL}?action=/internet/providers`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching providers:", error);
    return { status: 'error', message: 'Failed to fetch providers.', error: error.message };
  }
}

/**
 * Fetches data plans for a specific provider.
 * @param {string} provider The name of the provider.
 * @returns {Promise<object>} A promise that resolves to the API response containing sorted data plans.
 */
export async function fetchDataPlans(provider) {
  const url = `${BASE_URL}?action=/internet/plans&provider=${encodeURIComponent(provider)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    if (data.data && Array.isArray(data.data)) {
      data.data.sort((a, b) => a.amount - b.amount);
    }
    return data;
  } catch (error) {
    console.error(`Error fetching plans for ${provider}:`, error);
    return { status: 'error', message: 'Failed to fetch data plans.', error: error.message };
  }
}

/**
 * Submits a data plan purchase request.
 * @param {object} purchaseData An object with provider, number, plan_id, and reference.
 * @returns {Promise<object>} A promise that resolves to the purchase response from the API.
 */
export async function purchaseDataPlan(purchaseData) {
  const url = `${BASE_URL}?action=/internet/purchase`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(purchaseData),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error purchasing data plan:", error);
    return { status: 'error', message: 'Failed to complete purchase.', error: error.message };
  }
}