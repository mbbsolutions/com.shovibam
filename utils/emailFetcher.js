// utils/EmailFetcher.js
// Utility for fetching email based on username or account number.

const EMAIL_FETCHER_API_URL = "https://techvibs.com/bank/api_general/email_fetcher_api.php";

/**
 * Fetches an email address associated with a given identifier (username or account number).
 *
 * @param {string} identifier - The username or account number to look up.
 * @returns {Promise<{success: boolean, email?: string, message: string}>}
 * A promise that resolves to an object indicating success, the fetched email (if successful),
 * and a message.
 */
export async function fetchEmailByIdentifier(identifier) {
  if (!identifier || typeof identifier !== 'string' || identifier.trim().length < 3) {
    return { success: false, message: 'Identifier must be a string of at least 3 characters.' };
  }

  const trimmedIdentifier = identifier.trim();

  try {
    const response = await fetch(`${EMAIL_FETCHER_API_URL}?identifier=${encodeURIComponent(trimmedIdentifier)}`);

    if (!response.ok) {
      // Handle HTTP errors (e.g., 404, 500)
      const errorText = await response.text(); // Get raw error response
      console.error(`HTTP error! Status: ${response.status}, Response: ${errorText}`);
      return { success: false, message: `Server error: ${response.statusText}` };
    }

    const data = await response.json();

    // Assuming the API returns a structure like { success: boolean, email?: string, message: string }
    if (data.success) {
      return { success: true, email: data.email, message: data.message || 'Email found.' };
    } else {
      return { success: false, message: data.message || 'No email found for this identifier.' };
    }
  } catch (error) {
    console.error('Network or parsing error fetching email:', error);
    return { success: false, message: `Network error: ${error.message || 'Failed to connect to email lookup service.'}` };
  }
}
