import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";
import PageHeader from "@/components/PageHeader";
import AvatarPickerSheet from "@/components/profile/AvatarPickerSheet";
import ProfileActivityCard, { ProfileActivityItem } from "@/components/profile/ProfileActivityCard";
import ProfileHeroCard from "@/components/profile/ProfileHeroCard";
import CdlViewerModal from "@/components/profile/CdlViewerModal";
import RowItem from "@/components/shared/RowItem";
import TileCard from "@/components/shared/TileCard";
import VerificationSectionHeader from "@/components/verification/VerificationSectionHeader";
import { useAuth } from "@/context/AuthContext";
import { useThemeContext } from "@/context/ThemeContext";
import {
    accountRows,
    accountTiles,
    dangerRows,
    supportRows,
} from "@/data/profileData";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useDriverProfile } from "@/hooks/useDriverProfile";
import { useShipments } from "@/hooks/useShipments";
import type { Shipment } from "@/types/shipment";
import { driverApi } from "@/lib/api"; 
import MaterialCommunityIcons from "@expo/vector-icons/build/MaterialCommunityIcons";
import { router } from "expo-router";
import { useEffect, useMemo, useState, useRef } from "react";
import * as ImageManipulator from "expo-image-manipulator";
import {
    ActivityIndicator,
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

export default function ProfileScreen() {
    const theme = useAppTheme();
    const { colorMode, setColorMode, isDark } = useThemeContext();
    const { logout } = useAuth();
    
    const { profile, isLoading: profileLoading } = useDriverProfile();
    const { active, loading: shipmentsLoading } = useShipments();

    const fullName = profile
        ? `${profile.first_name} ${profile.last_name}`.trim()
        : "";

    const activityItems = useMemo<ProfileActivityItem[]>(
        () =>
            active.map((s: Shipment) => {
                const pickup = s.stops.find((st) => st.stop_type === "Pickup");
                const delivery = s.stops.find(
                    (st) => st.stop_type === "Delivery",
                );
                return {
                    id: String(s.id),
                    date: pickup?.start_date ?? s.created_at?.slice(0, 10) ?? "",
                    tripId: s.pro_number || s.shipment_no,
                    status: "clean" as const,
                    origin: pickup?.city
                        ? `${pickup.city}, ${pickup.state}`
                        : pickup?.stop_name ?? "—",
                    originTime: pickup?.start_time ?? "",
                    destination: delivery?.city
                        ? `${delivery.city}, ${delivery.state}`
                        : delivery?.stop_name ?? "—",
                    destinationTime: delivery?.start_time ?? "",
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
    const [cdlFront, setCdlFront] = useState<string | null>(null);
    const [cdlBack, setCdlBack] = useState<string | null>(null);

    const scaleAnim = useRef(new Animated.Value(0)).current;

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

    const fetchCompleteProfileData = async () => {
        try {
            const res = await driverApi.getCompleteProfile();
            const profileData = res.data?.data?.driver_profile as any;
            
            if (res.ok && profileData) {
                if (!isUploading && profileData.profile_picture_url) {
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

                setCdlFront(
                    cdlUrl(profileData.cdl_front_image, profileData.cdl_front_path),
                );
                setCdlBack(
                    cdlUrl(profileData.cdl_back_image, profileData.cdl_back_path),
                );
            }
        } catch (error) {
            console.log("Could not fetch complete profile data", error);
        }
    };

    useEffect(() => {
        fetchCompleteProfileData();
    }, []);

    const handleLogout = async () => {
        await logout();
    };

    const handlePhotoSelected = async (uri: string) => {
        setPickerVisible(false);

        try {
            setIsUploading(true);
            
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
            fetchCompleteProfileData(); 
            
        } catch (error) {
            Alert.alert("Error", "Something went wrong while uploading your photo.");
            fetchCompleteProfileData();
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <SafeAreaView
            edges={["top"]}
            style={[styles.screen, { backgroundColor: theme.card }]}>
            <StatusBar backgroundColor={theme.card} barStyle="dark-content" />
            <View style={[styles.inner, { backgroundColor: theme.background }]}>
                <AppHeader appName="DollarTraq" onNotificationPress={() => {}} />

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}>
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
                            name={fullName}
                            role={role}
                            company=""
                            avatarUri={avatarUri}
                            verified={true}
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
                                    <TileCard
                                        icon={<MaterialCommunityIcons name={left.icon} size={20} color={theme.primaryButton} />}
                                        title={left.title}
                                        badge={left.badge}
                                        onPress={() => {
                                            if (left.id === "personal") router.push("/profile/personal-info" as any);
                                            if (left.id === "equipment") router.push("/profile/my-equipment" as any);
                                            if (left.id === "license") setCdlViewerVisible(true);
                                        }}
                                    />
                                    {right ? (
                                        <TileCard
                                            icon={<MaterialCommunityIcons name={right.icon} size={22} color={theme.primaryButton} />}
                                            title={right.title}
                                            badge={right.badge}
                                            onPress={() => {
                                                if (right.id === "equipment") router.push("/profile/my-equipment" as any);
                                                if (right.id === "license") setCdlViewerVisible(true);
                                            }}
                                        />
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

                    <VerificationSectionHeader title="Account Management" />

                    {supportRows.map((row) => (
                        <RowItem
                            key={row.id}
                            icon={<MaterialCommunityIcons name={row.icon} size={22} color={theme.primaryButton} />}
                            title={row.title}
                            subtitle={row.subtitle}
                            onPress={() => {
                                if (row.id === "logout") handleLogout();
                            }}
                        />
                    ))}

                    {dangerRows.map((row) => (
                        <RowItem
                            key={row.id}
                            icon={<MaterialCommunityIcons name={row.icon} size={22} color={theme.err} />}
                            title={row.title}
                            subtitle={row.subtitle}
                            variant={row.variant}
                            onPress={() => {}}
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
                    frontUri={cdlFront} 
                    backUri={cdlBack} 
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