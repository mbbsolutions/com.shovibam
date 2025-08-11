// Shop.js
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
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
  FlatList,
  Modal,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../contexts/AuthContext';
import { LoginActionIcons } from '../components/Loginicons';
import { getAllProducts, recordSale } from '../utils/shop.js';
import { saveItem, getItem } from '../utils/StorageService';

// --- Centralized Dark Theme ---
const DarkTheme = {
  background: '#121212',
  card: '#0A1128',
  inputBg: '#1E1E1E',
  itemBackgrounds: [
    '#1A2A3A', '#2A1A3A', '#1A3A2A', '#3A2A1A',
    '#2A3A1A', '#3A1A2A', '#1A3A3A', '#2A2A2A'
  ],
  primary: '#4CC9F0',
  textPrimary: '#FFFFFF',
  textSecondary: '#B0B0B0',
  successBg: '#1B3A2E',
  successText: '#4CC9F0',
  errorBg: '#3A1A1A',
  errorText: '#FF6B6B',
  paymentCash: '#2E7D32',
  paymentTransfer: '#1565C0',
  paymentCard: '#6A1B9A',
  paymentCrypto: '#FF8F00',
  border: 'rgba(255,255,255,0.15)',
  borderAccent: 'rgba(76, 201, 240, 0.5)',
  borderMedium: 'rgba(255,255,255,0.3)',
  shadow: '#000000',
};

// --- Storage Keys ---
const ALL_PRODUCTS_CACHE_KEY = 'allProductsCache';
const RECENT_SELECTED_PRODUCTS_KEY = 'recentSelectedProductsList';
const CURRENT_CART_PRODUCTS_KEY = 'currentCartProducts';
const CURRENT_CART_DETAILS_KEY = 'currentCartDetails';
const PENDING_SALES_KEY = 'pendingSalesQueue';
const MAX_RECENT_PRODUCTS = 40;
const MAX_SYNC_RETRIES = 3;

// --- Enhanced Error Messaging ---
const getErrorMessage = (error, isOnline) => {
  if (!isOnline) return 'No internet. Sale saved offline.';
  if (error.message?.includes('network')) return 'Network error - check connection';
  if (error.message?.includes('timeout')) return 'Request timed out. Try again.';
  if (error.message?.includes('storage')) return 'Storage error. Restart app.';
  return error.message || 'Operation failed. Please try again.';
};

// --- Pending Sync Button Component ---
const PendingSyncButton = ({ onSync, isOnline, syncInProgress }) => {
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const loadCount = async () => {
      try {
        const pending = await getItem(PENDING_SALES_KEY) || [];
        const validSales = pending.filter(sale =>
          sale.items && sale.items.length > 0 && sale.totalAmount > 0
        );
        setPendingCount(validSales.length);
      } catch (e) {
        console.error('Failed to load pending sales count:', e);
      }
    };
    loadCount();
    const interval = setInterval(loadCount, 5000);
    return () => clearInterval(interval);
  }, []);

  if (pendingCount === 0) return null;

  return (
    <TouchableOpacity
      style={styles.pendingSyncButton}
      onPress={onSync}
      disabled={!isOnline || syncInProgress}
    >
      <Text style={styles.pendingSyncText}>
        {pendingCount} pending {pendingCount === 1 ? 'sale' : 'sales'} • Tap to sync
      </Text>
    </TouchableOpacity>
  );
};

