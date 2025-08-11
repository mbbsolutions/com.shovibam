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
import ColourScheme from '../styles/ColourSchemeStyles';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext'; // Import useAuth to get selectedAccount

// Helper to format currency - MOVED TO TOP LEVEL
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

// Define alternating colors for transaction blocks - MOVED TO TOP LEVEL
const transactionColors = {
    primary: ColourScheme.backgroundPrimary,
    secondary: ColourScheme.backgroundSecondary,
    textPrimary: ColourScheme.textLight,
    textSecondary: ColourScheme.textDark,
    feeBackgroundPrimary: '#4a4a4a',
    feeBackgroundSecondary: '#e8e8e8',
};

// Add navigation prop to the component signature
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
            } else if (type === 'internalfees') {
                fees.push(item);
            }
        });

        fees.forEach(fee => {
            let attached = false;
            for (const key in mainTransactions) {
                const mainTx = mainTransactions[key];
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

        return processedList.slice(0, 10);
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
                limit: 50,
            });

            console.log("API response:", {
                success: result.success,
                count: result.transactions?.length,
                error: result.error
            });

            if (result.success && result.transactions) {
                const nonChargesTransactions = result.transactions.filter(
                    item => item.transaction_type?.toLowerCase() !== 'charges' && item.type?.toLowerCase() !== 'charges'
                );

                const groupedAndSortedTransactions = processAndGroupTransactions(nonChargesTransactions);
                setTransactions(groupedAndSortedTransactions);
                setError(null);

                if (groupedAndSortedTransactions.length === 0 && nonChargesTransactions.length > 0) {
                    setError("No main transactions (Payout/Dedicated Account) found for this account in the recent history.");
                } else if (groupedAndSortedTransactions.length === 0 && nonChargesTransactions.length === 0) {
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
            <h1>Transaction Details</h1>
            <p><strong>Type:</strong> ${selectedTransaction.transaction_type || selectedTransaction.type || 'N/A'}</p>
            <p><strong>Description:</strong> ${selectedTransaction.transaction_description || selectedTransaction.description || 'N/A'}</p>
            <p><strong>Amount:</strong> ${selectedTransaction.currency || 'NGN'} ${formatAmount(selectedTransaction.amount || 0)}</p>
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


    // renderFeeItem doesn't need formatAmount or transactionColors in its dependencies
    // because they are now stable global constants.
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

    // renderTransactionItem still depends on handleRowClick, and implicitly on
    // transactionColors (which is now global).
    const renderTransactionItem = useCallback(({ item, index }) => {
        const isEvenIndex = index % 2 === 0;
        const mainBackground = isEvenIndex ? transactionColors.primary : transactionColors.secondary;
        const mainTextColor = isEvenIndex ? transactionColors.textPrimary : transactionColors.textSecondary;
        const feeBackground = isEvenIndex ? transactionColors.feeBackgroundPrimary : transactionColors.feeBackgroundSecondary;
        const feeTextColor = isEvenIndex ? transactionColors.textPrimary : transactionColors.textSecondary;

        const transactionDisplayText = item.debitCreditIndicator === 'Debit'
            ? 'Debit'
            : item.debitCreditIndicator === 'Credit'
                ? 'Credit'
                : item.transaction_description || item.description || item.transaction_type || item.type || 'Transaction';

        return (
            <View key={item.id} style={[styles.mainTransactionContainer, { backgroundColor: mainBackground }]}>
                <TouchableOpacity onPress={() => handleRowClick(item)} style={styles.touchableRow}>
                    <View style={styles.transactionItem}>
                        <View style={styles.transactionDetails}>
                            <Text style={[styles.transactionType, { color: mainTextColor }]}>
                                {transactionDisplayText}
                            </Text>
                        </View>
                        <Text style={[
                            styles.transactionAmount,
                            (item.debitCreditIndicator === 'Debit') ? styles.debitAmount : styles.creditAmount,
                            { color: mainTextColor }
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
                                <Text style={styles.modalText}><Text style={styles.modalLabel}>Amount:</Text> {selectedTransaction.currency || 'NGN'} {formatAmount(selectedTransaction.amount || 0)}</Text>
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

const styles = StyleSheet.create({
    container: {
        backgroundColor: ColourScheme.backgroundLight,
        borderRadius: 10,
        padding: 10,
        width: '100%',
        maxWidth: 400,
        shadowColor: ColourScheme.shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
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
        fontSize: 16,
        fontWeight: 'bold',
        color: ColourScheme.textDark,
        flex: 1,
        textAlign: 'center',
    },
    viewMoreIcon: {
        padding: 5,
    },
    statusContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 15,
    },
    statusText: {
        marginTop: 8,
        fontSize: 13,
        color: ColourScheme.textDark,
    },
    errorText: {
        marginTop: 8,
        fontSize: 13,
        color: ColourScheme.error,
        textAlign: 'center',
        fontWeight: 'bold',
    },
    noTransactionsText: {
        marginTop: 8,
        fontSize: 13,
        color: ColourScheme.textDark,
        textAlign: 'center',
    },
    listContent: {
        paddingBottom: 5,
    },
    flatListCompact: {
        maxHeight: 250,
    },
    mainTransactionContainer: {
        marginBottom: 6,
        borderRadius: 6,
        overflow: 'hidden',
    },
    touchableRow: {
        width: '100%',
    },
    transactionItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 10,
    },
    transactionDetails: {
        flex: 1,
    },
    transactionType: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    transactionAmount: {
        fontSize: 14,
        fontWeight: 'bold',
        marginLeft: 8,
    },
    debitAmount: {
        color: ColourScheme.error,
    },
    creditAmount: {
        color: ColourScheme.success,
    },
    associatedFeesContainer: {
        paddingHorizontal: 10,
        paddingVertical: 3,
    },
    feeItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 3,
        paddingLeft: 20,
    },
    feeType: {
        fontSize: 12,
    },
    feeAmount: {
        fontSize: 12,
    },
    debugButton: {
        marginTop: 10,
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: ColourScheme.primary,
        borderRadius: 5,
    },
    debugButtonText: {
        color: ColourScheme.textLight,
        fontWeight: 'bold',
    },
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalView: {
        margin: 20,
        backgroundColor: ColourScheme.backgroundLight,
        borderRadius: 20,
        padding: 25,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
        width: '85%',
        maxHeight: '75%',
    },
    modalScrollView: {
        width: '100%',
        marginBottom: 15,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        color: ColourScheme.textDark,
    },
    modalText: {
        marginBottom: 6,
        fontSize: 13,
        color: ColourScheme.textDark,
        width: '100%',
    },
    modalLabel: {
        fontWeight: 'bold',
        color: ColourScheme.primary,
    },
    modalFeesContainer: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: ColourScheme.borderLight,
    },
    modalButtonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        marginTop: 15,
    },
    button: {
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 15,
        elevation: 2,
        flex: 1,
        marginHorizontal: 5,
    },
    buttonClose: {
        backgroundColor: ColourScheme.primary,
    },
    buttonPrint: {
        backgroundColor: ColourScheme.secondary,
    },
    buttonShare: {
        backgroundColor: ColourScheme.tertiary,
    },
    textStyle: {
        color: ColourScheme.textLight,
        fontWeight: 'bold',
        textAlign: 'center',
        fontSize: 13,
    },
});

DashboardHistory.propTypes = {
    customerId: PropTypes.string.isRequired,
    accountNumber: PropTypes.string,
    navigation: PropTypes.object.isRequired, 
};

export default DashboardHistory;