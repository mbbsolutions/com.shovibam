import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    RefreshControl,
    TouchableOpacity,
    Alert,
    Modal,
    ScrollView,
    Platform,
} from 'react-native';
import PropTypes from 'prop-types';
import { fetchHistoryGeneral } from '../utils/historyTable_gen_local';
import ColourScheme from '../styles/ColourSchemeStyles'; // Assuming this provides primary app colors
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

// --- Global Constants and Helpers ---

// Helper to format currency
const formatAmount = (value) => {
    if (typeof value === 'number' || (typeof value === 'string' && !isNaN(parseFloat(value)))) {
        const num = parseFloat(value);
        return num.toLocaleString('en-NG', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    }
    return value;
};

// Define alternating colors for transaction blocks - UPDATED FOR DARK THEME
const transactionColors = {
    primary: '#0A1128',       // Dark navy - background for even rows
    secondary: '#121212',     // Dark background - background for odd rows
    textPrimary: '#FFFFFF',   // White text for primary background
    textSecondary: '#B0B0B0', // Light gray text for secondary background
    feeBackgroundPrimary: 'rgba(76, 201, 240, 0.1)',  // Teal tint for fees on primary row
    feeBackgroundSecondary: 'rgba(76, 201, 240, 0.05)',// Lighter teal tint for fees on secondary row
    debit: '#FF6B6B',         // Soft red for debits
    credit: '#39FF14',        // Neon green for credits
};

// --- Font Styles (Moved outside StyleSheet.create for reusability) ---
// IMPORTANT: Ensure 'Inter-Regular', 'Inter-Medium', 'Inter-Bold' fonts are loaded in your app.
const textStyles = {
    regular: {
        fontFamily: 'Inter-Regular',
        fontSize: 14,
    },
    medium: {
        fontFamily: 'Inter-Medium',
        fontSize: 14,
    },
    bold: {
        fontFamily: 'Inter-Bold',
        fontSize: 16,
    },
    header: {
        fontFamily: 'Inter-Bold',
        fontSize: 18,
        letterSpacing: 0.5,
    },
};

// --- DashboardHistory Component ---
const DashboardHistory = ({ customerId, accountNumber, navigation }) => {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [errorDetail, setErrorDetail] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState(null);

    const flatListRef = useRef(null);
    const { selectedAccount } = useAuth(); // Get selectedAccount from AuthContext

    // Helper function to process and group transactions
    const processAndGroupTransactions = useCallback((data) => {
        if (!data || data.length === 0) {
            return [];
        }

        const mainTransactions = {};
        const fees = [];

        data.forEach(item => {
            const type = item.type?.toLowerCase() || item.transaction_type?.toLowerCase();
            if (type === 'dedicated_account' || type === 'payout') {
                const key = item.reference + (item.transactionDate || '') + (item.amount || '0') + item.debitCreditIndicator;
                if (!mainTransactions[key]) {
                    mainTransactions[key] = {
                        ...item,
                        id: item.id || key,
                        associatedFees: []
                    };
                }
            } else if (type === 'internalfees' || type === 'charges') { // Added 'charges' to fees
                fees.push(item);
            }
        });

        fees.forEach(fee => {
            let attached = false;
            for (const key in mainTransactions) {
                const mainTx = mainTransactions[key];
                // Check if fee matches a main transaction based on reference, date, and approximate amount
                if (fee.reference === mainTx.reference &&
                    new Date(fee.transactionDate).getTime() === new Date(mainTx.transactionDate).getTime() &&
                    Math.abs(parseFloat(fee.amount) - parseFloat(mainTx.amount)) < 0.01
                ) {
                    const alreadyHasFee = mainTx.associatedFees.some(
                        (existingFee) => existingFee.reference === fee.reference &&
                                         existingFee.transactionDate === fee.transactionDate &&
                                         existingFee.amount === fee.amount
                    );
                    if (!alreadyHasFee) {
                        mainTx.associatedFees.push(fee);
                        attached = true;
                        break;
                    }
                }
            }
        });

        const processedList = Object.values(mainTransactions).sort((a, b) => {
            const dateA = new Date(a.transactionDate);
            const dateB = new Date(b.transactionDate);
            const timeA = isNaN(dateA.getTime()) ? 0 : dateA.getTime();
            const timeB = isNaN(dateB.getTime()) ? 0 : dateB.getTime();
            return timeB - timeA;
        });

        return processedList.slice(0, 10); // Still show only the top 10
    }, []);

    const fetchHistory = useCallback(async (isRefreshing = false) => {
        if (!customerId) {
            const missingIdError = "Customer ID is missing. Cannot fetch transactions.";
            setError(missingIdError);
            setErrorDetail({ message: missingIdError, code: 'MISSING_CUSTOMER_ID' });
            !isRefreshing && setLoading(false);
            setTransactions([]);
            return;
        }

        !isRefreshing && setLoading(true);
        setError(null);
        setErrorDetail(null);

        try {
            console.log("Fetching transactions for:", {
                customerId: customerId ? customerId.substring(0, 6) + '...' : 'N/A',
                accountNumber
            });

            const result = await fetchHistoryGeneral({
                customerId,
                accountNo: accountNumber,
                limit: 50, // Fetch more data to ensure grouping works well before slicing
            });

            console.log("API response:", {
                success: result.success,
                count: result.transactions?.length,
                error: result.error
            });

            if (result.success && result.transactions) {
                // Filter out 'charges' or 'internalfees' from the main list before grouping
                // as they will be attached as associated fees.
                const nonChargesTransactions = result.transactions.filter(
                    item => item.transaction_type?.toLowerCase() !== 'charges' && item.type?.toLowerCase() !== 'charges'
                );
                
                const groupedAndSortedTransactions = processAndGroupTransactions(result.transactions); // Process all, then slice
                setTransactions(groupedAndSortedTransactions);
                setError(null);

                if (groupedAndSortedTransactions.length === 0 && nonChargesTransactions.length > 0) {
                    setError("No main transactions (Payout/Dedicated Account) found for this account in the recent history.");
                } else if (groupedAndSortedTransactions.length === 0 && result.transactions.length === 0) {
                    setError("No transactions found for this account.");
                }
            } else {
                setTransactions([]);
                const errorMessage = result.error || "Failed to fetch transactions";
                setError(errorMessage);
                setErrorDetail(result.errorDetail || {
                    message: errorMessage,
                    type: 'API_ERROR',
                    apiResponse: result
                });
            }
        } catch (err) {
            console.error("Fetch error:", err);
            const errorMessage = err.message || "Network error fetching transactions";
            setError(errorMessage);
            setErrorDetail({
                message: errorMessage,
                stack: err.stack,
                type: 'NETWORK_ERROR'
            });
            setTransactions([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [customerId, accountNumber, processAndGroupTransactions]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchHistory(true);
    }, [fetchHistory]);

    const showDebugPopup = () => {
        if (!errorDetail) {
            Alert.alert("Debug Info", "No detailed error information available.");
            return;
        }

        let debugMessage = "Error Details:\n\n";
        if (errorDetail.message) debugMessage += `Message: ${errorDetail.message}\n`;
        if (errorDetail.type) debugMessage += `Type: ${errorDetail.type}\n`;

        if (errorDetail.apiResponse) {
            const apiResponseString = JSON.stringify(errorDetail.apiResponse, null, 2);
            debugMessage += `\nAPI Response (first 500 chars):\n${apiResponseString.substring(0, Math.min(apiResponseString.length, 500))}...\n`;
        }

        if (errorDetail.stack) {
            debugMessage += `\nStack Trace (first 500 chars):\n${errorDetail.stack.substring(0, Math.min(errorDetail.stack.length, 500))}...`;
        }

        Alert.alert("Transaction Error Details", debugMessage, [{ text: "OK" }]);
    };

    const handleRowClick = useCallback((item) => {
        setSelectedTransaction(item);
        setModalVisible(true);
    }, []);

    const handlePrint = async () => {
        if (!selectedTransaction) return;

        const transactionDetailsHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: sans-serif; padding: 20px; color: #333; }
                    h1 { color: #4CC9F0; border-bottom: 2px solid #eee; padding-bottom: 10px; }
                    p { margin-bottom: 5px; }
                    strong { color: #0A1128; }
                    ul { list-style-type: none; padding: 0; }
                    li { margin-bottom: 3px; font-size: 0.9em; }
                    hr { border: 0; border-top: 1px dashed #ccc; margin-top: 20px; margin-bottom: 10px; }
                    .credit { color: ${transactionColors.credit}; }
                    .debit { color: ${transactionColors.debit}; }
                </style>
            </head>
            <body>
                <h1>Transaction Details</h1>
                <p><strong>Type:</strong> ${selectedTransaction.transaction_type || selectedTransaction.type || 'N/A'}</p>
                <p><strong>Description:</strong> ${selectedTransaction.transaction_description || selectedTransaction.description || 'N/A'}</p>
                <p><strong>Amount:</strong> ${selectedTransaction.currency || 'NGN'} <span class="${selectedTransaction.debitCreditIndicator === 'Debit' ? 'debit' : 'credit'}">${formatAmount(selectedTransaction.amount || 0)}</span></p>
                <p><strong>Direction:</strong> ${selectedTransaction.debitCreditIndicator || 'N/A'}</p>
                <p><strong>Date:</strong> ${selectedTransaction.transactionDate || 'N/A'}</p>
                <p><strong>Time:</strong> ${selectedTransaction.transactionTime || 'N/A'}</p>
                <p><strong>Reference:</strong> ${selectedTransaction.reference || 'N/A'}</p>
                ${selectedTransaction.associatedFees && selectedTransaction.associatedFees.length > 0 ? `
                    <h3>Associated Fees:</h3>
                    <ul>
                        ${selectedTransaction.associatedFees.map(fee => `
                            <li>${fee.transaction_type || fee.type || 'Fee'} (${fee.currency || 'NGN'} ${formatAmount(fee.amount || 0)})</li>
                        `).join('')}
                    </ul>
                ` : ''}
                <hr/>
                <p>Generated on: ${new Date().toLocaleString()}</p>
            </body>
            </html>
        `;

        try {
            await Print.printAsync({
                html: transactionDetailsHtml,
            });
        } catch (error) {
            Alert.alert('Print Error', `Failed to print: ${error.message}`);
            console.error('Print Error:', error);
        }
    };

    const handleShare = async () => {
        if (!selectedTransaction) return;

        const shareMessage = `Transaction Details:\n` +
            `Type: ${selectedTransaction.transaction_type || selectedTransaction.type || 'N/A'}\n` +
            `Description: ${selectedTransaction.transaction_description || selectedTransaction.description || 'N/A'}\n` +
            `Amount: ${selectedTransaction.currency || 'NGN'} ${formatAmount(selectedTransaction.amount || 0)}\n` +
            `Direction: ${selectedTransaction.debitCreditIndicator || 'N/A'}\n` +
            `Date: ${selectedTransaction.transactionDate || 'N/A'}\n` +
            `Time: ${selectedTransaction.transactionTime || 'N/A'}\n` +
            `Reference: ${selectedTransaction.reference || 'N/A'}\n` +
            (selectedTransaction.associatedFees && selectedTransaction.associatedFees.length > 0
                ? `\nAssociated Fees:\n${selectedTransaction.associatedFees.map(fee =>
                    `- ${fee.transaction_type || fee.type || 'Fee'} (${fee.currency || 'NGN'} ${formatAmount(fee.amount || 0)})`
                  ).join('\n')}`
                : '');

        try {
            await Sharing.shareAsync(shareMessage, {
                mimeType: 'text/plain',
                dialogTitle: 'Share Transaction Details',
            });
        } catch (error) {
            Alert.alert('Share Error', `Failed to share: ${error.message}`);
            console.error('Share Error:', error);
        }
    };

    // Modify handleViewMore to navigate to HistoryScreen
    const handleViewMore = useCallback(() => {
        if (navigation) {
            navigation.navigate('History', {
                selectedAccount: selectedAccount // Pass the selected account data
            });
        } else {
            console.warn("Navigation prop not available in DashboardHistory.");
        }
    }, [navigation, selectedAccount]);


    const renderFeeItem = useCallback(({ item, feeBackground, feeTextColor }) => (
        <View style={[styles.feeItem, { backgroundColor: feeBackground }]}>
            <Text style={[styles.feeType, { color: feeTextColor }]}>
                {item.transaction_type || item.type || 'N/A'}
            </Text>
            <Text style={[styles.feeAmount, { color: feeTextColor }]}>
                {item.currency || 'NGN'} {formatAmount(item.amount || 0)}
            </Text>
        </View>
    ), []);

    const renderTransactionItem = useCallback(({ item, index }) => {
        const isEvenIndex = index % 2 === 0;
        const mainBackground = isEvenIndex ? transactionColors.primary : transactionColors.secondary;
        const mainTextColor = isEvenIndex ? transactionColors.textPrimary : transactionColors.textSecondary;
        const feeBackground = isEvenIndex ? transactionColors.feeBackgroundPrimary : transactionColors.feeBackgroundSecondary;
        const feeTextColor = isEvenIndex ? transactionColors.textPrimary : transactionColors.textSecondary;

        const transactionDisplayText = item.debitCreditIndicator === 'Debit'
            ? item.transaction_description || item.description || 'Debit Transaction'
            : item.debitCreditIndicator === 'Credit'
                ? item.transaction_description || item.description || 'Credit Transaction'
                : item.transaction_description || item.description || item.transaction_type || item.type || 'Transaction';

        return (
            <View style={[styles.mainTransactionContainer, { backgroundColor: mainBackground }]}>
                <TouchableOpacity onPress={() => handleRowClick(item)} style={styles.touchableRow} activeOpacity={0.7}>
                    <View style={styles.transactionItem}>
                        <View style={styles.transactionDetails}>
                            <Text style={[styles.transactionType, { color: mainTextColor }]}>
                                {transactionDisplayText}
                            </Text>
                        </View>
                        <Text style={[
                            styles.transactionAmount,
                            (item.debitCreditIndicator === 'Debit') ? styles.debitAmount : styles.creditAmount,
                        ]}>
                            {item.currency || 'NGN'} {formatAmount(item.amount || 0)}
                        </Text>
                    </View>
                </TouchableOpacity>
                {item.associatedFees && item.associatedFees.length > 0 && (
                    <View style={styles.associatedFeesContainer}>
                        {item.associatedFees.map((fee, feeIndex) => (
                            <View key={fee.id || `fee-${item.id}-${feeIndex}`}>
                                {renderFeeItem({ item: fee, feeBackground: feeBackground, feeTextColor: feeTextColor })}
                            </View>
                        ))}
                    </View>
                )}
            </View>
        );
    }, [handleRowClick, renderFeeItem]);

    return (
        <View style={styles.container}>
            <View style={styles.headerContainer}>
                <Text style={styles.header}>Recent Transactions</Text>
                {transactions.length > 0 && (
                    <TouchableOpacity onPress={handleViewMore} style={styles.viewMoreIcon}>
                        <MaterialCommunityIcons name="dots-horizontal-circle" size={24} color={ColourScheme.primary} />
                    </TouchableOpacity>
                )}
            </View>

            {loading && !refreshing ? (
                <View style={styles.statusContainer}>
                    <ActivityIndicator size="small" color={ColourScheme.primary} />
                    <Text style={styles.statusText}>Loading transactions...</Text>
                </View>
            ) : error ? (
                <View style={styles.statusContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity
                        onPress={showDebugPopup}
                        style={styles.debugButton}
                    >
                        <Text style={styles.debugButtonText}>Show Debug Info</Text>
                    </TouchableOpacity>
                </View>
            ) : transactions.length === 0 ? (
                <View style={styles.statusContainer}>
                    <Text style={styles.noTransactionsText}>
                        No main transactions found for this account.
                    </Text>
                    <TouchableOpacity
                        onPress={() => fetchHistory(true)}
                        style={styles.debugButton}
                    >
                        <Text style={styles.debugButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    ref={flatListRef}
                    data={transactions}
                    renderItem={({ item, index }) => renderTransactionItem({ item, index })}
                    keyExtractor={(item) => item.id}
                    showsVerticalScrollIndicator={true}
                    contentContainerStyle={styles.listContent}
                    style={styles.flatListCompact}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={ColourScheme.primary}
                        />
                    }
                />
            )}

            {/* Transaction Detail Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.centeredView}>
                    <View style={styles.modalView}>
                        <Text style={styles.modalTitle}>Transaction Details</Text>
                        {selectedTransaction && (
                            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={true}>
                                <Text style={styles.modalText}><Text style={styles.modalLabel}>Type:</Text> {selectedTransaction.transaction_type || selectedTransaction.type || 'N/A'}</Text>
                                <Text style={styles.modalText}><Text style={styles.modalLabel}>Description:</Text> {selectedTransaction.transaction_description || selectedTransaction.description || 'N/A'}</Text>
                                <Text style={styles.modalText}><Text style={styles.modalLabel}>Amount:</Text> {selectedTransaction.currency || 'NGN'} <Text style={(selectedTransaction.debitCreditIndicator === 'Debit') ? styles.debitAmount : styles.creditAmount}>{formatAmount(selectedTransaction.amount || 0)}</Text></Text>
                                <Text style={styles.modalText}><Text style={styles.modalLabel}>Direction:</Text> {selectedTransaction.debitCreditIndicator || 'N/A'}</Text>
                                <Text style={styles.modalText}><Text style={styles.modalLabel}>Date:</Text> {selectedTransaction.transactionDate || 'N/A'}</Text>
                                <Text style={styles.modalText}><Text style={styles.modalLabel}>Time:</Text> {selectedTransaction.transactionTime || 'N/A'}</Text>
                                <Text style={styles.modalText}><Text style={styles.modalLabel}>Reference:</Text> {selectedTransaction.reference || 'N/A'}</Text>
                                {selectedTransaction.associatedFees && selectedTransaction.associatedFees.length > 0 && (
                                    <View style={styles.modalFeesContainer}>
                                        <Text style={styles.modalLabel}>Associated Fees:</Text>
                                        {selectedTransaction.associatedFees.map((fee, idx) => (
                                            <Text key={`modal-fee-${idx}`} style={styles.modalText}>
                                                - {fee.transaction_type || fee.type || 'Fee'} ({fee.currency || 'NGN'} {formatAmount(fee.amount || 0)})
                                            </Text>
                                        ))}
                                    </View>
                                )}
                            </ScrollView>
                        )}
                        <View style={styles.modalButtonContainer}>
                            {Platform.OS !== 'web' && (
                                <>
                                    <TouchableOpacity
                                        style={[styles.button, styles.buttonPrint]}
                                        onPress={handlePrint}
                                    >
                                        <Text style={styles.textStyle}>Print</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.button, styles.buttonShare]}
                                        onPress={handleShare}
                                    >
                                        <Text style={styles.textStyle}>Share</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                            <TouchableOpacity
                                style={[styles.button, styles.buttonClose]}
                                onPress={() => setModalVisible(!modalVisible)}
                            >
                                <Text style={styles.textStyle}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

// --- StyleSheet ---
const styles = StyleSheet.create({
    container: {
        backgroundColor: '#0A1128', // Dark navy
        borderRadius: 12,
        padding: 15,
        width: '100%',
        borderWidth: 1,
        borderColor: 'rgba(76, 201, 240, 0.2)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
        alignSelf: 'center',
        marginTop: 15,
        minHeight: 200,
    },
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
        paddingHorizontal: 5,
    },
    header: {
        ...textStyles.header, // Using the new font style
        color: ColourScheme.textLight, // Assuming textLight is white/light for the header
        flex: 1,
        textAlign: 'center',
    },
    viewMoreIcon: {
        backgroundColor: 'rgba(76, 201, 240, 0.1)',
        borderRadius: 20,
        padding: 6,
        borderWidth: 1,
        borderColor: 'rgba(76, 201, 240, 0.3)',
    },
    statusContainer: {
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center', // Center content vertically
        minHeight: 150, // Give it some height
    },
    statusText: {
        ...textStyles.regular, // Using the new font style
        color: '#B0B0B0', // Light gray
        marginTop: 10,
    },
    errorText: {
        ...textStyles.medium, // Using the new font style
        color: transactionColors.debit, // Soft red for errors
        textAlign: 'center',
        padding: 10,
        backgroundColor: 'rgba(255, 107, 107, 0.1)',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(255, 107, 107, 0.3)',
    },
    noTransactionsText: {
        ...textStyles.regular, // Using the new font style
        color: '#B0B0B0', // Light gray
        textAlign: 'center',
        marginTop: 10,
    },
    listContent: {
        paddingBottom: 5,
    },
    flatListCompact: {
        maxHeight: 250, // Fixed height for the FlatList
    },
    mainTransactionContainer: {
        marginBottom: 8,
        borderRadius: 8,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    touchableRow: {
        width: '100%',
    },
    transactionItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 15,
    },
    transactionDetails: {
        flex: 1,
    },
    transactionType: {
        ...textStyles.medium, // Using the new font style
        color: '#FFFFFF', // White text
        flex: 1,
    },
    transactionAmount: {
        ...textStyles.bold, // Using the new font style
        marginLeft: 8,
    },
    debitAmount: {
        color: transactionColors.debit, // Soft red
    },
    creditAmount: {
        color: transactionColors.credit, // Neon green
    },
    associatedFeesContainer: {
        paddingHorizontal: 15, // Match main transaction padding
        paddingVertical: 5,
        borderTopWidth: StyleSheet.hairlineWidth, // Thin separator
        borderTopColor: 'rgba(255,255,255,0.05)',
    },
    feeItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 3,
        paddingLeft: 10, // Indent fees slightly
    },
    feeType: {
        ...textStyles.regular, // Using the new font style
        fontSize: 12, // Slightly smaller for fees
    },
    feeAmount: {
        ...textStyles.regular, // Using the new font style
        fontSize: 12, // Slightly smaller for fees
    },
    debugButton: {
        marginTop: 15,
        paddingVertical: 8,
        paddingHorizontal: 15,
        backgroundColor: ColourScheme.primary, // Using primary color from ColourSchemeStyles
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(76, 201, 240, 0.5)',
    },
    debugButtonText: {
        ...textStyles.medium, // Using the new font style
        color: ColourScheme.textLight, // Assuming textLight is white/light
    },
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)', // Darker overlay
    },
    modalView: {
        backgroundColor: '#0A1128', // Dark navy
        borderRadius: 12,
        padding: 20,
        width: '90%',
        maxHeight: '80%',
        borderWidth: 1,
        borderColor: 'rgba(76, 201, 240, 0.3)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    modalScrollView: {
        width: '100%',
        marginBottom: 15,
    },
    modalTitle: {
        ...textStyles.bold, // Using the new font style
        color: '#4CC9F0', // Teal for modal title
        marginBottom: 15,
        textAlign: 'center',
    },
    modalText: {
        ...textStyles.regular, // Using the new font style
        color: '#FFFFFF', // White text
        marginBottom: 8,
        lineHeight: 20,
        width: '100%',
    },
    modalLabel: {
        ...textStyles.medium, // Using the new font style
        color: '#4CC9F0', // Teal for labels
    },
    modalFeesContainer: {
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: 'rgba(76, 201, 240, 0.1)',
    },
    modalButtonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        marginTop: 15,
    },
    button: {
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 15,
        backgroundColor: 'rgba(76, 201, 240, 0.2)',
        borderWidth: 1,
        borderColor: 'rgba(76, 201, 240, 0.5)',
        flex: 1,
        marginHorizontal: 5,
        alignItems: 'center',
    },
    buttonClose: {
        backgroundColor: ColourScheme.primary, // Primary button
        borderColor: ColourScheme.primary, // Match border
    },
    buttonPrint: {
        backgroundColor: 'rgba(76, 201, 240, 0.2)', // Teal tint
        borderColor: 'rgba(76, 201, 240, 0.5)',
    },
    buttonShare: {
        backgroundColor: 'rgba(141, 71, 204, 0.2)', // Purple tint (example tertiary/accent)
        borderColor: 'rgba(141, 71, 204, 0.5)',
    },
    textStyle: {
        ...textStyles.medium, // Using the new font style
        color: '#4CC9F0', // Teal text for buttons
        textAlign: 'center',
    },
});

DashboardHistory.propTypes = {
    customerId: PropTypes.string.isRequired,
    accountNumber: PropTypes.string,
    navigation: PropTypes.object.isRequired,
};

export default DashboardHistory;