export default function Shop({ navigation }) {
  const { selectedAccount } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  const [amount, setAmount] = useState('');
  const [product, setProduct] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [agentAcct, setAgentAcct] = useState(selectedAccount?.account_number || 'N/A');
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [productDetailsInput, setProductDetailsInput] = useState({});
  const [showSaleFormModal, setShowSaleFormModal] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [discountValue, setDiscountValue] = useState('');
  const [discountType, setDiscountType] = useState('amount');
  const [subtotalAmount, setSubtotalAmount] = useState(0);
  const [syncInProgress, setSyncInProgress] = useState(false);

  // --- Ref to prevent infinite loop ---
  const hasFetchedRef = useRef(false);

  // --- Network Detection ---
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected);
      if (state.isConnected) {
        processPendingSales();
      }
    });

    NetInfo.fetch().then(state => {
      setIsOnline(state.isConnected);
    });

    return () => unsubscribe();
  }, [processPendingSales]);

  // --- Load cart on mount ---
  useEffect(() => {
    const loadCartState = async () => {
      try {
        const savedProducts = await getItem(CURRENT_CART_PRODUCTS_KEY);
        const savedDetails = await getItem(CURRENT_CART_DETAILS_KEY);
        if (savedProducts) setSelectedProducts(JSON.parse(savedProducts));
        if (savedDetails) setProductDetailsInput(JSON.parse(savedDetails));
      } catch (e) {
        console.error('Shop: Error loading cart state:', e);
      }
    };
    loadCartState();
  }, []);

  // --- Save cart ---
  useEffect(() => {
    const handler = setTimeout(async () => {
      try {
        await saveItem(CURRENT_CART_PRODUCTS_KEY, JSON.stringify(selectedProducts));
        await saveItem(CURRENT_CART_DETAILS_KEY, JSON.stringify(productDetailsInput));
      } catch (e) {
        console.error('Shop: Error saving cart state:', e);
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [selectedProducts, productDetailsInput]);

  // --- Fetch & cache products: Now includes products.length safely ---
  useEffect(() => {
    // Prevent re-fetching if already fetched
    if (hasFetchedRef.current && products.length > 0) return;
    hasFetchedRef.current = true;

    const fetchAndCacheProducts = async () => {
      setLoadingProducts(true);
      setFetchError('');

      try {
        const cachedProducts = await getItem(ALL_PRODUCTS_CACHE_KEY);
        const shouldUseCache = cachedProducts && Array.isArray(cachedProducts) && cachedProducts.length > 0;

        if (shouldUseCache) {
          setProducts(cachedProducts);
          console.log('Loaded products from cache.');
        } else {
          setFetchError('No cached products. Waiting for internet...');
        }

        // Only attempt API fetch if online and no cache
        if (isOnline && !shouldUseCache) {
          const fetchedProducts = await getAllProducts();
          setProducts(fetchedProducts);
          await saveItem(ALL_PRODUCTS_CACHE_KEY, fetchedProducts);
          console.log('Fetched and cached latest products from API.');
          setFetchError(''); // Clear error if API succeeds
        }
      } catch (err) {
        console.error('Error fetching products:', err);
        if (!products.length) {
          setFetchError(getErrorMessage(err, isOnline));
        }
      } finally {
        setLoadingProducts(false);
      }
    };

    fetchAndCacheProducts();
  }, [isOnline, products.length]); // ✅ Now includes products.length safely

  // --- Memoize filtered products ---
  const filteredProducts = useMemo(() => {
    return products
      .filter(item =>
        item.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase()))
      )
      .slice(0, 10);
  }, [products, searchQuery]);

  // --- Calculate total ---
  useEffect(() => {
    let currentSubtotal = 0;
    const parts = [];
    selectedProducts.forEach(item => {
      const details = productDetailsInput[item.product_id] || {};
      const price = item.price !== null ? parseFloat(item.price) : (parseFloat(details.amount) || 0);
      const qty = parseInt(details.quantity) || 1;
      const total = price * qty;
      currentSubtotal += total;
      parts.push(`${item.product_name} (x${qty} @₦${price.toFixed(2)})`);
    });
    setSubtotalAmount(currentSubtotal);
    let finalTotal = currentSubtotal;
    if (discountValue && !isNaN(parseFloat(discountValue))) {
      const discount = parseFloat(discountValue);
      finalTotal = discountType === 'percentage'
        ? currentSubtotal * (1 - discount / 100)
        : currentSubtotal - discount;
      finalTotal = Math.max(finalTotal, 0);
    }
    setAmount(finalTotal.toFixed(2));
    setProduct(`Items: ${parts.join(', ')}`);
  }, [selectedProducts, productDetailsInput, discountValue, discountType]);

  // --- Validate Form ---
  const validateForm = () => {
    if (!product.trim() || parseFloat(amount) <= 0) {
      setErrorMsg('Please select products and enter valid amounts.');
      return false;
    }
    if (!customerName.trim()) {
      setErrorMsg("Enter customer's name");
      return false;
    }
    if (!customerPhone.match(/^\d{10,15}$/)) {
      setErrorMsg('Enter a valid customer phone number');
      return false;
    }
    setErrorMsg('');
    return true;
  };

  // --- Toggle Discount Type ---
  const toggleDiscountType = () => {
    setDiscountType(prev => (prev === 'amount' ? 'percentage' : 'amount'));
  };

  // --- Process Pending Sales ---
  const processPendingSales = useCallback(async () => {
    if (syncInProgress || !isOnline) return;
    setSyncInProgress(true);
    try {
      const pendingSales = await getItem(PENDING_SALES_KEY) || [];
      const validPendingSales = pendingSales.filter(sale =>
        sale.items && sale.items.length > 0 && sale.totalAmount > 0
      );
      if (validPendingSales.length === 0) return;

      let syncedCount = 0;
      for (const sale of validPendingSales) {
        let success = false;
        let retries = 0;
        while (!success && retries < MAX_SYNC_RETRIES) {
          try {
            const response = await recordSale(sale);
            if (response.success) success = true;
          } catch (e) {
            retries++;
            if (retries >= MAX_SYNC_RETRIES) break;
            await new Promise(resolve => setTimeout(resolve, 2000 * retries));
          }
        }
        if (success) syncedCount++;
      }

      const remaining = validPendingSales.slice(syncedCount);
      await saveItem(PENDING_SALES_KEY, remaining);

      if (syncedCount > 0) {
        setSuccess(`Synced ${syncedCount} pending sale(s)`);
        setTimeout(() => setSuccess(''), 5000);
      }
    } catch (e) {
      console.error('Error syncing pending sales:', e);
      setErrorMsg('Sync failed. Will retry later.');
    } finally {
      setSyncInProgress(false);
    }
  }, [isOnline, syncInProgress]);

  // --- Handle Sale (Offline-Safe) ---
  const handleShopSale = async () => {
    if (!validateForm()) return;
    setProcessing(true);
    setErrorMsg('');
    setSuccess('');

    try {
      const saleData = {
        customerName,
        customerPhone,
        paymentMethod: selectedPaymentMethod,
        totalAmount: parseFloat(amount),
        discount: {
          value: parseFloat(discountValue) || 0,
          type: discountType,
        },
        items: selectedProducts.map(item => ({
          productId: item.product_id,
          productName: item.product_name,
          quantity: parseInt(productDetailsInput[item.product_id]?.quantity) || 1,
          unitPrice: item.price !== null
            ? parseFloat(item.price)
            : parseFloat(productDetailsInput[item.product_id]?.amount) || 0
        })),
        timestamp: new Date().toISOString(),
        isSynced: false
      };

      if (isOnline) {
        const response = await recordSale(saleData);
        if (response.success) {
          setSuccess('Sale recorded successfully!');
        } else {
          throw new Error(response.message || 'Failed to record sale');
        }
      } else {
        const pending = await getItem(PENDING_SALES_KEY) || [];
        pending.push(saleData);
        await saveItem(PENDING_SALES_KEY, pending);
        setSuccess('Sale saved offline. Will sync when online.');
      }

      // Reset form
      setAmount('');
      setProduct('');
      setCustomerName('');
      setCustomerPhone('');
      setSelectedProducts([]);
      setProductDetailsInput({});
      setDiscountValue('');
      setDiscountType('amount');
      setSubtotalAmount(0);
      setSelectedPaymentMethod('');
      setShowSaleFormModal(false);
    } catch (error) {
      console.error('Sale error:', error);
      const message = getErrorMessage(error, isOnline);
      setErrorMsg(message);
    } finally {
      setProcessing(false);
    }
  };

  // --- Offline Bar UI ---
  const renderOfflineBar = () => (
    !isOnline && (
      <View style={styles.offlineBar}>
        <Ionicons name="wifi-outline" size={16} color="#FFFFFF" />
        <Text style={styles.offlineText}>Offline Mode — Sales will sync when online</Text>
      </View>
    )
  );

  // --- Handle Product Selection ---
  const handleProductSelect = async (item) => {
    setSelectedProducts(prev => {
      const isSelected = prev.some(p => p.product_id === item.product_id);
      if (isSelected) {
        setProductDetailsInput(prev => {
          const currentQty = parseInt(prev[item.product_id]?.quantity || '0');
          return {
            ...prev,
            [item.product_id]: { ...prev[item.product_id], quantity: (currentQty + 1).toString() }
          };
        });
        return prev;
      } else {
        setProductDetailsInput(prev => ({
          ...prev,
          [item.product_id]: prev[item.product_id] || {
            amount: item.price !== null ? parseFloat(item.price).toFixed(2) : '',
            quantity: '1'
          }
        }));
        return [...prev, item];
      }
    });

    try {
      let recent = await getItem(RECENT_SELECTED_PRODUCTS_KEY) || [];
      recent = recent.filter(p => p.product_id !== item.product_id);
      recent.unshift(item);
      if (recent.length > MAX_RECENT_PRODUCTS) recent = recent.slice(0, MAX_RECENT_PRODUCTS);
      await saveItem(RECENT_SELECTED_PRODUCTS_KEY, recent);
    } catch (e) {
      console.error('Error updating recent products:', e);
    }
  };

  // --- Handle Product Details Input ---
  const handleProductDetailsInputChange = useCallback((productId, field, text) => {
    setProductDetailsInput(prev => {
      const current = prev[productId] || { amount: '', quantity: '1' };
      let updated = text;
      if (field === 'amount') updated = text.replace(/[^0-9.]/g, '');
      else if (field === 'quantity') {
        updated = text.replace(/[^0-9]/g, '') || '1';
        if (parseInt(updated) === 0) updated = '1';
      }
      return { ...prev, [productId]: { ...current, [field]: updated } };
    });
  }, []);

  // --- Remove Selected Item ---
  const handleRemoveSelectedItem = useCallback((productId) => {
    setSelectedProducts(prev => prev.filter(p => p.product_id !== productId));
    setProductDetailsInput(prev => {
      const newDetails = { ...prev };
      delete newDetails[productId];
      return newDetails;
    });
  }, []);

  // --- Render Product Item ---
  const renderProductItem = ({ item, index }) => {
    const isSelected = selectedProducts.some(p => p.product_id === item.product_id);
    const currentDetails = productDetailsInput[item.product_id] || { amount: '', quantity: '1' };
    return (
      <TouchableOpacity
        style={[
          styles.productItem,
          { backgroundColor: DarkTheme.itemBackgrounds[index % DarkTheme.itemBackgrounds.length] },
          isSelected && styles.selectedProductItem
        ]}
        onPress={() => handleProductSelect(item)}
      >
        <View style={styles.productItemContent}>
          <View style={styles.productTextContainer}>
            <Text style={styles.productName}>{item.product_name}</Text>
            <Text style={styles.productDescription}>{item.description}</Text>
          </View>
          <View style={styles.amountQuantityContainer}>
            {item.price !== null ? (
              <Text style={styles.productFixedAmountText}>₦{parseFloat(item.price).toFixed(2)}</Text>
            ) : (
              <TextInput
                style={styles.productAmountInput}
                value={currentDetails.amount}
                onChangeText={(text) => handleProductDetailsInputChange(item.product_id, 'amount', text)}
                keyboardType="numeric"
                placeholder="Amt (₦)"
                placeholderTextColor={DarkTheme.textSecondary}
                onTouchStart={(e) => e.stopPropagation()}
              />
            )}
            <TextInput
              style={styles.productQuantityInput}
              value={currentDetails.quantity}
              onChangeText={(text) => handleProductDetailsInputChange(item.product_id, 'quantity', text)}
              keyboardType="numeric"
              placeholder="Qty"
              placeholderTextColor={DarkTheme.textSecondary}
              onTouchStart={(e) => e.stopPropagation()}
            />
          </View>
        </View>
        {isSelected && (
          <View style={styles.checkmarkContainer}>
            <Ionicons name="checkmark-circle" size={24} color={DarkTheme.successText} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // --- Close Modal ---
  const handleCloseSaleFormModal = () => {
    setShowSaleFormModal(false);
    setProcessing(false);
    setErrorMsg('');
    setSuccess('');
    setSelectedPaymentMethod('');
  };

  // --- Payment Button Style ---
  const paymentButtonDisabledStyle = (processing || parseFloat(amount) <= 0)
    ? { opacity: 0.6 }
    : {};

  return (
    <SafeAreaView style={localShopStyles.safeArea}>
      {renderOfflineBar()}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {success ? <Text style={styles.successMsg}>{success}</Text> : null}
          {errorMsg ? <Text style={styles.errorMsg}>{errorMsg}</Text> : null}
          <PendingSyncButton onSync={processPendingSales} isOnline={isOnline} syncInProgress={syncInProgress} />
          
          <View style={localShopStyles.headerSection}>
            <View style={localShopStyles.headerLeft}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingRight: 10 }}>
                <Ionicons name="arrow-back" size={24} color={DarkTheme.textPrimary} />
              </TouchableOpacity>
              <View style={localShopStyles.agentAccountHeader}>
                <Text style={localShopStyles.agentAccountName} numberOfLines={1}>
                  {`${selectedAccount?.customer_first_name || ''} ${selectedAccount?.customer_last_name || ''}`.trim() || 'N/A'}
                </Text>
                <Text style={localShopStyles.agentAccountNumber}>
                  {selectedAccount?.account_number || 'N/A'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.mainContentCard}>
            <Text style={styles.listTitle}>Select Product(s)/Service(s)</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search products..."
              placeholderTextColor={DarkTheme.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {loadingProducts ? null : fetchError ? null : (
              <Text style={styles.productCountInfo}>
                Displaying {filteredProducts.length} of {products.length} products.
                {products.length > 10 && ' (Scroll to search more or refine search)'}
              </Text>
            )}
            {selectedProducts.length > 0 && (
              <View style={styles.inlineSelectedItemsSummary}>
                <Text style={styles.inlineSummaryHeader}>Selected Items:</Text>
                {selectedProducts.map((item) => {
                  const details = productDetailsInput[item.product_id] || {};
                  const qty = parseInt(details.quantity) || 1;
                  const basePrice = item.price !== null ? parseFloat(item.price) : (parseFloat(details.amount) || 0);
                  return (
                    <View key={item.product_id} style={styles.inlineSummaryItemRow}>
                      <TouchableOpacity onPress={() => handleRemoveSelectedItem(item.product_id)} style={styles.removeButton}>
                        <Ionicons name="close-circle" size={16} color={DarkTheme.errorText} />
                      </TouchableOpacity>
                      <Text style={styles.inlineSummaryItemText} numberOfLines={1}>{item.product_name}</Text>
                      <TextInput
                        style={styles.inlineSummaryQuantityInput}
                        value={qty.toString()}
                        onChangeText={(text) => handleProductDetailsInputChange(item.product_id, 'quantity', text)}
                        keyboardType="numeric"
                        onTouchStart={(e) => e.stopPropagation()}
                      />
                      <Text style={styles.inlineSummaryAmountText}>@₦{basePrice.toFixed(2)}</Text>
                    </View>
                  );
                })}
                <View style={styles.inlineSummaryTotalRow}>
                  <Text style={styles.inlineSummaryTotalLabel}>Subtotal:</Text>
                  <Text style={styles.inlineSummaryTotalAmount}>₦{subtotalAmount.toFixed(2)}</Text>
                </View>
                <View style={styles.discountContainer}>
                  <Text style={styles.discountLabel}>Discount:</Text>
                  <TextInput
                    style={styles.discountInput}
                    value={discountValue}
                    onChangeText={setDiscountValue}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor={DarkTheme.textSecondary}
                  />
                  <TouchableOpacity style={styles.discountTypeToggleButton} onPress={toggleDiscountType}>
                    <Text style={styles.discountTypeButtonText}>
                      {discountType === 'amount' ? '₦' : '%'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.inlineSummaryTotalRow}>
                  <Text style={styles.inlineSummaryTotalLabel}>Total:</Text>
                  <Text style={styles.inlineSummaryTotalAmount}>₦{parseFloat(amount).toFixed(2)}</Text>
                </View>
                <View style={styles.paymentMethodIconsContainer}>
                  <TouchableOpacity
                    style={[
                      styles.paymentMethodButton,
                      styles.paymentMethodButtonCash,
                      selectedPaymentMethod === 'cash' && styles.selectedPaymentMethod,
                      paymentButtonDisabledStyle
                    ]}
                    onPress={() => {
                      setSelectedPaymentMethod('cash');
                      navigation.navigate('PaymentConfirmationScreen', {
                        amount: parseFloat(amount).toFixed(2),
                        paymentMethod: 'cash'
                      });
                    }}
                    disabled={processing || parseFloat(amount) <= 0}
                  >
                    <Ionicons name="cash-outline" size={24} color={DarkTheme.textPrimary} />
                    <Text style={styles.paymentMethodButtonText}>Cash</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.paymentMethodButton,
                      styles.paymentMethodButtonTransfer,
                      selectedPaymentMethod === 'transfer' && styles.selectedPaymentMethod,
                      paymentButtonDisabledStyle
                    ]}
                    onPress={() => {
                      setSelectedPaymentMethod('transfer');
                      navigation.navigate('PaymentConfirmationScreen', {
                        amount: parseFloat(amount).toFixed(2),
                        paymentMethod: 'transfer'
                      });
                    }}
                    disabled={processing || parseFloat(amount) <= 0}
                  >
                    <Ionicons name="swap-horizontal-outline" size={24} color={DarkTheme.textPrimary} />
                    <Text style={styles.paymentMethodButtonText}>Transfer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.paymentMethodButton,
                      styles.paymentMethodButtonCard,
                      selectedPaymentMethod === 'pos' && styles.selectedPaymentMethod,
                      paymentButtonDisabledStyle
                    ]}
                    onPress={() => {
                      setSelectedPaymentMethod('pos');
                      navigation.navigate('POS');
                    }}
                    disabled={processing || parseFloat(amount) <= 0}
                  >
                    <Ionicons name="card-outline" size={24} color={DarkTheme.textPrimary} />
                    <Text style={styles.paymentMethodButtonText}>POS</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.paymentMethodButton,
                      styles.paymentMethodButtonCrypto,
                      selectedPaymentMethod === 'crypto' && styles.selectedPaymentMethod,
                      paymentButtonDisabledStyle
                    ]}
                    onPress={() => {
                      setSelectedPaymentMethod('crypto');
                      console.log('Crypto payment selected');
                    }}
                    disabled={processing || parseFloat(amount) <= 0}
                  >
                    <Ionicons name="wallet-outline" size={24} color={DarkTheme.textPrimary} />
                    <Text style={styles.paymentMethodButtonText}>Crypto</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={[styles.button, (!selectedPaymentMethod || processing) && { opacity: 0.6 }]}
                  onPress={() => selectedPaymentMethod && setShowSaleFormModal(true)}
                  disabled={!selectedPaymentMethod || processing || parseFloat(amount) <= 0}
                >
                  <Text style={styles.buttonText}>Complete Sale</Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.scrollableProductListWrapper}>
              {loadingProducts ? (
                <ActivityIndicator size="large" color={DarkTheme.primary} style={{ marginTop: 50 }} />
              ) : fetchError ? (
                <Text style={styles.errorMsg}>{fetchError}</Text>
              ) : (
                <FlatList
                  data={filteredProducts}
                  renderItem={renderProductItem}
                  keyExtractor={(item) => item.product_id.toString()}
                  contentContainerStyle={styles.productList}
                />
              )}
            </View>
          </View>
        </ScrollView>
        <LoginActionIcons />
      </KeyboardAvoidingView>

      {/* Sale Confirmation Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showSaleFormModal}
        onRequestClose={handleCloseSaleFormModal}
      >
        <KeyboardAvoidingView style={styles.modalOverlay} behavior="padding">
          <View style={styles.modalContent}>
            <TouchableOpacity onPress={handleCloseSaleFormModal} style={styles.modalBackButton}>
              <Ionicons name="arrow-back" size={20} color={DarkTheme.primary} />
              <Text style={styles.modalBackButtonText}>Back to Product Selection</Text>
            </TouchableOpacity>
            <Text style={styles.formTitle}>Complete Sale via {selectedPaymentMethod}</Text>
            <Text style={styles.label}>Product(s)/Service(s)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: DarkTheme.inputBg }]}
              value={product}
              editable={false}
              multiline
              placeholderTextColor={DarkTheme.textSecondary}
            />
            <Text style={styles.label}>Total Amount (₦)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: DarkTheme.inputBg }]}
              value={amount}
              editable={false}
              keyboardType="numeric"
              placeholderTextColor={DarkTheme.textSecondary}
            />
            <Text style={styles.label}>Customer Name</Text>
            <TextInput
              style={styles.input}
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="Full Name"
              placeholderTextColor={DarkTheme.textSecondary}
            />
            <Text style={styles.label}>Customer Phone Number</Text>
            <TextInput
              style={styles.input}
              value={customerPhone}
              onChangeText={setCustomerPhone}
              keyboardType="phone-pad"
              placeholder="e.g. 08012345678"
              placeholderTextColor={DarkTheme.textSecondary}
              maxLength={15}
            />
            <TouchableOpacity
              style={[styles.button, processing && { opacity: 0.6 }]}
              onPress={handleShopSale}
              disabled={processing}
            >
              {processing ? (
                <ActivityIndicator color={DarkTheme.textPrimary} />
              ) : (
                <Text style={styles.buttonText}>Record Sale</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// --- Header Styles ---
const localShopStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: DarkTheme.background,
  },
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: DarkTheme.card,
    borderBottomWidth: 1,
    borderBottomColor: DarkTheme.border,
    paddingTop: Platform.OS === 'android' ? 30 : 0,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  agentAccountHeader: {
    marginLeft: 10,
  },
  agentAccountName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: DarkTheme.textPrimary,
  },
  agentAccountNumber: {
    fontSize: 13,
    color: DarkTheme.textSecondary,
  },
});

// --- Main Styles ---
const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 120,
    flexGrow: 1,
    justifyContent: 'flex-start',
    backgroundColor: DarkTheme.background,
  },
  mainContentCard: {
    backgroundColor: DarkTheme.card,
    borderRadius: 12,
    padding: 20,
    shadowColor: DarkTheme.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: 20,
  },
  label: {
    color: DarkTheme.textPrimary,
    marginTop: 16,
    marginBottom: 4,
    fontWeight: '600',
    fontSize: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: DarkTheme.border,
    borderRadius: 5,
    padding: 12,
    backgroundColor: DarkTheme.inputBg,
    fontSize: 16,
    color: DarkTheme.textPrimary,
  },
  successMsg: {
    backgroundColor: DarkTheme.successBg,
    color: DarkTheme.successText,
    padding: 12,
    borderRadius: 4,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: DarkTheme.successText,
    fontSize: 15,
    textAlign: 'center',
  },
  errorMsg: {
    backgroundColor: DarkTheme.errorBg,
    color: DarkTheme.errorText,
    padding: 12,
    borderRadius: 4,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: DarkTheme.errorText,
    fontSize: 15,
    textAlign: 'center',
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: DarkTheme.primary,
    marginBottom: 15,
    textAlign: 'center',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: DarkTheme.borderAccent,
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    backgroundColor: DarkTheme.inputBg,
    fontSize: 16,
    color: DarkTheme.textPrimary,
  },
  productCountInfo: {
    fontSize: 13,
    color: DarkTheme.textSecondary,
    textAlign: 'center',
    marginBottom: 10,
  },
  inlineSelectedItemsSummary: {
    backgroundColor: DarkTheme.itemBackgrounds[0],
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: DarkTheme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  inlineSummaryHeader: {
    fontSize: 17,
    fontWeight: 'bold',
    color: DarkTheme.primary,
    marginBottom: 10,
    textAlign: 'center',
  },
  inlineSummaryItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: DarkTheme.borderAccent,
  },
  removeButton: {
    padding: 5,
    marginRight: 5,
  },
  inlineSummaryItemText: {
    flex: 1,
    fontSize: 15,
    color: DarkTheme.textPrimary,
    marginRight: 10,
  },
  inlineSummaryQuantityInput: {
    width: 50,
    borderWidth: 1,
    borderColor: DarkTheme.borderMedium,
    borderRadius: 5,
    paddingVertical: 4,
    paddingHorizontal: 8,
    textAlign: 'center',
    fontSize: 15,
    backgroundColor: DarkTheme.inputBg,
    marginRight: 10,
    color: DarkTheme.textPrimary,
  },
  inlineSummaryAmountText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: DarkTheme.primary,
  },
  inlineSummaryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 15,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: DarkTheme.borderAccent,
  },
  inlineSummaryTotalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: DarkTheme.primary,
  },
  inlineSummaryTotalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: DarkTheme.successText,
  },
  discountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: DarkTheme.borderAccent,
  },
  discountLabel: {
    fontSize: 16,
    color: DarkTheme.textPrimary,
    fontWeight: '600',
  },
  discountInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: DarkTheme.borderMedium,
    borderRadius: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    fontSize: 16,
    backgroundColor: DarkTheme.inputBg,
    marginHorizontal: 10,
    textAlign: 'right',
    color: DarkTheme.textPrimary,
  },
  discountTypeToggleButton: {
    backgroundColor: DarkTheme.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
  },
  discountTypeButtonText: {
    color: DarkTheme.textPrimary,
    fontWeight: 'bold',
    fontSize: 16,
  },
  paymentMethodIconsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: DarkTheme.borderAccent,
  },
  paymentMethodButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 8,
    width: '45%',
    marginBottom: 10,
    shadowColor: DarkTheme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  paymentMethodButtonCash: { backgroundColor: DarkTheme.paymentCash },
  paymentMethodButtonTransfer: { backgroundColor: DarkTheme.paymentTransfer },
  paymentMethodButtonCard: { backgroundColor: DarkTheme.paymentCard },
  paymentMethodButtonCrypto: { backgroundColor: DarkTheme.paymentCrypto },
  paymentMethodButtonText: {
    color: DarkTheme.textPrimary,
    marginTop: 5,
    fontWeight: 'bold',
    fontSize: 14,
  },
  selectedPaymentMethod: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  scrollableProductListWrapper: {
    maxHeight: 300,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: DarkTheme.border,
    borderRadius: 10,
    overflow: 'hidden',
  },
  productList: {
    padding: 10,
  },
  productItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: DarkTheme.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
    position: 'relative',
  },
  selectedProductItem: {
    borderWidth: 2,
    borderColor: DarkTheme.primary,
  },
  productItemContent: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'center',
  },
  productTextContainer: {
    flex: 2,
    marginRight: 10,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: DarkTheme.textPrimary,
  },
  productDescription: {
    fontSize: 12,
    color: DarkTheme.textSecondary,
    marginTop: 2,
  },
  amountQuantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1.5,
    justifyContent: 'flex-end',
  },
  productFixedAmountText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: DarkTheme.primary,
    marginRight: 10,
  },
  productAmountInput: {
    width: 80,
    borderWidth: 1,
    borderColor: DarkTheme.borderMedium,
    borderRadius: 5,
    paddingVertical: 6,
    paddingHorizontal: 8,
    textAlign: 'right',
    fontSize: 15,
    backgroundColor: DarkTheme.inputBg,
    marginRight: 10,
    color: DarkTheme.textPrimary,
  },
  productQuantityInput: {
    width: 50,
    borderWidth: 1,
    borderColor: DarkTheme.borderMedium,
    borderRadius: 5,
    paddingVertical: 6,
    paddingHorizontal: 8,
    textAlign: 'center',
    fontSize: 15,
    backgroundColor: DarkTheme.inputBg,
    color: DarkTheme.textPrimary,
  },
  checkmarkContainer: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalContent: {
    backgroundColor: DarkTheme.card,
    borderRadius: 10,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
    shadowColor: DarkTheme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    padding: 5,
  },
  modalBackButtonText: {
    color: DarkTheme.primary,
    fontSize: 16,
    marginLeft: 5,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: DarkTheme.primary,
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: DarkTheme.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 6,
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: DarkTheme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    color: DarkTheme.textPrimary,
    fontWeight: 'bold',
    fontSize: 16,
  },
  offlineBar: {
    backgroundColor: '#FF8F00',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineText: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 8,
  },
  pendingSyncButton: {
    backgroundColor: DarkTheme.primary,
    padding: 12,
    borderRadius: 8,
    margin: 10,
    alignItems: 'center',
  },
  pendingSyncText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
});