import AppText from "@/components/AppText";
import { LiveCamera, type CaptureResult } from "@/components/LiveCamera";
import { shrinkPhoto } from "@/utils/photos";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/*
| Photos are taken with our own camera, inside the app.
|
| The phone's camera app came back empty-handed too easily: after the shot it
| shows a review screen, and a driver who swiped back instead of confirming
| discarded the photo without being told. This stays in the app, takes the
| photo on one tap, and stamps it with time and place like the delivery form's
| camera already does.
*/

interface Props {
  visible: boolean;
  /** Shown over the viewfinder, e.g. "Proof of delivery". */
  title: string;
  onCaptured: (photo: CaptureResult) => void;
  onClose: () => void;
}

export default function PhotoCaptureModal({ visible, title, onCaptured, onClose }: Props) {
  /*
  | Shrinking a full-size shot takes a second or two on a low-end phone, and
  | the shutter is live again as soon as the picture is taken. While a photo
  | is being saved further taps are ignored and the screen says so; a result
  | that arrives after the camera was closed (or reopened) is dropped, so a
  | late shot can never land on the wrong question or close a newer camera.
  */
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const opening = useRef(0);

  // Opening or closing starts afresh: reset while rendering, the refs in the effect below.
  const [shownVisible, setShownVisible] = useState(visible);
  if (shownVisible !== visible) {
    setShownVisible(visible);
    setSaving(false);
  }

  useEffect(() => {
    opening.current += 1;
    savingRef.current = false;
  }, [visible]);

  const handleCapture = async (result: CaptureResult) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);

    const mine = opening.current;
    const uri = await shrinkPhoto(result.uri);
    if (opening.current !== mine) return;

    savingRef.current = false;
    setSaving(false);
    onCaptured({ ...result, uri });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.modal}>
        {visible && (
          <LiveCamera
            accessLevel="full"
            onCapture={handleCapture}
            onClose={onClose}
            showFlip
            showCapture
            style={styles.camera}
          />
        )}

        {/* Lets touches through, so it never sits on top of the camera's close button. */}
        <SafeAreaView edges={["top"]} pointerEvents="none" style={styles.header}>
          <AppText variant="label" style={styles.title}>
            {title}
          </AppText>
        </SafeAreaView>

        {saving && (
          <View style={styles.saving}>
            <ActivityIndicator color="#FFFFFF" />
            <AppText variant="label1" style={styles.savingText}>
              Saving photo…
            </AppText>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: "#000" },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingTop: 72,
    paddingHorizontal: 16,
  },
  title: {
    color: "#FFFFFF",
    backgroundColor: "rgba(0,0,0,0.5)",
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    fontWeight: "700",
    overflow: "hidden",
  },
  camera: { flex: 1 },
  saving: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  savingText: { color: "#FFFFFF", fontWeight: "600" },
});
