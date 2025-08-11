import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  FlatList,
  Modal,
  Platform,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import Icon from "react-native-vector-icons/MaterialCommunityIcons"; // Keep Icon for other uses like account-switch, content-copy, check, refresh
import {
  getMappedUserData,
  setLastChosenAccount,
  getLastChosenAccount,
  fetchAndStoreUserAccountsByTechvibesId,
  getCurrentFintech,
} from "../services/AuthService";
import { fetchLatestHistoryForAccount } from "../utils/historyTable_gen_local";

function getBestAccountNo(user) {
  return user?.account_number || user?.accountNumber || "";
}
function getBestTechvibesId(user) {
  return user?.techvibes_id || "";
}
function getFullName(user) {
  if (user?.customer_first_name || user?.customer_last_name) {
    return `${user.customer_first_name ?? ""} ${user.customer_last_name ?? ""}`.trim();
  }
  return user?.fullName || "";
}
function getSource(user) {
  return user?.source || "";
}
function getCustomerId(user) {
  return user?.customer_id || "";
}
function formatMoney(val) {
  if (val === undefined || val === null || val === "") return "";
  const num = Number(val);
  if (isNaN(num)) return val;
  return num.toLocaleString("en-NG", { minimumFractionDigits: 2 });
}

const BalanceView = ({
  showDropdown = false,
  onAccountChanged,
  onBalanceChange,
  subAccount: propSubAccount,
  mainAccount: propMainAccount,
  accounts: propAccounts,
  setSubAccountState: propSetSubAccountState,
  accountDropdownVisible: propAccountDropdownVisible,
  setAccountDropdownVisible: propSetAccountDropdownVisible,
}) => {
  const [copying, setCopying] = useState(false);
  const [accounts, setAccounts] = useState(propAccounts || []);
  const [mainAccount, setMainAccount] = useState(propMainAccount || null);
  const [subAccount, setSubAccount] = useState(propSubAccount || null);
  const [accountDropdownVisible, setAccountDropdownVisible] = useState(
    typeof propAccountDropdownVisible === "boolean" ? propAccountDropdownVisible : false
  );
  const [balance, setBalance] = useState("0.00");
  const [lastUpdated, setLastUpdated] = useState("Never");
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [dropdownLoading, setDropdownLoading] = useState(false);

  // Sync props with internal state if passed as props
  useEffect(() => {
    if (Array.isArray(propAccounts) && propAccounts.length > 0) setAccounts(propAccounts);
  }, [propAccounts]);
  useEffect(() => {
    if (propMainAccount) setMainAccount(propMainAccount);
  }, [propMainAccount]);
  useEffect(() => {
    if (propSubAccount) setSubAccount(propSubAccount);
  }, [propSubAccount]);
  useEffect(() => {
    if (typeof propAccountDropdownVisible === "boolean")
      setAccountDropdownVisible(propAccountDropdownVisible);
  }, [propAccountDropdownVisible]);

  // Initial load accounts and set main/sub account
  useEffect(() => {
    // If accounts are already provided via props, we don't need to fetch them here
    if (accounts && accounts.length > 0) {
      // Ensure subAccount is set if not already, based on props
      if (!subAccount && propSubAccount) {
        setSubAccount(propSubAccount);
      } else if (!subAccount && propAccounts && propAccounts.length > 0) {
        // If no propSubAccount, but propAccounts exist, try to find last chosen or default to first
        (async () => {
          const lastChosen = await getLastChosenAccount();
          const foundAccount = lastChosen ? propAccounts.find(acc => getBestAccountNo(acc) === getBestAccountNo(lastChosen)) : null;
          setSubAccount(foundAccount || propAccounts[0]);
        })();
      }
      return;
    }

    // If accounts are NOT provided via props, fetch them from SessionManager
    const loadAccounts = async () => {
      setDropdownLoading(true); // Indicate loading for initial fetch
      let allMappedProfiles = await getMappedUserData();
      let lastChosen = await getLastChosenAccount();
      let initialTechvibesId = null;
      let initialFintech = getCurrentFintech(); // Get default fintech

      // Try to get techvibes_id from last chosen account
      if (lastChosen && lastChosen.techvibes_id) {
        initialTechvibesId = lastChosen.techvibes_id;
        initialFintech = lastChosen.fintech || initialFintech;
      } else if (allMappedProfiles.length > 0) {
        // Fallback: If no lastChosen or no techvibes_id in it, try the first mapped profile
        initialTechvibesId = allMappedProfiles[0].techvibes_id;
        // Fintech might be in the first account of the first profile
        initialFintech = allMappedProfiles[0].accounts[0]?.fintech || initialFintech;
      }

      let fetchedAccounts = [];
      if (initialTechvibesId) {
        // Fetch all accounts associated with this techvibes_id
        fetchedAccounts = await fetchAndStoreUserAccountsByTechvibesId(initialTechvibesId, initialFintech);
      } else {
        // If no techvibes_id found, try to use any existing accounts from getMappedUserData directly
        // This handles cases where techvibes_id might not be consistently set yet,
        // or for older data structures.
        if (allMappedProfiles.length > 0) {
          fetchedAccounts = allMappedProfiles.flatMap(profile => profile.accounts);
        }
      }

      setAccounts(fetchedAccounts);

      let chosenSub = null;
      if (lastChosen) {
        // Find the last chosen account within the fetched list
        chosenSub = fetchedAccounts.find(
          (acc) => getBestAccountNo(acc) === getBestAccountNo(lastChosen)
        );
      }

      // If last chosen account not found or not set, default to the first fetched account
      if (!chosenSub && fetchedAccounts.length > 0) {
        chosenSub = fetchedAccounts[0];
      }

      setMainAccount(chosenSub); // Main account is the primary one for the session
      setSubAccount(chosenSub); // Sub account is the currently displayed one

      if (propSetSubAccountState) propSetSubAccountState(chosenSub); // Notify parent if prop is provided
      setDropdownLoading(false);
    };

    loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array means this runs once on mount

  // Fetch balance using fetchLatestHistoryForAccount
  const fetchBalance = useCallback(async (account) => {
    if (!account || !account.customer_id) {
      setBalance("0.00");
      setLastUpdated("Never");
      return;
    }
    setLoadingBalance(true);
    try {
      const { row, success, current_balance } = await fetchLatestHistoryForAccount({
        customerId: account.customer_id,
        accountNo: account.account_number || account.accountNumber,
      });
      let newBal = "0.00";
      if (success) {
        if (
          current_balance !== undefined &&
          current_balance !== null &&
          current_balance !== "" &&
          !isNaN(Number(current_balance))
        ) {
          newBal = current_balance;
        } else if (row) {
          newBal =
            row.cumulative_internal_balAfter ??
            row.cumulative_internal_balafter ??
            row.internal_balAfter ??
            "0.00";
        }
      }
      setBalance(newBal);
      setLastUpdated(
        new Date().toLocaleString("en-NG", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    } catch (e) {
      console.error("Error fetching balance:", e);
      setBalance("0.00");
      setLastUpdated("Never");
    }
    setLoadingBalance(false);
  }, []);

  useEffect(() => {
    if (subAccount) fetchBalance(subAccount);
  }, [subAccount, fetchBalance]);

  // Notify parent of balance change
  useEffect(() => {
    if (typeof onBalanceChange === "function") {
      onBalanceChange(balance);
    }
  }, [balance, onBalanceChange]);

  const user = subAccount || mainAccount;
  const accountNo = getBestAccountNo(user);
  const techvibesId = getBestTechvibesId(user);
  const fullName = getFullName(user);
  const source = getSource(user);
  const customerId = getCustomerId(user);

  const handleCopyAccountNo = async () => {
    setCopying(true);
    if (accountNo) await Clipboard.setStringAsync(accountNo);
    setTimeout(() => setCopying(false), 800);
  };

  const isSelected = (item) =>
    subAccount && getBestAccountNo(item) === getBestAccountNo(subAccount);
  const getBestName = (item) =>
    (item.customer_first_name || item.customer_last_name)
      ? `${item.customer_first_name ?? ""} ${item.customer_last_name ?? ""}`.trim()
      : (item.full_name || item.username || item.account_number);

  const handleAccountSelect = async (selectedAccount) => {
    setDropdownLoading(true);
    setSubAccount(selectedAccount);
    if (propSetSubAccountState) propSetSubAccountState(selectedAccount);
    setAccountDropdownVisible(false);
    if (propSetAccountDropdownVisible) propSetAccountDropdownVisible(false);
    if (onAccountChanged) await onAccountChanged(selectedAccount);
    await setLastChosenAccount(selectedAccount); // Save the newly chosen account
    setDropdownLoading(false);
  };

  // Modal popup for account selection
  const renderAccountModal = () => (
    <Modal
      visible={accountDropdownVisible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        setAccountDropdownVisible(false);
        if (propSetAccountDropdownVisible) propSetAccountDropdownVisible(false);
      }}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={() => {
          setAccountDropdownVisible(false);
          if (propSetAccountDropdownVisible) propSetAccountDropdownVisible(false);
        }}
      >
        <View style={styles.dropdown}>
          <Text style={styles.title}>Select Account</Text>
          <FlatList
            data={accounts}
            keyExtractor={item => String(getBestAccountNo(item))} // Use a robust key
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.option,
                  isSelected(item) ? styles.selected : null,
                ]}
                onPress={() => handleAccountSelect(item)}
                disabled={dropdownLoading}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionText}>
                    {getBestAccountNo(item)}
                    {"  "}
                    <Text style={styles.sourceText}>
                      {item.source ? `[${item.source}]` : ""}
                    </Text>
                  </Text>
                  <Text style={styles.nameText}>
                    {getBestName(item)}
                  </Text>
                  <Text style={styles.detailText}>
                    {item.email || item.customer_email || "-"}  |  {item.fintech || "-"}
                  </Text>
                </View>
                {isSelected(item) && (
                  <Icon name="check" size={18} color="#28a745" style={{ marginLeft: 8 }} />
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={() => (
              <Text style={styles.emptyListText}>No other accounts found for this user.</Text>
            )}
          />
          {dropdownLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#166088" />
              <Text style={styles.loadingText}>Switching account...</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <View>
      {/* Account switch popup modal */}
      {renderAccountModal()}

      {/* Account header */}
      <View style={styles.infoCard}>
        {fullName ? (
          <Text style={styles.fullName}>{fullName}</Text>
        ) : null}
        <View style={styles.infoPairRow}>
          <TouchableOpacity
            style={styles.accountRow}
            onPress={() => showDropdown && setAccountDropdownVisible(true)}
            activeOpacity={showDropdown ? 0.7 : 1}
          >
            <Text style={styles.infoValue}>{accountNo}</Text>
            {showDropdown && accounts.length > 1 ? ( // Only show switch icon if there's more than 1 account
              <Icon name="account-switch" size={17} color="#166088" style={{ marginLeft: 5 }} />
            ) : null}
            <TouchableOpacity onPress={handleCopyAccountNo} style={{ marginLeft: 7 }}>
              <Icon name="content-copy" size={15} color="#4a6fa5" />
            </TouchableOpacity>
            {copying ? (
              <Text style={{ fontSize: 11, color: "#4a6fa5", marginLeft: 8 }}>Copied!</Text>
            ) : null}
          </TouchableOpacity>
          {source ? (
            <Text style={styles.sourceValue}>{source}</Text>
          ) : null}
        </View>
        <View style={styles.infoPairRow}>
          <Text style={styles.infoValue}>{customerId}</Text>
          <Text style={styles.infoValue}>{techvibesId}</Text>
        </View>
      </View>
      {/* Balance card */}
      <View style={styles.balanceCard}>
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 8,
        }}>
          <Text style={styles.balanceText}>₦{formatMoney(balance)}</Text>
          <TouchableOpacity style={{ marginLeft: 8 }} onPress={() => fetchBalance(subAccount)} disabled={loadingBalance}>
            <Icon name="refresh" size={18} color="#166088" />
            {loadingBalance && (
              <ActivityIndicator size="small" color="#166088" style={{ position: "absolute", left: 8, top: 2 }} />
            )}
          </TouchableOpacity>
        </View>
        <Text style={styles.balanceUpdate}>
          Last updated: {lastUpdated}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  infoCard: {
    backgroundColor: "#f6f8fa",
    borderRadius: 8,
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    elevation: 1,
    alignItems: "flex-start",
    width: "100%",
  },
  fullName: {
    fontSize: 15,
    color: "#166088",
    fontWeight: "bold",
    letterSpacing: 0.1,
    marginBottom: 1,
  },
  infoPairRow: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 1,
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    color: "#333",
    fontWeight: "500",
    letterSpacing: 0.1,
    marginBottom: 0,
    flex: 1,
  },
  sourceValue: {
    fontSize: 14,
    color: "#b07c00",
    fontWeight: "bold",
    letterSpacing: 0.15,
    marginLeft: 8,
  },
  balanceCard: {
    padding: 10,
    backgroundColor: "#fff",
    borderRadius: 6,
    marginBottom: 14,
    elevation: 1,
  },
  balanceText: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    color: "#28a745",
  },
  balanceUpdate: {
    fontSize: 11,
    color: "#666",
    textAlign: "center",
    marginBottom: 2,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(30,40,60,0.18)",
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 40,
  },
  dropdown: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    minWidth: 280,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    maxHeight: 350,
    position: "relative",
  },
  title: {
    fontWeight: "bold",
    color: "#166088",
    fontSize: 16,
    marginBottom: 12,
    textAlign: "center",
  },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 5,
    flexDirection: "row",
    alignItems: "center",
    borderBottomColor: "#e5e5e5",
    borderBottomWidth: 1,
  },
  selected: {
    backgroundColor: "#e6f4ea",
  },
  optionText: {
    color: "#166088",
    fontSize: 15,
    flex: 1,
  },
  nameText: {
    color: "#888",
    fontSize: 13,
  },
  sourceText: {
    color: "#b07c00",
    fontSize: 13,
  },
  detailText: {
    color: "#395",
    fontSize: 12.5,
    marginTop: 1,
    marginBottom: 0,
  },
  loadingOverlay: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.8)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  loadingText: {
    color: "#166088",
    fontWeight: "bold",
    marginTop: 10,
    fontSize: 16,
  },
  emptyListText: {
    textAlign: 'center',
    paddingVertical: 20,
    color: '#666',
    fontStyle: 'italic',
  },
});

export default BalanceView;
