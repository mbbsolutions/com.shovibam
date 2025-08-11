// styles/ColourSchemeStyles.js

const ColourScheme = {
  // Primary Colors
  primary: '#007bff', // Blue
  secondary: '#6c757d', // Grey
  accent: '#28a745', // Green

  // New additions for POS screen
  posPrimary: '#405026',       // Dark green from screenshot
  posSecondary: '#677F3D',     // Secondary green
  posAccent: '#8BA751',        // Highlight green
  posBackground: '#F5F5F5',    // Light background
  posCardBackground: '#FFFFFF', // White for cards
  posTextDark: '#333333',      // Primary text
  posTextMedium: '#666666',    // Secondary text
  posBorder: '#E0E0E0',       // Light borders
  
  // Backgrounds
  backgroundPrimary: '#36454F', // Deep Navy Grey (Main app background, also used for transaction items)
  backgroundSecondary: '#f0f2f5', // Lighter grey for specific screens like Transfer
  backgroundLight: '#FFFFFF', // White for cards, modals, etc.
  backgroundDark: '#0A1128', // Deep Navy Blue (from LoginBox, also used for bottom info section of main card)
  backgroundInput: '#1A2B4D', // Darker Blue for inputs
  backgroundLightGrey: '#f5f7fa', // Specific light grey for Loan screen background
  inputDisabledBackground: '#ececec', // Background for disabled input fields

  // Text Colors
  textPrimary: '#FFFFFF', // White for main text (used in main card header)
  textSecondary: '#E0E0E0', // Light grey for secondary text (used in main card customer ID, techvibes ID)
  textPlaceholder: '#A0A0A0', // Grey for placeholders
  textInfo: '#ADD8E6', // Light blue for info messages
  textSuccess: '#90EE90', // Light green for success messages
  textError: '#FF6347', // Red for error messages
  textDark: '#333', // Dark text for modals/light backgrounds (e.g., "Recent Transactions" header)
  textMedium: '#555', // Medium grey for general text
  textLight: '#FFFFFF', // <--- UPDATED: Changed from '#777' to '#FFFFFF' for white text on dark backgrounds
  textLightGrey: '#777', // For no transactions text etc. (keeping this as is, assuming it's used on lighter backgrounds)
  textErrorDark: '#721c24', // Dark red for error message text
  textSuccessDark: '#28a745', // Dark green for success message text

  // Borders & Separators
  borderLight: '#4A5B78', // Medium blue-grey for borders
  borderLighter: '#ddd', // Lighter grey for separators
  borderHairline: '#eee', // Very light grey for hairline borders
  borderError: '#dc3545', // Red for error message border
  borderSuccess: '#28a745', // Green for success message border

  // Icons
  iconPrimary: '#ADD8E6', // Light blue for general icons
  iconSuccess: '#30c37c', // Green for success icons
  iconError: '#e74c3c', // Red for error icons
  iconHistory: '#0056b3', // Dark blue for history icon
  iconForgotPassword: '#ADD8E6', // Light blue for forgot password
  iconRegister: '#90EE90', // Light green for register
  iconTransfer: '#166088', // Specific blue for transfer icons
  iconDashboard: '#007bff', // Blue for dashboard icons
  iconData: '#28a745', // Green for data icon
  iconAirtime: '#ffc107', // Yellow for airtime icon
  iconBill: '#dc3545', // Red for bill payment icon
  iconLoan: '#166088', // Specific blue for loan icon (reusing from iconTransfer)

  // Shadows
  shadowColor: '#000',

  // Message Box Backgrounds
  successBackground: '#e6f4ea',
  errorBackground: '#fdecea',
  infoBackground: '#e0f2fe',
};

export default ColourScheme;
