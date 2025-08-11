import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Dimensions, Modal, Pressable, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const { width } = Dimensions.get('window');

const allCardTypes = [
    { id: '1', name: 'Visa', icon: 'credit-card', color: '#FF2D75' },       // Neon Pink
    { id: '2', name: 'Mastercard', icon: 'credit-card-outline', color: '#00FEFC' }, // Cyan
    { id: '3', name: 'Verve', icon: 'credit-card-multiple', color: '#39FF14' },     // Neon Green
    { id: '4', name: 'Amex', icon: 'credit-card-settings', color: '#FF00FF' },      // Magenta
    { id: '5', name: 'Discover', icon: 'credit-card-search', color: '#00B4FF' },    // Bright Blue
    { id: '6', name: 'UnionPay', icon: 'credit-card-chip', color: '#FFA500' },      // Orange
];

const Cards = () => {
    const [modalVisible, setModalVisible] = useState(false);
    const scaleAnim = useRef(new Animated.Value(0)).current;

    const toggleModal = () => {
        if (!modalVisible) {
            setModalVisible(true);
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 5,
                useNativeDriver: true,
            }).start();
        } else {
            Animated.spring(scaleAnim, {
                toValue: 0,
                friction: 5,
                useNativeDriver: true,
            }).start(() => setModalVisible(false));
        }
    };

    const renderCard = ({ item }) => (
        <TouchableOpacity 
            style={[styles.card, { backgroundColor: `${item.color}20` }]}
            onPress={() => console.log('Card pressed:', item.name)}
        >
            <Icon name={item.icon} size={28} color={item.color} />
            <Text style={styles.cardText}>{item.name}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            {/* Main horizontal cards */}
            <FlatList
                data={allCardTypes.slice(0, 2)}
                renderItem={renderCard}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.cardList}
            />

            {/* Book-style more button */}
            <TouchableOpacity 
                style={styles.moreButton}
                onPress={toggleModal}
            >
                <View style={styles.bookSpine}>
                    <Icon name="book-open-variant" size={20} color="#4CC9F0" />
                </View>
            </TouchableOpacity>

            {/* Popup modal for additional cards */}
            <Modal
                visible={modalVisible}
                transparent
                animationType="fade"
                onRequestClose={toggleModal}
            >
                <Pressable style={styles.modalOverlay} onPress={toggleModal}>
                    <Animated.View 
                        style={[
                            styles.modalContent,
                            { transform: [{ scale: scaleAnim }] }
                        ]}
                    >
                        <Text style={styles.modalTitle}>All Card Types</Text>
                        <FlatList
                            data={allCardTypes}
                            renderItem={renderCard}
                            numColumns={3}
                            columnWrapperStyle={styles.modalRow}
                            contentContainerStyle={styles.modalCardList}
                        />
                    </Animated.View>
                </Pressable>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'rgba(10, 17, 40, 0.7)',
        borderRadius: 12,
        padding: 15,
        marginVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(76, 201, 240, 0.2)',
    },
    cardList: {
        paddingRight: 50,
    },
    card: {
        width: 100,
        height: 60,
        borderRadius: 8,
        marginRight: 10,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    cardText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 5,
    },
    moreButton: {
        position: 'absolute',
        right: 10,
        width: 40,
        height: 60,
        justifyContent: 'center',
        alignItems: 'center',
    },
    bookSpine: {
        backgroundColor: 'rgba(76, 201, 240, 0.1)',
        width: '100%',
        height: '80%',
        justifyContent: 'center',
        alignItems: 'center',
        borderLeftWidth: 3,
        borderLeftColor: 'rgba(76, 201, 240, 0.5)',
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    modalContent: {
        backgroundColor: '#0A1128',
        borderRadius: 12,
        padding: 20,
        width: width - 40,
        borderWidth: 1,
        borderColor: 'rgba(76, 201, 240, 0.3)',
    },
    modalTitle: {
        color: '#4CC9F0',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        textAlign: 'center',
    },
    modalRow: {
        justifyContent: 'space-between',
        marginBottom: 15,
    },
    modalCardList: {
        paddingBottom: 10,
    },
});

export default Cards;