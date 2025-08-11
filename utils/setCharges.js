/**
 * Fetch charge for an amount and main_type using the new dedicated API endpoint.
 * @param {Object} params
 * @param {string|number} params.amount - The amount to check charges for.
 * @param {string} [params.main_type] - The main type (e.g. "Payout", "Transfer-In"). Optional.
 * @returns {Promise<string>} Returns the charge as a string (e.g. "120.00"), or "0.00" if not found or on error.
 */
export async function setCharges({ amount, main_type = "Payout" }) {
  try {
    // Prepare the data object to be sent as JSON
    const requestData = {
      amount: amount,
      main_type: main_type
    };

    // Make the API call to the new dedicated endpoint
    const response = await fetch(
      "https://techvibs.com/bank/api_general/charges_and_bal_manager_api.php",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json", // Important: Changed to JSON
        },
        body: JSON.stringify(requestData), // Important: Stringify the object
      }
    );

    // Check if the response is ok (status 200-299)
    if (!response.ok) {
       // Try to parse error JSON if available, otherwise use status text
       let errorMessage = `HTTP error! status: ${response.status}`;
       try {
         const errorData = await response.json();
         errorMessage = errorData.error || errorData.message || errorMessage;
       } catch (e) {
         // Ignore JSON parse error for error message
       }
       console.error("setCharges API Error:", errorMessage);
       return "0.00";
    }

    // Parse the JSON response
    const data = await response.json();

    // Check if the response contains the 'charge' field
    if (data && typeof data.charge !== "undefined") {
      // Return the charge, defaulting to "0.00" if it's an empty string or null-like
      return data.charge === "" || data.charge === null ? "0.00" : String(data.charge);
    } else if (data && data.error) {
       // Log API-specific errors returned in the response body
       console.error("setCharges API Response Error:", data.error, data.message || "");
       return "0.00";
    }

    // If 'charge' field is missing unexpectedly
    console.warn("setCharges: Unexpected API response format:", data);
    return "0.00";
  } catch (error) {
    // Handle network errors, JSON parse errors, etc.
    console.error("Error in setCharges utility function:", error);
    return "0.00";
  }
}