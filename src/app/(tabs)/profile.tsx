import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";
import PageHeader from "@/components/PageHeader";
import AvatarPickerSheet from "@/components/profile/AvatarPickerSheet";
import ProfileActivityCard, { ProfileActivityItem } from "@/components/profile/ProfileActivityCard";
import ProfileHeroCard from "@/components/profile/ProfileHeroCard";
import CdlViewerModal from "@/components/profile/CdlViewerModal";
import DeleteAccountModal from "@/components/profile/DeleteAccountModal";
import RowItem from "@/components/shared/RowItem";
import TileCard, { type TileCardBadge } from "@/components/shared/TileCard";
import VerificationSectionHeader from "@/components/verification/VerificationSectionHeader";
import { useAuth } from "@/context/AuthContext";
import {
    accountRows,
    accountTiles,
    dangerRows,
    supportRows,
    type ProfileRowData,
    type ProfileTileData,
} from "@/data/profileData";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useDriverProfile } from "@/hooks/useDriverProfile";
import { useLivenessVerification } from "@/hooks/useLivenessVerification";
import { useRefreshOnFocusAndForeground } from "@/hooks/useRefreshOnFocusAndForeground";
import { useShipments } from "@/hooks/useShipments";
import type { Shipment } from "@/types/shipment";
import { driverApi, type LivenessStatus } from "@/lib/api";
import { onInvalidate } from "@/lib/invalidate";
import { livenessBadge, resolveLiveness } from "@/utils/liveness";
import { openExternalLink } from "@/utils/openExternalLink";
import { cityState, destinationStop, originStop, stopAppointment, stopTitle } from "@/utils/stops";
import MaterialCommunityIcons from "@expo/vector-icons/build/MaterialCommunityIcons";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import * as ImageManipulator from "expo-image-manipulator";
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    View,
    Platform,
    Alert,
    Modal,
    Pressable,
    Animated
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const S3_BASE_URL = "https://dollartraq.s3.us-east-2.amazonaws.com/";

const NEUTRAL_BADGE = { color: "#9CA3AF", bg: "#9CA3AF18" };

/* What /driver/complete-profile adds to the screen beyond /driver/profile. */
interface CompleteProfileExtras {
    cdlFront: string | null;
    cdlBack: string | null;
    equipmentChecks: number;
    liveness: { status?: LivenessStatus | null; verified?: boolean } | null;
}

