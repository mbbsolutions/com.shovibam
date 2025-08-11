import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Platform,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { fetchHistoryGeneral } from '../utils/historyTable_gen_local';
import GeneralIconsMenuButtons from '../components/GeneralIconsMenuButtons';
import { useAuth } from '../contexts/AuthContext';

// Dark Theme Colors
const COLORS = {
  backgroundPrimary: '#121212',       // Main background
  cardBackground: '#0A1128',          // Cards & filter container
  accent: '#4CC9F0',                  // Primary accent (teal blue)
  textPrimary: '#FFFFFF',             // Main text
  textSecondary: '#B0B0B0',           // Secondary/dimmed text
  border: 'rgba(255,255,255,0.15)',   // Subtle borders
  error: '#FF5252',                   // Error red
  success: '#4CAF50',                 // Success green
  tableHeader: '#1A237E',             // Dark indigo header
  tableRowEven: 'rgba(255,255,255,0.05)', // Faint white even row
  tableRowOdd: 'rgba(255,255,255,0.02)',  // Slightly lighter odd row
};

/**
 * Format numeric amount with Nigerian locale
 * @param {number|string} value - The value to format
 * @returns {string} Formatted currency string
 */
const formatAmount = (value) => {
  if (typeof value === 'number' || (typeof value === 'string' && !isNaN(parseFloat(value)))) {
    const num = parseFloat(value);
    return num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return value;
};

export default function HistoryScreen({ route, navigation }) {
  const { selectedAccount, isLoadingAuth } = useAuth();
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState(null);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [searchReference, setSearchReference] = useState('');
  const [searchName, setSearchName] = useState('');

  useEffect(() => {
    if (isLoadingAuth) {
      console.log('HistoryScreen: AuthContext still loading. Waiting...');
      return;
    }

    const loadTransactionHistory = async () => {
      const customerId = selectedAccount?.customer_id;
      console.log('HistoryScreen: Attempting to load history for customerId:', customerId);

      if (!customerId) {
        setError('User ID is missing or account not selected. Cannot fetch transaction history.');
        setTransactionHistory([]);
        setLoadingHistory(false);
        return;
      }

      setLoadingHistory(true);
      setError(null);
      setTransactionHistory([]);

      try {
        const options = {
          customerId: customerId,
          limit: 50,
          fromDate: startDate ? startDate.toISOString().split('T')[0] : undefined,
          toDate: endDate ? endDate.toISOString().split('T')[0] : undefined,
          reference: searchReference.trim() || undefined,
          name: searchName.trim() || undefined,
        };

        console.log('HistoryScreen: Fetching history with options:', options);
        const result = await fetchHistoryGeneral(options);

        if (result.success && Array.isArray(result.transactions)) {
          setTransactionHistory(result.transactions);
          console.log(`HistoryScreen: Fetched ${result.transactions.length} transactions.`);
        } else {
          setError(result.error || 'Failed to load transaction history.');
          setTransactionHistory([]);
        }
      } catch (err) {
        console.error('HistoryScreen: Error fetching transaction history:', err);
        setError('An unexpected error occurred while fetching history.');
        setTransactionHistory([]);
      } finally {
        setLoadingHistory(false);
      }
    };

    loadTransactionHistory();
  }, [selectedAccount, startDate, endDate, searchReference, searchName, isLoadingAuth]);

  /**
   * Handle date selection from DateTimePicker
   */
  const onDateChange = (event, selectedDate, type) => {
    if (Platform.OS === 'android') {
      if (type === 'start') setShowStartDatePicker(false);
      if (type === 'end') setShowEndDatePicker(false);
    }
    if (selectedDate) {
      if (type === 'start') {
        setStartDate(selectedDate);
      } else if (type === 'end') {
        setEndDate(selectedDate);
      }
    }
  };

  /**
   * Clear all filters and reset form
   */
  const clearFilters = useCallback(() => {
    setStartDate(null);
    setEndDate(null);
    setSearchReference('');
    setSearchName('');
    setError(null);
  }, []);

  /**
   * Render table header
   */
  const renderListHeader = useCallback(() => (
    <View style={styles.tableHeader}>
      <Text style={[styles.headerCell, styles.dateCell]}>Date</Text>
      <Text style={[styles.headerCell, styles.typeCell]}>Type</Text>
      <Text style={[styles.headerCell, styles.amountCell]}>Amount</Text>
      <Text style={[styles.headerCell, styles.feesCell]}>Fees</Text>
      <Text style={[styles.headerCell, styles.refCell]}>Ref</Text>
      <Text style={[styles.headerCell, styles.statusCell]}>Status</Text>
      <Text style={[styles.headerCell, styles.balanceCell]}>Balance</Text>
    </View>
  ), []);

  /**
   * Render individual transaction row
   */
  const renderTransactionItem = useCallback(
    ({ item, index }) => (
      <View
        style={[
          styles.tableRow,
          {
            backgroundColor: index % 2 === 0 ? COLORS.tableRowEven : COLORS.tableRowOdd,
          },
        ]}
      >
        <Text style={[styles.tableCell, styles.dateCell]}>
          {item.transactionDate ? item.transactionDate.split(' ')[0] : 'N/A'}
        </Text>
        <Text style={[styles.tableCell, styles.typeCell]}>{item.type || 'N/A'}</Text>
        <Text style={[styles.tableCell, styles.amountCell]}>
          {item.currency}{' '}
          {item.amount !== undefined ? formatAmount(item.amount) : 'N/A'}
        </Text>
        <Text style={[styles.tableCell, styles.feesCell]}>
          {item.internalFeesAmount !== undefined && item.internalFeesAmount !== null
            ? formatAmount(item.internalFeesAmount)
            : '0.00'}
        </Text>
        <Text style={[styles.tableCell, styles.refCell]}>
          {item.reference ? `${item.reference.substring(0, 10)}...` : 'N/A'}
        </Text>
        <Text style={[styles.tableCell, styles.statusCell]}>{item.status || 'N/A'}</Text>
        <Text style={[styles.tableCell, styles.balanceCell]}>
          {item.currency}{' '}
          {item.balance !== undefined ? formatAmount(item.balance) : 'N/A'}
        </Text>
      </View>
    ),
    []
  );

  // Show loading while auth is initializing
  if (isLoadingAuth) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Loading user session...</Text>
      </View>
    );
  }

  // Account info display
  const displayAccountName = `${selectedAccount?.customer_first_name || ''} ${selectedAccount?.customer_last_name || 'N/A'}`.trim();
  const displayAccountNumber = selectedAccount?.account_number || 'N/A';
  const displayCustomerId = selectedAccount?.customer_id || 'N/A';

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Page Title */}
        <Text style={styles.title}>Transaction History</Text>

        {/* Account Info */}
        <View style={styles.compactAccountInfo}>
          <Text style={styles.compactText}>{displayAccountName}</Text>
          <Text style={styles.compactText}>Acc No: {displayAccountNumber}</Text>
          <Text style={styles.compactText}>Customer ID: {displayCustomerId}</Text>
        </View>

        {/* Filters */}
        <View style={styles.filterContainer}>
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Date:</Text>
            {Platform.OS === 'web' ? (
              <>
                <TextInput
                  style={styles.dateInput}
                  placeholder="Start (YYYY-MM-DD)"
                  placeholderTextColor={COLORS.textSecondary}
                  value={startDate ? startDate.toISOString().split('T')[0] : ''}
                  onChangeText={(text) => {
                    const date = new Date(text);
                    setStartDate(isNaN(date.getTime()) ? null : date);
                  }}
                  keyboardType="numeric"
                />
                <TextInput
                  style={styles.dateInput}
                  placeholder="End (YYYY-MM-DD)"
                  placeholderTextColor={COLORS.textSecondary}
                  value={endDate ? endDate.toISOString().split('T')[0] : ''}
                  onChangeText={(text) => {
                    const date = new Date(text);
                    setEndDate(isNaN(date.getTime()) ? null : date);
                  }}
                  keyboardType="numeric"
                />
              </>
            ) : (
              <>
                <TouchableOpacity
                  onPress={() => setShowStartDatePicker(true)}
                  style={styles.datePickerButton}
                >
                  <Text style={styles.datePickerButtonText}>
                    {startDate ? startDate.toLocaleDateString() : 'Start Date'}
                  </Text>
                </TouchableOpacity>
                {showStartDatePicker && (
                  <DateTimePicker
                    value={startDate || new Date()}
                    mode="date"
                    display="default"
                    onChange={(event, selectedDate) => onDateChange(event, selectedDate, 'start')}
                  />
                )}
                <TouchableOpacity
                  onPress={() => setShowEndDatePicker(true)}
                  style={styles.datePickerButton}
                >
                  <Text style={styles.datePickerButtonText}>
                    {endDate ? endDate.toLocaleDateString() : 'End Date'}
                  </Text>
                </TouchableOpacity>
                {showEndDatePicker && (
                  <DateTimePicker
                    value={endDate || new Date()}
                    mode="date"
                    display="default"
                    onChange={(event, selectedDate) => onDateChange(event, selectedDate, 'end')}
                  />
                )}
              </>
            )}
          </View>

          {/* Search Filter */}
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Search:</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Ref or Name"
              placeholderTextColor={COLORS.textSecondary}
              value={searchReference || searchName}
              onChangeText={(text) => {
                setSearchReference(text);
                setSearchName(text);
              }}
              autoCapitalize="none"
            />
          </View>

          {/* Clear Filters Button */}
          <TouchableOpacity
            onPress={clearFilters}
            style={styles.clearFilterButton}
            activeOpacity={0.8}
          >
            <Text style={styles.clearFilterButtonText}>Clear Filters</Text>
          </TouchableOpacity>
        </View>

        {/* Content: Loading, Error, Table, or Empty State */}
        {loadingHistory ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.accent} />
            <Text style={styles.loadingText}>Loading transactions...</Text>
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : transactionHistory.length > 0 ? (
          <View style={styles.tableContainer}>
            {renderListHeader()}
            <FlatList
              data={transactionHistory}
              renderItem={renderTransactionItem}
              keyExtractor={(item, index) =>
                item.history_id ? String(item.history_id) : index.toString()
              }
              scrollEnabled={false}
              contentContainerStyle={styles.flatListContent}
            />
          </View>
        ) : (
          <Text style={styles.noTransactionsText}>
            No transactions found for the selected criteria.
          </Text>
        )}
      </ScrollView>

      {/* Bottom Navigation */}
      <GeneralIconsMenuButtons navigation={navigation} active="History" />
    </View>
  );
}

// Styles
const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 16,
    backgroundColor: COLORS.backgroundPrimary,
    paddingBottom: 80,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.accent,
    marginBottom: 16,
    textAlign: 'center',
  },
  compactAccountInfo: {
    marginBottom: 20,
    alignItems: 'center',
  },
  compactText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  filterContainer: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: 16,
    width: '100%',
    maxWidth: 600,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: 20,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 12,
    color: COLORS.textPrimary,
    width: 60,
  },
  datePickerButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  datePickerButtonText: {
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  dateInput: {
    flex: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  clearFilterButton: {
    backgroundColor: 'rgba(255,82,82,0.2)',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  clearFilterButtonText: {
    color: COLORS.error,
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.error,
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
  },
  tableContainer: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    width: '100%',
    maxWidth: 600,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.tableHeader,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerCell: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  tableCell: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textPrimary,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  dateCell: { flex: 1.5 },
  typeCell: { flex: 1.5 },
  amountCell: { flex: 1.5 },
  feesCell: { flex: 1 },
  refCell: { flex: 1.8 },
  statusCell: { flex: 1 },
  balanceCell: { flex: 2 },
  flatListContent: {
    paddingBottom: 0,
  },
  noTransactionsText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
  },
});