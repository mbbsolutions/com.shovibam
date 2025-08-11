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
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { getAirtimeProviders, topupAirtime } from '../utils/AirtimeUtils';
import GeneralIconsMenuButtons from '../components/GeneralIconsMenuButtons';
import PinVerifyPopup from '../components/PinVerifyPopup';
import TransactionResultModal from '../components/Receipt';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import provider icons for Airtime
const airtimeProviderIcons = {
  MTN: require('../assets/mtn_icon.png'),
  GLO: require('../assets/glo_icon.png'),
  AIRTEL: require('../assets/airtel_icon.png'),
  '9MOBILE': require('../assets/ninemobile_icon.png'),
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

  // New state variables for PIN and Transaction Result
  const [pinVerifyVisible, setPinVerifyVisible] = useState(false);
  const [inputPin, setInputPin] = useState('');
  const [transactionResult, setTransactionResult] = useState({
    visible: false,
    status: 'pending',
    title: 'Transaction Result',
    debug: '',
  });

  useEffect(() => {
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

      if (topupResponse && topupResponse.success === true) {
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
      }
    } catch (err) {
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
});