export default function ProfileScreen() {
    const theme = useAppTheme();
    const { user, logout, updateDriver } = useAuth();

    const {
        profile,
        isLoading: profileLoading,
        refetch: refetchProfile,
    } = useDriverProfile();
    const { active, loading: shipmentsLoading, refresh: refreshShipments } = useShipments();
    const {
        busy: livenessBusy,
        verify: verifyLiveness,
        checkStatus: checkLiveness,
        recheck: recheckLiveness,
        noteServerState: noteLivenessServerState,
        awaitingVerdict,
    } = useLivenessVerification();

    const fullName = profile
        ? `${profile.first_name} ${profile.last_name}`.trim()
        : "";

    const activityItems = useMemo<ProfileActivityItem[]>(
        () =>
            active.map((s: Shipment) => {
                const pickup = originStop(s.stops);
                const delivery = destinationStop(s.stops);
                const pickupAt = stopAppointment(pickup);
                const deliveryAt = stopAppointment(delivery);
                return {
                    id: String(s.id),
                    date: pickupAt.date ?? s.created_at?.slice(0, 10) ?? "",
                    tripId: s.pro_number || s.shipment_no,
                    status: "clean" as const,
                    origin: pickup ? cityState(pickup) || stopTitle(pickup) : "—",
                    originTime: pickupAt.time ?? "",
                    destination: delivery ? cityState(delivery) || stopTitle(delivery) : "—",
                    destinationTime: deliveryAt.time ?? "",
                };
            }),
        [active],
    );

    // app_drivers has no role system — everyone signing in here is a driver.
    const role = "Driver";

    const [avatarUri, setAvatarUri] = useState<string | undefined>(undefined);
    const [pickerVisible, setPickerVisible] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [viewerVisible, setViewerVisible] = useState(false);

    const [cdlViewerVisible, setCdlViewerVisible] = useState(false);
    const [extras, setExtras] = useState<CompleteProfileExtras | null>(null);

    const [deleteVisible, setDeleteVisible] = useState(false);
    // When the delete dialog was opened: the date it names is counted from then.
    const [deleteOpenedAt, setDeleteOpenedAt] = useState(0);
    const [pulling, setPulling] = useState(false);

    // Created once, like a ref, but readable while rendering.
    const [scaleAnim] = useState(() => new Animated.Value(0));

    useEffect(() => {
        if (viewerVisible) {
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 150,
                friction: 12,
                useNativeDriver: true,
            }).start();
        } else {
            scaleAnim.setValue(0);
        }
    }, [viewerVisible, scaleAnim]);

    /*
    | A refresh must not swap the photo the driver has just picked back to the
    | old one while the upload is still going, and an older answer arriving
    | after a newer one must not win either.
    */
    const uploadingRef = useRef(false);
    const completeRequestRef = useRef(0);

    // A promise chain, so state is only ever set once the request has answered.
    const fetchCompleteProfileData = useCallback((): Promise<void> => {
        const request = ++completeRequestRef.current;
        return driverApi
            .getCompleteProfile()
            .then((res) => {
                if (request !== completeRequestRef.current) return;
                const profileData = res.data?.data?.driver_profile;

                if (res.ok && profileData) {
                    if (!uploadingRef.current && profileData.profile_picture_url) {
                        setAvatarUri(profileData.profile_picture_url);
                    }

                    /*
                     * The API now returns ready-made URLs. The path fallback stays
                     * for older builds of the API, but only the server really knows
                     * which bucket the file is in — so prefer what it tells us over
                     * gluing a hardcoded hostname onto a storage path.
                     */
                    const cdlUrl = (url?: string | null, path?: string | null) => {
                        if (url) return url;
                        if (!path) return null;
                        return path.startsWith("http") ? path : `${S3_BASE_URL}${path}`;
                    };

                    const history = res.data?.data?.verified_equipment_history;

                    setExtras({
                        cdlFront: cdlUrl(profileData.cdl_front_image, profileData.cdl_front_path),
                        cdlBack: cdlUrl(profileData.cdl_back_image, profileData.cdl_back_path),
                        equipmentChecks: Array.isArray(history) ? history.length : 0,
                        liveness:
                            profileData.liveness_status !== undefined ||
                            profileData.liveness_verified !== undefined
                                ? {
                                      status: profileData.liveness_status,
                                      verified: profileData.liveness_verified,
                                  }
                                : null,
                    });
                }
            })
            .catch((error) => {
                console.log("Could not fetch complete profile data", error);
            });
    }, []);

    useEffect(() => {
        fetchCompleteProfileData();

        const offProfile = onInvalidate("profile", () => {
            fetchCompleteProfileData();
        });
        const offSession = onInvalidate("session", () => {
            completeRequestRef.current += 1;
            setExtras(null);
            setAvatarUri(undefined);
        });
        return () => {
            offProfile();
            offSession();
        };
    }, [fetchCompleteProfileData]);

    const refreshAll = useCallback(
        () =>
            Promise.all([
                refetchProfile(),
                fetchCompleteProfileData(),
                refreshShipments(),
                // Only asks Didit while a finished ID check is still waiting on it.
                recheckLiveness(),
            ]).then(() => undefined),
        [refetchProfile, fetchCompleteProfileData, refreshShipments, recheckLiveness],
    );

    useRefreshOnFocusAndForeground(refreshAll);

    const handlePullToRefresh = useCallback(async () => {
        setPulling(true);
        try {
            await refreshAll();
        } finally {
            setPulling(false);
        }
    }, [refreshAll]);

    /*
    | Identity check, newest source first: /driver/profile (newer API builds),
    | then /driver/complete-profile (every build), then what this phone cached
    | at login, so the badge has an answer even offline.
    */
    const serverLiveness =
        profile &&
        (profile.liveness_status !== undefined || profile.liveness_verified !== undefined)
            ? { status: profile.liveness_status, verified: profile.liveness_verified }
            : extras?.liveness ?? null;

    const livenessSource =
        serverLiveness ??
        (user ? { status: user.livenessStatus, verified: user.livenessVerified } : null);

    const serverLivenessState = livenessSource
        ? resolveLiveness(livenessSource.status, livenessSource.verified)
        : null;

    /*
    | A check the driver finished that Didit has not decided yet: the server
    | still says skipped or pending, but VERIFY ID there would open a second
    | session and lose the first one's verdict. It shows as in review instead,
    | so a tap asks for the verdict (checkStatus). Applied here only, on top of
    | the server's answer and never saved into it, and any verdict the server
    | has wins over it.
    |
    | A "declined" still on screen counts as stale too: a marker is only saved
    | after a new session started, which moves the server off declined, and a
    | fresh decline for that session clears the marker on the next check.
    */
    const livenessState =
        (serverLivenessState === "unverified" || serverLivenessState === "declined") &&
        awaitingVerdict
            ? "in_review"
            : serverLivenessState;

    // Once the server's answer has a verdict, the marker can go. Also run when a
    // marker is read back from storage, since the verdict may already be here.
    useEffect(() => {
        noteLivenessServerState(serverLivenessState);
    }, [serverLivenessState, awaitingVerdict, noteLivenessServerState]);

    // Keep the cached copy in step, so the next launch starts from the right badge.
    const serverStatus = serverLiveness?.status;
    const serverVerified = serverLiveness?.verified;
    useEffect(() => {
        if (!user) return;
        const changes: { liveness_status?: LivenessStatus; liveness_verified?: boolean } = {};
        if (serverStatus && serverStatus !== user.livenessStatus) {
            changes.liveness_status = serverStatus;
        }
        if (typeof serverVerified === "boolean" && serverVerified !== user.livenessVerified) {
            changes.liveness_verified = serverVerified;
        }
        if (Object.keys(changes).length > 0) {
            updateDriver(changes).catch(() => {});
        }
    }, [user, serverStatus, serverVerified, updateDriver]);

    const handleLivenessPress = useCallback(() => {
        switch (livenessState) {
            case "approved":
                Alert.alert("ID verified", "Your identity is verified. There is nothing else to do.");
                return;
            case "in_review":
                checkLiveness();
                return;
            case "declined":
            case "unverified":
                verifyLiveness();
                return;
        }
    }, [livenessState, checkLiveness, verifyLiveness]);

    const tileBadge = (id: ProfileTileData["id"], fallback?: TileCardBadge): TileCardBadge | undefined => {
        switch (id) {
            case "verification": {
                if (!livenessState) return undefined;
                const badge = livenessBadge(livenessState, theme.primaryButton);
                return { label: badge.tileLabel, color: badge.color, bg: badge.bg };
            }
            case "license":
                // Photos the driver sent at signup. Nobody has checked them, so "on file", not "verified".
                if (!extras) return undefined;
                return extras.cdlFront || extras.cdlBack
                    ? { label: "ON FILE", color: theme.primaryButton, bg: `${theme.primaryButton}18` }
                    : { label: "NOT ADDED", ...NEUTRAL_BADGE };
            case "equipment":
                if (!extras) return undefined;
                return extras.equipmentChecks > 0
                    ? { label: "VERIFIED", color: "#22C55E", bg: "#22C55E18" }
                    : { label: "NONE YET", ...NEUTRAL_BADGE };
            default:
                return fallback;
        }
    };

    const handleTilePress = (id: ProfileTileData["id"]) => {
        switch (id) {
            case "personal":
                router.push("/profile/personal-info" as any);
                return;
            case "equipment":
                router.push("/profile/my-equipment" as any);
                return;
            case "license":
                setCdlViewerVisible(true);
                return;
            case "verification":
                handleLivenessPress();
                return;
        }
    };

    const openDeleteDialog = useCallback(() => {
        setDeleteOpenedAt(Date.now());
        setDeleteVisible(true);
    }, []);

    const handleRowPress = (row: ProfileRowData) => {
        if (row.url) {
            openExternalLink(row.url, {
                toolbar: theme.card,
                controls: theme.primaryButton,
            });
        } else if (row.id === "logout") {
            handleLogout();
        } else if (row.id === "delete") {
            openDeleteDialog();
        }
    };

    const handleLogout = async () => {
        await logout();
    };

    const handlePhotoSelected = async (uri: string) => {
        setPickerVisible(false);

        try {
            setIsUploading(true);
            uploadingRef.current = true;

            const compressedImage = await ImageManipulator.manipulateAsync(
                uri,
                [{ resize: { width: 1080 } }],
                { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
            );

            const finalUri = compressedImage.uri;

            setAvatarUri(finalUri);

            const formData = new FormData();
            const filename = finalUri.split('/').pop() || 'profile.jpg';

            const cleanFileObject = JSON.parse(JSON.stringify({
                uri: Platform.OS === 'ios' ? finalUri.replace('file://', '') : finalUri,
                name: filename,
                type: "image/jpeg",
            }));

            formData.append("image", cleanFileObject as any);

            const response = await driverApi.uploadProfilePic(formData);

            if (!response.ok) {
                Alert.alert("Upload Failed", "Could not save your new profile picture.");
            }
            uploadingRef.current = false;
            fetchCompleteProfileData();

        } catch {
            Alert.alert("Error", "Something went wrong while uploading your photo.");
            uploadingRef.current = false;
            fetchCompleteProfileData();
        } finally {
            uploadingRef.current = false;
            setIsUploading(false);
        }
    };

    const renderTile = (tile: ProfileTileData, iconSize: number) => (
        <TileCard
            icon={<MaterialCommunityIcons name={tile.icon} size={iconSize} color={theme.primaryButton} />}
            title={tile.title}
            badge={tileBadge(tile.id, tile.badge)}
            onPress={() => handleTilePress(tile.id)}
        />
    );

    return (
        <SafeAreaView
            edges={["top"]}
            style={[styles.screen, { backgroundColor: theme.card }]}>
            <StatusBar backgroundColor={theme.card} barStyle="dark-content" />
            <View style={[styles.inner, { backgroundColor: theme.background }]}>
                <AppHeader appName="DollarTraq" />

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={pulling}
                            onRefresh={handlePullToRefresh}
                            tintColor={theme.primaryButton}
                            colors={[theme.primaryButton]}
                        />
                    }>
                    <PageHeader
                        title="Profile"
                        subtitle="Manage your account"
                    />

                    {profileLoading ? (
                        <View style={styles.loaderCard}>
                            <ActivityIndicator
                                size="small"
                                color={theme.primaryButton}
                            />
                        </View>
                    ) : (
                        <ProfileHeroCard
                            name={fullName || user?.name || ""}
                            role={role}
                            company={profile?.carrier_name ?? user?.carrierName ?? ""}
                            avatarUri={avatarUri}
                            liveness={livenessState}
                            onLivenessPress={handleLivenessPress}
                            livenessBusy={livenessBusy}
                            isUploading={isUploading}
                            onEditAvatar={() => setPickerVisible(true)}
                            onAvatarPress={() => {
                                if (avatarUri) setViewerVisible(true);
                            }}
                        />
                    )}

                    <VerificationSectionHeader title="Account Management" />

                    <View style={[styles.tilesCard]}>
                        {Array.from({
                            length: Math.ceil(accountTiles.length / 2),
                        }).map((_, rowIdx) => {
                            const left = accountTiles[rowIdx * 2];
                            const right = accountTiles[rowIdx * 2 + 1];
                            return (
                                <View key={rowIdx} style={styles.tileGrid}>
                                    {renderTile(left, 20)}
                                    {right ? (
                                        renderTile(right, 22)
                                    ) : (
                                        <View style={{ flex: 1 }} />
                                    )}
                                </View>
                            );
                        })}
                    </View>

                    {accountRows.map((row) => (
                        <RowItem
                            key={row.id}
                            icon={<MaterialCommunityIcons name={row.icon} size={22} color={theme.primaryButton} />}
                            title={row.title}
                            subtitle={row.subtitle}
                            onPress={() => {
                                if (row.id === "settings") router.push("/profile/settings" as any);
                            }}
                        />
                    ))}

                    <View style={styles.sectionHeaderRow}>
                        <VerificationSectionHeader title="Recent Activity" />
                    </View>

                    {shipmentsLoading ? (
                        <View style={styles.loaderCard}>
                            <ActivityIndicator size="small" color={theme.primaryButton} />
                        </View>
                    ) : activityItems.length === 0 ? (
                        <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
                            <MaterialCommunityIcons name="truck-outline" size={28} color={theme.secondaryText} />
                            <AppText variant="caption" style={{ color: theme.secondaryText, marginTop: 6 }}>
                                No active loads right now
                            </AppText>
                        </View>
                    ) : (
                        activityItems.map((item) => (
                            <ProfileActivityCard
                                key={item.id}
                                item={item}
                                onViewDetails={() => router.push(`/loads/${item.id}` as any)}
                            />
                        ))
                    )}

                    <VerificationSectionHeader title="Support" />

                    {supportRows.map((row) => (
                        <RowItem
                            key={row.id}
                            icon={<MaterialCommunityIcons name={row.icon} size={22} color={theme.primaryButton} />}
                            title={row.title}
                            subtitle={row.subtitle}
                            external={!!row.url}
                            onPress={() => handleRowPress(row)}
                        />
                    ))}

                    {dangerRows.map((row) => (
                        <RowItem
                            key={row.id}
                            icon={<MaterialCommunityIcons name={row.icon} size={22} color={theme.err} />}
                            title={row.title}
                            subtitle={row.subtitle}
                            variant={row.variant}
                            onPress={() => handleRowPress(row)}
                        />
                    ))}

                    <View style={styles.bottomPad} />
                </ScrollView>

                <AvatarPickerSheet
                    visible={pickerVisible}
                    onClose={() => setPickerVisible(false)}
                    onPhotoSelected={handlePhotoSelected}
                />

                <Modal
                    visible={viewerVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setViewerVisible(false)}
                >
                    <Pressable
                        style={styles.viewerBackground}
                        onPress={() => setViewerVisible(false)}
                    >
                        <Pressable
                            style={styles.viewerCloseBtn}
                            onPress={() => setViewerVisible(false)}
                        >
                            <MaterialCommunityIcons name="close" size={28} color="#FFFFFF" />
                        </Pressable>

                        {avatarUri && (
                            <Animated.Image
                                source={{ uri: avatarUri }}
                                style={[
                                    styles.viewerImage,
                                    { transform: [{ scale: scaleAnim }] }
                                ]}
                                resizeMode="contain"
                            />
                        )}
                    </Pressable>
                </Modal>

                <CdlViewerModal
                    visible={cdlViewerVisible}
                    onClose={() => setCdlViewerVisible(false)}
                    frontUri={extras?.cdlFront ?? null}
                    backUri={extras?.cdlBack ?? null}
                />

                <DeleteAccountModal
                    visible={deleteVisible}
                    openedAt={deleteOpenedAt}
                    onClose={() => setDeleteVisible(false)}
                    hasActiveLoad={active.length > 0}
                />

            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    inner: { flex: 1 },
    scrollView: { flex: 1 },
    content: {
        paddingHorizontal: 20,
        paddingBottom: 120,
        gap: 8,
    },
    tilesCard: { borderRadius: 16, gap: 8 },
    tileGrid: { flexDirection: "row", gap: 8 },
    sectionHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingRight: 4,
    },
    bottomPad: { height: 16 },
    loaderCard: {
        borderRadius: 16,
        padding: 24,
        justifyContent: "center",
        alignItems: "center",
    },
    emptyCard: {
        borderRadius: 16,
        padding: 24,
        justifyContent: "center",
        alignItems: "center",
        gap: 4,
    },
    viewerBackground: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.95)",
        justifyContent: "center",
        alignItems: "center",
    },
    viewerCloseBtn: {
        position: "absolute",
        top: Platform.OS === "ios" ? 60 : 40,
        right: 20,
        zIndex: 10,
        padding: 8,
        backgroundColor: "rgba(255,255,255,0.1)",
        borderRadius: 20,
    },
    viewerImage: {
        width: "100%",
        height: "80%",
    },
});
