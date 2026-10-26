import React, { useCallback, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/build/MaterialCommunityIcons";

import AppHeader from "@/components/AppHeader";
import PageHeader from "@/components/PageHeader";
import AppText from "@/components/AppText";
import RetryNotice from "@/components/loads/RetryNotice";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useCompleteProfile } from "@/hooks/useCompleteProfile";
import { useRefreshOnFocusAndForeground } from "@/hooks/useRefreshOnFocusAndForeground";
import { VerifiedEquipment } from "@/lib/api";
import { cleanOcrText, extractVin, unitMatch } from "@/utils/ocr";

const GREEN = "#16A34A";
const GREY = "#6B7280";

const MONO = Platform.select({ ios: "Menlo", default: "monospace" });

type Tone = "good" | "warn" | "muted" | "plain";

interface RowStatus {
  text: string;
  tone: Tone;
  /** Shown in a fixed-width face: a VIN is read character by character. */
  mono?: boolean;
  /** The VIN's check digit adds up. */
  confirmed?: boolean;
}

interface PhotoRow {
  title: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  imageUrl: string | null;
  text: string | null;
  status: RowStatus | null;
}

/*
| What the card's chip says.
|
| Every upload is stored as "verified", so the old green VERIFIED chip appeared
| on a photo of a laptop. Nothing checks these photos on the server; the chip
| now says only what the app can tell from the text read off them.
*/
function equipmentCheck(item: VerifiedEquipment, vinFound: boolean): { label: string; tone: Tone } {
  if (vinFound) return { label: "VIN READ", tone: "good" };

  const anyText = [item.vin_text, item.tractor_text, item.trailer_text].some((t) => !!t?.trim());
  return anyText
    ? { label: "CHECK PHOTOS", tone: "warn" }
    : { label: "PHOTOS ONLY", tone: "muted" };
}

/*
| Whether the load's unit number shows in a tractor or trailer photo. Older API
| builds do not send the load's numbers, and some loads have none: then there
| is nothing to compare against and no line is shown.
*/
function unitStatus(raw: string | null, unitNumber: string | null | undefined, unit: "truck" | "trailer"): RowStatus | null {
  const number = unitNumber?.trim();
  if (!number) return null;

  return unitMatch(raw, number)
    ? { text: `Matches ${unit} #${number}`, tone: "good" }
    : { text: "Unit number not read", tone: "muted" };
}

