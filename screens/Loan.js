import React, { useState, useEffect, useCallback } from 'react';
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
    Alert,
    Keyboard, // Import Keyboard for dismissing it
    TouchableWithoutFeedback, // For dismissing keyboard on tap
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; // Keep this for wider screen safety
import GeneralIconsMenuButtons from '../components/GeneralIconsMenuButtons';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext'; // Adjust path if necessary
import ColourScheme from '../styles/ColourSchemeStyles'; // Import the new color scheme

export default function Loan({ navigation }) {
    // Use selectedAccount and isLoadingAuth from AuthContext
    const { selectedAccount, isLoadingAuth } = useAuth();

    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');
    const [processing, setProcessing] = useState(false);
    const [success, setSuccess] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    // Derive agentAcct directly from selectedAccount
    const agentAcct = selectedAccount?.account_number || selectedAccount?.accountNumber || '';
    const customerId = selectedAccount?.customer_id || null;

    // Function to get full name (copied for consistency, though not directly used in this component's display)
    const getFullNameFromUserObject = useCallback((user) => {
        if (user?.customer_first_name || user?.customer_last_name) {
            return `${user.customer_first_name ?? ""} ${user.customer_last_name ?? ""}`.trim();
        }
        return user?.fullName || "";
    }, []);

    const validate = () => {
        if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
            setErrorMsg('Enter a valid loan amount');
            return false;
        }
        if (!reason.trim()) {
            setErrorMsg("Enter a reason for the loan");
            return false;
        }
        setErrorMsg('');
        return true;
    };

    const handleLoanRequest = async () => {
        // Ensure an account is selected before proceeding
        if (!customerId) {
            Alert.alert('Authentication Required', 'Please log in to submit a loan request.');
            return;
        }

        if (!validate()) return;

        setProcessing(true);
        setSuccess('');
        setErrorMsg('');
        Keyboard.dismiss(); // Dismiss keyboard when submitting

        try {
            // In a real application, you would make an API call here.
            // Example payload might look like:
            const loanPayload = {
                customer_id: customerId,
                agent_account_number: agentAcct,
                loan_amount: parseFloat(amount),
                loan_reason: reason.trim(),
                // Add other relevant details like a unique request ID, timestamp, etc.
            };

            console.log('Simulating loan request with payload:', loanPayload);

            // Simulate an API call for loan request
            await new Promise(r => setTimeout(r, 2500)); // Increased simulation time for effect

            // Simulate API response
            const apiSuccess = Math.random() > 0.3; // 70% chance of success for demonstration

            if (apiSuccess) {
                setSuccess(
                    `Loan request of ₦${parseFloat(amount).toLocaleString()} submitted successfully! We will review your application shortly.`
                );
                setAmount('');
                setReason('');
            } else {
                setErrorMsg('Loan request failed. Please try again later or contact support.');
            }

        } catch (e) {
            console.error('Loan request error:', e);
            setErrorMsg('An unexpected error occurred. Please try again.');
        } finally {
            setProcessing(false);
        }
    };

    // Show global loading indicator if AuthContext is still loading
    if (isLoadingAuth) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={ColourScheme.iconLoan} />
                <Text style={styles.loadingText}>Loading user data...</Text>
            </SafeAreaView>
        );
    }

    // Handle case where no selected account is available after loading
    if (!selectedAccount || !selectedAccount.customer_id) {
        return (
            <SafeAreaView style={styles.fullScreenBackground}> {/* Use fullScreenBackground */}
                <GeneralIconsMenuButtons navigation={navigation} active="Loan" />
                <View style={styles.loadingContainer}>
                    <Text style={styles.errorText}>No active account selected. Please log in.</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginButton}>
                        <Text style={styles.loginButtonText}>Go to Login</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.fullScreenBackground}> {/* Use fullScreenBackground */}
            {/* General Icons Menu Buttons at top right, now also displaying account */}
            <GeneralIconsMenuButtons
                navigation={navigation}
                active="Loan"
                accountNumber={agentAcct} // Pass the derived account number
                customerName={getFullNameFromUserObject(selectedAccount)} // Pass full name
            />

            <KeyboardAvoidingView
                style={styles.keyboardAvoidingContainer} // Use a style for better flex management
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0} // Adjust this offset based on your header height
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <ScrollView
                        contentContainerStyle={styles.scrollViewContent} // New style for ScrollView content
                    >
                        <View style={styles.mainContentCard}> {/* New card for main content */}
                            <View style={{ alignItems: 'center', marginBottom: 20 }}>
                                <Icon name="currency-ngn" size={38} color={ColourScheme.iconLoan} />
                            </View>
                            <Text style={styles.title}>Request a Loan</Text>
                            <Text style={styles.subtitle}>
                                Apply for a loan using your agent account.
                            </Text>

                            {success ? <Text style={styles.successMsg}>{success}</Text> : null}
                            {errorMsg ? <Text style={styles.errorMsg}>{errorMsg}</Text> : null}

                            <Text style={styles.label}>Your Account Number</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: ColourScheme.inputDisabledBackground, color: ColourScheme.textMedium }]}
                                value={agentAcct}
                                editable={false}
                            />

                            <Text style={styles.label}>Loan Amount (₦)</Text>
                            <TextInput
                                style={styles.input}
                                value={amount}
                                onChangeText={(text) => setAmount(text.replace(/[^0-9.]/g, ''))} // Allow only numbers and a decimal
                                keyboardType="numeric"
                                placeholder="e.g., 50000"
                                placeholderTextColor={ColourScheme.textPlaceholder} // Added placeholder color
                                returnKeyType="next"
                                onSubmitEditing={() => Keyboard.dismiss()} // Consider focusing next field if you had more
                            />

                            <Text style={styles.label}>Reason for Loan</Text>
                            <TextInput
                                style={[styles.input, styles.reasonInput]} // Separate style for multiline height
                                value={reason}
                                onChangeText={setReason}
                                placeholder="e.g., Business expansion, emergency, personal use"
                                placeholderTextColor={ColourScheme.textPlaceholder} // Added placeholder color
                                multiline
                                numberOfLines={4} // Increased lines for better input visibility
                                textAlignVertical="top" // Ensures text starts from the top on Android
                                returnKeyType="done"
                                onSubmitEditing={handleLoanRequest} // Submit on "done" from last input
                            />

                            <TouchableOpacity
                                style={[styles.button, processing && { opacity: 0.6 }]}
                                onPress={handleLoanRequest}
                                disabled={processing || !customerId} // Disable if no customer ID
                            >
                                {processing ? (
                                    <ActivityIndicator color={ColourScheme.textPrimary} />
                                ) : (
                                    <Text style={styles.buttonText}>Submit Loan Request</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    fullScreenBackground: { // New style for the main background
        flex: 1,
        backgroundColor: ColourScheme.backgroundPrimary, // Using color from scheme
    },
    keyboardAvoidingContainer: {
        flex: 1,
    },
    scrollViewContent: { // New style for ScrollView content container
        flexGrow: 1,
        justifyContent: 'center', // Center the card vertically
        alignItems: 'center',
        paddingVertical: 20, // Add some vertical padding
        paddingHorizontal: 20,
    },
    mainContentCard: { // New style for the main content card, mimicking loginBox
        backgroundColor: ColourScheme.backgroundDark, // Dark background
        borderRadius: 15,
        padding: 25,
        width: '100%',
        maxWidth: 400,
        alignItems: 'center',
        shadowColor: ColourScheme.shadowColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 10,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: ColourScheme.backgroundPrimary, // Consistent with main background
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: ColourScheme.textPrimary, // Changed to primary text color for dark background
    },
    errorText: {
        fontSize: 16,
        color: ColourScheme.textError,
        textAlign: 'center',
        marginBottom: 20,
    },
    loginButton: {
        backgroundColor: ColourScheme.primary,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    loginButtonText: {
        color: ColourScheme.textPrimary,
        fontSize: 16,
        fontWeight: 'bold',
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: ColourScheme.textPrimary, // Changed to primary text color
        marginBottom: 8,
        marginTop: 2,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: ColourScheme.textSecondary, // Changed to secondary text color
        marginBottom: 14,
        textAlign: 'center',
    },
    label: {
        color: ColourScheme.textPrimary, // Changed to primary text color
        marginTop: 16,
        marginBottom: 4,
        fontWeight: '600',
        fontSize: 15,
        alignSelf: 'flex-start', // Align labels to the left
        width: '100%', // Ensure label takes full width for alignment
    },
    input: {
        borderWidth: 1,
        borderColor: ColourScheme.borderLight, // Using borderLight from login screen
        borderRadius: 8, // Increased border radius for consistency
        padding: 12,
        backgroundColor: ColourScheme.backgroundInput, // Using backgroundInput from login screen
        fontSize: 16,
        color: ColourScheme.textPrimary, // Input text color
        minHeight: 50, // Consistent with login inputs
        width: '100%', // Ensure input takes full width of its container
    },
    reasonInput: {
        height: 100, // Adjusted height for multiline input
        paddingTop: 12, // Ensure text is not cut off at the top
        paddingBottom: 12,
    },
    button: {
        backgroundColor: ColourScheme.primary, // Using primary color for button
        padding: 15,
        borderRadius: 8, // Consistent with login buttons
        marginTop: 30,
        alignItems: 'center',
        width: '100%', // Make button full width
    },
    buttonText: {
        color: ColourScheme.textPrimary,
        fontWeight: 'bold',
        fontSize: 17,
    },
    successMsg: {
        backgroundColor: ColourScheme.successBackground,
        color: ColourScheme.textSuccessDark,
        padding: 12,
        borderRadius: 4,
        marginBottom: 16,
        borderLeftWidth: 4,
        borderLeftColor: ColourScheme.textSuccessDark,
        fontSize: 15,
        width: '100%', // Ensure message takes full width
        textAlign: 'center',
    },
    errorMsg: {
        backgroundColor: ColourScheme.errorBackground,
        color: ColourScheme.textError,
        padding: 12,
        borderRadius: 4,
        marginBottom: 16,
        borderLeftWidth: 4,
        borderLeftColor: ColourScheme.textError,
        fontSize: 15,
        width: '100%', // Ensure message takes full width
        textAlign: 'center',
    },
});
