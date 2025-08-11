import React, { useState, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    Button,
    StyleSheet,
    Alert,
    ScrollView,
    ActivityIndicator,
    TouchableOpacity,
    Platform,
    KeyboardAvoidingView,
    SafeAreaView,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';

// Import the email service utility
import { sendEmail } from '../utils/emailService'; // Make sure this path is correct

// Import the new color scheme
import ColourScheme from '../styles/ColourSchemeStyles';

// Conditionally import DateTimePicker for native platforms only
let DateTimePicker = null;
if (Platform.OS === 'ios' || Platform.OS === 'android') {
    DateTimePicker = require('@react-native-community/datetimepicker').default;
}

const Register2 = () => {
    const route = useRoute();
    const navigation = useNavigation();

    const { initialStepOneData } = route.params;

    // --- State for Step 2 Fields ---
    const [password, setPassword] = useState(''); // This will map to 'pass' in DB
    const [passwordError, setPasswordError] = useState('');
    const [pin, setPin] = useState('');
    const [pinError, setPinError] = useState('');

    // Date picker states
    const [dateOfBirth, setDateOfBirth] = useState(new Date()); // Store as Date object

    // Initialize displayDate directly from initial dateOfBirth
    const initialDay = String(dateOfBirth.getDate()).padStart(2, '0');
    const initialMonth = String(dateOfBirth.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const initialYear = dateOfBirth.getFullYear();
    const [displayDate, setDisplayDate] = useState(`${initialDay}/${initialMonth}/${initialYear}`); // This will map to 'dob' in DB

    const [showDatePicker, setShowDatePicker] = useState(false); // Controls visibility of native date picker

    const [address, setAddress] = useState('');
    const [gender, setGender] = useState(''); // Empty string as default

    const [selectedIdType, setSelectedIdType] = useState(''); // Empty string as default

    // These are already camelCase and match DB columns:
    const [nationalIdentityNo, setNationalIdentityNo] = useState('');
    const [ninUserId, setNinUserId] = useState('');
    const [bvn, setBvn] = useState('');

    const [isLoading, setIsLoading] = useState(false);

    const fintech_code = initialStepOneData.fintech_code || 'KIAKIA'; // Use fintech from Step 1 data
    // NEW: Specific API URL for registration submission
    const REGISTER_SUBMIT_API_URL = 'https://techvibs.com/bank/api_general/register_submit_api.php';


    // --- Password Validation Logic ---
    const validatePassword = (text) => {
        setPassword(text);
        if (!text) {
            setPasswordError('Password cannot be empty.');
        } else if (!/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/.test(text)) {
            setPasswordError('Min 8 characters, at least one letter and one number.');
        } else {
            setPasswordError('');
        }
    };

    // --- PIN Validation Logic ---
    const validatePin = (text) => {
        setPin(text);
        if (!text) {
            setPinError('PIN cannot be empty.');
        } else if (!/^\d{4}$/.test(text)) {
            setPinError('PIN must be exactly 4 digits.');
        } else {
            setPinError('');
        }
    };

    // --- Date Picker Handlers for Native Platforms ---
    const onChangeDate = (event, selectedDate) => {
        const currentDate = selectedDate || dateOfBirth;
        setShowDatePicker(Platform.OS === 'ios'); // Keep picker open on iOS until manually closed
        setDateOfBirth(currentDate);

        // Format for display and API submission
        const day = String(currentDate.getDate()).padStart(2, '0');
        const month = String(currentDate.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
        const year = currentDate.getFullYear();
        setDisplayDate(`${day}/${month}/${year}`);
    };

    const showDatepicker = () => {
        setShowDatePicker(true);
    };


    // --- The Core Submission Function ---
    const handleFinalRegistration = useCallback(async () => {
        setIsLoading(true);

        // Re-run validations on final submit to catch any last-minute changes or bypasses
        validatePassword(password);
        validatePin(pin);

        // Use setTimeout to allow state updates from validatePassword/validatePin to complete
        // before checking their error states, as state updates are asynchronous.
        setTimeout(async () => {
            if (passwordError || pinError) { // Check the latest error states
                Alert.alert("Validation Error", "Please correct the errors in password or PIN fields.");
                setIsLoading(false);
                return;
            }

            // Additional validations for other required fields
            if (!displayDate || !address.trim() || !gender) {
                Alert.alert("Validation Error", "Please fill in all *required fields on this page (Date of Birth, Address, Gender).");
                setIsLoading(false);
                return;
            }

            // NIN/BVN validation based on selection
            if (!selectedIdType) {
                Alert.alert("Validation Error", "Please select either NIN or BVN and fill the required field(s).");
                setIsLoading(false);
                return;
            }
            if (selectedIdType === 'NIN' && (!nationalIdentityNo || nationalIdentityNo.trim().length === 0)) {
                Alert.alert("Validation Error", "National Identity Number is required if NIN is selected.");
                setIsLoading(false);
                return;
            }
            if (selectedIdType === 'BVN' && (!bvn || bvn.trim().length === 0)) {
                Alert.alert("Validation Error", "BVN is required if BVN is selected.");
                setIsLoading(false);
                return;
            }

            // Combine data from initialStepOneData (passed from RegisterScreen) and current Step 2 state
            const combinedData = {
                ...initialStepOneData,
                // Changed 'password' to 'pass' to match DB column
                pass: password,
                pin,
                // Changed 'dateOfBirth' to 'dob' to match DB column
                dob: displayDate, // Use the formatted date string for API
                address: address.trim(),
                // Gender conversion for API/DB: 'Male' -> '0', 'Female' -> '1'
                gender: gender === 'Male' ? '0' : (gender === 'Female' ? '1' : ''),
                fintech: fintech_code, // Renamed from fintech_code to fintech to match DB
                transactionTrackingRef: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                }),
                device_fingerprint: 'react_native_app_device_id_12345',
            };

            // Add ID specific data, ensuring other ID fields are empty if not selected
            if (selectedIdType === 'NIN') {
                combinedData.nationalIdentityNo = nationalIdentityNo.trim();
                combinedData.ninUserId = ninUserId.trim();
                combinedData.bvn = ''; // Ensure BVN is empty if NIN is selected
            } else if (selectedIdType === 'BVN') {
                combinedData.bvn = bvn.trim();
                combinedData.nationalIdentityNo = ''; // Ensure NIN is empty if BVN is selected
                combinedData.ninUserId = '';
            }

            // --- Create FormData object ---
            const formData = new FormData();
            formData.append('action', 'register_account'); // This action is for the register_submit_api.php
            for (const key in combinedData) {
                formData.append(key, typeof combinedData[key] === 'string' ? combinedData[key].trim() : combinedData[key]);
            }

            // --- Make the API Call ---
            try {
                console.log('Attempting to send final registration data...');
                // console.log("FormData being sent:", Object.fromEntries(formData.entries())); // For debugging

                const response = await fetch(REGISTER_SUBMIT_API_URL, { // <--- Changed API URL here
                    method: 'POST',
                    headers: { /* No Content-Type for FormData, it's handled automatically */ },
                    body: formData,
                });

                const responseText = await response.text();
                console.log('Raw API Response (Final Submission):', responseText);

                let data;
                try {
                    data = JSON.parse(responseText);
                } catch (jsonError) {
                    console.error('Failed to parse JSON response (Final Submission):', jsonError);
                    throw new Error('Server returned non-JSON response: ' + responseText);
                }

                // Check for data.status === 'success' from PHP backend
                if (response.ok && data.status === 'success') {
                    Alert.alert('Success', data.message || 'Account registered successfully!');
                    console.log('Registration Data:', data);

                    // --- Send success email to the user ---
                    const userEmail = initialStepOneData.email;
                    const userFullName = `${initialStepOneData.firstName} ${initialStepOneData.lastName} ${initialStepOneData.otherNames}`.trim();
                    const accountNo = data.data?.accountNumber || 'N/A'; // Get account number from successful response

                    const successEmailSubject = `Welcome to ${fintech_code.toUpperCase()}! Your Account is Ready!`;
                    const successEmailBody = `
                        <p>Dear ${userFullName || 'Valued Customer'},</p>
                        <p>Congratulations! Your account with <strong>${fintech_code.toUpperCase()}</strong> has been successfully created.</p>
                        <p>Your Account Number is: <strong>${accountNo}</strong></p>
                        <p>You can now log in using your username: <strong>${initialStepOneData.username}</strong> and the password you set.</p>
                        <p>Thank you for choosing ${fintech_code.toUpperCase()}.</p>
                        <p>Best regards,<br/>The ${fintech_code.toUpperCase()} Team</p>
                    `;

                    const emailResult = await sendEmail({
                        toEmail: userEmail,
                        subject: successEmailSubject,
                        body: successEmailBody,
                        isHtml: true,
                    });

                    if (!emailResult.success) {
                        console.error('Failed to send success email:', emailResult.message);
                        // Optionally, alert the user that the email failed to send, but registration was successful
                        // Alert.alert('Email Notice', 'Account created, but we could not send a confirmation email.');
                    }

                    navigation.navigate('Login');
                } else {
                    // Use data.message for the message, and a more accurate title
                    const errorMessage = data.message || 'An unknown error occurred during registration.';
                    Alert.alert('Registration Failed', errorMessage); // The title remains "Registration Failed" if data.status is not 'success'
                    console.error('Server Error:', data);

                    // --- Send failure email to administrator ---
                    const adminEmail = 'admin@techvibs.com'; // Replace with your actual admin email
                    const failureEmailSubject = `Registration Failed: ${initialStepOneData.email || 'Unknown User'}`;
                    const failureEmailBody = `
                        <p>A user attempted to register an account, but the registration failed.</p>
                        <p><strong>User Details (from Step 1):</strong></p>
                        <ul>
                            <li>Email: ${initialStepOneData.email || 'N/A'}</li>
                            <li>Phone No: ${initialStepOneData.phoneNo || 'N/A'}</li>
                            <li>Username: ${initialStepOneData.username || 'N/A'}</li>
                            <li>Fintech: ${fintech_code.toUpperCase()}</li>
                        </ul>
                        <p><strong>Error Message:</strong></p>
                        <p>${errorMessage}</p>
                        <p>Please investigate this issue.</p>
                    `;

                    const emailResult = await sendEmail({
                        toEmail: adminEmail,
                        subject: failureEmailSubject,
                        body: failureEmailBody,
                        isHtml: true,
                    });

                    if (!emailResult.success) {
                        console.error('Failed to send failure notification email to admin:', emailResult.message);
                    }
                }
            } catch (error) {
                console.error('Network or client-side error during final registration:', error);
                Alert.alert('Error', 'Failed to connect to the server or process request. Please check your internet connection.');

                // --- Send network/client-side error email to administrator ---
                const adminEmail = 'admin@techvibs.com'; // Replace with your actual admin email
                const networkErrorSubject = `Registration Network Error: ${initialStepOneData.email || 'Unknown User'}`;
                const networkErrorBody = `
                    <p>A network or client-side error occurred during account registration.</p>
                    <p><strong>User Details (from Step 1):</strong></p>
                    <ul>
                        <li>Email: ${initialStepOneData.email || 'N/A'}</li>
                        <li>Phone No: ${initialStepOneData.phoneNo || 'N/A'}</li>
                        <li>Username: ${initialStepOneData.username || 'N/A'}</li>
                        <li>Fintech: ${fintech_code.toUpperCase()}</li>
                    </ul>
                    <p><strong>Error Details:</strong></p>
                    <p>${error.message}</p>
                    <p>Please investigate this issue.</p>
                `;

                const emailResult = await sendEmail({
                    toEmail: adminEmail,
                    subject: networkErrorSubject,
                    body: networkErrorBody,
                    isHtml: true,
                });

                if (!emailResult.success) {
                    console.error('Failed to send network error notification email to admin:', emailResult.message);
                }
            } finally {
                setIsLoading(false);
            }
        }, 0); // Use setTimeout(..., 0)
    }, [
        initialStepOneData, password, pin, displayDate, address, gender,
        selectedIdType, nationalIdentityNo, ninUserId, bvn, navigation,
        passwordError, pinError, // Include validation errors in dependencies to ensure callback is fresh
        fintech_code // ADDED: fintech_code as a dependency
    ]);


    return (
        <SafeAreaView style={styles.safeArea}> {/* Set background here */}
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
                style={styles.keyboardAvoidingContainer}
            >
                <ScrollView contentContainerStyle={styles.scrollViewContent} showsVerticalScrollIndicator={false}>
                    <Text style={styles.title}>Account Security & Identity</Text>
                    <Text style={styles.subtitle}>Set your password, PIN, and provide identity details (Step 2 of 2)</Text>

                    <TextInput
                        style={styles.input}
                        placeholder="Password*"
                        placeholderTextColor={ColourScheme.textPlaceholder}
                        secureTextEntry
                        value={password}
                        onChangeText={validatePassword}
                    />
                    {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
                    <Text style={styles.infoText}>Min 8 characters, at least one letter and one number.</Text>

                    <TextInput
                        style={styles.input}
                        placeholder="Transaction PIN (4 digits)*"
                        placeholderTextColor={ColourScheme.textPlaceholder}
                        keyboardType="numeric"
                        secureTextEntry
                        value={pin}
                        onChangeText={validatePin}
                        maxLength={4}
                    />
                    {pinError ? <Text style={styles.errorText}>{pinError}</Text> : null}
                    <Text style={styles.infoText}>PIN must be exactly 4 digits.</Text>

                    {/* Date Picker Integration */}
                    {Platform.OS === 'ios' || Platform.OS === 'android' ? (
                        <>
                            <TouchableOpacity onPress={showDatepicker} style={styles.datePickerButton}>
                                <Text style={styles.datePickerButtonText}>
                                    {displayDate ? `Date of Birth: ${displayDate}` : 'Select Date of Birth*'}
                                </Text>
                            </TouchableOpacity>
                            {showDatePicker && (
                                <DateTimePicker
                                    testID="dateTimePicker"
                                    value={dateOfBirth}
                                    mode="date"
                                    display="default"
                                    onChange={onChangeDate}
                                    maximumDate={new Date()}
                                />
                            )}
                        </>
                    ) : (
                        // Web platform fallback for Date of Birth
                        <TextInput
                            style={styles.input}
                            placeholder="Date of Birth (DD/MM/YYYY)*"
                            placeholderTextColor={ColourScheme.textPlaceholder}
                            value={displayDate}
                            onChangeText={setDisplayDate} // Allow manual entry for web
                            // Note: No specific keyboard type for web TextInputs
                        />
                    )}
                    <Text style={styles.infoText}>Format: DD/MM/YYYY</Text>


                    <TextInput
                        style={styles.input}
                        placeholder="Residential Address*"
                        placeholderTextColor={ColourScheme.textPlaceholder}
                        value={address}
                        onChangeText={setAddress}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                    />

                    <Text style={styles.label}>Gender*</Text>
                    <View style={styles.radioContainer}>
                        <TouchableOpacity
                            style={styles.radioButton}
                            onPress={() => setGender('Male')}
                        >
                            <View style={gender === 'Male' ? styles.radioSelected : styles.radioUnselected}>
                                {gender === 'Male' && <View style={styles.radioInnerCircle} />}
                            </View>
                            <Text style={styles.radioText}>Male</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.radioButton}
                            onPress={() => setGender('Female')}
                        >
                            <View style={gender === 'Female' ? styles.radioSelected : styles.radioUnselected}>
                                {gender === 'Female' && <View style={styles.radioInnerCircle} />}
                            </View>
                            <Text style={styles.radioText}>Female</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.label}>Identity Type*</Text>
                    <View style={styles.radioContainer}>
                        <TouchableOpacity
                            style={styles.radioButton}
                            onPress={() => setSelectedIdType('NIN')}
                        >
                            <View style={selectedIdType === 'NIN' ? styles.radioSelected : styles.radioUnselected}>
                                {selectedIdType === 'NIN' && <View style={styles.radioInnerCircle} />}
                            </View>
                            <Text style={styles.radioText}>NIN</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.radioButton}
                            onPress={() => setSelectedIdType('BVN')}
                        >
                            <View style={selectedIdType === 'BVN' ? styles.radioSelected : styles.radioUnselected}>
                                {selectedIdType === 'BVN' && <View style={styles.radioInnerCircle} />}
                            </View>
                            <Text style={styles.radioText}>BVN</Text>
                        </TouchableOpacity>
                    </View>

                    {selectedIdType === 'NIN' && (
                        <>
                            <TextInput
                                style={styles.input}
                                placeholder="National Identity No.*"
                                placeholderTextColor={ColourScheme.textPlaceholder}
                                value={nationalIdentityNo}
                                onChangeText={setNationalIdentityNo}
                                keyboardType="numeric"
                            />
                            <TextInput
                                style={styles.input}
                                placeholder="NIN User ID (If applicable)"
                                placeholderTextColor={ColourScheme.textPlaceholder}
                                value={ninUserId}
                                onChangeText={setNinUserId}
                            />
                        </>
                    )}

                    {selectedIdType === 'BVN' && (
                        <TextInput
                            style={styles.input}
                            placeholder="BVN*"
                            placeholderTextColor={ColourScheme.textPlaceholder}
                            value={bvn}
                            onChangeText={setBvn}
                            keyboardType="numeric"
                        />
                    )}

                    <View style={styles.spacer} />
                    <Button
                        title="Back"
                        onPress={() => navigation.goBack()}
                        color={ColourScheme.secondary} // Using color from scheme
                    />
                    <View style={styles.smallSpacer} />
                    <Button
                        title="Register Account"
                        onPress={handleFinalRegistration}
                        color={ColourScheme.primary} // Using color from scheme
                        disabled={
                            isLoading ||
                            !!passwordError ||
                            !!pinError ||
                            !displayDate ||
                            !gender ||
                            !selectedIdType ||
                            (selectedIdType === 'NIN' && !nationalIdentityNo.trim()) ||
                            (selectedIdType === 'BVN' && !bvn.trim())
                        }
                    />
                    {isLoading && <ActivityIndicator size="large" color={ColourScheme.accent} style={styles.loadingIndicator} />} {/* Using color from scheme */}
                    <View style={styles.largeSpacer} />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: ColourScheme.backgroundPrimary, // Set background here
    },
    keyboardAvoidingContainer: {
        flex: 1,
    },
    scrollViewContent: {
        flexGrow: 1,
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 40,
        backgroundColor: ColourScheme.backgroundDark, // Similar to LoginScreen's loginBox background
        borderRadius: 15, // Rounded corners
        marginHorizontal: 10, // Add horizontal margin to make it a "card"
        marginTop: 20, // Push it down a bit
        marginBottom: 20,
        shadowColor: ColourScheme.shadowColor, // Add shadow
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 10,
        alignItems: 'center', // Center content within the card
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
        textAlign: 'center',
        color: ColourScheme.textPrimary, // Changed to primary text color
    },
    subtitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 20,
        color: ColourScheme.textSecondary, // Changed to secondary text color
        textAlign: 'center',
    },
    input: {
        height: 50,
        borderColor: ColourScheme.borderLight, // Changed to borderLight
        borderWidth: 1,
        borderRadius: 8,
        marginBottom: 15,
        paddingHorizontal: 15,
        backgroundColor: ColourScheme.backgroundInput, // Changed to input background color
        color: ColourScheme.textPrimary, // Changed to primary text color
        width: '100%', // Make it full width
    },
    infoText: {
        fontSize: 12,
        color: ColourScheme.textMedium, // Changed to textMedium
        marginBottom: 10,
        marginLeft: 5,
        alignSelf: 'flex-start', // Align to start
        width: '100%', // Ensure it takes full width
    },
    label: {
        fontSize: 16,
        fontWeight: 'bold',
        color: ColourScheme.textPrimary, // Changed to primary text color
        marginBottom: 10,
        marginTop: 5,
        alignSelf: 'flex-start', // Align to start
        width: '100%', // Ensure it takes full width
    },
    radioContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        marginBottom: 15,
        width: '100%', // Ensure it takes full width
    },
    radioButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 20,
    },
    radioUnselected: {
        height: 20,
        width: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: ColourScheme.borderDark, // Changed to borderDark
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    radioSelected: {
        height: 20,
        width: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: ColourScheme.primary, // Changed to primary color
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    radioInnerCircle: {
        height: 10,
        width: 10,
        borderRadius: 5,
        backgroundColor: ColourScheme.primary, // Changed to primary color
    },
    radioText: {
        fontSize: 16,
        color: ColourScheme.textPrimary, // Changed to primary text color
    },
    spacer: {
        height: 30,
    },
    smallSpacer: {
        height: 10,
    },
    largeSpacer: {
        height: 60,
    },
    loadingIndicator: {
        marginTop: 20,
    },
    errorText: {
        fontSize: 12,
        color: ColourScheme.textError, // Changed to error text color
        marginBottom: 5,
        marginLeft: 5,
        alignSelf: 'flex-start', // Align to start
        width: '100%', // Ensure it takes full width
    },
    datePickerButton: {
        height: 50,
        borderColor: ColourScheme.borderLight, // Changed to borderLight
        borderWidth: 1,
        borderRadius: 8,
        marginBottom: 15,
        paddingHorizontal: 15,
        backgroundColor: ColourScheme.backgroundInput, // Changed to input background color
        justifyContent: 'center',
        width: '100%', // Make it full width
    },
    datePickerButtonText: {
        color: ColourScheme.textPrimary, // Changed to primary text color
        fontSize: 16,
    },
});

export default Register2;
