import AppText from '@/components/AppText';
import { useAppTheme } from '@/hooks/useAppTheme';
import { EvilIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { TripStep } from './types';

interface StepTimelineProps {
  steps: TripStep[];
  activeIndex: number;
}

export default function StepTimeline({ steps, activeIndex }: StepTimelineProps) {
  const theme = useAppTheme();

  return (
    <View style={styles.container}>
      {steps.map((step, index) => {
        const isCompleted = index < activeIndex;
        const isActive = index === activeIndex;
        const isLast = index === steps.length - 1;

        const dotColor = isCompleted || isActive ? theme.primaryButton : theme.secondaryText;
        const lineColor = isCompleted ? theme.primaryButton : theme.secondaryText;

        return (
          <View key={step.id} style={styles.row}>
            <View style={styles.timelineCol}>
              <View style={[styles.dot, { backgroundColor: dotColor, borderColor: dotColor }]}>
                {isCompleted && (
                 <MaterialCommunityIcons name="check" size={12} color="#fff" style={styles.checkMark} ></MaterialCommunityIcons>
                )}
                {isActive && (
                  <EvilIcons name="location" size={14} color="#ffff" />
                )}
              </View>
              {!isLast && (
              <MaterialCommunityIcons name="minus" size={12} color={lineColor} style={[styles.line, { backgroundColor: lineColor }]} />
              )}
            </View>

  
            <View style={styles.textCol}>
              <View style={styles.labelRow}>
                <AppText
                  variant="label"
                  style={[
                    styles.stepLabel,
                    { color: isActive ? theme.text : isCompleted ? theme.text : theme.secondaryText },
                    ...(isActive ? [{ fontWeight: '600' as const }] : []),
                  ]}
                >
                  {step.label}
                </AppText>
                {isActive && (
                  <View style={[styles.activeBadge, { backgroundColor: theme.primaryButton + '18' }]}>
                    <AppText variant="tiny" style={{ color: theme.primaryButton, fontWeight: '600' }}>
                      ACTIVE
                    </AppText>
                  </View>
                )}
              </View>
              <AppText variant="caption" color="secondaryText" style={styles.sublabel}>
                {step.sublabel}
              </AppText>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 52,
  },
  timelineCol: {
    alignItems: 'center',
    width: 28,
    marginRight: 12,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  activeDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  checkMark: {
    width: 8,
    height: 5,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#fff',
    transform: [{ rotate: '-45deg' }, { translateY: -1 }],
  },
  line: {
    width: 2,
    flex: 1,
    minHeight: 24,
    marginTop: 2,
    marginBottom: 2,
  },
  textCol: {
    flex: 1,
    paddingTop: 1,
    paddingBottom: 12,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepLabel: {
    fontSize: 14,
  },
 
  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  sublabel: {
    marginTop: 2,
    fontSize: 12,
  },
});
