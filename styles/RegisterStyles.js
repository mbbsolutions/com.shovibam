import { StyleSheet, Dimensions, Platform } from 'react-native'; // Import Platform

const { height } = Dimensions.get('window');

const styles = StyleSheet.create({
  // New style for KeyboardAvoidingView
  keyboardAvoidingView: {
    flex: 1, // Crucial for it to take full available space
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  scrollContent: {
    // Adjusted paddingBottom for better keyboard compatibility
    paddingBottom: Platform.OS === 'ios' ? 50 : 150, // More padding for Android to ensure last input is visible
  },
  loadingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 10,
    color: '#fff',
    fontSize: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 20,
    color: '#333',
  },
  inputContainer: {
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
    color: '#555',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: 'red',
  },
  errorText: {
    color: 'red',
    fontSize: 12,
    marginTop: 4,
  },
  successText: {
    color: 'green',
    fontSize: 12,
    marginTop: 4,
  },
  infoText: {
    color: 'blue',
    fontSize: 12,
    marginTop: 4,
  },
  sendOtpButton: {
    backgroundColor: '#007bff',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  sendOtpButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  otpInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: 10,
    backgroundColor: '#fff',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  documentUploadSection: {
    marginTop: 20,
    padding: 15,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 10,
    backgroundColor: '#fefefe',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
    textAlign: 'center',
  },
  documentUploadContainer: { // Added this style for consistency with Register.js
    marginBottom: 15,
    // alignItems: 'center', // You might want to remove this if you want left-aligned content
  },
  uploadButton: {
    backgroundColor: '#28a745',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 5,
    width: '80%', // Adjusted width for better layout
    alignSelf: 'center', // Center the button if width is less than 100%
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  imagePreview: { // Added this style for image previews
    width: 100,
    height: 100,
    resizeMode: 'contain',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    alignSelf: 'center', // Center the image preview
  },
  button: { // Renamed from registerButton for general use
    backgroundColor: '#007bff',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  disabledButton: { // Renamed from registerButtonDisabled for general use
    backgroundColor: '#a0c9ed',
  },
  buttonText: { // Renamed from registerButtonText for general use
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loginLink: {
    textAlign: 'center',
    marginTop: 10,
    color: '#007bff',
    fontSize: 16,
    marginBottom: 20,
  },
  pickerContainer: { // Added style for Picker container
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden', // Ensures the picker's border radius is respected
  },
  picker: { // Added style for Picker
    height: 50, // Standard height for pickers
    width: '100%',
  },
  datePickerButton: { // Style for the touchable button that opens the date picker
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    justifyContent: 'center',
    minHeight: 50, // Ensure it's tall enough to tap
  },
  datePickerText: { // Style for the text inside the date picker button
    fontSize: 16,
    color: '#333',
  },
  inlineFeedback: { // For username/phone availability feedback
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    minHeight: 20, // Give it some space even if no text
  }
});

export default styles;