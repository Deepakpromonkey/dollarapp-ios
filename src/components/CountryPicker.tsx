import AppText from "@/components/AppText";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useState } from "react";
import {
    Dimensions,
    FlatList,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { height } = Dimensions.get("window");

export type Country = {
    code: string;
    flag: string;
    dialCode: string;
    name: string;
    digitLengths: number[];
    placeholder: string;
};

export const COUNTRIES: Country[] = [
    {
        code: "IN",
        flag: "🇮🇳",
        dialCode: "+91",
        name: "India",
        digitLengths: [10],
        placeholder: "98765 43210",
    },
    {
        code: "US",
        flag: "🇺🇸",
        dialCode: "+1",
        name: "United States",
        digitLengths: [10],
        placeholder: "(555) 123-4567",
    },
    {
        code: "GB",
        flag: "🇬🇧",
        dialCode: "+44",
        name: "United Kingdom",
        digitLengths: [10],
        placeholder: "7400 123456",
    },
    {
        code: "CA",
        flag: "🇨🇦",
        dialCode: "+1",
        name: "Canada",
        digitLengths: [10],
        placeholder: "(416) 555-0199",
    },
    {
        code: "AU",
        flag: "🇦🇺",
        dialCode: "+61",
        name: "Australia",
        digitLengths: [9],
        placeholder: "412 345 678",
    },
    {
        code: "DE",
        flag: "🇩🇪",
        dialCode: "+49",
        name: "Germany",
        digitLengths: [10, 11],
        placeholder: "151 23456789",
    },
    {
        code: "FR",
        flag: "🇫🇷",
        dialCode: "+33",
        name: "France",
        digitLengths: [9],
        placeholder: "6 12 34 56 78",
    },
    {
        code: "AE",
        flag: "🇦🇪",
        dialCode: "+971",
        name: "UAE",
        digitLengths: [9],
        placeholder: "50 123 4567",
    },
    {
        code: "ZA",
        flag: "🇿🇦",
        dialCode: "+27",
        name: "South Africa",
        digitLengths: [9],
        placeholder: "71 123 4567",
    },
    {
        code: "BR",
        flag: "🇧🇷",
        dialCode: "+55",
        name: "Brazil",
        digitLengths: [11],
        placeholder: "11 91234-5678",
    },
];

interface CountryPickerProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (country: Country) => void;
    selectedCountryCode?: string;
}

export default function CountryPicker({
    visible,
    onClose,
    onSelect,
    selectedCountryCode,
}: CountryPickerProps) {
    const theme = useAppTheme();
    const insets = useSafeAreaInsets();
    const [searchQuery, setSearchQuery] = useState("");

    const filteredCountries = searchQuery.trim()
        ? COUNTRIES.filter(
              (c) =>
                  c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  c.dialCode.includes(searchQuery),
          )
        : COUNTRIES;

    const handleClose = () => {
        setSearchQuery("");
        onClose();
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={handleClose}>
            <View style={styles.modalOverlay}>
                <Pressable
                    style={StyleSheet.absoluteFill}
                    onPress={handleClose}
                />
                <View
                    style={[
                        styles.modalContent,
                        {
                            backgroundColor: theme.card || "#ffffff",
                            paddingBottom: Math.max(insets.bottom, 20),
                        },
                    ]}>
                    <View style={styles.modalHeader}>
                        <AppText
                            variant="title"
                            style={{ fontSize: 18, color: theme.text }}>
                            Select Country
                        </AppText>
                        <Pressable onPress={handleClose} hitSlop={12}>
                            <AppText
                                style={{
                                    fontSize: 24,
                                    color: theme.secondaryText,
                                }}>
                                ×
                            </AppText>
                        </Pressable>
                    </View>

                    <TextInput
                        style={[
                            styles.searchInput,
                            {
                                backgroundColor:
                                    theme.cardSecondary || "#F4F6F9",
                                color: theme.text,
                            },
                        ]}
                        placeholder="Search country or code"
                        placeholderTextColor={theme.secondaryText}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoCorrect={false}
                    />

                    <FlatList
                        data={filteredCountries}
                        keyExtractor={(item) => item.code + item.name}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item }) => {
                            const isSelected =
                                item.code === selectedCountryCode;
                            return (
                                <Pressable
                                    style={[
                                        styles.countryItem,
                                        isSelected && {
                                            backgroundColor:
                                                theme.primaryButton + "15",
                                        },
                                    ]}
                                    onPress={() => {
                                        onSelect(item);
                                        handleClose();
                                    }}>
                                    <AppText
                                        style={{
                                            fontSize: 24,
                                            marginRight: 12,
                                        }}>
                                        {item.flag}
                                    </AppText>
                                    <AppText
                                        style={[
                                            styles.countryName,
                                            { color: theme.text },
                                        ]}>
                                        {item.name}
                                    </AppText>
                                    <AppText
                                        style={{
                                            color: isSelected
                                                ? theme.primaryButton
                                                : theme.secondaryText,
                                            fontWeight: "600",
                                        }}>
                                        {item.dialCode}
                                    </AppText>
                                </Pressable>
                            );
                        }}
                    />
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        justifyContent: "flex-end",
    },
    modalContent: {
        height: height * 0.7,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20,
    },
    searchInput: {
        height: 48,
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 16,
        marginBottom: 16,
        ...Platform.select({ android: { includeFontPadding: false } }),
    },
    countryItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 12,
        marginBottom: 2,
    },
    countryName: {
        flex: 1,
        fontSize: 16,
    },
});
