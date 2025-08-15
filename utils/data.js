import { Platform, Alert } from 'react-native'; // Import Platform and Alert

const BASE_URL = 'https://techvibs.com/bank/api_general/data_general_api.php';

// Android-specific timeout settings
const ANDROID_TIMEOUT = 15000; // 15 seconds for Android
const DEFAULT_TIMEOUT = 8000; // 8 seconds for other platforms

/**
 * Enhanced fetch wrapper with timeout and Android-specific handling
 * @param {string} url The URL to fetch.
 * @param {object} options Fetch options (method, headers, body, etc.).
 * @returns {Promise<Response>} A promise that resolves to the fetch Response object.
 */
async function enhancedFetch(url, options = {}) {
  const controller = new AbortController();
  const timeout = Platform.OS === 'android' ? ANDROID_TIMEOUT : DEFAULT_TIMEOUT;
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    // Add Android-specific headers if needed for debugging or specific server handling
    const headers = {
      'Content-Type': 'application/json',
      ...(Platform.OS === 'android' && { 
        'X-Platform': 'Android-Emulator', // Custom header for server-side debugging
        'Cache-Control': 'no-cache'       // Prevent caching on Android emulator during dev
      }),
      ...(options.headers || {})
    };

    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal // Link AbortController to fetch request
    });

    clearTimeout(timeoutId); // Clear timeout if fetch completes before timeout

    if (!response.ok) {
      // Throw an error if HTTP status is not 2xx
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response;

  } catch (error) {
    clearTimeout(timeoutId); // Ensure timeout is cleared on error too
    
    // Enhanced Android error messages for better debugging
    if (Platform.OS === 'android') {
      if (error.name === 'AbortError') {
        // Specific message for timeout
        throw new Error(`Android emulator request timeout (${timeout}ms). Check your network connection and API endpoint accessibility.`);
      }
      // General network error for Android
      throw new Error(`Android network error: ${error.message}. Ensure your emulator has internet access.`);
    }
    // Re-throw original error for other platforms
    throw error;
  }
}

/**
 * Fetches the list of internet providers from the API.
 * @returns {Promise<object>} A promise that resolves to the API response.
 */
export async function fetchProviders() {
  const url = `${BASE_URL}?action=/internet/providers`;
  
  try {
    const response = await enhancedFetch(url);
    const data = await response.json();
    
    // Log response on Android emulator for debugging
    if (__DEV__ && Platform.OS === 'android') {
      console.log('Android emulator - providers response:', data);
    }
    
    return data;
    
  } catch (error) {
    console.error("Error fetching providers:", error);
    
    // Provide fallback data in development for Android emulator
    if (__DEV__ && Platform.OS === 'android') {
      console.warn('Using fallback providers data for Android emulator');
      return {
        status: 'success',
        data: [
          { provider: 'AIRTEL', name: 'Airtel Nigeria' },
          { provider: 'MTN', name: 'MTN Nigeria' },
          { provider: 'GLO', name: 'Glo Mobile' },
          { provider: '9MOBILE', name: '9Mobile' },
          { provider: 'SMILE4G', name: 'Smile 4G LTE' },
          { provider: 'SPECTRANET', name: 'Spectranet' }
        ]
      };
    }
    
    return { 
      status: 'error', 
      message: 'Failed to fetch providers.', 
      error: error.message 
    };
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
    const response = await enhancedFetch(url);
    const data = await response.json();
    
    if (data.data && Array.isArray(data.data)) {
      data.data.sort((a, b) => a.amount - b.amount); // Sort plans by amount
    }
    
    // Log response on Android emulator for debugging
    if (__DEV__ && Platform.OS === 'android') {
      console.log(`Android emulator - plans for ${provider}:`, data);
    }
    
    return data;
    
  } catch (error) {
    console.error(`Error fetching plans for ${provider}:`, error);
    
    // Provide fallback data in development for Android emulator
    if (__DEV__ && Platform.OS === 'android') {
      console.warn(`Using fallback plans data for ${provider} on Android emulator`);
      return {
        status: 'success',
        data: generateFallbackPlans(provider) // Use helper to generate specific fallback plans
      };
    }
    
    return { 
      status: 'error', 
      message: 'Failed to fetch data plans.', 
      error: error.message 
    };
  }
}

/**
 * Generates fallback data plans for Android emulator testing
 * @param {string} provider The name of the provider.
 * @returns {Array<object>} An array of mock data plans.
 */
function generateFallbackPlans(provider) {
  const basePlans = [
    { id: `${provider}-1gb`, name: `1GB Daily`, amount: 500, description: `Valid for 1 Day` },
    { id: `${provider}-2gb`, name: `2GB Weekly`, amount: 1000, description: `Valid for 7 Days` },
    { id: `${provider}-5gb`, name: `5GB Monthly`, amount: 2000, description: `Valid for 30 Days` },
    { id: `${provider}-10gb`, name: `10GB Monthly`, amount: 3500, description: `Valid for 30 Days` }
  ];
  
  return basePlans.map(plan => ({
    ...plan,
    // Prepend provider name to plan name and update description for clarity
    name: `${provider} ${plan.name}`, 
    description: `Fallback data for ${provider} - ${plan.description}` 
  }));
}

/**
 * Submits a data plan purchase request.
 * @param {object} purchaseData An object with provider, number, plan_id, and reference.
 * @returns {Promise<object>} A promise that resolves to the purchase response from the API.
 */
export async function purchaseDataPlan(purchaseData) {
  const url = `${BASE_URL}?action=/internet/purchase`;
  try {
    // Using enhancedFetch for consistent behavior, including timeouts and Android headers
    const response = await enhancedFetch(url, {
      method: 'POST',
      body: JSON.stringify(purchaseData),
    });

    // We check response.ok within enhancedFetch, so if we reach here, response is OK.
    const result = await response.json();
    
    // Define an array of keywords to look for in the message
    const insufficientPhrases = [
      'insufficient',
      'balance',
      'topup',
      'wallet',
      'low balance',
      'not enough',
      'fund',
      'recharge'
    ];

    // Convert message to lowercase for case-insensitive matching
    const lowerMessage = result.message ? result.message.toLowerCase() : '';
    
    let isInsufficient = false;
    for (const phrase of insufficientPhrrases) {
      if (lowerMessage.includes(phrase)) {
        isInsufficient = true;
        break;
      }
    }

    // Handle insufficient balance response
    if (isInsufficient) {
      return {
        ...result, // Keep other original properties from the response
        message: 'ISB, Please Reachout to us for assistance', // Standardized message
        code: 'INSUFFICIENT_FUNDS' // Custom error code
      };
    }
    
    return result; // Return the original result if no insufficient balance issue
    
  } catch (error) {
    console.error("Error purchasing data plan:", error);
    // Return a structured error response
    return { 
      status: 'error', 
      message: error.message || 'Failed to complete purchase due to network or API error.', 
      error: error.message 
    };
  }
}
