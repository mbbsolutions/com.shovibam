// utils/historyTable_gen_local.js

// API endpoints (use your actual URLs)
const HISTORY_GENERAL_API_URL = 'https://techvibs.com/bank/api_general/access_history_general_local_api.php';
const FETCH_ACCOUNTS_BY_TECHVIBES_ID_API_URL = 'https://techvibs.com/bank/api_general/fetch_accounts_by_techvibes_id.php';

// Helper functions (keep your existing implementations)
function processTransactionsForFeesAndCharges(transactions) {
    // Your existing implementation - Assuming this processes, but doesn't sort or limit
    // For demonstration, let's assume it just returns the input if no specific logic is provided.
    // Replace with your actual logic if different.
    console.log("Processing transactions for fees and charges...");
    return transactions;
}

function sortHistoryByDateDesc(transactions) {
    // THIS FUNCTION IS NO LONGER CALLED IN fetchHistoryGeneral
    // It remains here if other parts of your application might use it.
    // If not, you can remove this function entirely.
    console.log("Sorting history by date (this should not be called by fetchHistoryGeneral now)");
    // Example of its previous logic (for reference, if you keep it)
    if (!transactions || transactions.length === 0) {
        return [];
    }
    const sorted = [...transactions].sort((a, b) => {
        const dateA = new Date(a.transactionDate);
        const dateB = new Date(b.transactionDate);
        const timeA = isNaN(dateA.getTime()) ? 0 : dateA.getTime();
        const timeB = isNaN(dateB.getTime()) ? 0 : dateB.getTime();
        return timeB - timeA; // Descending order
    });
    return sorted;
}

function addBalanceField(transactions) {
    // Your existing implementation - Assuming this adds balances, but doesn't sort or limit
    // For demonstration, let's assume it just returns the input if no specific logic is provided.
    // Replace with your actual logic if different.
    console.log("Adding balance field to transactions...");
    return transactions;
}

export async function fetchHistoryGeneral(opts = {}) {
    try {
        const { customerId, accountNo, limit = 10, offset = 0 } = opts; // 'limit' and 'offset' are passed to API
        
        // Enhanced debug logging
        console.log("Fetching transactions for:", {
            customerId: customerId ? `${customerId.substring(0, 6)}...` : 'none',
            accountNo: accountNo || 'none',
            limit, // Log the limit being sent to the API
            offset
        });

        const body = {
            limit, // Pass the limit directly to the API
            offset,
            ...(customerId && { customer_id: customerId }),
            ...(accountNo && { account_number: accountNo }),
            _cache: Date.now() // Cache buster
        };

        console.log("Request payload:", body);
        const response = await fetch(HISTORY_GENERAL_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        // Handle non-JSON responses
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const errorText = await response.text();
            console.error("Non-JSON response:", errorText);
            throw new Error(`API returned non-JSON: ${errorText.substring(0, 100)}`);
        }

        const data = await response.json();
        console.log("API response:", {
            status: data.status,
            dataLength: Array.isArray(data.data) ? data.data.length : data.data ? 1 : 0,
            balance: data.current_balance
        });

        // Process transactions
        let transactions = [];
        if (data.data) {
            transactions = Array.isArray(data.data) ? data.data : [data.data];
        }

        const processed = processTransactionsForFeesAndCharges(transactions);
        // REMOVED: const sorted = sortHistoryByDateDesc(processed);
        const withBalances = addBalanceField(processed); // Now calls addBalanceField on 'processed' directly

        return {
            transactions: withBalances, // Return transactions as received from API, after initial processing and balance adding
            success: data.status === 'success',
            current_balance: data.current_balance,
            error: data.status !== 'success' ? (data.message || 'No transactions found') : null
        };

    } catch (error) {
        console.error("Fetch error in fetchHistoryGeneral:", error); // Specific error message
        return {
            transactions: [],
            success: false,
            current_balance: null, // Ensure balance is null on error
            error: error.message || 'Failed to fetch transactions',
            errorDetail: {
                message: error.message,
                stack: error.stack,
                // Consider adding response.status if you have it
            }
        };
    }
}

// Keep your existing fetchLatestBalance implementation
export async function fetchLatestBalance(opts = {}) {
    try {
        const result = await fetchHistoryGeneral({
            customerId: opts.customerId,
            accountNo: opts.accountNo,
            limit: 1 // This will still request 1 transaction from the API
        });

        return {
            balance: result.current_balance,
            success: result.success,
            error: result.error
        };
    } catch (error) {
        console.error("Balance fetch error:", error);
        return {
            balance: null,
            success: false,
            error: error.message || 'Failed to fetch balance'
        };
    }
}

// Keep your existing fetchAccountsByTechvibesId implementation
export async function fetchAccountsByTechvibesId(techvibesId) {
    // Your existing implementation
    // For demonstration:
    console.log(`Fetching accounts for Techvibes ID: ${techvibesId}`);
    try {
        const response = await fetch(FETCH_ACCOUNTS_BY_TECHVIBES_ID_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ techvibes_id: techvibesId })
        });
        const data = await response.json();
        if (data.status === 'success') {
            return { success: true, accounts: data.accounts || [] };
        } else {
            return { success: false, error: data.message || 'Failed to fetch accounts' };
        }
    } catch (error) {
        console.error("Error fetching accounts by Techvibes ID:", error);
        return { success: false, error: error.message || 'Network error fetching accounts' };
    }
}

// Keep your existing fetchHistoryByTechvibesId implementation
export async function fetchHistoryByTechvibesId(opts = {}) {
    // Your existing implementation
    // This function seems to be a wrapper around fetchHistoryGeneral
    // It should also pass the limit to fetchHistoryGeneral if it's meant to be limited by API
    console.log(`Fetching history by Techvibes ID for customer: ${opts.customerId} and account: ${opts.accountNo}`);
    return await fetchHistoryGeneral({
        customerId: opts.customerId,
        accountNo: opts.accountNo,
        limit: opts.limit, // Ensure limit is passed through if this is used
        offset: opts.offset
    });
}