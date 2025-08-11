import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../contexts/AuthContext';
import { fetchLatestHistoryForAccount } from '../utils/historyTable_gen_local';
import { LoginActionIcons, PosIcon } from '../components/Loginicons';
import { setCharges } from '../utils/setCharges';
import { useRoute } from '@react-navigation/native';

// === DARK THEME COLORS ===
const COLORS = {
  backgroundPrimary: '#121212',
  cardBackground: '#0A1128',
  accent: '#4CC9F0',
  textPrimary: '#FFFFFF',
  textSecondary: '#B0B0B0',
  border: 'rgba(255,255,255,0.15)',
  shadow: '#000',
  inputBg: '#1E1E1E',
  buttonBg: '#4CC9F0',
  buttonText: '#121212',
  errorBg: '#3C1E1E',
  successBg: '#1E3C1E',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

// Get screen height for responsive styling
const { height: screenHeight } = Dimensions.get('window');

export default function POS({ navigation }) {
  const route = useRoute();
  const { selectedAccount, isLoadingAuth, updateSelectedAccountBalance } = useAuth();

  const [currentAccountBalance, setCurrentAccountBalance] = useState(null);
  const [fetchingBalance, setFetchingBalance] = useState(true);
  const [amount, setAmount] = useState('');
  const [amountInWords, setAmountInWords] = useState('');
  const [charges, setChargesState] = useState('0.00');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showCardModal, setShowCardModal] = useState(false);
  const [cardPin, setCardPin] = useState('');
  const [cardProcessing, setCardProcessing] = useState(false);
  const [cardError, setCardError] = useState('');
  const [isTransactionActive, setIsTransactionActive] = useState(false);
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;

  // Flash animation for "INSERT CARD"
  useEffect(() => {
    if (showCardModal) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(flashAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(flashAnim, {
            toValue: 0,
            duration: 800,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      flashAnim.stopAnimation();
      flashAnim.setValue(0);
    }
  }, [showCardModal, flashAnim]);

  // Number to Words Logic
  const convertChunk = useCallback((num) => {
    const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    let chunk = '';
    if (num >= 100) {
      chunk += units[Math.floor(num / 100)] + ' Hundred ';
      num %= 100;
    }
    if (num >= 10 && num <= 19) {
      chunk += teens[num - 10];
    } else if (num >= 20) {
      chunk += tens[Math.floor(num / 10)] + ' ';
      num %= 10;
    }
    if (num >= 1 && num <= 9) {
      chunk += units[num];
    }
    return chunk.trim();
  }, []);

  const numberToWords = useCallback(
    (num) => {
      if (num === 0) return 'Zero Naira';
      if (num < 0) return 'Minus ' + numberToWords(Math.abs(num));
      let words = '';
      const scales = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];
      let integerPart = Math.floor(num);
      let decimalPart = Math.round((num - integerPart) * 100);

      if (integerPart === 0) {
        words = 'Zero';
      } else {
        let i = 0;
        while (integerPart > 0) {
          const chunk = integerPart % 1000;
          if (chunk !== 0) {
            const chunkWords = convertChunk(chunk);
            words = chunkWords + ' ' + scales[i] + ' ' + words;
          }
          integerPart = Math.floor(integerPart / 1000);
          i++;
        }
      }

      words = words.trim();
      if (words) words += ' Naira';
      if (decimalPart > 0) {
        words += (words ? ' and ' : '') + convertChunk(decimalPart) + ' Kobo';
      }
      return words.trim() || 'Zero Naira';
    },
    [convertChunk]
  );

  const formatMoney = useCallback((val) => {
    const numericVal = parseFloat(val);
    if (isNaN(numericVal)) return '';
    return numericVal.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }, []);

  // Fetch latest balance
  useEffect(() => {
    const getLatestBalance = async () => {
      if (!selectedAccount?.customer_id) {
        setCurrentAccountBalance(null);
        setFetchingBalance(false);
        return;
      }
      setFetchingBalance(true);
      try {
        const result = await fetchLatestHistoryForAccount({ customerId: selectedAccount.customer_id });
        if (result.success && result.row && result.row.balance !== undefined) {
          setCurrentAccountBalance(Number(result.row.balance));
        } else {
          setCurrentAccountBalance(
            selectedAccount?.balance !== undefined ? Number(selectedAccount.balance) : null
          );
          console.warn('POS.js: Using fallback balance from selectedAccount.');
        }
      } catch (error) {
        console.error('POS.js: Error fetching balance:', error);
        setCurrentAccountBalance(
          selectedAccount?.balance !== undefined ? Number(selectedAccount.balance) : null
        );
      } finally {
        setFetchingBalance(false);
      }
    };

    if (!isLoadingAuth && selectedAccount) {
      getLatestBalance();
    } else {
      setFetchingBalance(false);
    }
  }, [isLoadingAuth, selectedAccount]);

  // Handle amount input
  const handleAmountChange = useCallback(
    async (text) => {
      const cleanedText = text.replace(/[^0-9.]/g, '');
      const parts = cleanedText.split('.');
      let finalAmount = parts[0];
      if (parts.length > 1) {
        finalAmount += '.' + parts.slice(1).join('');
      }
      setAmount(finalAmount);
      const numericAmount = parseFloat(finalAmount);
      if (!isNaN(numericAmount)) {
        setAmountInWords(numberToWords(numericAmount));
        const fetchedCharges = await setCharges({ amount: numericAmount, main_type: 'Payout' });
        setChargesState(fetchedCharges);
      } else {
        setAmountInWords('');
        setChargesState('0.00');
      }
    },
    [numberToWords]
  );

  // Handle pre-filled amount from navigation
  useEffect(() => {
    if (route.params?.amount) {
      const passedAmount = route.params.amount.toString();
      handleAmountChange(passedAmount);
      navigation.setParams({ amount: undefined });
    }
  }, [route.params?.amount, navigation, handleAmountChange]);

  const validateMainForm = () => {
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setErrorMsg('Enter a valid cashout amount');
      return false;
    }
    setErrorMsg('');
    return true;
  };

  const handleCashout = () => {
    if (validateMainForm()) {
      setShowCardModal(true);
      setCardPin('');
      setCardError('');
      setIsTransactionActive(true);
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 1500,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 1500,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  };

  const validateCardDetails = () => {
    setCardError('');
    if (!cardPin.match(/^\d{4}$/)) {
      setCardError('Please enter a valid 4-digit PIN.');
      return false;
    }
    return true;
  };

  const handleProcessCard = async () => {
    if (!validateCardDetails()) return;

    setCardProcessing(true);
    try {
      await new Promise((r) => setTimeout(r, 2000));
      const isSuccess = Math.random() > 0.2;

      if (isSuccess) {
        setSuccess(`Cashout of ₦${formatMoney(parseFloat(amount))} successful!`);
        if (updateSelectedAccountBalance && selectedAccount?.customer_id && selectedAccount?.account_number) {
          updateSelectedAccountBalance(selectedAccount.customer_id, selectedAccount.account_number);
        }
        setAmount('');
        setAmountInWords('');
        setChargesState('0.00');
        setIsTransactionActive(false);
        scanLineAnim.stopAnimation();
        scanLineAnim.setValue(0);
      } else {
        setCardError('Card processing failed. Please check details or try again.');
        setIsTransactionActive(false);
        scanLineAnim.stopAnimation();
        scanLineAnim.setValue(0);
      }
    } catch (e) {
      console.error('Card processing error:', e);
      setCardError('An unexpected error occurred.');
      setIsTransactionActive(false);
      scanLineAnim.stopAnimation();
      scanLineAnim.setValue(0);
    } finally {
      setCardProcessing(false);
    }
  };

  const handleKeypadPress = (key) => {
    if (cardProcessing) return;
    if (key === 'back') {
      setCardPin((prev) => prev.slice(0, -1));
    } else if (cardPin.length < 4) {
      setCardPin((prev) => prev + key);
    }
  };

  const handleManualPinChange = (text) => {
    const cleanedText = text.replace(/\D/g, '');
    if (cleanedText.length <= 4) {
      setCardPin(cleanedText);
    }
  };

  const renderKeypad = () => {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'];
    return (
      <View style={styles.keypadContainer}>
        {keys.map((key, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.keypadButton,
              key === '' && styles.keypadButtonEmpty,
              key === 'back' && styles.keypadButtonBack,
            ]}
            onPress={() => handleKeypadPress(key)}
            disabled={cardProcessing || key === ''}
          >
            {key === 'back' ? (
              <Ionicons name="backspace-outline" size={24} color={COLORS.textPrimary} />
            ) : (
              <Text style={styles.keypadButtonText}>{key}</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  if (isLoadingAuth || fetchingBalance) {
    return (
      <SafeAreaView style={localPOSStyles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={localPOSStyles.loadingText}>Loading account data...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={localPOSStyles.safeArea}>
      {/* Header */}
      <View style={localPOSStyles.headerSection}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingRight: 10 }}>
          <Ionicons name="arrow-back" size={24} color={COLORS.accent} />
        </TouchableOpacity>
        <View style={localPOSStyles.accountInfoMoved}>
          <Text style={localPOSStyles.accountName} numberOfLines={1}>
            {selectedAccount
              ? `${selectedAccount.customer_first_name || ''} ${selectedAccount.customer_last_name || ''}`.trim()
              : 'No Account Selected'}
          </Text>
          <Text style={localPOSStyles.accountNumber}>{selectedAccount?.account_number || 'N/A'}</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
        <ScrollView contentContainerStyle={localPOSStyles.scrollViewContent} keyboardShouldPersistTaps="handled">
          <View style={localPOSStyles.compactPosIconContainer}>
            <PosIcon size={40} navigation={navigation} isActive={true} color={COLORS.accent} />
          </View>

          {success ? <Text style={styles.successMsg}>{success}</Text> : null}
          {errorMsg ? <Text style={styles.errorMsg}>{errorMsg}</Text> : null}

          {isTransactionActive && (
            <View style={styles.transactionStatusContainer}>
              <ActivityIndicator size="small" color={COLORS.accent} />
              <Text style={styles.transactionStatusText}>
                Processing transaction for ₦{formatMoney(parseFloat(amount))}...
              </Text>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setIsTransactionActive(false);
                  setShowCardModal(false);
                  setCardProcessing(false);
                  scanLineAnim.stopAnimation();
                  scanLineAnim.setValue(0);
                  navigation.goBack();
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel Transaction</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.label}>Amount (₦)</Text>
          <TextInput
            style={styles.input}
            value={formatMoney(amount)}
            onChangeText={handleAmountChange}
            keyboardType="numeric"
            placeholder="Cashout Amount"
            placeholderTextColor={COLORS.textSecondary}
            editable={!isTransactionActive}
          />

          {amountInWords ? <Text style={styles.amountInWordsText}>{amountInWords}</Text> : null}

          {amount && !isNaN(parseFloat(amount)) && (
            <Text style={styles.chargesText}>Charges: ₦{charges}</Text>
          )}

          <TouchableOpacity
            style={[styles.button, (processing || isTransactionActive) && { opacity: 0.7 }]}
            onPress={handleCashout}
            disabled={processing || isTransactionActive}
          >
            {processing ? (
              <ActivityIndicator color={COLORS.buttonText} />
            ) : (
              <Text style={styles.buttonText}>Process Cashout</Text>
            )}
          </TouchableOpacity>
        </ScrollView>

        <LoginActionIcons />
      </KeyboardAvoidingView>

      <Modal
        animationType="slide"
        transparent={true}
        visible={showCardModal}
        onRequestClose={() => {
          if (!cardProcessing) {
            setIsTransactionActive(false);
            setShowCardModal(false);
            scanLineAnim.stopAnimation();
            scanLineAnim.setValue(0);
          }
        }}
      >
        <KeyboardAvoidingView style={styles.modalOverlay} behavior="padding">
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Card Transaction</Text>
            <Text style={styles.modalSubtitle}>Amount: ₦{formatMoney(parseFloat(amount))}</Text>
            {amountInWords ? <Text style={styles.modalAmountInWordsText}>{amountInWords}</Text> : null}
            {cardError ? <Text style={styles.errorMsg}>{cardError}</Text> : null}

            <View style={styles.scanningContainer}>
              <View style={styles.cardOutline}>
                <Animated.View
                  style={[
                    styles.scanLine,
                    {
                      transform: [
                        {
                          translateY: scanLineAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, 100],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              </View>
              <Animated.Text style={[styles.scanningText, { opacity: flashAnim }]}>INSERT CARD</Animated.Text>
              {cardProcessing && <ActivityIndicator size="large" color={COLORS.accent} style={{ marginTop: 12 }} />}
            </View>

            <TextInput
              style={styles.input}
              placeholder="Enter PIN"
              placeholderTextColor={COLORS.textSecondary}
              value={cardPin}
              onChangeText={handleManualPinChange}
              keyboardType="numeric"
              maxLength={4}
              secureTextEntry
              editable={!cardProcessing}
            />

            {renderKeypad()}

            <TouchableOpacity
              style={[styles.button, (cardPin.length !== 4 || cardProcessing) && { opacity: 0.6 }]}
              onPress={handleProcessCard}
              disabled={cardPin.length !== 4 || cardProcessing}
            >
              {cardProcessing ? (
                <ActivityIndicator color={COLORS.buttonText} />
              ) : (
                <Text style={styles.buttonText}>Process Card</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                setIsTransactionActive(false);
                setShowCardModal(false);
                setCardProcessing(false);
                scanLineAnim.stopAnimation();
                scanLineAnim.setValue(0);
              }}
              disabled={cardProcessing}
            >
              <Text style={styles.modalCloseButtonText}>Return</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// === STYLES ===
const styles = StyleSheet.create({
  label: {
    color: COLORS.textSecondary,
    marginTop: 16,
    marginBottom: 8,
    fontWeight: '600',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 14,
    backgroundColor: COLORS.inputBg,
    fontSize: 16,
    marginBottom: 12,
    color: COLORS.textPrimary,
  },
  amountInWordsText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 6,
    marginBottom: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  chargesText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: -4,
    marginBottom: 16,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  modalAmountInWordsText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
    marginBottom: 16,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  button: {
    backgroundColor: COLORS.buttonBg,
    padding: 16,
    borderRadius: 8,
    marginTop: 20,
    alignItems: 'center',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonText: {
    color: COLORS.buttonText,
    fontWeight: '700',
    fontSize: 17,
  },
  successMsg: {
    backgroundColor: COLORS.successBg,
    color: COLORS.accent,
    padding: 14,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.accent,
    fontSize: 15,
  },
  errorMsg: {
    backgroundColor: COLORS.errorBg,
    color: '#E57373',
    padding: 14,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#E57373',
    fontSize: 15,
  },
  transactionStatusContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(76, 201, 240, 0.1)',
    padding: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.accent,
    marginBottom: 24,
  },
  transactionStatusText: {
    fontSize: 16,
    color: COLORS.accent,
    fontWeight: '700',
    marginTop: 10,
    textAlign: 'center',
  },
  cancelButton: {
    backgroundColor: '#E57373',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    marginTop: 16,
  },
  cancelButtonText: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.overlay,
  },
  modalContent: {
    backgroundColor: COLORS.cardBackground,
    padding: 24,
    borderRadius: 12,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  modalCloseButton: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
    width: '100%',
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: COLORS.textSecondary,
    fontWeight: '700',
    fontSize: 15,
  },
  scanningContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  cardOutline: {
    width: 220,
    height: 120,
    borderWidth: 2,
    borderColor: COLORS.accent,
    borderRadius: 12,
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#121212',
  },
  scanLine: {
    width: '100%',
    height: 4,
    backgroundColor: COLORS.accent,
    position: 'absolute',
    top: 0,
  },
  scanningText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    fontWeight: 'bold',
  },
  keypadContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '100%',
    marginTop: 20,
    marginBottom: 10,
  },
  keypadButton: {
    width: '30%',
    aspectRatio: 1.5,
    margin: '1.5%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  keypadButtonEmpty: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  keypadButtonBack: {
    backgroundColor: COLORS.inputBg,
  },
  keypadButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
});

const localPOSStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.backgroundPrimary,
  },
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: COLORS.cardBackground,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  accountInfoMoved: {
    marginLeft: 12,
  },
  accountName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    maxWidth: 180,
  },
  accountNumber: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundPrimary,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  compactPosIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: COLORS.cardBackground,
    alignSelf: 'center',
    marginTop: 20,
    marginBottom: 20,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
});
