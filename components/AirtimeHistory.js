import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    FlatList,
    Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { fetchHistoryGeneral } from '../utils/historyTable_gen_local'; // Assuming this utility fetches all history
import TransactionDetailModal from '../components/Receipt';

const { width } = Dimensions.get('window');

// Helper functions
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

const formatTransactionDate = (dateString) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        return 'N/A';
    }
    const options = { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    return date.toLocaleString('en-US', options);
};

export default function AirtimeHistory({ customerId, onLatestBalance }) {
    const navigation = useNavigation();
    const [transactionHistory, setTransactionHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [lastHistoryApiResponse, setLastHistoryApiResponse] = useState(null);

    // State for the transaction detail modal
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedTransactionDetail, setSelectedTransactionDetail] = useState(null);

    const transactionColors = useMemo(() => ['#e6f7ff', '#f0f8ff', '#e0ffe0', '#fff0e6', '#f8e6ff'], []);

    useEffect(() => {
        let isMounted = true;
        const fetchAndSetHistory = async () => {
            if (!customerId) {
                if (isMounted) {
                    setTransactionHistory([]);
                    setLastHistoryApiResponse(null);
                    setLoadingHistory(false);
                    onLatestBalance(null);
                }
                return;
            }
            if (isMounted) {
                setLoadingHistory(true);
                setTransactionHistory([]);
                setLastHistoryApiResponse(null);
            }
            try {
                const historyOptions = {
                    customerId: customerId,
                    limit: 10, // Fetch up to 10 transactions, then filter for airtime
                };
                const result = await fetchHistoryGeneral(historyOptions);
                if (isMounted) {
                    setLastHistoryApiResponse(result);
                    if (result.success && Array.isArray(result.transactions)) {
                        // Filter transactions to include only those with 'Airtime' in the note
                        const airtimeTransactions = result.transactions.filter(item =>
                            item.note && typeof item.note === 'string' && item.note.toLowerCase().includes('airtime')
                        );
                        setTransactionHistory(airtimeTransactions);

                        // Update latest balance based on the *original* (unfiltered) transactions
                        // For now, keeping it based on original transactions as DashboardHistory does.
                        if (result.transactions.length > 0 && result.transactions[0].balance !== undefined && result.transactions[0].balance !== null) {
                            onLatestBalance(result.transactions[0].balance);
                        } else {
                            onLatestBalance(null);
                        }
                    } else {
                        setTransactionHistory([]);
                        onLatestBalance(null);
                    }
                }
            } catch (error) {
                if (isMounted) {
                    setTransactionHistory([]);
                    setLastHistoryApiResponse({ error: 'Error calling fetchHistoryGeneral', message: error.message });
                    onLatestBalance(null);
                }
            } finally {
                if (isMounted) {
                    setLoadingHistory(false);
                }
            }
        };
        fetchAndSetHistory();
        return () => {
            isMounted = false;
        };
    }, [customerId, onLatestBalance]);

    // Function to handle row press and show detail modal
    const handleRowPress = useCallback((item) => {
        setSelectedTransactionDetail(item);
        setShowDetailModal(true);
    }, []);

    // Height calculation for showing 3.5 items initially
    const ITEM_HEIGHT = 52; // Approximate item height (adjust as needed)
    const VISIBLE_ITEMS = 3.5;
    // Dynamically calculate height based on actual items, up to VISIBLE_ITEMS
    const dynamicListHeight = Math.min(transactionHistory.length, VISIBLE_ITEMS) * ITEM_HEIGHT;


    return (
        <View style={styles.historyCard}>
            <View style={styles.historyIconContainer}> {/* New container for just the icon */}
                <TouchableOpacity
                    onPress={() => navigation.navigate('History')} // Still navigates to general history
                    style={styles.historyIcon}
                >
                    <Icon name="history" size={24} color="#0056b3" />
                </TouchableOpacity>
            </View>
            {loadingHistory ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#0056b3" />
                    <Text style={styles.loadingText}>Loading airtime transactions...</Text>
                </View>
            ) : transactionHistory.length > 0 ? (
                // Apply dynamic height to the listWrapper
                <View style={[styles.listWrapper, { height: dynamicListHeight }]}>
                    <FlatList
                        data={transactionHistory}
                        renderItem={({ item, index }) => {
                            let statusIconName;
                            let statusIconColor;

                            if (item.type && item.type.toLowerCase() === 'dedicated_account') {
                                statusIconName = 'arrow-down-bold';
                                statusIconColor = '#28a745';
                            } else if (item.status && item.status.toLowerCase() === 'success') {
                                statusIconName = 'check-circle';
                                statusIconColor = 'green';
                            } else if (item.status && item.status.toLowerCase() === 'failed') {
                                statusIconName = 'close-circle';
                                statusIconColor = 'red';
                            } else {
                                statusIconName = 'information';
                                statusIconColor = '#555';
                            }

                            return (
                                <TouchableOpacity
                                    style={[styles.transactionItem, { backgroundColor: transactionColors[index % transactionColors.length] }]}
                                    onPress={() => handleRowPress(item)}
                                >
                                    <View style={styles.transactionHeader}>
                                        <Text style={styles.transactionTextCompact}>Date: {formatTransactionDate(item.transactionDate || '')}</Text>
                                        {statusIconName && (
                                            <Icon name={statusIconName} size={20} color={statusIconColor} style={styles.statusIcon} />
                                        )}
                                    </View>
                                    <Text style={styles.transactionTextCompact}>Amount: NGN {item.amount !== undefined ? formatAmount(item.amount) : 'N/A'}</Text>
                                    {item.internalFeesAmount !== undefined && item.internalFeesAmount !== null && (
                                        <Text style={styles.transactionTextCompact}>Fees: NGN {formatAmount(item.internalFeesAmount)}</Text>
                                    )}
                                </TouchableOpacity>
                            );
                        }}
                        keyExtractor={(item, index) => item.history_id ? String(item.history_id) : index.toString()}
                        ItemSeparatorComponent={() => <View style={styles.historySeparator} />}
                        showsVerticalScrollIndicator={true}
                        scrollEnabled={true}
                        bounces={true}
                        contentContainerStyle={{ paddingBottom: 8 }}
                    />
                </View>
            ) : (
                <Text style={styles.noTransactionsText}>No airtime transactions found for this account.</Text>
            )}

            {/* Transaction Detail Modal */}
            <TransactionDetailModal
                isVisible={showDetailModal}
                transaction={selectedTransactionDetail}
                onClose={() => setShowDetailModal(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    historyCard: {
        backgroundColor: '#ffffff',
        borderRadius: 10,
        padding: 10,
        width: '100%',
        maxWidth: 400,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 3,
        marginTop: 0,
    },
    listWrapper: {
        overflow: 'hidden',
        borderRadius: 6,
        marginBottom: 10,
    },
    historyIconContainer: {
        alignSelf: 'flex-end',
        marginBottom: 10,
        paddingHorizontal: 5,
    },
    historyIcon: {
        padding: 5,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: '#555',
    },
    transactionItem: {
        borderRadius: 5,
        paddingVertical: 8,
        paddingHorizontal: 8,
        marginBottom: 4,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#eee',
        minHeight: 52,
        flexDirection: 'column',
        justifyContent: 'center',
    },
    transactionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 2,
    },
    transactionTextCompact: {
        fontSize: 12,
        color: '#555',
        marginBottom: 0,
        paddingVertical: 1,
    },
    statusIcon: {
        marginLeft: 8,
    },
    historySeparator: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: '#ddd',
        marginVertical: 2,
    },
    noTransactionsText: {
        fontSize: 14,
        color: '#777',
        textAlign: 'center',
        paddingVertical: 10,
    },
});
