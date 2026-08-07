import AppButton from '@/components/AppButton';
import AppText from '@/components/AppText';
import { useAppTheme } from '@/hooks/useAppTheme';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

interface VerificationStepProps {
  onComplete: () => void;
}

export default function VerificationStep({ onComplete }: VerificationStepProps) {
  const theme = useAppTheme();

  const handleOpenForm = () => {
    router.push('/trip/verification-form');
   
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.card }]}>
      <View style={styles.header}>
        <AppText variant="label" style={styles.title}> Verification Required</AppText>
        <AppText variant="caption" color="secondaryText">
          VIN number · 6 trailer photos · 4 truck photos
        </AppText>
      </View>

      <View style={styles.row}>
        <AppButton
          title="Start Verification "
          onPress={handleOpenForm}
          style={styles.button}
        />
        <AppButton
          title="Mark Done"
          onPress={onComplete}
          variant="secondary"
          style={styles.smallButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  header: {
    gap: 4,
  },
  title: {
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
  },
  smallButton: {
    paddingHorizontal: 12,
  },
});
