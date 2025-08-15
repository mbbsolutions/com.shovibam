import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    ScrollView,
    TextInput,
    ActivityIndicator,
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    TouchableNativeFeedback
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { fetchProviders, fetchDataPlans, purchaseDataPlan } from '../utils/data';
import PinVerifyPopup from '../components/PinVerifyPopup';
import TransactionResultModal from '../components/Receipt';
import GeneralIconsMenuButtons from '../components/GeneralIconsMenuButtons';
import { useAuth } from '../contexts/AuthContext';
import { fetchUserDetails } from '../utils/transferGeneral';
import { getRecentPurchases, saveRecentPurchase, migrateLegacyPurchases } from '../utils/StorageService';
import { sendEmail } from '../utils/emailService';

// Cache expiration time in milliseconds (5 minutes)
const CACHE_EXPIRATION_TIME = 5 * 60 * 1000;

// Image Loading Fix: Use require() directly for local assets
const dataProviderIcons = {
    AIRTEL: require('../assets/airtel_icon.png'),
    GLO: require('../assets/glo_icon.png'),
    MTN: require('../assets/mtn_icon.png'),
    '9MOBILE': require('../assets/ninemobile_icon.png'),
    SMILE4G: require('../assets/smile_icon.png'),
    SPECTRANET: require('../assets/spectranet_icon.png'),
};

// Cache storage object (outside component to persist across re-renders)
const cache = {
    providers: {
        data: null,
        timestamp: null
    },
    plans: {} // Will store plans by provider: { 'PROVIDER_KEY': { data: [...], timestamp: Date.now() } }
};

function generateReference() {
    return 'ref-' + Math.random().toString(36).substr(2, 9);
}

