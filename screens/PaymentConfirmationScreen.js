import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';

export default function PaymentConfirmationScreen({ route, navigation }) {
    const { amount, paymentMethod } = route.params;

    const [staffPin, setStaffPin] = useState('');
    const [processing, setProcessing] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const handleConfirmPayment = async () => {
        setErrorMsg('');
        setSuccessMsg('');

        if (staffPin.length !== 4 || isNaN(staffPin)) {
            setErrorMsg('Please enter a valid 4-digit PIN.');
            return;
        }

        setProcessing(true);

        try {
            // Simulate API call to verify staff PIN and complete transaction
            // In a real application, you would send staffPin, amount, paymentMethod
            // and other relevant transaction details to your backend for processing.
            console.log(`Attempting to confirm payment: Amount ₦${amount}, Method: ${paymentMethod}, Staff PIN: ${staffPin}`);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate network delay

            // Simulate successful PIN verification and transaction completion
            if (staffPin === '1234') { // Replace with actual PIN verification logic
                setSuccessMsg('Payment confirmed successfully!');
                // Navigate to Dashboard after a short delay to show success message
                setTimeout(() => {
                    navigation.navigate('Dashboard');
                }, 1500);
            } else {
                setErrorMsg('Incorrect PIN. Please try again.');
            }

        } catch (error) {
            console.error('Payment confirmation error:', error);
            setErrorMsg('An error occurred during payment confirmation. Please try again.');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                {/* Changed onPress to navigate directly to 'POS' screen */}
                <TouchableOpacity onPress={() => navigation.navigate('POS')} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#166088" />
                    <Text style={styles.backButtonText}>Back to POS</Text> {/* Changed button text */}
                </TouchableOpacity>

                <Ionicons name="checkmark-circle-outline" size={80} color="#28a745" style={styles.icon} />
                <Text style={styles.title}>Payment Confirmation</Text>
                <Text style={styles.message}>
                    Your payment request for {' '}
                    <Text style={styles.amountText}>₦{parseFloat(amount).toFixed(2)}</Text> {' '}
                    via <Text style={styles.methodText}>{paymentMethod.toUpperCase()}</Text> has been initiated.
                </Text>
                <Text style={styles.instruction}>
                    Please complete the transaction according to your chosen method.
                </Text>

                {/* Staff PIN Section */}
                <View style={styles.pinSection}>
                    <Text style={styles.pinLabel}>Staff PIN:</Text>
                    <TextInput
                        style={styles.pinInput}
                        placeholder="Enter 4-digit PIN"
                        value={staffPin}
                        onChangeText={setStaffPin}
                        keyboardType="numeric"
                        maxLength={4}
                        secureTextEntry={true}
                        editable={!processing}
                    />
                    {errorMsg ? <Text style={styles.errorMsg}>{errorMsg}</Text> : null}
                    {successMsg ? <Text style={styles.successMsg}>{successMsg}</Text> : null}

                    <TouchableOpacity
                        style={[styles.confirmButton, processing && { opacity: 0.6 }]}
                        onPress={handleConfirmPayment}
                        disabled={processing}
                    >
                        {processing ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.confirmButtonText}>Confirm Payment</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={styles.doneButton}
                    onPress={() => navigation.navigate('Dashboard')} // Or navigate to Retail to start a new sale
                >
                    <Text style={styles.doneButtonText}>Done</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#f5f7fa',
    },
    container: {
        flex: 1,
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f7fa',
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 20, // Adjust for iOS SafeArea
        left: 20,
        padding: 10,
        borderRadius: 5,
        backgroundColor: '#eaf2f8',
    },
    backButtonText: {
        color: '#166088',
        marginLeft: 5,
        fontSize: 16,
    },
    icon: {
        marginBottom: 20,
    },
    title: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#166088',
        marginBottom: 15,
        textAlign: 'center',
    },
    message: {
        fontSize: 18,
        color: '#333',
        textAlign: 'center',
        marginBottom: 10,
    },
    amountText: {
        fontWeight: 'bold',
        color: '#28a745',
    },
    methodText: {
        fontWeight: 'bold',
        color: '#FF9800', // A color to highlight the method
    },
    instruction: {
        fontSize: 16,
        color: '#555',
        textAlign: 'center',
        marginBottom: 30,
    },
    // Staff PIN Section Styles
    pinSection: {
        width: '100%',
        alignItems: 'center',
        marginTop: 20,
        padding: 20,
        backgroundColor: '#eaf2f8',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#b6c8e9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    pinLabel: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#166088',
        marginBottom: 10,
    },
    pinInput: {
        width: '60%',
        padding: 12,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        fontSize: 20,
        textAlign: 'center',
        letterSpacing: 4, // For better PIN input visualization
        backgroundColor: '#fff',
        marginBottom: 15,
    },
    confirmButton: {
        backgroundColor: '#166088',
        paddingVertical: 14,
        paddingHorizontal: 30,
        borderRadius: 8,
        marginTop: 10,
        alignItems: 'center',
        justifyContent: 'center',
        width: '80%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    confirmButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 18,
    },
    successMsg: {
        backgroundColor: '#e6f4ea',
        color: '#28a745',
        padding: 10,
        borderRadius: 4,
        marginBottom: 10,
        borderLeftWidth: 4,
        borderLeftColor: '#28a745',
        fontSize: 15,
        width: '100%',
        textAlign: 'center',
    },
    errorMsg: {
        backgroundColor: '#fdecea',
        color: '#dc3545',
        padding: 10,
        borderRadius: 4,
        marginBottom: 10,
        borderLeftWidth: 4,
        borderLeftColor: '#dc3545',
        fontSize: 15,
        width: '100%',
        textAlign: 'center',
    },
    doneButton: {
        backgroundColor: '#6c757d', // A neutral color for 'Done'
        paddingVertical: 14,
        paddingHorizontal: 30,
        borderRadius: 8,
        marginTop: 30, // Increased margin to separate from PIN section
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    doneButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 18,
    },
});
