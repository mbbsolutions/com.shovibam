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
import { fetchHistoryGeneral } from '../utils/historyTable_gen_local';
import TransactionDetailModal from '../components/Receipt';
import ColourScheme from '../styles/ColourSchemeStyles'; // Import the new color scheme

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

export default function DashboardHistory({ customerId, onLatestBalance }) {
    const navigation = useNavigation();
    const [transactionHistory, setTransactionHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [lastHistoryApiResponse, setLastHistoryApiResponse] = useState(null);

    // State for the transaction detail modal
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedTransactionDetail, setSelectedTransactionDetail] = useState(null);

    // Using colors from ColourScheme for transaction items
    const transactionColors = useMemo(() => [
        ColourScheme.borderLighter, // Reusing a light border color for a light background
        ColourScheme.backgroundLight, // White
        ColourScheme.textSuccess, // Green (maybe too strong for background, consider adding a lighter green to scheme)
        ColourScheme.backgroundSecondary, // Lighter grey
        ColourScheme.borderHairline // Very light grey
    ], []);

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
                    limit: 10,
                };
                const result = await fetchHistoryGeneral(historyOptions);
                if (isMounted) {
                    setLastHistoryApiResponse(result);
                    if (result.success && Array.isArray(result.transactions)) {
                        // This is the main Dashboard History, so it should show all transactions
                        setTransactionHistory(result.transactions);
                        if (result.transactions.length > 0 && result.transactions[0].balance !== undefined && result.transactions[0].balance !== null) {
                            onLatestBalance(Number(result.transactions[0].balance)); // Ensure balance is a number
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

    const handleRowPress = useCallback((item) => {
        setSelectedTransactionDetail(item);
        setShowDetailModal(true);
    }, []);

    const ITEM_HEIGHT = 52;
    const VISIBLE_ITEMS = 3.5;
    const dynamicListHeight = Math.min(transactionHistory.length, VISIBLE_ITEMS) * ITEM_HEIGHT;


    return (
        <View style={styles.historyCard}>
            <View style={styles.historyIconContainer}>
                <TouchableOpacity
                    onPress={() => navigation.navigate('History')}
                    style={styles.historyIcon}
                >
                    <Icon name="history" size={24} color={ColourScheme.iconHistory} /> {/* Using color from scheme */}
                </TouchableOpacity>
            </View>
            {loadingHistory ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={ColourScheme.iconHistory} /> {/* Using color from scheme */}
                    <Text style={styles.loadingText}>Loading transactions...</Text>
                </View>
            ) : transactionHistory.length > 0 ? (
                <View style={[styles.listWrapper, { height: dynamicListHeight }]}>
                    <FlatList
                        data={transactionHistory}
                        renderItem={({ item, index }) => {
                            let statusIconName;
                            let statusIconColor;

                            if (item.type && item.type.toLowerCase() === 'dedicated_account') {
                                statusIconName = 'arrow-down-bold';
                                statusIconColor = ColourScheme.iconSuccess; // Using color from scheme
                            } else if (item.status && item.status.toLowerCase() === 'success') {
                                statusIconName = 'check-circle';
                                statusIconColor = ColourScheme.iconSuccess; // Using color from scheme
                            } else if (item.status && item.status.toLowerCase() === 'failed') {
                                statusIconName = 'close-circle';
                                statusIconColor = ColourScheme.iconError; // Using color from scheme
                            } else {
                                statusIconName = 'information';
                                statusIconColor = ColourScheme.textMedium; // Using color from scheme
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
                <Text style={styles.noTransactionsText}>No transactions found for this account.</Text>
            )}

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
        backgroundColor: ColourScheme.backgroundLight, // Using color from scheme
        borderRadius: 10,
        padding: 10,
        width: '100%',
        maxWidth: 400,
        shadowColor: ColourScheme.shadowColor,
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
        color: ColourScheme.textMedium, // Using color from scheme
    },
    transactionItem: {
        borderRadius: 5,
        paddingVertical: 8,
        paddingHorizontal: 8,
        marginBottom: 4,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: ColourScheme.borderHairline, // Using color from scheme
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
        color: ColourScheme.textMedium, // Using color from scheme
        marginBottom: 0,
        paddingVertical: 1,
    },
    statusIcon: {
        marginLeft: 8,
    },
    historySeparator: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: ColourScheme.borderLighter, // Using color from scheme
        marginVertical: 2,
    },
    noTransactionsText: {
        fontSize: 14,
        color: ColourScheme.textLightGrey, // Using color from scheme
        textAlign: 'center',
        paddingVertical: 10,
    },
});
