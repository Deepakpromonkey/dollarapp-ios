import AppButton from '@/components/AppButton';
import AppText from '@/components/AppText';
import SectionHeader from '@/components/SectionHeader';
import { useAppTheme } from '@/hooks/useAppTheme';
import { Alert, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';



interface CircularProgressProps {
    percent: number;
    label: string;
    sublabel: string;
    size?: number;
    strokeWidth?: number;
}

function CircularProgress({
    percent,
    label,
    sublabel,
    size = 100,
    strokeWidth = 5,
}: CircularProgressProps) {
    const theme = useAppTheme();
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = circumference * (1 - percent / 100);

    return (
        <View style={styles.circularWrapper}>
            <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>

                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={theme.cardSecondary}
                    strokeWidth={strokeWidth}
                    fill="none"
                />

                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={theme.primaryButton}
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={progress}
                    strokeLinecap="round"
                />
            </Svg>


            <View style={[styles.circularCenter, { width: size, height: size }]}>
                <AppText variant="label" style={{ color: theme.text, fontWeight: '700' }}>
                    {percent}%
                </AppText>
            </View>


            <AppText variant="label1" style={{ color: theme.text, marginTop: 10 }}>
                {label}
            </AppText>
            <AppText variant="tiny" style={{ color: theme.secondaryText, letterSpacing: 0.8, marginTop: 2 }}>
                {sublabel}
            </AppText>
        </View>
    );
}



interface BarRowProps {
    label: string;
    value: string;
    percent: number; // 0–100
    barColor: string;
    valueColor?: string;
}

function BarRow({ label, value, percent, barColor, valueColor }: BarRowProps) {
    const theme = useAppTheme();

    return (
        <View style={styles.barRow}>
            <View style={styles.barHeader}>
                <AppText variant="tiny" style={{ color: theme.secondaryText, letterSpacing: 0.8 }}>
                    {label}
                </AppText>
                <AppText variant="label1" style={{ color: valueColor ?? theme.text }}>
                    {value}
                </AppText>
            </View>

            <View style={[styles.barTrack, { backgroundColor: theme.cardSecondary }]}>
                <View
                    style={[
                        styles.barFill,
                        { width: `${Math.min(percent, 100)}%`, backgroundColor: barColor },
                    ]}
                />
            </View>
        </View>
    );
}


interface HoursOfServiceProps {
    driveLeftLabel?: string;
    driveLeftPercent?: number;
    shiftLeftLabel?: string;
    shiftLeftPercent?: number;
    breakRequiredIn?: string;
    breakPercent?: number;
    cycleLabel?: string;
    cyclePercent?: number;
    compliancePercent?: number;
    onCallDispatch?: () => void;
    onReportDelay?: () => void;
}

export default function HoursOfService({
    driveLeftLabel = '6h 45m',
    driveLeftPercent = 65,
    shiftLeftLabel = '8h 10m',
    shiftLeftPercent = 75,
    breakRequiredIn = '1h 30m',
    breakPercent = 20,
    cycleLabel = '42h 15m',
    cyclePercent = 60,
    compliancePercent = 98,
    onCallDispatch,
    onReportDelay,
}: HoursOfServiceProps) {
    const theme = useAppTheme();

    return (
        <View style={styles.container}>

            <SectionHeader
                label="Hours of Service"
                right={
                    <AppText
                        variant="caption"
                        style={{ color: theme.primaryButton, fontWeight: '700' }}>
                        Compliance: {compliancePercent}%
                    </AppText>
                }
            />


            <View style={styles.gaugesRow}>
                <View style={[styles.gaugeCard, { backgroundColor: theme.cardSecondary }]}>
                    <CircularProgress
                        percent={driveLeftPercent}
                        label={driveLeftLabel}
                        sublabel="DRIVE LEFT"
                    />
                </View>
                <View style={[styles.gaugeCard, { backgroundColor: theme.cardSecondary }]}>
                    <CircularProgress
                        percent={shiftLeftPercent}
                        label={shiftLeftLabel}
                        sublabel="SHIFT LEFT"
                    />
                </View>
            </View>


            <View style={[styles.barCard, { backgroundColor: theme.cardSecondary }]}>
                <BarRow
                    label="BREAK REQUIRED IN"
                    value={breakRequiredIn}
                    percent={breakPercent}
                    barColor="#E53935"
                    valueColor="#E53935"
                />
                <View style={[styles.divider, { backgroundColor: theme.card }]} />
                <BarRow
                    label="CYCLE (70H/8D)"
                    value={cycleLabel}
                    percent={cyclePercent}
                    barColor={theme.primaryButton}
                />
            </View>


            <View style={styles.actionsRow}>
                <AppButton
                    title="Call Dispatch"
                    onPress={onCallDispatch ?? (() => Alert.alert('Call Dispatch'))}
                    variant="primary"
                    style={{ flex: 1, borderRadius: 30 }}
                />
                <AppButton
                    title="Report Delay"
                    onPress={onReportDelay ?? (() => Alert.alert('Report Delay'))}
                    variant="secondary"
                    style={{ flex: 1, borderRadius: 30 }}
                />
            </View>
        </View>
    );
}



const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        gap: 16,
    },


    gaugesRow: {
        flexDirection: 'row',
        gap: 12,
    },
    gaugeCard: {
        flex: 1,
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
    },
    circularWrapper: {
        alignItems: 'center',
    },
    circularCenter: {
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
    },


    barCard: {
        borderRadius: 16,
        padding: 18,
        gap: 14,
    },
    barRow: {
        gap: 8,
    },
    barHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    barTrack: {
        height: 3,
        borderRadius: 4,
        overflow: 'hidden',
    },
    barFill: {
        height: '100%',
        borderRadius: 4,
    },
    divider: {
        height: 1,
    },


    actionsRow: {
        flexDirection: 'row',
        gap: 12,
    },
});
