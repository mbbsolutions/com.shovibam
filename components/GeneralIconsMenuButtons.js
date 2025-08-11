import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform, Modal, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import ColourScheme from '../styles/ColourSchemeStyles';

export default function GeneralIconsMenuButtons({
    navigation,
    active,
    hide = [],
    showLoginInsteadOfRegister = false,
    style,
}) {
    const insets = useSafeAreaInsets();
    const [menuVisible, setMenuVisible] = useState(false);
    const { logout = () => console.warn("Logout function not available") } = useAuth();

    const showRegister = active === 'Login' && !hide.includes('Register');
    const showForgotPassword = active === 'Login' && !hide.includes('ForgotPassword');
    const showLoginInstead = showLoginInsteadOfRegister && !hide.includes('Login');

    // Ultra-bright neon colors for maximum vibrancy
    const NeonIconColors = {
        profile: '#FF2D75',     // Neon Pink
        settings: '#00FEFC',    // Cyan
        history: '#39FF14',     // Neon Green
        otherAccounts: '#FF00FF', // Magenta
        newAccount: '#00B4FF',  // Bright Blue
        logout: '#FF0000',      // Pure Red
        home: '#FFFF00',        // Bright Yellow
        login: '#FF7B00',       // Bright Orange
        forgotPassword: '#FFEE00', // Lemon Yellow
        register: '#00FF80',    // Bright Green
        pos: '#A5FF00',          // Lime Green
        retail: '#FF00A5',      // Hot Pink (Reusing this color for "Shop")
        transfer: '#00FFD1',    // Turquoise
        dashboard: '#FF00FF',   // Fuchsia
        shop: '#FF00A5',        // Hot Pink for the Shop icon
    };

    // Menu Dropdown Items with bright colors
    const menuItems = [
        {
            label: (
                <>
                    <Icon name="account-outline" size={18} color={NeonIconColors.profile} style={styles.iconStyle} />
                    Profile
                </>
            ),
            onPress: () => navigateAfterDelay('Profile'),
        },
        {
            label: (
                <>
                    <Icon name="cog-outline" size={18} color={NeonIconColors.settings} style={styles.iconStyle} />
                    Settings
                </>
            ),
            onPress: () => navigateAfterDelay('Settings'),
        },
        {
            label: (
                <>
                    <Icon name="history" size={18} color={NeonIconColors.history} style={styles.iconStyle} />
                    History
                </>
            ),
            onPress: () => navigateAfterDelay('History'),
        },
        {
            label: (
                <>
                    <Icon name="account-multiple-outline" size={18} color={NeonIconColors.otherAccounts} style={styles.iconStyle} />
                    Other Accounts
                </>
            ),
            onPress: () => navigateAfterDelay('Otheraccounts'),
        },
        {
            label: (
                <>
                    <Icon name="plus-circle-outline" size={18} color={NeonIconColors.newAccount} style={styles.iconStyle} />
                    New Account
                </>
            ),
            onPress: () => navigateAfterDelay('CreateNewAccount'),
        },
        {
            label: (
                <>
                    <Icon name="logout" size={18} color={NeonIconColors.logout} style={styles.iconStyle} />
                    Logout
                </>
            ),
            onPress: async () => {
                setMenuVisible(false);
                await logout();
                setTimeout(() => navigation.replace('LandingPage'), 200);
            },
        },
    ];

    const navigateAfterDelay = (screen) => {
        setMenuVisible(false);
        setTimeout(() => navigation.navigate(screen), 200);
    };

    return (
        <>
            {/* Top Menu Button */}
            <View style={[styles.menuButtonContainer, {
                left: 15,
                top: Platform.OS === 'ios' ? insets.top + 75 : 75
            }]}>
                <TouchableOpacity
                    onPress={() => setMenuVisible(true)}
                    style={[styles.menuButton, { backgroundColor: NeonIconColors.settings }]}
                    activeOpacity={0.7}
                >
                    <Icon name="menu" size={24} color="#FFF" />
                </TouchableOpacity>
            </View>

            {/* Menu Dropdown Modal */}
            <Modal
                visible={menuVisible}
                animationType="fade"
                transparent
                onRequestClose={() => setMenuVisible(false)}
            >
                <Pressable
                    style={[styles.menuModalOverlay, {
                        paddingLeft: 15,
                        paddingTop: Platform.OS === 'ios' ? insets.top + 110 : 110
                    }]}
                    onPress={() => setMenuVisible(false)}
                >
                    <Pressable style={[styles.menuDropdown, {
                        backgroundColor: ColourScheme.backgroundDark,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.2)'
                    }]}>
                        {menuItems.map((item, idx) => (
                            <TouchableOpacity
                                key={idx}
                                style={styles.menuDropdownItem}
                                onPress={item.onPress}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.menuDropdownText, {
                                    color: ColourScheme.textPrimary,
                                    textShadowColor: 'rgba(255,255,255,0.3)',
                                    textShadowOffset: { width: 0, height: 0 },
                                    textShadowRadius: 10
                                }]}>
                                    {item.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Bottom Navigation */}
            <View style={[
                styles.bottomNav,
                style,
                {
                    paddingBottom: Math.max(insets.bottom, 10),
                    backgroundColor: 'rgba(10,10,42,0.95)', // More opaque background
                    borderTopColor: 'rgba(255,255,255,0.15)'
                },
            ]}>
                {/* Dashboard / Home */}
                {!hide.includes('Dashboard') && (
                    <TouchableOpacity
                        style={styles.navItem}
                        onPress={() => navigation.navigate('Dashboard')}
                    >
                        <View style={styles.iconContainer}>
                            <Icon
                                name="home-outline"
                                size={26}
                                color={active === 'Dashboard' ? NeonIconColors.home : 'rgba(255,255,255,0.8)'}
                                style={[
                                    styles.iconGlow,
                                    active === 'Dashboard' && {
                                        textShadowColor: NeonIconColors.home,
                                        textShadowRadius: 20 // More glow when active
                                    }
                                ]}
                            />
                        </View>
                        <Text style={[
                            styles.iconText,
                            {
                                color: active === 'Dashboard' ? NeonIconColors.home : 'rgba(255,255,255,0.8)',
                                textShadowColor: active === 'Dashboard' ? NeonIconColors.home : 'transparent',
                                textShadowRadius: active === 'Dashboard' ? 10 : 0
                            }
                        ]}>
                            Home
                        </Text>
                    </TouchableOpacity>
                )}

                {/* Login icon */}
                {showLoginInstead && (
                    <TouchableOpacity
                        style={styles.navItem}
                        onPress={() => navigation.navigate('Login')}
                    >
                        <View style={styles.iconContainer}>
                            <Icon
                                name="login"
                                size={26}
                                color={active === 'Login' ? NeonIconColors.login : 'rgba(255,255,255,0.8)'}
                                style={[
                                    styles.iconGlow,
                                    active === 'Login' && {
                                        textShadowColor: NeonIconColors.login,
                                        textShadowRadius: 20
                                    }
                                ]}
                            />
                        </View>
                        <Text style={[
                            styles.iconText,
                            {
                                color: active === 'Login' ? NeonIconColors.login : 'rgba(255,255,255,0.8)',
                                textShadowColor: active === 'Login' ? NeonIconColors.login : 'transparent',
                                textShadowRadius: active === 'Login' ? 10 : 0
                            }
                        ]}>
                            Login
                        </Text>
                    </TouchableOpacity>
                )}

                {/* Forgot Password icon */}
                {showForgotPassword && (
                    <TouchableOpacity
                        style={styles.navItem}
                        onPress={() => navigation.navigate('ForgotPassword')}
                    >
                        <View style={styles.iconContainer}>
                            <Icon
                                name="lock-reset"
                                size={26}
                                color={active === 'ForgotPassword' ? NeonIconColors.forgotPassword : 'rgba(255,255,255,0.8)'}
                                style={[
                                    styles.iconGlow,
                                    active === 'ForgotPassword' && {
                                        textShadowColor: NeonIconColors.forgotPassword,
                                        textShadowRadius: 20
                                    }
                                ]}
                            />
                        </View>
                        <Text style={[
                            styles.iconText,
                            {
                                color: active === 'ForgotPassword' ? NeonIconColors.forgotPassword : 'rgba(255,255,255,0.8)',
                                textShadowColor: active === 'ForgotPassword' ? NeonIconColors.forgotPassword : 'transparent',
                                textShadowRadius: active === 'ForgotPassword' ? 10 : 0
                            }
                        ]}>
                            Forgot
                        </Text>
                    </TouchableOpacity>
                )}

                {/* Register icon */}
                {showRegister && (
                    <TouchableOpacity
                        style={styles.navItem}
                        onPress={() => navigation.navigate('Register')}
                    >
                        <View style={styles.iconContainer}>
                            <Icon
                                name="account-plus"
                                size={26}
                                color={active === 'Register' ? NeonIconColors.register : 'rgba(255,255,255,0.8)'}
                                style={[
                                    styles.iconGlow,
                                    active === 'Register' && {
                                        textShadowColor: NeonIconColors.register,
                                        textShadowRadius: 20
                                    }
                                ]}
                            />
                        </View>
                        <Text style={[
                            styles.iconText,
                            {
                                color: active === 'Register' ? NeonIconColors.register : 'rgba(255,255,255,0.8)',
                                textShadowColor: active === 'Register' ? NeonIconColors.register : 'transparent',
                                textShadowRadius: active === 'Register' ? 10 : 0
                            }
                        ]}>
                            Register
                        </Text>
                    </TouchableOpacity>
                )}

                {/* POS */}
                {!hide.includes('POS') && (
                    <TouchableOpacity
                        style={styles.navItem}
                        onPress={() => navigation.navigate('POS')}
                    >
                        <View style={styles.iconContainer}>
                            <Icon
                                name="point-of-sale"
                                size={26}
                                color={active === 'POS' ? NeonIconColors.pos : 'rgba(255,255,255,0.8)'}
                                style={[
                                    styles.iconGlow,
                                    active === 'POS' && {
                                        textShadowColor: NeonIconColors.pos,
                                        textShadowRadius: 20
                                    }
                                ]}
                            />
                        </View>
                        <Text style={[
                            styles.iconText,
                            {
                                color: active === 'POS' ? NeonIconColors.pos : 'rgba(255,255,255,0.8)',
                                textShadowColor: active === 'POS' ? NeonIconColors.pos : 'transparent',
                                textShadowRadius: active === 'POS' ? 10 : 0
                            }
                        ]}>
                            POS
                        </Text>
                    </TouchableOpacity>
                )}

                {/* Retail/Shop */}
                {!hide.includes('Shop') && (
                    <TouchableOpacity
                        style={styles.navItem}
                        onPress={() => navigation.navigate('Shop')}
                    >
                        <View style={styles.iconContainer}>
                            <Icon
                                name="storefront-outline"
                                size={26}
                                color={active === 'Shop' ? NeonIconColors.shop : 'rgba(255,255,255,0.8)'}
                                style={[
                                    styles.iconGlow,
                                    active === 'Shop' && {
                                        textShadowColor: NeonIconColors.shop,
                                        textShadowRadius: 20
                                    }
                                ]}
                            />
                        </View>
                        <Text style={[
                            styles.iconText,
                            {
                                color: active === 'Shop' ? NeonIconColors.shop : 'rgba(255,255,255,0.8)',
                                textShadowColor: active === 'Shop' ? NeonIconColors.shop : 'transparent',
                                textShadowRadius: active === 'Shop' ? 10 : 0
                            }
                        ]}>
                            Shop
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    menuButtonContainer: {
        position: 'absolute',
        zIndex: 20,
        backgroundColor: 'transparent',
    },
    menuButton: {
        padding: 10,
        borderRadius: 20,
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
    },
    menuDropdown: {
        width: 220,
        borderRadius: 12,
        paddingVertical: 8,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 10,
        elevation: 8,
    },
    menuDropdownItem: {
        paddingVertical: 14,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
    },
    menuDropdownText: {
        fontSize: 16,
        fontWeight: '500',
    },
    iconStyle: {
        marginRight: 10,
        textShadowColor: 'rgba(255,255,255,0.5)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10
    },
    iconContainer: {
        backgroundColor: 'rgba(0,0,0,0.4)', // Darker background for better contrast
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)', // Subtle border
    },
    iconGlow: {
        textShadowColor: 'rgba(255,255,255,0.7)', // Stronger glow
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10 // Base glow for inactive, overridden by active state in JSX
    },
    bottomNav: {
        flexDirection: 'row',
        borderTopWidth: 1,
        paddingVertical: 8,
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100, // Increased from 10 to ensure it stays on top
        backgroundColor: 'rgba(10,10,42,0.95)', // More opaque background
        borderTopColor: 'rgba(255,255,255,0.15)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -5 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 15,
    },
    navItem: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 8,
    },
      iconText: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 2,
    },
});