const formatBalance = (num) => {
    const numStr = parseFloat(num).toFixed(2);
    return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

// Helper function to check if cache is still valid
const isCacheValid = (timestamp) => {
    return timestamp && (Date.now() - timestamp < CACHE_EXPIRATION_TIME);
};

// Helper function to generate email content
const generatePurchaseEmailContent = (status, details) => {
    const { provider, planName, amount, phoneNumber, reference, date } = details;
    const formattedAmount = formatBalance(amount);
    const formattedDate = new Date(date).toLocaleString();
    if (status === 'success') {
        return `
            <h2>Data Purchase Successful! 🎉</h2>
            <p>Your data purchase was completed successfully.</p>
            <p><strong>Details:</strong></p>
            <ul>
                <li><strong>Provider:</strong> ${provider}</li>
                <li><strong>Plan:</b> ${planName}</li>
                <li><strong>Amount:</strong> ₦${formattedAmount}</li>
                <li><strong>Phone Number:</b> ${phoneNumber}</li>
                <li><strong>Reference:</strong> ${reference}</li>
                <li><strong>Date:</strong> ${formattedDate}</li>
            </ul>
            <p>Thank you for using our service!</p>
            <p>Best regards,<br/>The App Team</p>
        `;
    } else {
        return `
            <h2>Data Purchase Failed! 🚨</h2>
            <p>We're sorry, but your data purchase could not be completed.</p>
            <p><strong>Details:</strong></p>
            <ul>
                <li><strong>Provider:</strong> ${provider || 'N/A'}</li>
                <li><strong>Plan:</strong> ${planName || 'N/A'}</li>
                <li><strong>Amount:</b> ₦${formattedAmount}</li>
                <li><strong>Phone Number:</strong> ${phoneNumber}</li>
                <li><strong>Reference:</strong> ${reference}</li>
                <li><strong>Date:</strong> ${formattedDate}</li>
            </ul>
            <p>Please try again or contact support if the issue persists.</p>
            <p>Best regards,<br/>The App Team</p>
        `;
    }
};

// Add Fallback Data for Development (placed at top-level)
const getFallbackPlans = (provider) => {
    if (__DEV__ && Platform.OS === 'android') {
        console.warn('Using fallback data for Android emulator for provider:', provider);
        return [
            {
                id: `fallback-${provider}-1`,
                name: `${provider} 1GB Daily Plan (Fallback)`,
                amount: 500,
                description: 'This is fallback data for emulator testing due to API issues.'
            },
            {
                id: `fallback-${provider}-2`,
                name: `${provider} 2.5GB Weekly Plan (Fallback)`,
                amount: 1000,
                description: 'This is fallback data for emulator testing due to API issues.'
            },
            {
                id: `fallback-${provider}-3`,
                name: `${provider} 5GB Monthly Plan (Fallback)`,
                amount: 2000,
                description: 'This is fallback data for emulator testing due to API issues.'
            }
        ];
    }
    return [];
};

// Simplified StyleSheet with adjusted provider button styles
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212', // Dark background
    },
   headerIconContainer: {
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: 20,  // Add this line to move the icon downward
  paddingVertical: 12,
  backgroundColor: '#121212',
},
    scrollContainer: {
        flexGrow: 1,
        backgroundColor: '#121212', // Added this line for consistent dark background
        paddingHorizontal: 16, // Remove vertical padding
        paddingTop: 16, // Add some top padding to prevent overlap
        paddingBottom: 20, // Explicitly set bottom padding for ScrollView content
    },
    card: {
        backgroundColor: '#0A1128',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        elevation: 4,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 4,
            },
        }),
    },
    accountInfo: {
        alignItems: 'flex-end',
        marginTop: 16,
    },
    balanceText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#4CC9F0',
        marginBottom: 4,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 12,
    },
    providerContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginHorizontal: -2, // Reduced from -4
    },
    providerButtonWrapper: {
        width: '24%', // Keep 4 per row
        aspectRatio: 1,
        borderRadius: 8,
        overflow: 'hidden', // Ensures ripple effect is contained
        marginBottom: 8,
        paddingHorizontal: 2, // Reduced from 4
    },
    providerButton: {
        width: '100%',
        height: '100%',
        backgroundColor: '#1E1E1E',
        borderRadius: 6, // Slightly smaller radius
        padding: 4, // Reduced from 6
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#333', // Single definition
    },
    selectedProviderButton: {
        borderColor: '#4CC9F0',
        borderWidth: 1.5, // Slightly thinner border
    },
    providerIcon: {
        width: 20, // Reduced from 24
        height: 20, // Reduced from 24
        marginBottom: 2, // Reduced from 4
        resizeMode: 'contain',
    },
    providerText: {
        color: '#FFFFFF',
        fontSize: 8, // Reduced from 10
        textAlign: 'center',
        paddingHorizontal: 1, // Reduced from 2
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1E1E1E',
        borderRadius: 8,
        padding: 8,
        marginBottom: 12,
    },
    planItem: {
        padding: 12,
        backgroundColor: '#1E1E1E',
        borderRadius: 8,
        marginBottom: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    planName: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 13,
        flexShrink: 1,
    },
    planAmount: {
        color: '#4CC9F0',
        fontWeight: 'bold',
        fontSize: 13,
    },
    button: {
        backgroundColor: '#4CC9F0',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 16,
    },
    buttonText: {
        color: '#0A1128',
        fontSize: 16,
        fontWeight: 'bold',
    },
    input: {
        flex: 1,
        height: 40,
        backgroundColor: '#1E1E1E',
        color: '#FFFFFF',
        borderRadius: 8,
        paddingHorizontal: 10,
        fontSize: 14,
    },
    recentPurchaseCard: {
        width: 160,
        height: 80,
        borderRadius: 8,
        padding: 8,
        marginRight: 10,
        backgroundColor: '#1E1E1E',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#333',
    },
    recentPurchaseProvider: {
        color: '#4CC9F0',
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    recentPurchasePlan: {
        color: '#FFFFFF',
        fontSize: 11,
        marginBottom: 2,
        flexShrink: 1,
    },
    recentPurchaseAmount: {
        fontWeight: 'bold',
        fontSize: 12,
        color: '#4CC9F0',
        alignSelf: 'flex-end',
    },
    statusText: {
        fontSize: 9,
        fontWeight: 'bold',
        marginTop: 2,
    },
    successStatus: {
        color: '#4CAF50',
    },
    failedStatus: {
        color: '#F44336',
    },
    pendingStatus: {
        color: '#FFC107',
    },
    errorText: {
        color: '#FF6B6B',
        textAlign: 'center',
        marginVertical: 10,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        marginBottom: 16,
    },
    backButtonText: {
        marginLeft: 5,
        color: '#4CC9F0',
        fontSize: 16,
    },
    label: {
        fontSize: 14,
        marginBottom: 8,
        color: '#B0B0B0',
        alignSelf: 'flex-end',
    },
});