/** "10/13/2026 · 04:52 PM" in the phone's own format, or "" for a missing date. */
function formatStamp(iso?: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.toLocaleDateString()} · ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export default function MyEquipmentScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { equipmentHistory, isLoading, error, refetch } = useCompleteProfile();
  const [pulling, setPulling] = useState(false);
  const [viewer, setViewer] = useState<{ url: string; title: string } | null>(null);

  useRefreshOnFocusAndForeground(refetch);

  const onPull = useCallback(async () => {
    setPulling(true);
    try {
      await refetch();
    } finally {
      setPulling(false);
    }
  }, [refetch]);

  const isDark = theme.background === "#0D0F14";
  const borderColor = isDark ? "#2A2F38" : "#E5E7EB";
  const amber = isDark ? "#F59E0B" : "#B45309";

  const toneColor = (tone: Tone) =>
    tone === "good" ? GREEN : tone === "warn" ? amber : tone === "muted" ? GREY : theme.text;

  const renderCard = (item: VerifiedEquipment) => {
    const vin = extractVin(item.vin_text);
    const check = equipmentCheck(item, !!vin);
    const shipment = item.shipment;
    const loadName =
      shipment?.shipment_no || shipment?.pro_number || `#${shipment?.id ?? item.shipment_id}`;
    const submitted = formatStamp(item.updated_at) || formatStamp(item.created_at);

    const rows: PhotoRow[] = [
      {
        title: "VIN plate",
        icon: "barcode-scan",
        imageUrl: item.vin_image_url,
        text: item.vin_text,
        status: vin
          ? { text: vin.vin, tone: "plain", mono: true, confirmed: vin.confirmed }
          : { text: "No VIN found in photo", tone: "warn" },
      },
      {
        title: "Tractor",
        icon: "truck",
        imageUrl: item.tractor_image_url,
        text: item.tractor_text,
        status: unitStatus(item.tractor_text, shipment?.truck_number, "truck"),
      },
      {
        title: "Trailer",
        icon: "truck-trailer",
        imageUrl: item.trailer_image_url,
        text: item.trailer_text,
        status: unitStatus(item.trailer_text, shipment?.trailer_number, "trailer"),
      },
    ];

    return (
      <View
        key={item.id}
        style={[styles.card, { backgroundColor: theme.card, borderColor }]}
      >
        <View style={[styles.cardHeader, { borderBottomColor: borderColor }]}>
          <AppText
            style={{ fontWeight: "700", color: theme.text, flex: 1, marginRight: 8 }}
            numberOfLines={1}
          >
            Load {loadName}
          </AppText>
          <View style={[styles.badge, { backgroundColor: toneColor(check.tone) + "18" }]}>
            <AppText
              variant="caption"
              style={{ color: toneColor(check.tone), fontWeight: "600" }}
            >
              {check.label}
            </AppText>
          </View>
        </View>

        {rows.map((row) => (
          <EquipmentRow
            key={row.title}
            title={row.title}
            icon={row.icon}
            imageUrl={row.imageUrl}
            rawText={row.text}
            status={row.status}
            statusColor={toneColor(row.status?.tone ?? "plain")}
            borderColor={borderColor}
            onOpenImage={(url) => setViewer({ url, title: `${row.title} · Load ${loadName}` })}
          />
        ))}

        {submitted ? (
          <View style={styles.cardFooter}>
            <AppText variant="caption" style={{ color: theme.secondaryText }}>
              Submitted {submitted}
            </AppText>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.screen, { backgroundColor: theme.card }]}
    >
      <View style={[styles.inner, { backgroundColor: theme.background }]}>
        <AppHeader appName="My Equipment" />

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={pulling}
              onRefresh={onPull}
              tintColor={theme.primaryButton}
            />
          }
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
            subtitle="Photos you took to verify your loads"
          />

          {isLoading && equipmentHistory.length === 0 ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={theme.primaryButton} />
            </View>
          ) : error && equipmentHistory.length === 0 ? (
            <RetryNotice
              title="Couldn't load your equipment"
              message={error}
              onRetry={onPull}
              busy={pulling}
            />
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
              <AppText style={{ color: theme.secondaryText, marginTop: 12, textAlign: "center" }}>
                No equipment photos yet.
              </AppText>
            </View>
          ) : (
            <>
              {error ? (
                <RetryNotice
                  title="Couldn't update your equipment"
                  message={error}
                  onRetry={onPull}
                  busy={pulling}
                />
              ) : null}
              {equipmentHistory.map(renderCard)}
            </>
          )}
          <View style={styles.bottomPad} />
        </ScrollView>
      </View>

      <Modal
        visible={!!viewer}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setViewer(null)}
      >
        <Pressable
          style={styles.viewer}
          onPress={() => setViewer(null)}
          accessibilityLabel="Close photo"
        >
          {viewer ? (
            <Image
              source={{ uri: viewer.url }}
              style={styles.viewerImage}
              resizeMode="contain"
            />
          ) : null}
          <View style={[styles.viewerBar, { top: insets.top + 12 }]}>
            <AppText style={styles.viewerTitle} numberOfLines={1}>
              {viewer?.title ?? ""}
            </AppText>
            <Pressable
              onPress={() => setViewer(null)}
              hitSlop={12}
              style={styles.viewerClose}
              accessibilityRole="button"
              accessibilityLabel="Close photo"
            >
              <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

