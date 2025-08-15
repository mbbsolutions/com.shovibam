import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Pressable,
    StyleSheet,
    Alert,
    ActivityIndicator,
    ScrollView,
    Platform,
    Keyboard,
    KeyboardAvoidingView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/Ionicons';

import { useAuth } from '../contexts/AuthContext';
import { fetchUserDetails, transferGeneral } from '../utils/transferGeneral';
import { setCharges } from '../utils/setCharges';
import { validateBudPayAccount } from '../utils/validate_ActNo_General';
import BankSearchDropdown from '../components/BankSearchDropdown';
import PinVerifyPopup from '../components/PinVerifyPopup';
import TransactionResultModal from '../components/Receipt';
import GeneralIconsMenuButtons from '../components/GeneralIconsMenuButtons';
import { getItem, saveItem } from '../utils/StorageService';
import { sendEmail } from '../utils/emailService';

// Define a key for AsyncStorage specific to the user
const RECIPIENT_HISTORY_KEY = (techvibesId) => `@recipient_history_${techvibesId}`;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
        paddingTop: Platform.OS === 'android' ? 30 : 50,
    },
    scrollContainer: {
        padding: 16,
        paddingBottom: 150,
    },
    headerCard: {
        backgroundColor: '#0A1128',
        borderRadius: 12,
        padding: 20,
        width: '100%',
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 8,
        position: 'relative',
    },
    topIconContainer: {
        position: 'absolute',
        top: 10,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 1,
    },
    accountInfoContainer: {
        marginTop: 30,
        alignItems: 'flex-end',
    },
    accountNameText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 4,
        textAlign: 'right',
    },
    accountNumberText: {
        fontSize: 14,
        color: '#B0B0B0',
        marginBottom: 4,
        textAlign: 'right',
    },
    balanceText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#4CC9F0',
        marginBottom: 4,
        textAlign: 'right',
    },
    timeText: {
        fontSize: 14,
        color: '#B0B0B0',
        textAlign: 'right',
    },
    label: {
        fontSize: 14,
        color: '#B0B0B0',
        marginBottom: 8,
    },
    formGroup: {
        marginBottom: 15,
    },
    input: {
        backgroundColor: '#1E1E1E',
        color: '#FFFFFF',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#333',
    },
    pickerContainer: {
        backgroundColor: '#1E1E1E',
        borderRadius: 8,
        overflow: 'hidden',
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#333',
    },
    picker: {
        color: '#FFFFFF',
        backgroundColor: '#1E1E1E',
    },
    pickerItem: {
        color: '#FFFFFF',
        backgroundColor: '#1E1E1E',
    },
    button: {
        backgroundColor: '#4CC9F0',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 20,
        ...Platform.select({
            web: {
                cursor: 'pointer',
                userSelect: 'none',
                outlineStyle: 'none',
            }
        })
    },
    buttonText: {
        color: '#0A1128',
        fontSize: 16,
        fontWeight: 'bold',
    },
    chargeText: {
        marginTop: 5,
        textAlign: 'right',
        color: '#B0B0B0',
        fontWeight: '600',
    },
    errorText: {
        color: '#FF6B6B',
        textAlign: 'center',
        marginVertical: 10,
        fontWeight: '600',
    },
    successText: {
        color: '#51E898',
        textAlign: 'center',
        marginVertical: 10,
        fontWeight: '600',
    },
    loadingIndicator: {
        marginTop: 20,
    },
    bankInput: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#1E1E1E',
        borderRadius: 8,
        padding: 12,
        borderWidth: 1,
        borderColor: '#333',
    },
    bankNameText: {
        color: '#FFFFFF',
        fontSize: 16,
        flex: 1,
    },
    bankPlaceholderText: {
        color: '#B0B0B0',
        fontSize: 16,
        flex: 1,
    },
    clearButton: {
        padding: 5,
    },
    recipientNameText: {
        fontSize: 14,
        color: '#B0B0B0',
        textAlign: 'right',
        marginTop: 5,
        fontWeight: '600',
    },
    validationStatus: {
        textAlign: 'right',
        marginTop: 5,
        fontSize: 12,
        fontWeight: 'bold',
    },
    validationStatusLoading: {
        color: '#4CC9F0',
    },
    validationStatusError: {
        color: '#FF6B6B',
    },
    transactionHistoryTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 10,
    },
    transactionCardsContainer: {
        flexDirection: 'row',
        height: 120,
        marginBottom: 20,
    },
    transactionCard: {
        width: 160,
        height: 100,
        borderRadius: 8,
        padding: 8,
        marginRight: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    transactionCardText: {
        color: '#FFFFFF',
        fontSize: 11,
        marginBottom: 2,
    },
    transactionCardBank: {
        fontWeight: 'bold',
        fontSize: 13,
    },
    scrollHint: {
        position: 'absolute',
        right: 10,
        top: '50%',
        marginTop: -10,
        color: '#4CC9F0',
        zIndex: 1,
    },
});

