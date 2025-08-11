/**
 * shopApi.js
 *
 * This utility file provides a centralized point of interaction with the
 * retail store's product and sales API endpoints. It ensures consistent
 * naming, error handling, and data structures across all API calls.
 */

// Define the base URL for your API.
// Ensure this matches the actual URL where your api.php file is hosted.
const API_BASE_URL = 'https://techvibs.com/retail/all_retail_table_api.php';

/**
 * Helper function to handle API responses.
 * @param {Response} response The fetch API response object.
 * @returns {Promise<Object>} The JSON data from the response.
 * @throws {Error} If the response indicates an error.
 */
async function handleApiResponse(response) {
    const data = await response.json();
    if (!response.ok) {
        // If the HTTP status code is not 2xx, throw an error
        const errorMessage = data.message || `API Error: ${response.status} ${response.statusText}`;
        throw new Error(errorMessage);
    }
    return data;
}

// --- Product Functions ---

/**
 * Fetches all active products from the API.
 * @returns {Promise<Array>} An array of product objects.
 * @throws {Error} If the API call fails.
 */
export async function getAllProducts() {
    try {
        const response = await fetch(`${API_BASE_URL}?resource=products`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        const result = await handleApiResponse(response);
        return result.data; // The actual product array is in the 'data' key
    } catch (error) {
        console.error('Error fetching products:', error.message);
        throw error;
    }
}

// --- Sale Functions ---

/**
 * Records a new sale transaction.
 * @param {Object} saleData - The sale transaction data.
 * @param {string} saleData.customerName - Customer's name.
 * @param {string} saleData.customerPhone - Customer's phone number.
 * @param {string} saleData.paymentMethod - Payment method (cash, transfer, etc.).
 * @param {number} saleData.totalAmount - Total amount of the sale.
 * @param {Object} saleData.discount - Discount information.
 * @param {number} saleData.discount.value - Discount value.
 * @param {string} saleData.discount.type - Discount type (amount/percentage).
 * @param {Array} saleData.items - Array of items purchased.
 * @returns {Promise<Object>} The API response, including a success status and message.
 */
export async function recordSale(saleData) {
    try {
        const response = await fetch(`${API_BASE_URL}?resource=sales`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'create_sale',
                customer_name: saleData.customerName,
                customer_phone: saleData.customerPhone,
                payment_method: saleData.paymentMethod,
                total_amount: saleData.totalAmount,
                discount_value: saleData.discount.value,
                discount_type: saleData.discount.type,
                // The API expects the items array directly from the saleData
                items: saleData.items,
                // IMPORTANT: You should get the actual agentId from your authentication context
                agent_id: saleData.agentId || 'current_user',
                sale_date: new Date().toISOString()
            })
        });

        const result = await handleApiResponse(response);
        
        if (result.success) {
            return {
                success: true,
                saleId: result.sale_id, // or whatever field your API returns for the new sale ID
                message: result.message || 'Sale recorded successfully'
            };
        } else {
            throw new Error(result.message || 'Failed to record sale');
        }
    } catch (error) {
        console.error('Error recording sale:', error.message);
        throw error;
    }
}