interface EquipmentRowProps {
  title: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  imageUrl: string | null;
  rawText: string | null;
  status: RowStatus | null;
  statusColor: string;
  borderColor: string;
  onOpenImage: (url: string) => void;
}

/*
| One photo and what was read off it: what it shows (the VIN, or whether the
| load's unit number appears), then the scanned text as a two-line summary that
| opens to the lines exactly as the phone read them, which is what the broker
| sees too.
*/
function EquipmentRow({
  title,
  icon,
  imageUrl,
  rawText,
  status,
  statusColor,
  borderColor,
  onOpenImage,
}: EquipmentRowProps) {
  const theme = useAppTheme();
  const [expanded, setExpanded] = useState(false);

  const summary = cleanOcrText(rawText);
  const lines = rawText?.trim() ?? "";

  return (
    <View style={[styles.row, { borderBottomColor: borderColor }]}>
      <View style={[styles.iconBox, { backgroundColor: theme.background }]}>
        <MaterialCommunityIcons name={icon} size={20} color={theme.primaryButton} />
      </View>

      <View style={styles.rowText}>
        <AppText variant="caption" style={{ color: theme.secondaryText }}>
          {title}
        </AppText>

        {status ? (
          <View style={styles.statusLine}>
            <AppText
              variant="label"
              numberOfLines={1}
              style={[
                { color: statusColor, flexShrink: 1 },
                status.mono ? { fontFamily: MONO, letterSpacing: 0.5 } : {},
              ]}
            >
              {status.text}
            </AppText>
            {status.confirmed ? (
              <MaterialCommunityIcons
                name="check-decagram"
                size={14}
                color={GREEN}
                accessibilityLabel="Check digit matches"
              />
            ) : null}
          </View>
        ) : null}

        {summary ? (
          <Pressable
            onPress={() => setExpanded((open) => !open)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={expanded ? "Hide scanned text" : "Show all scanned text"}
            style={styles.scanned}
          >
            <View style={styles.scannedLabel}>
              <AppText variant="tiny" style={{ color: theme.secondaryText }}>
                Scanned text
              </AppText>
              <MaterialCommunityIcons
                name={expanded ? "chevron-up" : "chevron-down"}
                size={14}
                color={theme.secondaryText}
              />
            </View>
            {expanded ? (
              <View style={[styles.rawBox, { backgroundColor: theme.cardSecondary }]}>
                <AppText
                  variant="tiny"
                  style={{ color: theme.text, fontFamily: MONO, lineHeight: 15 }}
                >
                  {lines}
                </AppText>
              </View>
            ) : (
              <AppText
                variant="caption"
                numberOfLines={2}
                ellipsizeMode="tail"
                style={{ color: theme.text }}
              >
                {summary}
              </AppText>
            )}
          </Pressable>
        ) : (
          <AppText variant="caption" style={{ color: theme.secondaryText, marginTop: 4 }}>
            No text read from photo
          </AppText>
        )}
      </View>

      {imageUrl ? (
        <Pressable
          onPress={() => onOpenImage(imageUrl)}
          hitSlop={6}
          accessibilityRole="imagebutton"
          accessibilityLabel={`Open ${title} photo`}
        >
          <Image
            source={{ uri: imageUrl }}
            style={[styles.thumbnail, { borderColor }]}
          />
        </Pressable>
      ) : null}
    </View>
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
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
  },
  rowText: { flex: 1, minWidth: 0 },
  statusLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  scanned: { marginTop: 6 },
  scannedLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginBottom: 2,
  },
  rawBox: {
    borderRadius: 8,
    padding: 8,
    marginTop: 2,
  },
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
  viewer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  viewerImage: {
    width: "100%",
    height: "80%",
  },
  viewerBar: {
    position: "absolute",
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  viewerTitle: {
    flex: 1,
    color: "#FFFFFF",
  },
  viewerClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
});
