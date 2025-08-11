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
import AirtelIcon from '../assets/airtel_icon.png';
import GloIcon from '../assets/glo_icon.png';
import MtnIcon from '../assets/mtn_icon.png';
import NineMobileIcon from '../assets/ninemobile_icon.png';
import SmileIcon from '../assets/smile.png';
import SpectranetIcon from '../assets/spectranet_icon.png';

const dataProviderIcons = {
    AIRTEL: AirtelIcon,
    GLO: GloIcon,
    MTN: MtnIcon,
    '9MOBILE': NineMobileIcon,
    SMILE: SmileIcon,
    SPECTRANET: SpectranetIcon,
};

function generateReference() {
    return 'ref-' + Math.random().toString(36).substr(2, 9);
}

const formatBalance = (num) => {
    const numStr = parseFloat(num).toFixed(2);
    return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const DataScreen = () => {
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
    const [cachedProviders, setCachedProviders] = useState([]);
    const [cachedPlans, setCachedPlans] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [recentPurchases, setRecentPurchases] = useState([]);
    const [selectedRecentPurchase, setSelectedRecentPurchase] = useState(null);

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
        if (!currentUserTechvibesId) return [];
        try {
            await migrateLegacyPurchases(currentUserTechvibesId);
            const purchases = await getRecentPurchases(currentUserTechvibesId);
            return purchases || [];
        } catch (error) {
            console.error('Error loading recent purchases:', error);
            return [];
        }
    }, [currentUserTechvibesId]);

    useEffect(() => {
        const initRecentPurchases = async () => {
            const purchases = await loadRecentPurchases();
            if (purchases.length) {
                setRecentPurchases(purchases);
            }
        };
        initRecentPurchases();
    }, [currentUserTechvibesId, loadRecentPurchases]);

    const addToRecentPurchases = useCallback(async (purchase) => {
        if (!currentUserTechvibesId) return;
        try {
            const savedPurchases = await saveRecentPurchase(currentUserTechvibesId, {
                ...purchase,
                id: generateReference(),
                date: new Date().toISOString(),
                status: 'success'
            });
            setRecentPurchases(savedPurchases);
        } catch (error) {
            console.error('Error saving recent purchase:', error);
        }
    }, [currentUserTechvibesId]);

    useEffect(() => {
        const getProviders = async () => {
            if (cachedProviders.length > 0) {
                setProviders(cachedProviders);
                return;
            }
            setLoading(true);
            const result = await fetchProviders();
            if (result.data) {
                const providersWithIcons = result.data.map(provider => ({
                    ...provider,
                    icon: dataProviderIcons[provider.provider.toUpperCase()],
                }));
                setProviders(providersWithIcons);
                setCachedProviders(providersWithIcons);
            } else {
                setError(result.message || 'Failed to load providers.');
            }
            setLoading(false);
        };
        getProviders();
    }, [cachedProviders]);

    useEffect(() => {
        if (selectedProvider) {
            const getPlans = async () => {
                if (cachedPlans[selectedProvider.provider]) {
                    setPlans(cachedPlans[selectedProvider.provider]);
                    return;
                }
                setLoading(true);
                setPlans([]);
                setSelectedPlan(null);
                const result = await fetchDataPlans(selectedProvider.provider);
                if (result.data) {
                    setPlans(result.data);
                    setCachedPlans(prev => ({
                        ...prev,
                        [selectedProvider.provider]: result.data,
                    }));
                } else {
                    setPlans([]);
                    setError(result.message || 'No plans available.');
                }
                setLoading(false);
            };
            getPlans();
        } else {
            setPlans([]);
            setSearchTerm('');
        }
    }, [selectedProvider, cachedPlans]);

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

    const handleProviderSelect = (provider) => {
        setSelectedProvider(provider);
        setSelectedPlan(null);
        setTransactionResult({});
        setError(null);
    };

    const handleRecentPurchaseSelect = (purchase) => {
        const provider = providers.find(p => p.provider === purchase.provider);
        if (provider) {
            setSelectedProvider(provider);
            setPhoneNumber(purchase.phoneNumber);

            const matchingPlan = plans.find(p =>
                p.name === purchase.planName &&
                p.amount === purchase.amount
            );

            if (matchingPlan) {
                setSelectedPlan(matchingPlan);
                setReference(generateReference());
            } else {
                setSelectedRecentPurchase(purchase);
            }
        }
    };

    const handlePlanSelect = (plan) => {
        setSelectedPlan(plan);
        setReference(generateReference());
    };

    const handlePurchase = () => {
        if (!selectedPlan || !phoneNumber || !reference) {
            Alert.alert('Validation Error', 'Please select a plan and fill in all fields.');
            return;
        }
        if (balance !== null && selectedPlan.amount > balance) {
            Alert.alert('Insufficient Funds', `You need NGN ${formatBalance(selectedPlan.amount)} for this plan.`);
            return;
        }
        setShowPinPopup(true);
    };

    const handlePinVerified = async () => {
        setShowPinPopup(false);
        setLoading(true);
        setTransactionResult({});
        setError(null);
        const purchaseData = {
            provider: selectedProvider.provider,
            number: phoneNumber,
            plan_id: selectedPlan.id,
            reference: reference,
        };
        try {
            const result = await purchaseDataPlan(purchaseData);
            if (result.success) {
                await addToRecentPurchases({
                    provider: selectedProvider.provider,
                    planName: selectedPlan.name,
                    phoneNumber: phoneNumber,
                    amount: selectedPlan.amount,
                    reference: reference
                });
                setTransactionResult({
                    status: 'success',
                    title: 'Purchase Successful!',
                    message: result.message || 'Data purchase completed successfully.',
                    reference: result.reference || reference,
                    amount: selectedPlan.amount,
                    planName: selectedPlan.name,
                    phoneNumber: phoneNumber,
                    providerName: selectedProvider.name,
                });
                setSelectedProvider(null);
                setPhoneNumber('');
                setSelectedPlan(null);
                setPlans([]);
                setPin('');
            } else {
                setTransactionResult({
                    status: 'failed',
                    title: 'Purchase Failed!',
                    message: result.message || 'Data purchase could not be completed.',
                    reference: result.reference || reference,
                    amount: selectedPlan.amount,
                    planName: selectedPlan.name,
                    phoneNumber: phoneNumber,
                    providerName: selectedProvider.name,
                });
            }
            setShowReceipt(true);
        } catch (err) {
            setTransactionResult({
                status: 'failed',
                title: 'Network Error',
                message: err.message || 'Something went wrong.',
                amount: selectedPlan ? selectedPlan.amount : 0,
                planName: selectedPlan ? selectedPlan.name : 'N/A',
                phoneNumber: phoneNumber,
                providerName: selectedProvider ? selectedProvider.name : 'N/A',
            });
            setShowReceipt(true);
        } finally {
            setLoading(false);
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
    };

    const handleClosePinPopup = () => {
        setShowPinPopup(false);
        setPin('');
    };

    const handleBack = () => {
        setSelectedPlan(null);
    };

    const styles = StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: '#121212',
        },
        scrollContainer: {
            padding: 16,
            paddingBottom: 150,
            paddingTop: Platform.OS === 'android' ? 30 : 50,
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
        sectionTitle: {
            fontSize: 16,
            fontWeight: 'bold',
            color: '#FFFFFF',
            marginBottom: 10,
            alignSelf: 'flex-end',
        },
        formCard: {
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
        },
        providerContainer: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-around',
            marginBottom: 20,
        },
        providerButton: {
            backgroundColor: '#1E1E1E',
            borderRadius: 10,
            padding: 15,
            alignItems: 'center',
            justifyContent: 'center',
            width: '45%',
            marginBottom: 10,
            borderColor: '#333',
            borderWidth: 1,
        },
        selectedProviderButton: {
            borderColor: '#4CC9F0',
            borderWidth: 2,
        },
        providerIcon: {
            width: 40,
            height: 40,
            marginBottom: 8,
            resizeMode: 'contain',
        },
        providerText: {
            color: '#FFFFFF',
            fontSize: 14,
            fontWeight: 'bold',
        },
        input: {
            backgroundColor: '#1E1E1E',
            color: '#FFFFFF',
            borderRadius: 8,
            padding: 12,
            fontSize: 16,
            borderWidth: 1,
            borderColor: '#333',
            marginBottom: 15,
            width: '100%',
        },
        button: {
            backgroundColor: '#4CC9F0',
            padding: 15,
            borderRadius: 8,
            alignItems: 'center',
            marginTop: 20,
            alignSelf: 'flex-end',
        },
        buttonText: {
            color: '#0A1128',
            fontSize: 16,
            fontWeight: 'bold',
        },
        errorText: {
            color: '#FF6B6B',
            textAlign: 'center',
            marginVertical: 10,
            fontWeight: '600',
        },
        recentPurchasesTitle: {
            fontSize: 16,
            fontWeight: 'bold',
            color: '#FFFFFF',
            marginBottom: 10,
        },
        recentPurchasesList: {
            flexDirection: 'row',
            height: 120,
        },
        recentPurchaseCard: {
            width: 160,
            height: 100,
            borderRadius: 8,
            padding: 8,
            marginRight: 10,
            backgroundColor: '#1E1E1E',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
            elevation: 3,
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: '#333',
        },
        recentPurchaseAmount: {
            fontWeight: 'bold',
            fontSize: 13,
            color: '#4CC9F0',
        },
        scrollHint: {
            position: 'absolute',
            right: 10,
            top: '50%',
            marginTop: -10,
            color: '#4CC9F0',
            zIndex: 1,
        },
        planCardContainer: {
            maxHeight: 400,
            marginBottom: 20,
        },
        verticalScrollView: {
            flex: 1,
        },
        planItemVertical: {
            padding: 15,
            backgroundColor: '#1E1E1E',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#333',
            marginBottom: 10,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        planInfoContainer: {
            flex: 1,
            marginRight: 10,
        },
        planName: {
            color: '#FFFFFF',
            fontWeight: '600',
            fontSize: 15,
        },
        planDescription: {
            color: '#B0B0B0',
            fontSize: 13,
            marginTop: 3,
        },
        planAmount: {
            color: '#4CC9F0',
            fontWeight: 'bold',
            fontSize: 15,
        },
        label: {
            fontSize: 14,
            marginBottom: 8,
            color: '#B0B0B0',
            alignSelf: 'flex-end',
        },
        loadingContainer: {
            padding: 20,
            alignItems: 'center',
        },
        noPlansText: {
            textAlign: 'center',
            padding: 20,
            color: '#B0B0B0',
        },
        backButton: {
            flexDirection: 'row',
            alignItems: 'center',
            alignSelf: 'flex-end',
            marginBottom: 20,
        },
        backButtonText: {
            marginLeft: 5,
            color: '#4CC9F0',
            fontSize: 16,
        },
        searchContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#1E1E1E',
            borderRadius: 8,
            paddingHorizontal: 15,
            marginBottom: 15,
            borderWidth: 1,
            borderColor: '#333',
        },
        searchInput: {
            flex: 1,
            height: 40,
            color: '#FFFFFF',
            paddingLeft: 10,
        },
        searchIcon: {
            marginRight: 5,
        },
        recentPurchaseProvider: {
            color: '#4CC9F0',
            fontSize: 14,
            fontWeight: 'bold',
        },
        recentPurchasePlan: {
            color: '#FFFFFF',
            fontSize: 12,
            marginTop: 5,
        },
        recentPurchasePhone: {
            color: '#B0B0B0',
            fontSize: 12,
            marginTop: 3,
        },
        rightAlignedContent: {
            alignItems: 'flex-end',
        },
    });

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <GeneralIconsMenuButtons navigation={navigation} active="Data" />
            <ScrollView
                contentContainerStyle={styles.scrollContainer}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {!selectedPlan ? (
                    <>
                        <View style={styles.headerCard}>
                            <View style={styles.topIconContainer}>
                                <Icon name="wifi" size={24} color="#4CC9F0" />
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
                                        ? `NGN ${formatBalance(balance)}`
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
                            <Text style={styles.recentPurchasesTitle}>Recent Purchases</Text>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.recentPurchasesList}
                            >
                                {recentPurchases.length > 0 ? (
                                    recentPurchases.map((purchase) => (
                                        <TouchableOpacity
                                            key={purchase.id}
                                            style={[
                                                styles.recentPurchaseCard,
                                                purchase.status === 'success' && { borderLeftColor: '#4CAF50', borderLeftWidth: 4 },
                                                purchase.status === 'failed' && { borderLeftColor: '#F44336', borderLeftWidth: 4 }
                                            ]}
                                            onPress={() => handleRecentPurchaseSelect(purchase)}
                                        >
                                            <Text style={styles.recentPurchaseProvider}>
                                                {purchase.provider}
                                            </Text>
                                            <Text style={styles.recentPurchasePlan} numberOfLines={1}>
                                                {purchase.planName}
                                            </Text>
                                            <Text style={styles.recentPurchasePhone}>
                                                {purchase.phoneNumber}
                                            </Text>
                                            <Text style={styles.recentPurchaseAmount}>
                                                ₦{formatBalance(purchase.amount)}
                                            </Text>
                                            {purchase.status && (
                                                <Text style={[
                                                    styles.recentPurchasePhone,
                                                    purchase.status === 'success' && { color: '#4CAF50' },
                                                    purchase.status === 'failed' && { color: '#F44336' }
                                                ]}>
                                                    {purchase.status.toUpperCase()}
                                                </Text>
                                            )}
                                        </TouchableOpacity>
                                    ))
                                ) : (
                                    <Text style={{ color: '#B0B0B0', alignSelf: 'center', marginLeft: 10 }}>
                                        No recent data purchases
                                    </Text>
                                )}
                            </ScrollView>
                            {recentPurchases.length > 2 && (
                                <Icon
                                    name="chevron-forward"
                                    size={20}
                                    color="#4CC9F0"
                                    style={styles.scrollHint}
                                />
                            )}
                        </View>
                        <View style={styles.formCard}>
                            <Text style={styles.sectionTitle}>Select Internet Provider</Text>
                            <View style={styles.providerContainer}>
                                {loading && <ActivityIndicator size="small" color="#4CC9F0" />}
                                {error && <Text style={styles.errorText}>{error}</Text>}
                                {!loading && providers.map((provider) => (
                                    <TouchableOpacity
                                        key={provider.provider}
                                        style={[
                                            styles.providerButton,
                                            selectedProvider?.provider === provider.provider && styles.selectedProviderButton
                                        ]}
                                        onPress={() => handleProviderSelect(provider)}
                                    >
                                        <Image
                                            source={provider.icon}
                                            style={styles.providerIcon}
                                            resizeMode="contain"
                                        />
                                        <Text style={styles.providerText}>
                                            {provider.provider}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            {selectedProvider && (
                                <>
                                    <Text style={styles.sectionTitle}>
                                        Data Plans for {selectedProvider.provider}
                                    </Text>
                                    <View style={styles.searchContainer}>
                                        <Icon name="search" size={20} color="#B0B0B0" style={styles.searchIcon} />
                                        <TextInput
                                            style={styles.searchInput}
                                            placeholder="Search plans..."
                                            placeholderTextColor="#666"
                                            value={searchTerm}
                                            onChangeText={setSearchTerm}
                                        />
                                    </View>
                                    <View style={styles.planCardContainer}>
                                        {loading ? (
                                            <View style={styles.loadingContainer}>
                                                <ActivityIndicator size="small" color="#4CC9F0" />
                                            </View>
                                        ) : filteredPlans.length > 0 ? (
                                            <ScrollView
                                                style={styles.verticalScrollView}
                                                showsVerticalScrollIndicator={true}
                                            >
                                                {filteredPlans.map((plan) => (
                                                    <TouchableOpacity
                                                        key={plan.id}
                                                        style={[
                                                            styles.planItemVertical,
                                                            selectedPlan?.id === plan.id && styles.selectedPlanItem
                                                        ]}
                                                        onPress={() => handlePlanSelect(plan)}
                                                    >
                                                        <View style={styles.planInfoContainer}>
                                                            <Text style={styles.planName}>{plan.name}</Text>
                                                            {plan.description && (
                                                                <Text style={styles.planDescription}>
                                                                    {plan.description}
                                                                </Text>
                                                            )}
                                                        </View>
                                                        <Text style={styles.planAmount}>
                                                            ₦{formatBalance(plan.amount)}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>
                                        ) : (
                                            <Text style={styles.noPlansText}>
                                                {searchTerm ? 'No matching plans found' : 'No data plans available'}
                                            </Text>
                                        )}
                                    </View>
                                </>
                            )}
                        </View>
                    </>
                ) : (
                    <View style={styles.formCard}>
                        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                            <Icon name="arrow-back" size={20} color="#4CC9F0" />
                            <Text style={styles.backButtonText}>Back</Text>
                        </TouchableOpacity>
                        <View style={styles.rightAlignedContent}>
                            <Text style={styles.sectionTitle}>Complete Purchase</Text>
                            <Text style={styles.label}>
                                Selected Plan: {selectedPlan.name} (₦{formatBalance(selectedPlan.amount)})
                            </Text>
                            <Text style={styles.label}>Phone Number</Text>
                            <TextInput
                                style={styles.input}
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
                )}
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
                        recipientBankName: 'N/A',
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
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

export default DataScreen;