const generateTransactionReference = () => {
    const timestamp = Date.now().toString(36); // Base36 timestamp
    const randomStr = Math.random().toString(36).substr(2, 6); // Random string
    return `TRF-${timestamp}-${randomStr}`.toUpperCase();
};

const TransferScreen = ({ navigation }) => {
    const { selectedAccount, isLoadingAuth, currentUserTechvibesId } = useAuth();

    const amountInputRef = useRef(null);
    const accountNumberInputRef = useRef(null);
    const narrationInputRef = useRef(null);
    const paymentModeInputRef = useRef(null);

    const initialCustomerId = selectedAccount?.customer_id || '';
    const initialSenderName = `${selectedAccount?.customer_first_name} ${selectedAccount?.customer_last_name}`.trim();

    const [customerId, setCustomerId] = useState(initialCustomerId);
    const [senderName, setSenderName] = useState(initialSenderName);
    const [balance, setBalance] = useState(null);
    const [currency, setCurrency] = useState('NGN');
    const [amount, setAmount] = useState('');
    const [bankCode, setBankCode] = useState('');
    const [bankName, setBankName] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [narration, setNarration] = useState('');
    const [paymentMode, setPaymentMode] = useState('');
    const [charge, setCharge] = useState('0.00');

    const [isBankModalVisible, setIsBankModalVisible] = useState(false);
    const [bankSearchQuery, setBankSearchQuery] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [isTransferring, setIsTransferring] = useState(false);
    const [userDetailsError, setUserDetailsError] = useState('');
    const [transferMessage, setTransferMessage] = useState('');

    const [recipientName, setRecipientName] = useState('');
    const [isVerifyingAccount, setIsVerifyingAccount] = useState(false);
    const [validationError, setValidationError] = useState('');

    const [isPinPopupVisible, setIsPinPopupVisible] = useState(false);
    const [transactionPin, setTransactionPin] = useState('');
    const [transferResultDetails, setTransferResultDetails] = useState(null);
    const [isReceiptModalVisible, setIsReceiptModalVisible] = useState(false);

    const [localTransferHistory, setLocalTransferHistory] = useState([]);

    const saveRecipientHistory = useCallback(async (history) => {
        if (!currentUserTechvibesId) return;
        try {
            await saveItem(RECIPIENT_HISTORY_KEY(currentUserTechvibesId), history);
        } catch (error) {
            console.error('Error saving recipient history:', error);
        }
    }, [currentUserTechvibesId]);

    const loadRecipientHistory = useCallback(async () => {
        if (!currentUserTechvibesId) return [];
        try {
            const history = await getItem(RECIPIENT_HISTORY_KEY(currentUserTechvibesId));
            return history || [];
        } catch (error) {
            console.error('Error loading recipient history:', error);
            return [];
        }
    }, [currentUserTechvibesId]);

    useEffect(() => {
        const initHistory = async () => {
            if (currentUserTechvibesId) {
                const savedHistory = await loadRecipientHistory();
                if (savedHistory.length) {
                    setLocalTransferHistory(savedHistory);
                }
            }
        };
        initHistory();
    }, [currentUserTechvibesId, loadRecipientHistory]);

    const formatBalance = (num) => {
        const numStr = parseFloat(num).toFixed(2);
        return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };

    const generateTransferEmailContent = (status, details) => {
        const {
            amount,
            charges,
            account_name,
            account_number,
            bank_name,
            narration,
            reference
        } = details;

        const formattedAmount = formatBalance(amount);
        const formattedCharges = formatBalance(charges);
        const total = formatBalance(amount + charges);
        const formattedDate = new Date().toLocaleString();

        if (status === 'success') {
            return `
                <h2>Transfer Successful! 🎉</h2>
                <p>Your transfer was completed successfully.</p>
                <p><strong>Details:</strong></p>
                <ul>
                    <li><strong>Amount:</strong> ${currency} ${formattedAmount}</li>
                    <li><strong>Charges:</strong> ${currency} ${formattedCharges}</li>
                    <li><strong>Total Debit:</strong> ${currency} ${total}</li>
                    <li><strong>Recipient Name:</strong> ${account_name}</li>
                    <li><strong>Account Number:</strong> ${account_number}</li>
                    <li><strong>Bank Name:</strong> ${bank_name}</li>
                    <li><strong>Narration:</strong> ${narration}</li>
                    <li><strong>Reference:</strong> ${reference}</li>
                    <li><strong>Date:</strong> ${formattedDate}</li>
                </ul>
                <p>Thank you for using our service!</p>
            `;
        } else {
            return `
                <h2>Transfer Failed! 🚨</h2>
                <p>We're sorry, but your transfer could not be completed.</p>
                <p><strong>Details:</strong></p>
                <ul>
                    <li><strong>Amount:</strong> ${currency} ${formattedAmount}</li>
                    <li><strong>Recipient Name:</strong> ${account_name || 'N/A'}</li>
                    <li><strong>Account Number:</strong> ${account_number}</li>
                    <li><strong>Bank Name:</strong> ${bank_name}</li>
                    <li><strong>Narration:</strong> ${narration || 'N/A'}</li>
                    <li><strong>Reference:</strong> ${reference || 'N/A'}</li>
                    <li><strong>Date:</strong> ${formattedDate}</li>
                    <li><strong>Reason:</strong> ${details.message || 'Unknown error'}</li>
                </ul>
                <p>Please try again or contact support if the issue persists.</p>
            `;
        }
    };


    const areAllRequirementsFilled = () => {
        return (
            amount &&
            bankCode &&
            bankName &&
            accountNumber &&
            narration &&
            (currency !== 'KES' || paymentMode) &&
            recipientName
        );
    };

    const getCardColor = (bankName) => {
        let hash = 0;
        for (let i = 0; i < bankName.length; i++) {
            hash = bankName.charCodeAt(i) + ((hash << 5) - hash);
        }

        const colors = [
            '#4A6FA5',
            '#6A8C8D',
            '#8A6FA5',
            '#5D8A66',
            '#7A5D8A',
            '#5D7A8A',
            '#8A5D6D',
            '#6D8A5D'
        ];

        return colors[Math.abs(hash) % colors.length];
    };

    const addToTransferHistory = async (transferDetails) => {
        const newEntry = {
            bankName: transferDetails.bank_name,
            bankCode: transferDetails.bank_code,
            accountNumber: transferDetails.account_number,
            recipientName: transferDetails.account_name,
            id: Date.now(),
            timestamp: new Date().toISOString()
        };

        setLocalTransferHistory(prev => {
            const updatedHistory = [
                newEntry,
                ...prev.filter(item =>
                    item.accountNumber !== newEntry.accountNumber
                )
            ].slice(0, 10);
            saveRecipientHistory(updatedHistory);
            return updatedHistory;
        });
    };

    const handleHistoryCardPress = (historyItem) => {
        setBankName(historyItem.bankName);
        setBankCode(historyItem.bankCode);
        setAccountNumber(historyItem.accountNumber);
        setRecipientName(historyItem.recipientName);
        amountInputRef.current?.focus();
    };

    useEffect(() => {
        const loadUserDetails = async () => {
            if (!selectedAccount) {
                return;
            }

            const newCustomerId = selectedAccount.customer_id;
            const newSenderName = `${selectedAccount.customer_first_name} ${selectedAccount.customer_last_name}`.trim();

            setCustomerId(newCustomerId);
            setSenderName(newSenderName);

            setIsLoading(true);
            setUserDetailsError('');

            const result = await fetchUserDetails(newCustomerId);

            if (result.success) {
                setBalance(result.balance);
            } else {
                setUserDetailsError(result.error);
                setBalance(null);
            }
            setIsLoading(false);
        };

        if (!isLoadingAuth) {
            loadUserDetails();
        }
    }, [selectedAccount, isLoadingAuth]);

    useEffect(() => {
        if (amount) {
            const getCharge = async () => {
                const fetchedCharge = await setCharges({ amount: parseFloat(amount), main_type: "Payout" });
                setCharge(fetchedCharge);
            };
            getCharge();
        } else {
            setCharge('0.00');
        }
    }, [amount, currency]);

    useEffect(() => {
        if (currency !== 'KES') {
            setPaymentMode('');
        }
    }, [currency]);

    useEffect(() => {
        if (!bankCode || !accountNumber || accountNumber.length < 10) {
            setRecipientName('');
            setValidationError('');
            return;
        }

        const debounceValidation = setTimeout(async () => {
            setIsVerifyingAccount(true);
            setValidationError('');

            const validationResult = await validateBudPayAccount({
                bank_code: bankCode,
                account_number: accountNumber,
                currency,
            });

            if (validationResult.success) {
                setRecipientName(validationResult.account_name);
            } else {
                setRecipientName('');
                setValidationError(validationResult.error);
            }
            setIsVerifyingAccount(false);
        }, 500);

        return () => clearTimeout(debounceValidation);
    }, [bankCode, accountNumber, currency]);

    const initiateTransfer = async () => {
        setIsTransferring(true);
        setIsPinPopupVisible(false);

        // Generate a reference upfront
        const clientReference = generateTransactionReference();

        const transferData = {
            customer_id: customerId,
            sender_name: senderName,
            currency,
            amount: parseFloat(amount),
            bank_code: bankCode,
            bank_name: bankName,
            account_number: accountNumber,
            narration,
            client_reference: clientReference, // Add client-generated reference
            ...(currency === 'KES' && { paymentMode }),
        };

        let resultStatus = 'failed';
        let resultTitle = 'Transfer Failed!';
        let resultReason = 'Unknown error';
        let serverMessage = '';

        // Initialize finalReference with the client-generated reference
        let finalReference = clientReference;

        try {
            const result = await transferGeneral(transferData);

            if (result.server_response && result.server_response.success) {
                resultStatus = 'success';
                resultTitle = 'Transfer Successful!';
                resultReason = result.server_response.server_message || 'Transaction completed successfully.';
                // Use server reference if available, fallback to client reference
                finalReference = result.server_response.final_reference || clientReference;
                serverMessage = result.server_response.server_message || '';
                setTransferMessage(`✅ Transfer successful: ${serverMessage}`);

                setAmount('');
                setBankCode('');
                setBankName('');
                setAccountNumber('');
                setNarration('');
                setRecipientName('');
                setTransactionPin('');
            } else {
                resultStatus = 'failed';
                resultTitle = 'Transfer Failed!';
                resultReason = result.server_response?.server_message || result.error || 'Transaction could not be completed.';
                serverMessage = result.server_response?.server_message || result.error || 'Transfer failed.';
                setTransferMessage(`❌ Error: ${serverMessage}`);
            }

            // Send email notification regardless of success/failure
            if (selectedAccount?.customer_email) {
                const emailContent = generateTransferEmailContent(resultStatus, {
                    amount: parseFloat(amount),
                    charges: parseFloat(charge),
                    account_name: recipientName,
                    account_number: accountNumber,
                    bank_name: bankName,
                    narration: narration,
                    reference: finalReference, // Use the determined finalReference
                    message: resultReason
                });

                try {
                    await sendEmail({
                        toEmail: selectedAccount.customer_email,
                        subject: resultStatus === 'success'
                            ? `Transfer Successful - ${currency} ${formatBalance(amount)} to ${recipientName}`
                            : `Transfer Failed - ${currency} ${formatBalance(amount)}`,
                        body: emailContent,
                        isHtml: true
                    });
                    console.log('Email notification sent successfully');
                } catch (emailError) {
                    console.error('Failed to send email notification:', emailError);
                }
            }
        } catch (error) {
            resultStatus = 'failed';
            resultTitle = 'Transfer Failed!';
            resultReason = error.message || 'Network or unexpected error during transfer.';
            serverMessage = error.message || 'Transfer failed due to an unexpected error.';
            setTransferMessage(`❌ Error: ${serverMessage}`);

            // Send failure email if possible
            if (selectedAccount?.customer_email) {
                const emailContent = generateTransferEmailContent('failed', {
                    amount: parseFloat(amount),
                    charges: parseFloat(charge),
                    account_name: recipientName,
                    account_number: accountNumber,
                    bank_name: bankName,
                    narration: narration,
                    reference: clientReference, // Use the client-generated reference on catch
                    message: resultReason
                });

                try {
                    await sendEmail({
                        toEmail: selectedAccount.customer_email,
                        subject: `Transfer Failed - ${currency} ${formatBalance(amount)}`,
                        body: emailContent,
                        isHtml: true
                    });
                    console.log('Failure email notification sent');
                } catch (emailError) {
                    console.error('Failed to send failure email notification:', emailError);
                }
            }
        } finally {
            setIsTransferring(false);
            setTransferResultDetails({
                status: resultStatus,
                title: resultTitle,
                message: resultReason,
                reference: finalReference, // Use the determined finalReference
                amount: parseFloat(amount),
                charges: parseFloat(charge),
                account_name: recipientName,
                account_number: accountNumber,
                bank_name: bankName,
                narration: narration,
            });
            setIsReceiptModalVisible(true);
        }
    };

    const handleVerifyPinClick = (e) => {
        if (Platform.OS === 'web') {
            e?.preventDefault?.();
            Keyboard.dismiss();
        }

        if (!areAllRequirementsFilled()) {
            Alert.alert('Error', 'Please fill in all required fields and ensure the recipient account is validated.');
            return;
        }

        const transferAmount = parseFloat(amount);
        if (isNaN(transferAmount) || transferAmount <= 0) {
            Alert.alert('Error', 'Please enter a valid amount.');
            return;
        }

        if (balance !== null) {
            const totalDebit = transferAmount + parseFloat(charge);
            if (totalDebit > balance) {
                Alert.alert('Error', `Insufficient funds. Your total debit would be ${currency} ${formatBalance(totalDebit)}.`);
                return;
            }
        }

        if (bankName && bankCode && accountNumber && recipientName) {
            addToTransferHistory({
                bank_name: bankName,
                bank_code: bankCode,
                account_number: accountNumber,
                account_name: recipientName
            });
        }

        setIsPinPopupVisible(true);
        setTransactionPin('');
        setTransferResultDetails(null);
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContainer}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <GeneralIconsMenuButtons navigation={navigation} active="Transfer" />
                <View style={styles.headerCard}>
                    <View style={styles.topIconContainer}>
                        <Icon name="send" size={24} color="#4CC9F0" />
                    </View>
                    <View style={styles.accountInfoContainer}>
                        <Text style={styles.accountNumberText}>
                            {selectedAccount?.account_number || 'Loading...'}
                        </Text>
                        <Text style={styles.accountNameText}>
                            {selectedAccount
                                ? `${selectedAccount.customer_first_name || ''} ${selectedAccount.customer_last_name || ''}`.trim() || 'N/A'
                                : 'Loading...'}
                        </Text>
                        <Text style={styles.balanceText}>
                            {balance !== null
                                ? `${currency} ${formatBalance(balance)}`
                                : 'Loading balance...'}
                        </Text>
                        <Text style={styles.timeText}>
                            {new Date().toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                hour12: true
                            })}
                        </Text>
                    </View>
                </View>
                <View style={{ marginBottom: 20, position: 'relative' }}>
                    <Text style={styles.transactionHistoryTitle}>Recent Recipients</Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.transactionCardsContainer}
                    >
                        {localTransferHistory.length > 0 ? (
                            localTransferHistory.map((item) => (
                                <TouchableOpacity
                                    key={item.id}
                                    style={[styles.transactionCard, { backgroundColor: getCardColor(item.bankName) }]}
                                    onPress={() => handleHistoryCardPress(item)}
                                >
                                    <Text style={[styles.transactionCardText, styles.transactionCardBank]}>
                                        {item.bankName}
                                    </Text>
                                    <Text style={styles.transactionCardText}>
                                        {item.accountNumber}
                                    </Text>
                                    <Text style={styles.transactionCardText}>
                                        {item.recipientName}
                                    </Text>
                                </TouchableOpacity>
                            ))
                        ) : (
                            <Text style={{ color: '#B0B0B0', alignSelf: 'center', marginLeft: 10 }}>
                                No recent recipients
                            </Text>
                        )}
                    </ScrollView>
                    {localTransferHistory.length > 2 && (
                        <Icon
                            name="chevron-forward"
                            size={20}
                            color="#4CC9F0"
                            style={styles.scrollHint}
                        />
                    )}
                </View>
                <View style={styles.headerCard}>
                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Currency</Text>
                        <View style={styles.pickerContainer}>
                            <Picker
                                selectedValue={currency}
                                style={styles.picker}
                                itemStyle={styles.pickerItem}
                                onValueChange={(itemValue) => setCurrency(itemValue)}>
                                <Picker.Item label="NGN" value="NGN" />
                                <Picker.Item label="KES" value="KES" />
                                <Picker.Item label="GHS" value="GHS" />
                            </Picker>
                        </View>
                    </View>
                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Recipient Bank</Text>
                        <TouchableOpacity
                            style={styles.bankInput}
                            onPress={() => setIsBankModalVisible(true)}
                            activeOpacity={0.8}
                        >
                            <Text style={bankName ? styles.bankNameText : styles.bankPlaceholderText}>
                                {bankName ? `${bankName} (${bankCode})` : "Select Bank"}
                            </Text>
                            {bankName && (
                                <TouchableOpacity
                                    style={styles.clearButton}
                                    onPress={() => {
                                        setBankName('');
                                        setBankCode('');
                                        setRecipientName('');
                                        setValidationError('');
                                    }}
                                >
                                    <Icon name="close" size={16} color="#B0B0B0" />
                                </TouchableOpacity>
                            )}
                        </TouchableOpacity>
                    </View>
                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Account Number</Text>
                        <TextInput
                            ref={accountNumberInputRef}
                            style={styles.input}
                            placeholder="Account Number"
                            placeholderTextColor="#B0B0B0"
                            value={accountNumber}
                            onChangeText={setAccountNumber}
                            keyboardType="numeric"
                            returnKeyType="next"
                            blurOnSubmit={false}
                            onSubmitEditing={() => amountInputRef.current?.focus()}
                        />
                        {isVerifyingAccount && <Text style={[styles.validationStatus, styles.validationStatusLoading]}>Verifying...</Text>}
                        {validationError && !isVerifyingAccount && <Text style={[styles.validationStatus, styles.validationStatusError]}>{validationError}</Text>}
                        {recipientName && (
                            <Text style={styles.recipientNameText}>
                                {recipientName}
                            </Text>
                        )}
                    </View>
                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Amount</Text>
                        <TextInput
                            ref={amountInputRef}
                            style={styles.input}
                            placeholder="0.00"
                            placeholderTextColor="#B0B0B0"
                            value={amount}
                            onChangeText={setAmount}
                            keyboardType="numeric"
                            returnKeyType="next"
                            blurOnSubmit={false}
                            onSubmitEditing={() => narrationInputRef.current?.focus()}
                        />
                        {amount && <Text style={styles.chargeText}>Charge: {formatBalance(charge)} {currency}</Text>}
                    </View>
                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Narration</Text>
                        <TextInput
                            ref={narrationInputRef}
                            style={styles.input}
                            placeholder="Enter narration"
                            placeholderTextColor="#B0B0B0"
                            value={narration}
                            onChangeText={setNarration}
                            returnKeyType={currency === 'KES' ? 'next' : 'done'}
                            blurOnSubmit={false}
                            onSubmitEditing={() => {
                                if (currency === 'KES') {
                                    paymentModeInputRef.current?.focus();
                                } else {
                                    Keyboard.dismiss();
                                }
                            }}
                        />
                    </View>
                    {currency === 'KES' && (
                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Payment Mode</Text>
                            <TextInput
                                ref={paymentModeInputRef}
                                style={styles.input}
                                placeholder="Payment Mode"
                                placeholderTextColor="#B0B0B0"
                                value={paymentMode}
                                onChangeText={setPaymentMode}
                                returnKeyType="done"
                                blurOnSubmit={false}
                                onSubmitEditing={() => Keyboard.dismiss()}
                            />
                        </View>
                    )}
                    <Pressable
                        style={({ pressed }) => [
                            styles.button,
                            (!areAllRequirementsFilled() || isTransferring || isVerifyingAccount) && { opacity: 0.5 },
                            pressed && Platform.OS !== 'web' && { opacity: 0.8 },
                            pressed && Platform.OS === 'web' && { opacity: 0.9 }
                        ]}
                        onPress={handleVerifyPinClick}
                        disabled={!areAllRequirementsFilled() || isTransferring || isVerifyingAccount}
                        onClick={Platform.OS === 'web' ? handleVerifyPinClick : undefined}
                    >
                        {isTransferring ? (
                            <ActivityIndicator color="#0A1128" />
                        ) : (
                            <Text style={styles.buttonText}>Verify Pin</Text>
                        )}
                    </Pressable>
                </View>
                {isLoading && (
                    <ActivityIndicator style={styles.loadingIndicator} size="small" color="#4CC9F0" />
                )}
                {transferMessage && (
                    <Text
                        style={transferMessage.startsWith('✅') ? styles.successText : styles.errorText}
                    >
                        {transferMessage}
                    </Text>
                )}
                <BankSearchDropdown
                    visible={isBankModalVisible}
                    query={bankSearchQuery}
                    setQuery={setBankSearchQuery}
                    onClose={() => {
                        setIsBankModalVisible(false);
                        setBankSearchQuery('');
                    }}
                    onSelect={(selectedBank) => {
                        setBankName(selectedBank.bank_name || selectedBank.name);
                        setBankCode(selectedBank.bank_code || selectedBank.code);
                        setIsBankModalVisible(false);
                        setBankSearchQuery('');
                        accountNumberInputRef.current?.focus();
                    }}
                />
                <PinVerifyPopup
                    visible={isPinPopupVisible}
                    onClose={() => setIsPinPopupVisible(false)}
                    onPinVerifiedSuccess={initiateTransfer}
                    parentLoading={isTransferring}
                    inputPin={transactionPin}
                    setPin={setTransactionPin}
                    transferDetails={{
                        amount: parseFloat(amount),
                        recipientName: recipientName,
                        recipientAcct: accountNumber,
                        recipientBankName: bankName,
                        description: narration,
                        charges: parseFloat(charge),
                    }}
                    mode={'pin'}
                    popupContent={{}}
                    onPopUpComplete={() => { }}
                    isStandalonePinVerify={true}
                />
                <TransactionResultModal
                    visible={isReceiptModalVisible}
                    status={transferResultDetails?.status || 'failed'}
                    title={transferResultDetails?.title || 'Transaction Result'}
                    onClose={() => {
                        setIsReceiptModalVisible(false);
                        setTransferResultDetails(null);
                        setTransferMessage('');
                    }}
                    transferDetails={transferResultDetails || {}}
                />
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

export default TransferScreen;