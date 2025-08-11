// components/BankSearchDropdown.js
import React, { useState, useEffect, useCallback } from "react";
import {
    Modal,
    View,
    FlatList,
    TouchableOpacity,
    Text,
    ActivityIndicator,
    StyleSheet,
    TextInput,
    TouchableWithoutFeedback,
    SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
// Import your centralized storage service functions
// --- CHANGE THIS LINE ---
import { saveItem, getItem } from "../utils/StorageService"; // <-- Changed from "../util/StorageService"
// --- END CHANGE ---
import { fetchBankList } from "../utils/bankList_general"; // Ensure this path is correct

// Key for AsyncStorage
const MOST_SELECTED_BANKS_KEY = 'mostSelectedBanks';
const MAX_RECENT_BANKS = 3; // Number of most selected banks to display

// Define a color scheme consistent with other dark-themed components
const BankSearchColourScheme = {
    backgroundOverlay: 'rgba(0, 0, 0, 0.7)', // Darker overlay
    backgroundModal: '#0A0A2A', // Deep Dark Navy Blue (from Transfer.js card)
    backgroundInput: '#2A2A4A', // Input background (from Transfer.js)
    borderInput: '#4A5568', // Input border (from PinVerifyPopup.js)
    textPrimary: '#FFFFFF', // Bright white text
    textSecondary: '#A0AEC0', // Lighter grey text (from PinVerifyPopup.js)
    textPlaceholder: '#6B7280', // Placeholder text
    textError: '#EF4444', // Error text (from TransactionResultModal.js / PinVerifyPopup.js)
    accent: '#2196F3', // Accent color (from TransactionResultModal.js)
    highlight: '#1A2E4D', // Highlight/selection color (from PinVerifyPopup.js)
};

/**
 * A modal dropdown component for searching and selecting banks.
 *
 * @param {boolean} visible - Controls the visibility of the modal.
 * @param {string} query - The current search query string.
 * @param {function} setQuery - Function to update the search query.
 * @param {function} onSelect - Callback function called when a bank is selected.
 * It receives an object like { code, name, bank_code, bank_name }.
 * @param {function} onClose - Callback function called when the modal should be closed.
 * @param {number} [minLength=3] - Minimum number of characters required before fetching/searching.
 */
export default function BankSearchDropdown({
    visible,
    query = "",
    setQuery,
    onSelect,
    onClose,
    minLength = 3,
}) {
    const [banks, setBanks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [mostSelectedBanks, setMostSelectedBanks] = useState([]); // New state for most selected banks

    // Function to load most selected banks using StorageService
    const loadMostSelectedBanks = useCallback(async () => {
        try {
            const storedBanks = await getItem(MOST_SELECTED_BANKS_KEY);
            if (storedBanks != null) {
                setMostSelectedBanks(storedBanks);
            } else {
                setMostSelectedBanks([]); // Ensure it's an empty array if nothing is stored
            }
        } catch (e) {
            console.error("Error loading most selected banks:", e);
            // Optionally set an error state here if you want to display it
        }
    }, []);

    // Function to save most selected banks using StorageService
    const saveMostSelectedBanks = useCallback(async (selectedBank) => {
        setMostSelectedBanks(prevBanks => {
            // Remove the selected bank if it already exists to move it to the front
            const updatedBanks = prevBanks.filter(
                (b) => b.bankCode !== selectedBank.bankCode
            );
            // Add the new bank to the front
            updatedBanks.unshift(selectedBank);
            // Trim the array to MAX_RECENT_BANKS
            const finalBanks = updatedBanks.slice(0, MAX_RECENT_BANKS);
            try {
                // Use saveItem from StorageService
                saveItem(MOST_SELECTED_BANKS_KEY, finalBanks);
            } catch (e) {
                console.error("Error saving most selected banks:", e);
                // Optionally set an error state here if you want to display it
            }
            return finalBanks;
        });
    }, []);

    useEffect(() => {
        let active = true;
        if (!visible) {
            // Reset state when modal is not visible
            setBanks([]);
            setLoading(false);
            setError("");
            setQuery(""); // Clear query when modal closes for a clean start next time
            return;
        }
        // Load most selected banks when modal becomes visible and query is empty
        if (visible && !query) {
            loadMostSelectedBanks();
            setBanks([]); // Clear search results if query is empty
        }
        if (!query || query.length < minLength) {
            // If query is too short or empty, don't fetch from API
            setBanks([]);
            setLoading(false);
            // Only set error if query is not empty but too short
            setError(query.length > 0 ? `Type at least ${minLength} characters` : "");
            return;
        }
        const fetchBanks = async () => {
            setLoading(true);
            setError("");
            try {
                const { banks: fetchedBanks, error: fetchError } = await fetchBankList(query, 100);
                if (!active) return; // Prevent state update if component unmounted
                if (fetchError) {
                    setBanks([]);
                    setError(fetchError);
                } else {
                    const mappedBanks = (fetchedBanks || []).map((b) => ({
                        bankCode: b.bankCode || b.code || b.nibssBankCode || "",
                        bankName: b.bankName || b.name || "",
                    }));
                    setBanks(mappedBanks);
                    setError(mappedBanks.length === 0 ? "No banks found matching your search" : "");
                }
            } catch (err) {
                console.error("BankSearchDropdown: Error fetching banks:", err);
                if (active) {
                    setBanks([]);
                    setError("Failed to fetch banks. Please try again.");
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };
        const debounceTimeout = setTimeout(() => {
            fetchBanks();
        }, 300); // Debounce search to avoid excessive API calls
        return () => {
            active = false;
            clearTimeout(debounceTimeout); // Clear timeout on cleanup
        };
    }, [query, visible, minLength, loadMostSelectedBanks, setQuery]); // Added setQuery to dependencies

    const handleSearchChange = (text) => {
        setQuery(text);
        // Clear errors/results immediately when typing starts
        setError("");
        setBanks([]);
    };

    const handleSelect = (bankCode, bankName) => {
        const selectedBank = { bankCode, bankName };
        saveMostSelectedBanks(selectedBank); // Save the selected bank using the service
        onSelect({ code: bankCode, name: bankName, bank_code: bankCode, bank_name: bankName });
        onClose(); // Close the modal after selection
    };

    const handleClosePress = () => {
        console.log("BankSearchDropdown: Close button pressed. Calling onClose.");
        onClose();
    };

    const renderBankItem = ({ item }) => (
        <TouchableOpacity
            style={[styles.bankOption, { backgroundColor: BankSearchColourScheme.backgroundModal }]}
            onPress={() => handleSelect(item.bankCode, item.bankName)}
            activeOpacity={0.7} // Add visual feedback on press
        >
            <Text style={[styles.bankName, { color: BankSearchColourScheme.textPrimary }]}>{item.bankName}</Text>
        </TouchableOpacity>
    );

    // --- Updated render for Recent Banks ---
    const renderRecentBankItem = ({ item }) => (
         <TouchableOpacity
            style={[styles.bankOption, { backgroundColor: BankSearchColourScheme.backgroundModal }]}
            onPress={() => handleSelect(item.bankCode, item.bankName)}
            activeOpacity={0.7} // Add visual feedback on press
        >
            <Text style={[styles.bankName, { color: BankSearchColourScheme.textPrimary }]}>{item.bankName}</Text>
        </TouchableOpacity>
    );
    // --- End Update ---

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                {/* --- Changed overlay background color --- */}
                <View style={[styles.overlay, { backgroundColor: BankSearchColourScheme.backgroundOverlay }]}>
                {/* --- End Change --- */}
                    <TouchableWithoutFeedback>
                        {/* --- Changed container background color --- */}
                        <View style={[styles.container, { backgroundColor: BankSearchColourScheme.backgroundModal }]}>
                        {/* --- End Change --- */}
                            <SafeAreaView style={styles.safeAreaContent}>
                                <View style={styles.topBar}>
                                    {/* --- Changed title text color --- */}
                                    <Text style={[styles.topBarTitle, { color: BankSearchColourScheme.textPrimary }]}>Select Bank</Text>
                                    {/* --- End Change --- */}
                                    <TouchableOpacity onPress={handleClosePress} style={styles.closeButton} accessibilityLabel="Close bank selection">
                                        {/* --- Changed close icon color --- */}
                                        <Icon name="close" size={24} color={BankSearchColourScheme.accent} />
                                        {/* --- End Change --- */}
                                    </TouchableOpacity>
                                </View>
                                {/* --- Changed input styles --- */}
                                <TextInput
                                    style={[
                                        styles.input,
                                        {
                                            backgroundColor: BankSearchColourScheme.backgroundInput,
                                            borderColor: BankSearchColourScheme.borderInput,
                                            color: BankSearchColourScheme.textPrimary,
                                            placeholderTextColor: BankSearchColourScheme.textPlaceholder,
                                        }
                                    ]}
                                    placeholder={`Type bank name (min ${minLength} chars)`}
                                    value={query}
                                    onChangeText={handleSearchChange}
                                    autoFocus
                                    autoCapitalize="words"
                                    returnKeyType="search"
                                    clearButtonMode="while-editing"
                                    placeholderTextColor={BankSearchColourScheme.textPlaceholder} // Explicitly set placeholder color
                                />
                                {/* --- End Change --- */}
                                {/* Display Most Selected Banks when query is empty */}
                                {!query && mostSelectedBanks.length > 0 && (
                                    <View style={styles.recentBanksContainer}>
                                        {/* --- Changed header text color --- */}
                                        <Text style={[styles.recentBanksHeader, { color: BankSearchColourScheme.textSecondary }]}>Recently Selected Banks</Text>
                                        {/* --- End Change --- */}
                                        {/* --- Updated FlatList for recent banks --- */}
                                        <FlatList
                                            data={mostSelectedBanks}
                                            keyExtractor={(item, index) => item.bankCode?.toString() || `recent-${index}`}
                                            renderItem={renderRecentBankItem} // Use the new render function
                                            scrollEnabled={false} // Disable scrolling for recent banks section if it fits
                                            contentContainerStyle={styles.listContentContainer}
                                        />
                                        {/* --- End Update --- */}
                                    </View>
                                )}
                                {/* Content Area: Loading, Error, List */}
                                {loading ? (
                                    <View style={styles.loadingContainer}>
                                        {/* --- Changed activity indicator color --- */}
                                        <ActivityIndicator size="large" color={BankSearchColourScheme.accent} />
                                        {/* --- End Change --- */}
                                        {/* --- Changed loading text color --- */}
                                        <Text style={[styles.loadingText, { color: BankSearchColourScheme.textSecondary }]}>Searching banks...</Text>
                                        {/* --- End Change --- */}
                                    </View>
                                ) : error ? (
                                    /* --- Changed error text color --- */
                                    <Text style={[styles.errorText, { color: BankSearchColourScheme.textError }]}>{error}</Text>
                                    /* --- End Change --- */
                                ) : (
                                    <FlatList
                                        data={banks}
                                        keyExtractor={(item, index) => item.bankCode?.toString() || index.toString()}
                                        renderItem={renderBankItem}
                                        ListEmptyComponent={
                                            query.length >= minLength ? ( // Only show "No banks found" if query is long enough
                                                /* --- Changed empty text color --- */
                                                <Text style={[styles.emptyText, { color: BankSearchColourScheme.textSecondary }]}>
                                                    No banks found matching your search.
                                                </Text>
                                                /* --- End Change --- */
                                            ) : null // Don't show anything if query is too short or empty for search results list
                                        }
                                        keyboardShouldPersistTaps="always"
                                        style={styles.list}
                                        contentContainerStyle={styles.listContentContainer}
                                    />
                                )}
                                {/* Display specific message if query is too short and no recent banks are shown */}
                                {!query && !loading && mostSelectedBanks.length === 0 && (
                                    /* --- Changed empty text color --- */
                                    <Text style={[styles.emptyText, { color: BankSearchColourScheme.textSecondary }]}>
                                        Start typing to search for a bank.
                                    </Text>
                                    /* --- End Change --- */
                                )}
                            </SafeAreaView>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        // backgroundColor moved to inline style with BankSearchColourScheme
        justifyContent: "center",
        alignItems: "center",
        // elevation: 20, // Can be kept or adjusted if needed
    },
    container: {
        // backgroundColor moved to inline style with BankSearchColourScheme
        padding: 20,
        borderRadius: 10,
        minWidth: "80%",
        maxHeight: '80%',
        // shadowColor: "#000", // Can be kept or adjusted if needed
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        // elevation moved to overlay or kept here if preferred
    },
    safeAreaContent: {
        flex: 1,
    },
    topBar: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 15,
    },
    topBarTitle: {
        fontSize: 18,
        fontWeight: "bold",
        // color moved to inline style with BankSearchColourScheme
    },
    closeButton: {
        padding: 5,
    },
    input: {
        // borderWidth: 1, // Border width kept
        // borderColor moved to inline style
        borderRadius: 8,
        padding: 12,
        marginTop: 10,
        marginBottom: 15,
        width: "100%",
        // color moved to inline style
        // backgroundColor moved to inline style
        // placeholderTextColor moved to inline style
    },
    loadingContainer: {
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 20,
    },
    loadingText: {
        marginTop: 8,
        fontSize: 14,
        // color moved to inline style
    },
    errorText: {
        fontSize: 14,
        // color moved to inline style
        textAlign: "center",
        paddingVertical: 15,
    },
    bankOption: {
        padding: 12, // Slightly increased padding
        // borderBottomWidth: 1,
        // borderBottomColor: "#eee", // Removed light border
        borderBottomWidth: StyleSheet.hairlineWidth, // Use hairline for subtle dark border
        borderBottomColor: BankSearchColourScheme.borderInput, // Use defined border color
        // backgroundColor moved to inline style
    },
    bankName: {
        fontSize: 16,
        // color moved to inline style
    },
    list: {
        flexGrow: 1,
        maxHeight: 250, // This height will now be for search results
    },
    listContentContainer: {
        paddingHorizontal: 5, // Reduced padding
        paddingBottom: 10,
    },
    emptyText: {
        fontSize: 14,
        // color moved to inline style
        textAlign: "center",
        paddingVertical: 20,
    },
    // New styles for recent banks
    recentBanksContainer: {
        marginBottom: 15,
        // borderBottomWidth: 1, // Removed solid line
        borderBottomWidth: StyleSheet.hairlineWidth, // Use hairline
        borderBottomColor: BankSearchColourScheme.borderInput, // Use defined border color
        paddingBottom: 10,
    },
    recentBanksHeader: {
        fontSize: 15,
        fontWeight: 'bold',
        // color moved to inline style
        marginBottom: 10,
        textAlign: 'left',
    },
});