// Updated ProviderButton component with compact styling and conditional highlights
const ProviderButton = ({ provider, onPress, isSelected, isAutoSelecting, lastRecentPurchaseProviderId, disabled }) => {
    const buttonStyle = [
        styles.providerButton,
        isSelected && styles.selectedProviderButton,
        isAutoSelecting && isSelected && { borderColor: '#4CC9F0', borderWidth: 2, backgroundColor: 'rgba(76, 201, 240, 0.1)' },
        lastRecentPurchaseProviderId === provider.provider && { backgroundColor: 'rgba(76, 201, 240, 0.2)' },
        disabled && { opacity: 0.5 }
    ];
    if (Platform.OS === 'android') {
        return (
            <View style={styles.providerButtonWrapper}>
                <TouchableNativeFeedback
                    onPress={() => onPress(provider)}
                    background={TouchableNativeFeedback.Ripple('#4CC9F0', false)}
                    useForeground={true}
                    disabled={disabled}
                >
                    <View style={buttonStyle}>
                        <Image source={provider.icon} style={styles.providerIcon} />
                        <Text style={styles.providerText} numberOfLines={1}>{provider.provider}</Text>
                    </View>
                </TouchableNativeFeedback>
            </View>
        );
    }
    return (
        <View style={styles.providerButtonWrapper}>
            <TouchableOpacity
                onPress={() => onPress(provider)}
                style={buttonStyle}
                activeOpacity={0.7}
                disabled={disabled}
            >
                <Image source={provider.icon} style={styles.providerIcon} />
                <Text style={styles.providerText} numberOfLines={1}>{provider.provider}</Text>
            </TouchableOpacity>
        </View>
    );
};

