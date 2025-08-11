import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    Button,
    StyleSheet,
    Alert,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
    KeyboardAvoidingView,
    SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

// Import the allowed fintechs from the local JSON file
import allowedFintechs from '../utils/allowedFintechs.json'; // Adjust path if necessary
// import BackgroundDesignColours from '../styles/BackgroundDesignColours'; // Removed this import
import ColourScheme from '../styles/ColourSchemeStyles'; // Import the new color scheme

// --- API Endpoints ---
const OTP_SERVICE_API_URL = 'https://techvibs.com/bank/api_general/OTP_Service_api.php';
// Now used for both registration submission and availability checks
const REGISTER_SUBMIT_API_URL = 'https://techvibs.com/bank/api_general/register_submit_api.php';


const RegisterScreen = () => {
    const navigation = useNavigation();

    // --- Basic Information State (Step 1 Fields) ---
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [otherNames, setOtherNames] = useState('');
    const [accountName, setAccountName] = useState(''); // Frontend variable remains camelCase
    const [isAccountNameManuallyEdited, setIsAccountNameManuallyEdited] = useState(false);
    const [phoneNo, setPhoneNo] = useState(''); // Frontend variable remains camelCase
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');

    // Automatically pick the first fintech from the allowedFintechs.json file
    // Ensure allowedFintechs is not empty before accessing index 0
    const fintech_code = allowedFintechs.length > 0 ? allowedFintechs[0] : 'default_fintech';
    const displayFintechName = allowedFintechs.length > 0 ? allowedFintechs[0].toUpperCase() : 'APP';

    // --- OTP Specific State ---
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
    const [otpSent, setOtpSent] = useState(false);
    const [otpVerified, setOtpVerified] = useState(false);
    const [otpMessage, setOtpMessage] = useState('');
    const [resendOtpCountdown, setResendOtpCountdown] = useState(0);
    const resendIntervalRef = useRef(null);

    // --- Availability Check States ---
    const [isUsernameAvailable, setIsUsernameAvailable] = useState(false);
    const [checkingUsername, setCheckingUsername] = useState(false);
    const [usernameError, setUsernameError] = useState('');

    const [isPhoneNoAvailable, setIsPhoneNoAvailable] = useState(false);
    const [checkingPhone, setCheckingPhone] = useState(false);
    const [phoneNoError, setPhoneNoError] = useState('');

    // --- Loading state (only for current screen's operations like OTP send) ---
    const [isLoading, setIsLoading] = useState(false);


    // --- Resend OTP Countdown Effect ---
    useEffect(() => {
        if (resendOtpCountdown > 0) {
            resendIntervalRef.current = setInterval(() => {
                setResendOtpCountdown((prev) => prev - 1);
            }, 1000);
        } else {
            clearInterval(resendIntervalRef.current);
        }
        return () => clearInterval(resendIntervalRef.current);
    }, [resendOtpCountdown]);


    // --- Effect for Automatic Account Name Update ---
    useEffect(() => {
        if (!isAccountNameManuallyEdited) {
            const trimmedFirstName = firstName.trim();
            const trimmedLastName = lastName.trim();
            if (trimmedFirstName || trimmedLastName) {
                setAccountName(`${trimmedFirstName} ${trimmedLastName}`.trim());
            } else {
                setAccountName('');
            }
        }
    }, [firstName, lastName, isAccountNameManuallyEdited]);

    // --- Availability Check Function ---
    const checkAvailability = useCallback(async (field, value, setError, setChecking, setIsAvailable) => {
        let validationMessage = '';
        setIsAvailable(false); // Reset availability when input changes

        if (field === 'username') {
            if (!value || value.length === 0) {
                setError('');
                setChecking(false);
                setIsAvailable(false);
                return;
            }
            if (value.length < 3) {
                validationMessage = 'Username must be at least 3 characters.';
            } else if (!/^[a-zA-Z0-9_]{3,20}$/.test(value)) {
                validationMessage = 'Username must be 3-20 characters (letters, numbers, underscores only).';
            }
        } else if (field === 'phoneNo') { // 'phoneNo' is the frontend state variable name
            if (!value || value.length === 0) {
                setError('');
                setChecking(false);
                setIsAvailable(false);
                return;
            }
            // Assuming a fixed 11-digit Nigerian phone number format
            if (!/^[0-9]{11}$/.test(value)) {
                validationMessage = 'Phone Number must be exactly 11 digits.';
            }
        }

        if (validationMessage) {
            setError(validationMessage);
            setChecking(false);
            setIsAvailable(false);
            return;
        }

        // Ensure fintech_code is available before making the API call
        if (!fintech_code) {
            setError('Fintech code is not defined. Cannot check availability.');
            setChecking(false);
            setIsAvailable(false);
            return;
        }

        setChecking(true);
        setError('');
        try {
            const response = await fetch(REGISTER_SUBMIT_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Fintech-Code': fintech_code, // <--- IMPORTANT: Sending fintech in a custom header
                },
                body: JSON.stringify({
                    action: 'check_account_exists',
                    username_or_account: value,
                    field_type: field, // Sending 'username' or 'phoneNo' (camelCase)
                    // REMOVED: fintech: fintech_code, // No longer sending fintech in the body for availability checks
                }),
            });

            const responseText = await response.text();
            console.log(`Raw Availability API Response for ${field}:`, responseText);

            let data;
            try {
                data = JSON.parse(responseText);
            } catch (jsonError) {
                console.error(`Failed to parse JSON response for ${field} availability:`, jsonError);
                setError('Server returned invalid response. Please try again.');
                setIsAvailable(false);
                return;
            }

            if (response.ok && data.found === true) {
                setError(`${field === 'username' ? 'Username' : 'Phone number'} is NOT available.`);
                setIsAvailable(false);
            } else if (response.ok && data.found === false) {
                setError('');
                setIsAvailable(true);
            } else {
                setError(data.message || `Could not check ${field} availability. Server error.`);
                setIsAvailable(false);
            }
        } catch (error) {
            console.error(`Network error checking ${field} availability:`, error);
            setError('Network error. Could not check availability.');
            setIsAvailable(false);
        } finally {
            setChecking(false);
        }
    }, [fintech_code]); // Dependency updated to reflect the change

    // --- Debounce for Username Availability Check ---
    useEffect(() => {
        const handler = setTimeout(() => {
            if (username.trim().length > 0) {
                checkAvailability('username', username.trim(), setUsernameError, setCheckingUsername, setIsUsernameAvailable);
            } else {
                setUsernameError('');
                setIsUsernameAvailable(false);
                setCheckingUsername(false);
            }
        }, 500);
        return () => clearTimeout(handler);
    }, [username, checkAvailability]);

    // --- Debounce for Phone Number Availability Check ---
    useEffect(() => {
        const handler = setTimeout(() => {
            if (phoneNo.trim().length > 0) {
                checkAvailability('phoneNo', phoneNo.trim(), setPhoneNoError, setCheckingPhone, setIsPhoneNoAvailable);
            } else {
                setPhoneNoError('');
                setIsPhoneNoAvailable(false);
                setCheckingPhone(false);
            }
        }, 500);
        return () => clearTimeout(handler);
    }, [phoneNo, checkAvailability]);


    // --- Function to Send OTP ---
    const handleSendOtp = async () => {
        // Add validation checks here for phone number, username, and email
        if (!email.trim()) {
            Alert.alert("Validation Error", "Please enter your email address to send OTP.");
            return;
        }
        if (!phoneNo.trim()) {
            Alert.alert("Validation Error", "Please enter your phone number to send OTP.");
            return;
        }
        if (!username.trim()) {
            Alert.alert("Validation Error", "Please enter a username to send OTP.");
            return;
        }

        if (checkingUsername || checkingPhone) {
            Alert.alert("Validation Error", "Please wait for username/phone number availability checks to complete.");
            return;
        }
        if (!isUsernameAvailable) {
            Alert.alert("Validation Error", usernameError || "Username is not available or invalid. Please choose a different username.");
            return;
        }
        if (!isPhoneNoAvailable) {
            Alert.alert("Validation Error", phoneNoError || "Phone number is not available or invalid. Please use a different phone number.");
            return;
        }

        if (isSendingOtp || resendOtpCountdown > 0) return;

        setIsSendingOtp(true);
        setOtpSent(false);
        setOtpVerified(false);
        setOtpMessage('');
        setOtp(''); // Clear previous OTP

        try {
            const response = await fetch(OTP_SERVICE_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'send_otp',
                    email: email.trim(),
                    first_name: firstName.trim(),
                    last_name: lastName.trim(),
                    other_names: otherNames.trim(),
                    // Changed keys to snake_case to match potential DB column names
                    account_name: accountName.trim(),
                    phone_no: phoneNo.trim(),
                    username: username.trim(),
                    fintech: fintech_code, // <--- IMPORTANT: Sending fintech in the body for OTP send
                }),
            });

            const responseText = await response.text();
            console.log('Raw OTP Send API Response:', responseText);

            let data;
            try {
                data = JSON.parse(responseText);
            } catch (jsonError) {
                console.error('Failed to parse OTP Send JSON response:', jsonError);
                throw new Error('Server returned non-JSON response for OTP: ' + responseText);
            }

            if (response.ok && data.success) {
                setOtpSent(true);
                setOtpMessage(data.message || 'OTP sent successfully! Please check your inbox/spam.');
                Alert.alert('Success', data.message || 'OTP sent successfully! Please check your inbox/spam.');
                setResendOtpCountdown(60); // Start countdown for resend
            } else {
                const errorMessage = data.message || 'Failed to send OTP. Please try again.';
                setOtpMessage(errorMessage);
                Alert.alert('OTP Error', errorMessage);
                console.error('OTP Server Error:', data);
            }
        } catch (error) {
            console.error('Network or client-side error sending OTP:', error);
            setOtpMessage('Failed to connect to the server to send OTP. Please try again.');
            Alert.alert('Error', 'Failed to connect to the server to send OTP. Please try again.');
        } finally {
            setIsSendingOtp(false);
        }
    };

    // --- Function to Verify OTP (Wrapped in useCallback to optimize) ---
    const handleVerifyOtp = useCallback(async () => {
        if (!email.trim() || !otp.trim()) {
            return;
        }
        if (otp.trim().length !== 6) {
            return;
        }
        if (isVerifyingOtp || otpVerified) return;

        setIsVerifyingOtp(true);
        setOtpVerified(false);
        setOtpMessage('Verifying OTP...');

        try {
            const response = await fetch(OTP_SERVICE_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'verify_otp',
                    email: email.trim(),
                    otp: otp.trim(),
                    // Changed key to snake_case to match potential DB column name
                    phone_no: phoneNo.trim(),
                    username: username.trim(),
                    fintech: fintech_code, // <--- IMPORTANT: Sending fintech in the body for OTP verification
                }),
            });

            const responseText = await response.text();
            console.log('Raw OTP Verify API Response:', responseText);

            let data;
            try {
                data = JSON.parse(responseText);
            } catch (jsonError) {
                console.error('Failed to parse OTP Verify JSON response:', jsonError);
                throw new Error('Server returned non-JSON response for OTP verification: ' + responseText);
            }

            if (response.ok && data.success) {
                setOtpVerified(true);
                setOtpMessage(data.message || 'OTP Verified Successfully!');
                Alert.alert('Success', data.message || 'OTP Verified Successfully!');
            } else {
                setOtpVerified(false);
                const errorMessage = data.message || 'Invalid or expired OTP. Please try again.';
                setOtpMessage(errorMessage);
                Alert.alert('OTP Verification Failed', errorMessage);
                console.error('OTP Verification Server Error:', data);
            }
        } catch (error) {
            console.error('Network or client-side error verifying OTP:', error);
            setOtpMessage('Failed to connect to server for OTP verification.');
            Alert.alert('Error', 'Failed to connect to the server for OTP verification. Please try again.');
        } finally {
            setIsVerifyingOtp(false);
        }
    }, [email, otp, isVerifyingOtp, otpVerified, phoneNo, username, fintech_code]);

    // --- Auto-verify OTP when 6 digits are entered ---
    useEffect(() => {
        if (otp.length === 6 && otpSent && !otpVerified && !isVerifyingOtp) {
            handleVerifyOtp();
        }
    }, [otp, otpSent, otpVerified, isVerifyingOtp, handleVerifyOtp]);


    // --- Handle Navigation to Next Step (Register2) ---
    const handleNextStep = () => {
        console.log("--- Checking Next Button Status (Step 1) ---");
        console.log("isLoading (OTP related):", isLoading);
        console.log("otpVerified:", otpVerified);
        console.log("checkingUsername:", checkingUsername);
        console.log("checkingPhone:", checkingPhone);
        console.log("isUsernameAvailable:", isUsernameAvailable);
        console.log("isPhoneNoAvailable:", isPhoneNoAvailable);
        console.log("firstName.trim().length > 0:", firstName.trim().length > 0);
        console.log("lastName.trim().length > 0:", lastName.trim().length > 0);
        console.log("otherNames.trim().length > 0:", otherNames.trim().length > 0);
        console.log("phoneNo.trim().length > 0:", phoneNo.trim().length > 0);
        console.log("username.trim().length > 0:", username.trim().length > 0);
        console.log("email.trim().length > 0:", email.trim().length > 0);
        console.log("fintech_code:", fintech_code); // Log the determined fintech_code
        console.log("-----------------------------------");


        // Basic client-side validations for Step 1 before proceeding
        if (!firstName.trim() || !lastName.trim() || !otherNames.trim() || !phoneNo.trim() || !username.trim() || !email.trim()) {
            Alert.alert("Validation Error", "Please fill in all *required fields on this page (First Name, Last Name, Other Names, Phone Number, Username, Email).");
            return;
        }

        if (!otpSent) {
            Alert.alert("Validation Error", "Please send OTP to your email first.");
            return;
        }
        if (!otpVerified) {
            Alert.alert("Validation Error", "Please verify your OTP before proceeding.");
            return;
        }

        if (checkingUsername || checkingPhone) {
            Alert.alert("Validation Error", "Please wait for username/phone number availability checks to complete.");
            return;
        }
        if (!isUsernameAvailable) {
            Alert.alert("Validation Error", usernameError || "Username is not available or invalid. Please choose a different username.");
            return;
        }
        if (!isPhoneNoAvailable) {
            Alert.alert("Validation Error", phoneNoError || "Phone number is not available or invalid. Please use a different phone number.");
            return;
        }
        // Also ensure fintech_code is available before proceeding
        if (!fintech_code) {
            Alert.alert("Configuration Error", "Fintech code is not configured. Please contact support.");
            return;
        }


        // If all Step 1 validations pass, navigate to Register2 and pass all current state data
        navigation.navigate('Register2', {
            initialStepOneData: {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                otherNames: otherNames.trim(),
                accountName: accountName.trim(), // Send as camelCase, Register2 will handle mapping to 'account_name' if needed for its API
                phoneNo: phoneNo.trim(),        // Send as camelCase, Register2 will handle mapping to 'phone_no' if needed for its API
                username: username.trim(),
                email: email.trim(),
                otpVerified: otpVerified,
                otpSent: otpSent,
                isUsernameAvailable: isUsernameAvailable,
                isPhoneNoAvailable: isPhoneNoAvailable,
                fintech_code: fintech_code, // Pass the determined fintech_code to Register2
            },
        });
    };

    return (
        <SafeAreaView style={styles.safeArea}> {/* Set background here */}
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
                style={styles.keyboardAvoidingContainer}
            >
                <ScrollView contentContainerStyle={styles.scrollViewContent} showsVerticalScrollIndicator={false}>
                    <Text style={styles.title}>{displayFintechName} Account Opening</Text>
                    <Text style={styles.subtitle}>Basic Information (Step 1 of 2)</Text>

                    {/* Display the determined Fintech Code */}
                    <View style={styles.fintechDisplayContainer}>
                        <Text style={styles.fintechLabel}>Fintech:</Text>
                        <Text style={styles.fintechValue}>{displayFintechName}</Text>
                    </View>

                    <TextInput
                        style={styles.input}
                        placeholder="First Name*"
                        placeholderTextColor={ColourScheme.textPlaceholder}
                        value={firstName}
                        onChangeText={setFirstName}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Last Name*"
                        placeholderTextColor={ColourScheme.textPlaceholder}
                        value={lastName}
                        onChangeText={setLastName}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Other Names*"
                        placeholderTextColor={ColourScheme.textPlaceholder}
                        value={otherNames}
                        onChangeText={setOtherNames}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Account Name (Auto-generated or edit)"
                        placeholderTextColor={ColourScheme.textPlaceholder}
                        value={accountName}
                        onChangeText={(text) => {
                            setAccountName(text);
                            setIsAccountNameManuallyEdited(text.trim().length > 0);
                        }}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Phone Number*"
                        placeholderTextColor={ColourScheme.textPlaceholder}
                        keyboardType="numeric"
                        value={phoneNo}
                        onChangeText={setPhoneNo}
                    />
                    {checkingPhone ? (
                        <Text style={styles.availabilityText}>Checking phone number availability...</Text>
                    ) : phoneNo.trim().length > 0 ? (
                        phoneNoError ? (
                            <Text style={styles.errorText}>{phoneNoError}</Text>
                        ) : (
                            <Text style={styles.successText}>Phone Number available.</Text>
                        )
                    ) : null}

                    <TextInput
                        style={styles.input}
                        placeholder="Username*"
                        placeholderTextColor={ColourScheme.textPlaceholder}
                        value={username}
                        onChangeText={setUsername}
                    />
                    {checkingUsername ? (
                        <Text style={styles.availabilityText}>Checking username availability...</Text>
                    ) : username.trim().length > 0 ? (
                        usernameError ? (
                            <Text style={styles.errorText}>{usernameError}</Text>
                        ) : (
                            <Text style={styles.successText}>Username available.</Text>
                        )
                    ) : null}

                    <TextInput
                        style={styles.input}
                        placeholder="Email*"
                        placeholderTextColor={ColourScheme.textPlaceholder}
                        keyboardType="email-address"
                        value={email}
                        onChangeText={setEmail}
                    />

                    <TouchableOpacity
                        style={styles.otpButton}
                        onPress={handleSendOtp}
                        disabled={
                            isSendingOtp ||
                            resendOtpCountdown > 0 ||
                            !email.trim() || // Email must be entered
                            !phoneNo.trim() || // Phone must be entered
                            !username.trim() || // Username must be entered
                            checkingUsername || // Must not be checking username
                            checkingPhone ||    // Must not be checking phone
                            !isUsernameAvailable || // Username must be available
                            !isPhoneNoAvailable // Phone number must be available
                        }
                    >
                        {isSendingOtp ? (
                            <ActivityIndicator color={ColourScheme.textPrimary} />
                        ) : (
                            <Text style={styles.otpButtonText}>
                                {resendOtpCountdown > 0 ? `Resend OTP (${resendOtpCountdown}s)` : (otpSent ? "Resend OTP" : "Send OTP")}
                            </Text>
                        )}
                    </TouchableOpacity>

                    {otpSent && (
                        <>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter OTP*"
                                placeholderTextColor={ColourScheme.textPlaceholder}
                                keyboardType="numeric"
                                value={otp}
                                onChangeText={setOtp}
                                maxLength={6}
                                editable={!isVerifyingOtp && !otpVerified}
                            />
                            {otpMessage ? (
                                <Text style={[styles.otpMessageText, otpVerified ? styles.otpVerifiedText : styles.otpErrorText]}>
                                    {otpMessage}
                                </Text>
                            ) : null}
                        </>
                    )}

                    <View style={styles.spacer} />
                    <Button
                        title="Next: Set Password & ID"
                        onPress={handleNextStep}
                        color={ColourScheme.primary}
                        disabled={
                            isLoading ||
                            !otpVerified ||
                            checkingUsername ||
                            checkingPhone ||
                            !isUsernameAvailable ||
                            !isPhoneNoAvailable ||
                            !firstName.trim() || !lastName.trim() || !otherNames.trim() || !phoneNo.trim() || !username.trim() || !email.trim() || !fintech_code
                        }
                    />
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
    fintechDisplayContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
        paddingHorizontal: 15,
        paddingVertical: 10,
        backgroundColor: ColourScheme.backgroundInput, // Changed to input background color
        borderRadius: 8,
        borderWidth: 1,
        borderColor: ColourScheme.borderLight, // Changed to borderLight
        width: '100%', // Make it full width
        justifyContent: 'center', // Center content
    },
    fintechLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: ColourScheme.textInfo, // Changed to info text color
        marginRight: 10,
    },
    fintechValue: {
        fontSize: 16,
        color: ColourScheme.textPrimary, // Changed to primary text color
        fontWeight: 'bold',
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
    otpButton: {
        backgroundColor: ColourScheme.accent, // Changed to accent color
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 10,
        width: '100%', // Make it full width
    },
    otpButtonText: {
        color: ColourScheme.textPrimary, // Changed to primary text color
        fontSize: 16,
        fontWeight: 'bold',
    },
    otpMessageText: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 10,
        fontWeight: 'bold',
        width: '100%', // Make it full width
    },
    otpVerifiedText: {
        color: ColourScheme.textSuccess, // Changed to success text color
    },
    otpErrorText: {
        color: ColourScheme.textError, // Changed to error text color
    },
    spacer: {
        height: 30,
    },
    largeSpacer: {
        height: 60,
    },
    availabilityText: {
        fontSize: 12,
        marginLeft: 5,
        marginBottom: 10,
        color: ColourScheme.textSecondary, // Changed to secondary text color
        alignSelf: 'flex-start', // Align to start
        width: '100%', // Ensure it takes full width
    },
    successText: {
        fontSize: 12,
        marginLeft: 5,
        marginBottom: 10,
        color: ColourScheme.textSuccess, // Changed to success text color
        alignSelf: 'flex-start', // Align to start
        width: '100%', // Ensure it takes full width
    },
    errorText: {
        fontSize: 12,
        marginLeft: 5,
        marginBottom: 10,
        color: ColourScheme.textError, // Changed to error text color
        alignSelf: 'flex-start', // Align to start
        width: '100%', // Ensure it takes full width
    },
});

export default RegisterScreen;
