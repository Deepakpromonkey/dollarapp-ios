import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/build/MaterialCommunityIcons";

import AppHeader from "@/components/AppHeader";
import PageHeader from "@/components/PageHeader";
import AppText from "@/components/AppText";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useCompleteProfile } from "@/hooks/useCompleteProfile";
import { VerifiedEquipment } from "@/lib/api";  

export default function MyEquipmentScreen() {
  const theme = useAppTheme();
  const { equipmentHistory, isLoading } = useCompleteProfile();

  const borderColor = "#E5E7EB"; 

  const renderEquipmentRow = (
    title: string,
    text: string | null,
    imageUrl: string,
    icon: any,
  ) => (
    <View style={[styles.row, { borderBottomColor: borderColor }]}>
      <View style={styles.rowLeft}>
        <View style={[styles.iconBox, { backgroundColor: theme.background }]}>
          <MaterialCommunityIcons
            name={icon}
            size={20}
            color={theme.primaryButton}
          />
        </View>
        <View>
          <AppText variant="caption" style={{ color: theme.secondaryText }}>
            {title}
          </AppText>
          <AppText
            style={{ color: theme.text, marginTop: 2, fontWeight: "500" }}
          >
            {text ? text.replace("\n", " ") : "Pending OCR / Image Only"}
          </AppText>
        </View>
      </View>
      {imageUrl && (
        <Image
          source={{ uri: imageUrl }}
          style={[styles.thumbnail, { borderColor: borderColor }]}
        />
      )}
    </View>
  );

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.screen, { backgroundColor: theme.card }]}
    >
      <View style={[styles.inner, { backgroundColor: theme.background }]}>
       <AppHeader
          appName="My Equipment"
          onNotificationPress={() => {}}
        />

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >

          <View style={{ flexDirection: "row", marginBottom: -4 }}>
              <MaterialCommunityIcons 
                  name="arrow-left" 
                  size={24} 
                  color={theme.text} 
                  onPress={() => router.back()}
                  style={{ padding: 4 }}
              />
          </View>

          <PageHeader
            title="Equipment History"
            subtitle="Verified assets from your loads"
          />

          {isLoading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={theme.primaryButton} />
            </View>
          ) : equipmentHistory.length === 0 ? (
            <View
              style={[
                styles.centerContainer,
                { backgroundColor: theme.card, borderRadius: 16 },
              ]}
            >
              <MaterialCommunityIcons
                name="truck-outline"
                size={32}
                color={theme.secondaryText}
              />
              <AppText style={{ color: theme.secondaryText, marginTop: 12 }}>
                No verified equipment found.
              </AppText>
            </View>
          ) : (
            equipmentHistory.map((item: VerifiedEquipment) => (
              <View
                key={item.id}
                style={[
                  styles.card,
                  { backgroundColor: theme.card, borderColor: borderColor },
                ]}
              >
                <View
                  style={[
                    styles.cardHeader,
                    { borderBottomColor: borderColor },
                  ]}
                >
                  <AppText style={{ fontWeight: "700", color: theme.text }}>
                    Load {item.shipment?.shipment_no}
                  </AppText>
                  <View
                    style={[styles.badge, { backgroundColor: "#22C55E18" }]}
                  >
                    <AppText
                      variant="caption"
                      style={{ color: "#22C55E", fontWeight: "600" }}
                    >
                      {item.status.toUpperCase()}
                    </AppText>
                  </View>
                </View>

                {renderEquipmentRow(
                  "VIN Number",
                  item.vin_text,
                  item.vin_image_url,
                  "barcode-scan",
                )}
                {renderEquipmentRow(
                  "Tractor Details",
                  item.tractor_text,
                  item.tractor_image_url,
                  "truck",
                )}
                {renderEquipmentRow(
                  "Trailer Details",
                  item.trailer_text,
                  item.trailer_image_url,
                  "truck-trailer",
                )}

                <View style={styles.cardFooter}>
                  <AppText
                    variant="caption"
                    style={{ color: theme.secondaryText }}
                  >
                    Verified on:{" "}
                    {new Date(item.created_at).toLocaleDateString()}
                  </AppText>
                </View>
              </View>
            ))
          )}
          <View style={styles.bottomPad} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  inner: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 10,
    gap: 16,
  },
  centerContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  card: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
  },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "#E5E7EB",
  },
  cardFooter: {
    padding: 12,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  bottomPad: { height: 40 },
});