const DataScreen = React.memo(() => {
    const navigation = useNavigation();
    const { selectedAccount, isLoadingAuth, currentUserTechvibesId } = useAuth();
    const [balance, setBalance] = useState(null);
    const [userDetailsError, setUserDetailsError] = useState('');
    const [isLoadingUser, setIsLoadingUser] = useState(false);
    const [providers, setProviders] = useState([]);
    const [selectedProvider, setSelectedProvider] = useState(null);
    const [plans, setPlans] = useState([]);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [reference, setReference] = useState(generateReference());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showPinPopup, setShowPinPopup] = useState(false);
    const [pin, setPin] = useState('');
    const [showReceipt, setShowReceipt] = useState(false);
    const [transactionResult, setTransactionResult] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [recentPurchases, setRecentPurchases] = useState([]);
    const [selectedRecentPurchase, setSelectedRecentPurchase] = useState(null);
    const [isAutoSelecting, setIsAutoSelecting] = useState(false);
    const [lastRecentPurchaseProviderId, setLastRecentPurchaseProviderId] = useState(null);
    const [currentPurchaseAttemptId, setCurrentPurchaseAttemptId] = useState(null);

    useEffect(() => {
        const loadUserDetails = async () => {
            if (!selectedAccount || isLoadingAuth) {
                return;
            }
            setIsLoadingUser(true);
            setUserDetailsError('');
            const result = await fetchUserDetails(selectedAccount.customer_id);
            if (result.success) {
                setBalance(result.balance);
            } else {
                setUserDetailsError(result.error);
                setBalance(null);
            }
            setIsLoadingUser(false);
        };
        if (!isLoadingAuth) {
            loadUserDetails();
        }
    }, [selectedAccount, isLoadingAuth]);

    const loadRecentPurchases = useCallback(async () => {
        if (!currentUserTechvibesId) return;
        try {
            await migrateLegacyPurchases(currentUserTechvibesId);
            const purchases = await getRecentPurchases(currentUserTechvibesId);
            setRecentPurchases(purchases || []);
        } catch (error) {
            console.error('Error loading recent purchases:', error);
            setRecentPurchases([]);
        }
    }, [currentUserTechvibesId]);

    useEffect(() => {
        loadRecentPurchases();
    }, [loadRecentPurchases]);

    const addToRecentPurchases = useCallback(async (purchase, status = 'attempted', id = generateReference()) => {
        if (!currentUserTechvibesId) return;
        try {
            const savedPurchases = await saveRecentPurchase(currentUserTechvibesId, {
                ...purchase,
                id: id,
                status: status,
                date: new Date().toISOString()
            });
            setRecentPurchases(savedPurchases);
        } catch (error) {
            console.error('Error saving recent purchase:', error);
        }
    }, [currentUserTechvibesId]);

    const updateRecentPurchaseStatus = useCallback(async (ref, status) => {
        if (!currentUserTechvibesId) return;
        try {
            const purchases = await getRecentPurchases(currentUserTechvibesId);
            const updatedPurchases = purchases.map(purchase =>
                purchase.reference === ref ? { ...purchase, status } : purchase
            );
            const purchaseToSave = updatedPurchases.find(p => p.reference === ref);
            if (purchaseToSave) {
                await saveRecentPurchase(currentUserTechvibesId, purchaseToSave);
                setRecentPurchases(updatedPurchases);
                console.log(`Purchase ${ref} status updated to: ${status}`);
            }
        } catch (error) {
            console.error('Error updating purchase status:', error);
        }
    }, [currentUserTechvibesId]);

    useEffect(() => {
        const getProviders = async () => {
            if (cache.providers.data && isCacheValid(cache.providers.timestamp)) {
                setProviders(cache.providers.data);
                if (__DEV__) console.log('Providers loaded from cache.');
                return;
            }
            setLoading(true);
            const result = await fetchProviders();
            console.log('Providers API response:', result);
            if (result.data) {
                const providersWithIcons = result.data.map(provider => ({
                    ...provider,
                    icon: dataProviderIcons[provider.provider.toUpperCase()],
                }));
                console.log('Processed providers:', providersWithIcons);
                setProviders(providersWithIcons);
                cache.providers = {
                    data: providersWithIcons,
                    timestamp: Date.now()
                };
                if (__DEV__) console.log('Providers fetched from API and cached.');
            } else {
                setError(result.message || 'Failed to load providers.');
                if (__DEV__) console.error('Failed to fetch providers:', result.message);
            }
            setLoading(false);
        };
        getProviders();
    }, []);

    useEffect(() => {
        if (selectedProvider) {
            const getPlans = async () => {
                const providerKey = selectedProvider.provider;
                if (cache.plans[providerKey] && isCacheValid(cache.plans[providerKey].timestamp)) {
                    setPlans(cache.plans[providerKey].data);
                    if (__DEV__) console.log(`Plans for ${providerKey} loaded from cache.`);
                    return;
                }
                setLoading(true);
                setPlans([]);
                setSelectedPlan(null);
                try {
                    const result = await fetchDataPlans(providerKey);
                    if (result.data) {
                        setPlans(result.data);
                        cache.plans[providerKey] = {
                            data: result.data,
                            timestamp: Date.now()
                        };
                        if (__DEV__) console.log(`Plans for ${providerKey} fetched from API and cached.`);
                    } else {
                        setPlans([]);
                        const errorMsg = result.message || 'No plans available.';
                        setError(errorMsg);
                        if (Platform.OS === 'android' && __DEV__) {
                            console.warn('Android emulator: Falling back to mock plans data.');
                            const fallbackPlans = getFallbackPlans(providerKey);
                            setPlans(fallbackPlans);
                            cache.plans[providerKey] = {
                                data: fallbackPlans,
                                timestamp: Date.now()
                            };
                        }
                    }
                } catch (err) {
                    setError(err.message);
                    if (__DEV__) console.error(`Error fetching plans for ${providerKey}:`, err.message);
                    if (__DEV__) {
                        console.warn('Attempting to use fallback data due to fetch error.');
                        const fallbackPlans = getFallbackPlans(providerKey);
                        setPlans(fallbackPlans);
                        cache.plans[providerKey] = {
                            data: fallbackPlans,
                            timestamp: Date.now()
                        };
                    }
                } finally {
                    setLoading(false);
                }
            };
            getPlans();
        } else {
            setPlans([]);
            setSearchTerm('');
            setError(null);
        }
    }, [selectedProvider]);

    useEffect(() => {
        if (selectedRecentPurchase && plans.length > 0) {
            const plan = plans.find(p =>
                p.name === selectedRecentPurchase.planName &&
                p.amount === selectedRecentPurchase.amount
            );
            if (plan) {
                setSelectedPlan(plan);
            }
            setSelectedRecentPurchase(null);
        }
    }, [plans, selectedRecentPurchase]);

    const filteredPlans = plans.filter(plan =>
        plan.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (plan.description && plan.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleProviderSelect = useCallback((provider) => {
        console.log('Provider selected:', provider.provider);
        if (!provider || !provider.provider) {
            console.error('Invalid provider selected');
            return;
        }
        setSelectedProvider(null);
        setTimeout(() => setSelectedProvider(provider), 0);
        setSelectedPlan(null);
        setTransactionResult({});
        setError(null);
        setIsAutoSelecting(false);
        setLastRecentPurchaseProviderId(null);
    }, []);

    const handleRecentPurchaseSelect = useCallback(async (purchase) => {
        setIsAutoSelecting(true);
        setSelectedRecentPurchase(purchase);
        setLastRecentPurchaseProviderId(purchase.provider);
        const provider = providers.find(p => p.provider === purchase.provider);
        if (!provider) {
            setError('Provider not found for this recent purchase.');
            setIsAutoSelecting(false);
            setLastRecentPurchaseProviderId(null);
            setSelectedProvider(null);
            setSelectedPlan(null);
            setPhoneNumber('');
            return;
        }
        setSelectedProvider(provider);
        setPhoneNumber(purchase.phoneNumber);
        setSelectedPlan(null);
        await new Promise(resolve => setTimeout(resolve, 500));
        try {
            let currentPlans = cache.plans[provider.provider]?.data;
            if (!currentPlans || !isCacheValid(cache.plans[provider.provider]?.timestamp)) {
                setLoading(true);
                const result = await fetchDataPlans(provider.provider);
                if (result.data) {
                    currentPlans = result.data;
                    cache.plans[provider.provider] = { data: currentPlans, timestamp: Date.now() };
                    setPlans(currentPlans);
                } else {
                    currentPlans = getFallbackPlans(provider.provider);
                    if (currentPlans.length === 0) throw new Error(result.message || 'No plans available for this provider.');
                    setPlans(currentPlans);
                    cache.plans[provider.provider] = { data: currentPlans, timestamp: Date.now() };
                }
                setLoading(false);
            } else {
                setPlans(currentPlans);
            }
            const matchedPlan = currentPlans.find(p =>
                p.name === purchase.planName &&
                p.amount === purchase.amount
            );
            await new Promise(resolve => setTimeout(resolve, 500));
            if (matchedPlan) {
                setSelectedPlan(matchedPlan);
                setReference(generateReference());
                setError(null);
            } else {
                setError(`The plan "${purchase.planName}" is no longer available.`);
                setSelectedPlan(null);
            }
        } catch (err) {
            setError(err.message || 'Failed to check plan availability. Please try again.');
            setSelectedPlan(null);
        } finally {
            setIsAutoSelecting(false);
            setSelectedRecentPurchase(null);
        }
    }, [providers]);

    const handlePlanSelect = useCallback((plan) => {
        setSelectedPlan(plan);
        setReference(generateReference());
        setError(null);
        setIsAutoSelecting(false);
        setLastRecentPurchaseProviderId(null);
    }, []);

    const handlePurchase = async () => {
        if (!selectedPlan || !phoneNumber) {
            Alert.alert('Validation Error', 'Please select a plan and fill in all fields.');
            return;
        }
        if (balance !== null && selectedPlan.amount > balance) {
            Alert.alert('Insufficient Funds', `You need NGN ${formatBalance(selectedPlan.amount)} for this plan.`);
            return;
        }
        const newPurchaseRef = generateReference();
        setReference(newPurchaseRef);
        setCurrentPurchaseAttemptId(newPurchaseRef);
        await addToRecentPurchases({
            provider: selectedProvider.provider,
            planName: selectedPlan.name,
            phoneNumber: phoneNumber,
            amount: selectedPlan.amount,
            reference: newPurchaseRef,
        }, 'pending', newPurchaseRef);
        setShowPinPopup(true);
    };

    const handlePinVerified = async () => {
        setShowPinPopup(false);
        setLoading(true);
        const purchaseData = {
            provider: selectedProvider.provider,
            number: phoneNumber,
            plan_id: selectedPlan.id,
            reference: reference,
        };
        let updatedStatus;
        let transactionMessage;
        let transactionTitle;
        try {
            const result = await purchaseDataPlan(purchaseData);
            if (result.code === 'INSUFFICIENT_FUNDS') {
                updatedStatus = 'failed';
                transactionMessage = result.message || 'Insufficient funds to complete this transaction.';
                transactionTitle = 'Insufficient Balance';
            } else if (result.success) {
                updatedStatus = 'success';
                transactionMessage = result.message || 'Data purchase completed successfully.';
                transactionTitle = 'Purchase Successful!';
            } else {
                updatedStatus = 'failed';
                transactionMessage = result.message || 'Data purchase could not be completed.';
                transactionTitle = 'Purchase Failed!';
            }
        } catch (err) {
            updatedStatus = 'failed';
            transactionMessage = err.message || 'A network error occurred during purchase.';
            transactionTitle = 'Network Error!';
            console.error('Purchase error:', err);
        } finally {
            await addToRecentPurchases({
                provider: selectedProvider.provider,
                planName: selectedPlan.name,
                phoneNumber: phoneNumber,
                amount: selectedPlan.amount,
                reference: purchaseData.reference,
            }, updatedStatus, currentPurchaseAttemptId);
            setTransactionResult({
                status: updatedStatus,
                title: transactionTitle,
                message: transactionMessage,
                account_name: selectedProvider?.provider,
                account_number: phoneNumber,
                bank_name: 'N/A',
                description: selectedPlan?.name,
                amount: selectedPlan?.amount,
                charges: 0,
                reference: purchaseData.reference,
            });
            setShowReceipt(true);
            setLoading(false);
            const emailContent = generatePurchaseEmailContent(updatedStatus, {
                provider: selectedProvider?.provider || 'N/A',
                planName: selectedPlan?.name || 'N/A',
                amount: selectedPlan?.amount || 0,
                phoneNumber: phoneNumber,
                reference: purchaseData.reference,
                date: new Date().toISOString()
            });
            try {
                if (selectedAccount && selectedAccount.customer_email) {
                    const subject = updatedStatus === 'success'
                        ? `Successful Data Purchase - ${selectedProvider?.provider || 'N/A'}`
                        : `Failed Data Purchase - ${selectedProvider?.provider || 'N/A'}`;
                    await sendEmail({
                        toEmail: selectedAccount.customer_email,
                        subject: subject,
                        body: emailContent,
                        isHtml: true
                    });
                    console.log(`${updatedStatus === 'success' ? 'Success' : 'Failure'} email sent!`);
                } else {
                    console.warn('Customer email not available for notification.');
                }
            } catch (emailError) {
                console.error('Failed to send email notification:', emailError);
            }
            setCurrentPurchaseAttemptId(null);
            setSelectedProvider(null);
            setPhoneNumber('');
            setSelectedPlan(null);
            setPlans([]);
            setPin('');
            setSearchTerm('');
            setError(null);
            setIsAutoSelecting(false);
            setLastRecentPurchaseProviderId(null);
        }
    };

    const handleCloseReceipt = () => {
        setShowReceipt(false);
        setSelectedProvider(null);
        setSelectedPlan(null);
        setPhoneNumber('');
        setPin('');
        setTransactionResult({});
        setReference(generateReference());
        setError(null);
        setIsAutoSelecting(false);
        setLastRecentPurchaseProviderId(null);
        setCurrentPurchaseAttemptId(null);
    };

    const handleClosePinPopup = () => {
        setShowPinPopup(false);
        setPin('');
    };

    const handleBack = () => {
        setSelectedPlan(null);
        setError(null);
        setSearchTerm('');
        Keyboard.dismiss();
        setSelectedRecentPurchase(null);
        setIsAutoSelecting(false);
        setLastRecentPurchaseProviderId(null);
        setCurrentPurchaseAttemptId(null);
    };

    return (
        <View style={styles.container}>
            <View style={styles.headerIconContainer}>
                <Icon name="wifi" size={32} color="#4CC9F0" />
            </View>
            <GeneralIconsMenuButtons navigation={navigation} active="Data" />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.select({
                    android: 60,
                    ios: 0
                })}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContainer}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.card}>
                        <View style={styles.accountInfo}>
                            <Text style={styles.balanceText}>
                                {balance !== null ? `NGN ${formatBalance(balance)}` : 'Loading...'}
                            </Text>
                            <Text style={{ color: '#B0B0B0', fontSize: 14 }}>
                                {selectedAccount?.account_number || 'N/A'}
                            </Text>
                            <Text style={{ color: '#B0B0B0', fontSize: 14 }}>
                                {selectedAccount ? `${selectedAccount.customer_first_name || ''} ${selectedAccount.customer_last_name || ''}`.trim() || 'N/A' : 'N/A'}
                            </Text>
                            <Text style={{ color: '#B0B0B0', fontSize: 12 }}>
                                {new Date().toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                    hour12: true
                                })}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.card}>
                        <Text style={styles.sectionTitle}>Recent Purchases</Text>
                        {isLoadingUser ? (
                            <ActivityIndicator size="small" color="#4CC9F0" style={{ paddingVertical: 20 }} />
                        ) : recentPurchases.length > 0 ? (
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ flexDirection: 'row', paddingVertical: 5 }}
                            >
                                {recentPurchases.map((purchase) => (
                                    <TouchableOpacity
                                        key={purchase.id || purchase.reference}
                                        onPress={() => handleRecentPurchaseSelect(purchase)}
                                        style={[
                                            styles.recentPurchaseCard,
                                            purchase.status === 'success' && styles.successCard,
                                            purchase.status === 'failed' && styles.failedCard,
                                            purchase.status === 'error' && styles.errorCard,
                                            purchase.status === 'pending' && styles.pendingCard,
                                            isAutoSelecting && selectedRecentPurchase?.id === purchase.id && { borderColor: '#4CC9F0', borderWidth: 2 }
                                        ]}
                                    >
                                        <View>
                                            <Text style={styles.recentPurchaseProvider} numberOfLines={1}>
                                                {purchase.provider || 'Unknown Provider'}
                                            </Text>
                                            <Text style={styles.recentPurchasePlan} numberOfLines={1}>
                                                {purchase.planName || 'Unknown Plan'}
                                            </Text>
                                            <Text style={styles.recentPurchaseAmount}>
                                                ₦{formatBalance(purchase.amount || 0)}
                                            </Text>
                                            {purchase.status && (
                                                <Text style={[
                                                    styles.statusText,
                                                    purchase.status === 'success' && styles.successStatus,
                                                    purchase.status === 'failed' && styles.failedStatus,
                                                    purchase.status === 'error' && styles.failedStatus,
                                                    purchase.status === 'pending' && styles.pendingStatus
                                                ]}>
                                                    {purchase.status.toUpperCase()}
                                                </Text>
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        ) : (
                            <Text style={{ color: '#B0B0B0', paddingVertical: 20, textAlign: 'center' }}>
                                {userDetailsError ? 'Error loading purchases' : 'No recent data purchases'}
                            </Text>
                        )}
                    </View>
                    {!selectedPlan ? (
                        <View style={styles.card}>
                            <Text style={styles.sectionTitle}>Select Internet Provider</Text>
                            {isAutoSelecting && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 10, backgroundColor: 'rgba(30, 30, 30, 0.8)', borderRadius: 8, marginBottom: 10 }}>
                                    <ActivityIndicator size="small" color="#4CC9F0" />
                                    <Text style={{ color: '#B0B0B0', marginLeft: 8, fontSize: 14 }}>Preparing your selection...</Text>
                                </View>
                            )}
                            <View style={styles.providerContainer}>
                                {loading && <ActivityIndicator size="small" color="#4CC9F0" />}
                                {error && <Text style={styles.errorText}>{error}</Text>}
                                {!loading && providers.map((provider) => (
                                    <ProviderButton
                                        key={provider.provider}
                                        provider={provider}
                                        onPress={handleProviderSelect}
                                        isSelected={selectedProvider?.provider === provider.provider}
                                        isAutoSelecting={isAutoSelecting}
                                        lastRecentPurchaseProviderId={lastRecentPurchaseProviderId}
                                        disabled={isAutoSelecting}
                                    />
                                ))}
                            </View>
                            {selectedProvider && (
                                <>
                                    <Text style={styles.sectionTitle}>
                                        Data Plans for {selectedProvider.provider}
                                    </Text>
                                    <View style={styles.searchContainer}>
                                        <Icon name="search" size={18} color="#B0B0B0" style={{ marginRight: 8 }} />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Search plans..."
                                            placeholderTextColor="#666"
                                            value={searchTerm}
                                            onChangeText={setSearchTerm}
                                        />
                                    </View>
                                    <ScrollView style={{ maxHeight: 300 }}>
                                        {loading ? (
                                            <ActivityIndicator size="small" color="#4CC9F0" style={{ paddingVertical: 20 }} />
                                        ) : filteredPlans.length > 0 ? (
                                            filteredPlans.map((plan) => (
                                                <TouchableOpacity
                                                    key={plan.id}
                                                    style={[
                                                        styles.planItem,
                                                        selectedPlan?.id === plan.id && { borderColor: '#4CC9F0', borderWidth: 2 },
                                                        isAutoSelecting && selectedPlan?.id === plan.id && { borderColor: '#4CC9F0', borderWidth: 2, backgroundColor: 'rgba(76, 201, 240, 0.1)' }
                                                    ]}
                                                    onPress={() => handlePlanSelect(plan)}
                                                    disabled={isAutoSelecting}
                                                >
                                                    <Text style={styles.planName}>{plan.name}</Text>
                                                    <Text style={styles.planAmount}>₦{formatBalance(plan.amount)}</Text>
                                                </TouchableOpacity>
                                            ))
                                        ) : (
                                            <Text style={{ color: '#B0B0B0', paddingVertical: 20, textAlign: 'center' }}>
                                                {searchTerm ? 'No matching plans found' : 'No data plans available'}
                                            </Text>
                                        )}
                                    </ScrollView>
                                </>
                            )}
                        </View>
                    ) : (
                        <>
                            <View style={styles.card}>
                                <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                                    <Icon name="arrow-back" size={20} color="#4CC9F0" />
                                    <Text style={styles.backButtonText}>Back</Text>
                                </TouchableOpacity>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={styles.sectionTitle}>Complete Purchase</Text>
                                    <Text style={styles.label}>
                                        Selected Plan: {selectedPlan.name} (₦{formatBalance(selectedPlan.amount)})
                                    </Text>
                                    <Text style={styles.label}>Phone Number</Text>
                                    <TextInput
                                        style={[styles.input, { width: '100%' }]}
                                        placeholder="e.g. 08012345678"
                                        placeholderTextColor="#666"
                                        keyboardType="phone-pad"
                                        value={phoneNumber}
                                        onChangeText={setPhoneNumber}
                                        maxLength={11}
                                        returnKeyType="done"
                                        onSubmitEditing={Keyboard.dismiss}
                                    />
                                    <Pressable
                                        style={({ pressed }) => [
                                            styles.button,
                                            { alignSelf: 'flex-end' },
                                            (loading || !phoneNumber) && { opacity: 0.5 },
                                            pressed && Platform.OS !== 'web' && { opacity: 0.8 },
                                            pressed && Platform.OS === 'web' && { opacity: 0.9 }
                                        ]}
                                        onPress={handlePurchase}
                                        disabled={loading || !phoneNumber}
                                    >
                                        {loading ? (
                                            <ActivityIndicator color="#0A1128" />
                                        ) : (
                                            <Text style={styles.buttonText}>Proceed to Pay</Text>
                                        )}
                                    </Pressable>
                                </View>
                            </View>
                        </>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
            <PinVerifyPopup
                visible={showPinPopup}
                mode="pin"
                onClose={handleClosePinPopup}
                onPinVerifiedSuccess={handlePinVerified}
                loading={loading}
                inputPin={pin}
                setPin={setPin}
                transferDetails={{
                    amount: selectedPlan?.amount,
                    recipientName: selectedProvider?.provider,
                    recipientAcct: phoneNumber,
                    description: selectedPlan?.name,
                    charges: 0,
                }}
            />
            <TransactionResultModal
                visible={showReceipt}
                status={transactionResult.status}
                title={transactionResult.title}
                onClose={handleCloseReceipt}
                transferDetails={{
                    ...transactionResult,
                    account_name: selectedProvider?.provider,
                    account_number: phoneNumber,
                    bank_name: 'N/A',
                    description: selectedPlan?.name,
                    amount: selectedPlan?.amount,
                    charges: 0,
                    reference: reference,
                }}
            />
        </View>
    );
});

export default DataScreen;
