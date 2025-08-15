import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
  Platform,
  Image,
  FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { getAirtimeProviders, topupAirtime } from '../utils/AirtimeUtils';
import GeneralIconsMenuButtons from '../components/GeneralIconsMenuButtons';
import PinVerifyPopup from '../components/PinVerifyPopup';
import TransactionResultModal from '../components/Receipt';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendEmail } from '../utils/emailService'; // Import the email service

// Import provider icons for Airtime
const airtimeProviderIcons = {
  MTN: require('../assets/mtn_icon.png'),
  GLO: require('../assets/glo_icon.png'),
  AIRTEL: require('../assets/airtel_icon.png'),
  '9MOBILE': require('../assets/ninemobile_icon.png'),
  // SIM_CARD_GENERIC reference has been removed from here
};

// Helper function to format money
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

// Helper function to generate a unique reference
const generateUniqueReference = () => {
  return `ref_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
};

export default function AirtimeScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user: userFromNavigation } = route.params || {};
  const {
    isAuthenticated,
    selectedAccount,
    isLoadingAuth,
    refreshAuthData,
  } = useAuth();

  const accountToUse = userFromNavigation || selectedAccount;

  // State variables
  const [step, setStep] = useState(1);
  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingProviders, setFetchingProviders] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [reference, setReference] = useState('');
  const [transactionHistory, setTransactionHistory] = useState([]);

  // New state variables for PIN and Transaction Result
  const [pinVerifyVisible, setPinVerifyVisible] = useState(false);
  const [inputPin, setInputPin] = useState('');
  const [transactionResult, setTransactionResult] = useState({
    visible: false,
    status: 'pending',
    title: 'Transaction Result',
    debug: '',
  });

  // Load transaction history from AsyncStorage
  const loadTransactionHistory = async () => {
    try {
      const history = await AsyncStorage.getItem('airtimeTransactionHistory');
      if (history) {
        setTransactionHistory(JSON.parse(history));
      }
    } catch (error) {
      console.error('Failed to load transaction history:', error);
    }
  };

  // Save transaction to history
  const saveToTransactionHistory = async (transaction) => {
    try {
      // Ensure the transaction has an 'id' for FlatList keyExtractor
      const transactionWithId = { ...transaction, id: transaction.id || generateUniqueReference() };
      const newHistory = [transactionWithId, ...transactionHistory.slice(0, 9)]; // Keep last 10 transactions
      await AsyncStorage.setItem('airtimeTransactionHistory', JSON.stringify(newHistory));
      setTransactionHistory(newHistory);
    } catch (error) {
      console.error('Failed to save transaction history:', error);
    }
  };


  useEffect(() => {
    loadTransactionHistory(); // Load history on component mount
    // Load cached providers if available
    const loadCachedProviders = async () => {
      try {
        const cachedProviders = await AsyncStorage.getItem('airtimeProviders');
        if (cachedProviders) {
          setProviders(JSON.parse(cachedProviders));
        }
      } catch (error) {
        console.error('Failed to load cached providers:', error);
      }
    };

    loadCachedProviders();

    // Fetch providers in the background
    if (isAuthenticated) {
      fetchAirtimeProviders();
    }
  }, [isAuthenticated]);

  const fetchAirtimeProviders = async () => {
    setFetchingProviders(true);
    setError('');
    try {
      const response = await getAirtimeProviders();
      if (response && response.success && response.data) {
        const mappedProviders = response.data.map(apiProvider => ({
          code: apiProvider.provider,
          name: apiProvider.provider,
          minAmount: apiProvider.minAmount ? Number(apiProvider.minAmount) : 0,
          maxAmount: apiProvider.maxAmount ? Number(apiProvider.maxAmount) : Infinity,
          icon: airtimeProviderIcons[apiProvider.provider.toUpperCase()] || null,
        }));

        // Cache the fetched providers
        await AsyncStorage.setItem('airtimeProviders', JSON.stringify(mappedProviders));

        setProviders(mappedProviders);
      } else {
        setError(response?.message || 'Failed to fetch airtime providers.');
      }
    } catch (err) {
      setError(err.message || 'An error occurred while fetching providers.');
    } finally {
      setFetchingProviders(false);
    }
  };

  const handleProviderSelect = (provider) => {
    setSelectedProvider(provider);
    setStep(2);
    setError('');
    setPhoneNumber('');
  };

  const handlePhoneNumberChange = (text) => {
    const cleanedText = text.replace(/[^0-9]/g, '');
    if (cleanedText.length <= 11) {
      setPhoneNumber(cleanedText);
    }
  };

  const handleAmountChange = (text) => {
    const cleanedText = text.replace(/[^0-9.]/g, '');
    setAmount(cleanedText);
  };

  const validateInputs = () => {
    if (!selectedProvider) {
      setError('Please select a provider.');
      return false;
    }
    if (!phoneNumber || phoneNumber.length !== 11 || !/^\d{11}$/.test(phoneNumber)) {
      setError('Please enter a valid 11-digit phone number.');
      return false;
    }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError('Please enter a valid amount.');
      return false;
    }
    const numericAmount = Number(amount);
    const numericBalance = Number(accountToUse.balance);
    if (selectedProvider.minAmount && numericAmount < selectedProvider.minAmount) {
      setError(`Amount must be at least ₦${formatAmount(selectedProvider.minAmount)}.`);
      return false;
    }
    if (selectedProvider.maxAmount && numericAmount > selectedProvider.maxAmount) {
      setError(`Amount cannot exceed ₦${formatAmount(selectedProvider.maxAmount)}.`);
      return false;
    }
    if (numericBalance !== undefined && numericAmount > numericBalance) {
      setError('Insufficient account balance.');
      return false;
    }
    return true;
  };

  // Function to send transaction email
  const sendTransactionEmail = async (transaction, status) => {
    try {
      if (!accountToUse?.customer_email) {
        console.warn('Customer email not available for sending transaction email.');
        return;
      }

      const subject = `Airtime Purchase ${status === 'success' ? 'Successful' : 'Failed'}`;
      const body = `
        <h3 style="color: ${status === 'success' ? '#4CAF50' : '#F44336'};">
          Airtime Purchase ${status === 'success' ? 'Successful' : 'Failed'}
        </h3>
        <p><strong>Network:</strong> ${transaction.provider}</p>
        <p><strong>Phone Number:</strong> ${transaction.phoneNumber}</p>
        <p><strong>Amount:</strong> ₦${formatAmount(transaction.amount)}</p>
        <p><strong>Status:</strong> ${transaction.status}</p>
        <p><strong>Date:</strong> ${new Date(transaction.date).toLocaleString()}</p>
        ${transaction.message ? `<p><strong>Message:</strong> ${transaction.message}</p>` : ''}
        <p>Thank you for using our service.</p>
      `;

      await sendEmail({
        toEmail: accountToUse.customer_email,
        subject,
        body,
        isHtml: true,
      });
      console.log(`Transaction ${status} email sent for reference: ${transaction.id}`);
    } catch (error) {
      console.error('Failed to send transaction email:', error);
    }
  };


  // Modify handlePinVerifiedSuccess to include email sending
  const handlePinVerifiedSuccess = async () => {
    setLoading(true);
    setError('');
    try {
      const topupResponse = await topupAirtime({
        provider: selectedProvider.code,
        number: phoneNumber,
        amount: amount,
        reference: reference,
      });

      // Create transaction record for history
      const transactionRecord = {
        id: reference, // Use the generated reference as ID
        provider: selectedProvider.code,
        phoneNumber: phoneNumber,
        amount: amount,
        status: topupResponse?.success ? 'success' : 'failed',
        date: new Date().toISOString(),
        message: topupResponse?.message || '',
      };

      await saveToTransactionHistory(transactionRecord);

      if (topupResponse?.success) {
        setTransactionResult({
          visible: true,
          status: 'success',
          title: 'Airtime Purchase Successful',
          debug: JSON.stringify({
            server_response: topupResponse,
            transaction_details: {
              provider: selectedProvider.code,
              phoneNumber,
              amount,
              reference,
            },
          }),
        });
        await refreshAuthData();
        // Send success email
        await sendTransactionEmail(transactionRecord, 'success');
      } else {
        setTransactionResult({
          visible: true,
          status: 'failed',
          title: 'Airtime Purchase Failed',
          debug: JSON.stringify({
            server_response: topupResponse,
            error_message: topupResponse?.message || 'Unknown error',
          }),
        });
        setError(topupResponse?.message || 'Airtime top-up failed.');
        // Send failure email
        await sendTransactionEmail(transactionRecord, 'failed');
      }
    } catch (err) {
      const transactionRecord = {
        id: reference,
        provider: selectedProvider?.code || 'unknown',
        phoneNumber: phoneNumber,
        amount: amount,
        status: 'failed',
        date: new Date().toISOString(),
        message: err.message || 'Transaction failed due to network error.',
      };

      await saveToTransactionHistory(transactionRecord);
      await sendTransactionEmail(transactionRecord, 'failed'); // Send failure email on caught error

      setTransactionResult({
        visible: true,
        status: 'failed',
        title: 'Transaction Error',
        debug: JSON.stringify({
          error: err.message,
          stack: err.stack,
        }),
      });
      setError(err.message || 'An unexpected error occurred during top-up.');
    } finally {
      setLoading(false);
      setPinVerifyVisible(false);
    }
  };

  const handleTopup = () => {
    if (!validateInputs()) {
      return;
    }
    if (!isAuthenticated) {
      Alert.alert('Authentication Error', 'You must be logged in to complete this transaction.');
      return;
    }
    const ref = generateUniqueReference();
    setReference(ref);
    setPinVerifyVisible(true);
  };

  const handleReceiptClose = () => {
    setTransactionResult(prev => ({ ...prev, visible: false }));
    if (transactionResult.status === 'success') {
      resetToInitialState();
    }
  };

  const resetToInitialState = () => {
    setStep(1);
    setSelectedProvider(null);
    setPhoneNumber('');
    setAmount('');
    setError('');
    setLoading(false);
    setInputPin('');
    setReference('');
  };

  const onPullToRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshAuthData();
      await fetchAirtimeProviders(); // Refresh providers as well
      await loadTransactionHistory(); // Refresh history on pull-to-refresh
    } catch (error) {
      console.error('Error during pull-to-refresh:', error);
    } finally {
      setRefreshing(false);
    }
  };

  if (isLoadingAuth) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.header}>Loading Account Details...</Text>
          <Text style={styles.message}>Please wait while we fetch your account information.</Text>
          <ActivityIndicator size="large" color="#4CC9F0" style={{ marginTop: 20 }} />
        </View>
      </View>
    );
  }

  if (!isAuthenticated || !accountToUse) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.header}>Access Denied</Text>
          <Text style={styles.message}>You must be logged in and have an account selected to buy airtime.</Text>
          <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Function to handle transaction card click
  const handleTransactionCardClick = (item) => {
    // Find the provider from the providers list that matches the transaction
    const provider = providers.find(p => p.code === item.provider);
    if (provider) {
      setSelectedProvider(provider);
      setPhoneNumber(item.phoneNumber);
      setAmount(item.amount.toString()); // Ensure amount is a string for TextInput
      setStep(2); // Move to the purchase form step
      setError(''); // Clear any previous errors
    } else {
      Alert.alert('Provider Not Found', `Could not find details for ${item.provider}. Please select manually.`);
    }
  };

  const renderTransactionItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => handleTransactionCardClick(item)}
      activeOpacity={0.7}
      style={styles.touchableTransactionCard} // Added a style for touchable
    >
      <View style={[
        styles.transactionCard,
        item.status === 'success' ? styles.successCard : styles.failedCard
      ]}>
        <View style={styles.transactionHeader}>
          {/* Use a MaterialIcons sim-card directly as a fallback icon */}
          {item.provider && airtimeProviderIcons[item.provider.toUpperCase()] ? (
            <Image 
              source={airtimeProviderIcons[item.provider.toUpperCase()]} 
              style={styles.transactionProviderIcon} 
            />
          ) : (
            // Fallback to MaterialIcons "sim-card" directly
            <Icon name="sim-card" size={16} color="#B0B0B0" style={styles.transactionProviderIcon} />
          )}
          <Text style={styles.transactionProvider} numberOfLines={1}>
            {item.provider}
          </Text>
          <Text style={[
            styles.transactionStatus,
            item.status === 'success' ? styles.successStatus : styles.failedStatus
          ]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.transactionPhone} numberOfLines={1}>
          {item.phoneNumber}
        </Text>
        <Text style={styles.transactionAmount}>
          ₦{formatAmount(item.amount)}
        </Text>
        {/* Removed transactionDate and transactionMessage from here */}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onPullToRefresh}
            colors={['#4CC9F0']}
            tintColor="#4CC9F0"
          />
        }
      >
        <View style={styles.card}>
          <Text style={styles.pageMainTitle}>
            <Icon name="phone-android" size={24} color="#4CC9F0" /> Buy Airtime
          </Text>
          <View style={styles.accountInfoContainer}>
            <Text style={styles.accountName}>
              {accountToUse.customer_first_name} {accountToUse.customer_last_name}
            </Text>
            <Text style={styles.accountNumber}>{accountToUse.account_number}</Text>
            <Text style={[styles.accountNumber, { fontWeight: 'bold', color: '#4CC9F0', marginTop: 2 }]}>
              Bal: ₦{accountToUse.balance !== undefined ? formatAmount(accountToUse.balance) : 'N/A'}
            </Text>
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Recent Transactions Section */}
          {transactionHistory.length > 0 && (
            <View style={styles.transactionHistoryContainer}>
              <Text style={styles.sectionTitle}>Recent Transactions</Text>
              <FlatList
                data={transactionHistory}
                renderItem={renderTransactionItem}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.transactionList}
              />
            </View>
          )}

          {step === 1 && (
            <View style={styles.providerSelectionContainer}>
              <Text style={styles.sectionTitle}>Select Network Provider</Text>
              {fetchingProviders ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#4CC9F0" />
                  <Text style={styles.loadingText}>Fetching providers...</Text>
                </View>
              ) : providers.length > 0 ? (
                <View style={styles.providersGrid}>
                  {providers.map((provider) => (
                    <TouchableOpacity
                      key={provider.code}
                      style={styles.providerCard}
                      onPress={() => handleProviderSelect(provider)}
                    >
                      {provider.icon ? (
                        <Image source={provider.icon} style={styles.providerIcon} />
                      ) : (
                        <Icon name="sim-card" size={40} color="#B0B0B0" style={styles.providerIconPlaceholder} />
                      )}
                      <Text style={styles.providerName}>{provider.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={styles.noDataText}>No airtime providers available. Try again later.</Text>
              )}
            </View>
          )}
          {step === 2 && selectedProvider && (
            <View style={styles.levelSection}>
              <View style={styles.providerHeader}>
                <TouchableOpacity onPress={() => setStep(1)} style={styles.backButton}>
                  <Icon name="arrow-back" size={20} color="#4CC9F0" />
                  <Text style={styles.backButtonText}>Back to Providers</Text>
                </TouchableOpacity>
                <View style={styles.providerTitleContainer}>
                  {selectedProvider.icon ? (
                    <Image
                      source={selectedProvider.icon}
                      style={styles.selectedProviderIcon}
                    />
                  ) : (
                    <Icon name="sim-card" size={30} color="#B0B0B0" style={styles.selectedProviderIcon} />
                  )}
                  <Text style={styles.sectionTitle}>{selectedProvider.name} Airtime</Text>
                </View>
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Phone Number *</Text>
                <Icon name="phone-android" size={18} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={phoneNumber}
                  onChangeText={handlePhoneNumberChange}
                  placeholder="e.g., 08012345678"
                  placeholderTextColor="#B0B0B0"
                  keyboardType="phone-pad"
                  maxLength={11}
                />
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Amount *</Text>
                <Icon name="attach-money" size={18} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={amount}
                  onChangeText={handleAmountChange}
                  placeholder="e.g., 1000"
                  placeholderTextColor="#B0B0B0"
                  keyboardType="numeric"
                  maxLength={11}
                />
              </View>
              {selectedProvider.minAmount !== 0 && selectedProvider.maxAmount !== Infinity && (
                <Text style={styles.infoText}>
                  Min: ₦{formatAmount(selectedProvider.minAmount)} | Max: ₦{formatAmount(selectedProvider.maxAmount)}
                </Text>
              )}
              <TouchableOpacity
                style={[styles.purchaseButton, loading ? styles.buttonDisabled : null]}
                onPress={handleTopup}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <ActivityIndicator size="small" color="#121212" />
                    <Text style={styles.purchaseButtonText}> Processing...</Text>
                  </>
                ) : (
                  <Text style={styles.purchaseButtonText}>Buy Airtime</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
      <PinVerifyPopup
        visible={pinVerifyVisible}
        onClose={() => setPinVerifyVisible(false)}
        onPinVerifiedSuccess={handlePinVerifiedSuccess}
        inputPin={inputPin}
        setPin={setInputPin}
        transferDetails={{
          amount: amount,
          recipientName: phoneNumber,
          recipientAcct: selectedProvider?.name || 'Airtime',
          description: `Airtime purchase for ${phoneNumber}`,
          reference: reference,
        }}
        loading={loading}
      />
      <TransactionResultModal
        visible={transactionResult.visible}
        status={transactionResult.status}
        title={transactionResult.title}
        debug={transactionResult.debug}
        onClose={handleReceiptClose}
        transferDetails={{
          amount: amount,
          account_name: phoneNumber,
          account_number: selectedProvider?.name || 'Airtime',
          bank_name: selectedProvider?.name || 'Network',
          description: `Airtime purchase for ${phoneNumber}`,
          reference: reference,
          sender_name: `${accountToUse?.customer_first_name} ${accountToUse?.customer_last_name}`,
          sender_bank: accountToUse?.bank_name,
          sender_account: accountToUse?.account_number,
        }}
        selectedAccount={accountToUse}
      />
      <GeneralIconsMenuButtons navigation={navigation} active="Dashboard" />
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 16,
    paddingTop: Platform.OS === 'android' ? 30 : 50,
    paddingBottom: 120,
  },
  card: {
    backgroundColor: '#0A1128',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: 100,
  },
  header: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 15,
    textAlign: 'center',
  },
  pageMainTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CC9F0',
    marginBottom: 20,
    textAlign: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  accountInfoContainer: {
    backgroundColor: 'rgba(76, 201, 240, 0.1)',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(76, 201, 240, 0.3)',
    alignSelf: 'flex-end',
    width: 'auto',
  },
  accountName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 5,
    textAlign: 'right',
  },
  accountNumber: {
    fontSize: 14,
    color: '#B0B0B0',
    textAlign: 'right',
  },
  levelSection: {
    backgroundColor: '#0A1128',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 15,
    textAlign: 'center',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#B0B0B0',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  backButtonText: {
    fontSize: 14,
    color: '#4CC9F0',
    marginLeft: 5,
  },
  noDataText: {
    fontSize: 14,
    color: '#B0B0B0',
    textAlign: 'center',
    padding: 20,
  },
  inputContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 5,
  },
  inputIcon: {
    position: 'absolute',
    left: 10,
    top: '50%',
    transform: [{ translateY: -9 }],
    color: '#B0B0B0',
    zIndex: 1,
  },
  input: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 12,
    paddingLeft: 35,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(76, 201, 240, 0.5)',
    borderRadius: 6,
    backgroundColor: '#121212',
    color: '#FFFFFF',
  },
  purchaseButton: {
    backgroundColor: '#4CC9F0',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
    borderRadius: 8,
  },
  purchaseButtonText: {
    color: '#121212',
    fontSize: 16,
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: '#4CC9F0',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#121212',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    marginBottom: 15,
    padding: 10,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#B0B0B0',
    textAlign: 'center',
    marginBottom: 20,
  },
  providerSelectionContainer: {
    marginBottom: 20,
  },
  providersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  providerCard: {
    width: '48%',
    aspectRatio: 1.5,
    backgroundColor: '#0A1128',
    borderRadius: 10,
    marginBottom: 12,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  providerIcon: {
    width: 40,
    height: 40,
    marginBottom: 8,
    resizeMode: 'contain',
  },
  providerIconPlaceholder: {
    width: 40,
    height: 40,
    marginBottom: 8,
    textAlign: 'center',
    lineHeight: 40,
  },
  providerName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  providerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  providerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  selectedProviderIcon: {
    width: 30,
    height: 30,
    marginRight: 10,
    resizeMode: 'contain',
  },
  infoText: {
    fontSize: 14,
    color: '#B0B0B0',
    textAlign: 'center',
    marginTop: -10,
    marginBottom: 20,
  },
  // Updated styles for the compact transaction history section
  transactionHistoryContainer: {
    marginBottom: 20,
  },
  transactionList: {
    paddingHorizontal: 5,
  },
  touchableTransactionCard: { // New style for TouchableOpacity wrapper
    marginRight: 8, // Same as transactionCard.marginRight to maintain spacing
  },
  transactionCard: {
    width: 120, // Reduced from 160
    borderRadius: 8,
    padding: 10, // Reduced from 12
    // marginRight: 8, // Moved to touchableTransactionCard
    backgroundColor: '#0A1128',
    borderWidth: 1,
    height: 90, // Fixed height for consistency
    justifyContent: 'space-between', // Added for vertical distribution of content
  },
  successCard: {
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  failedCard: {
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  transactionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4, // Reduced from 8
  },
  transactionProviderIcon: {
    width: 16, // Reduced from 20
    height: 16, // Reduced from 20
    marginRight: 4, // Reduced from 6
    resizeMode: 'contain', // Added to ensure image scales correctly
  },
  transactionProvider: {
    flex: 1,
    fontSize: 10, // Reduced from 12
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  transactionStatus: {
    fontSize: 8, // Reduced from 10
    fontWeight: 'bold',
    paddingHorizontal: 3, // Reduced from 4
    paddingVertical: 1, // Reduced from 2
    borderRadius: 3, // Reduced from 4
  },
  successStatus: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    color: '#4CAF50',
  },
  failedStatus: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    color: '#EF4444',
  },
  transactionPhone: {
    fontSize: 12, // Reduced from 14
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2, // Reduced from 4
  },
  transactionAmount: {
    fontSize: 14, // Reduced from 16
    fontWeight: 'bold',
    color: '#4CC9F0',
    // marginBottom removed as per optimization
  },
  // Removed transactionDate and transactionMessage styles as they're no longer used
});
