import type { MaterialCommunityIcons } from "@expo/vector-icons";

/*
| The driver's identity check, as the app shows it.
|
| The API stores Didit's verdict in app_drivers.liveness_status, and the
| broker's control tower reads the same column, so its values cannot change:
| approved, in_review, declined, and two that both mean "not checked yet" —
| skipped (chose to verify later at signup) and pending (the column default on
| older rows). The app folds those two into one "unverified" state.
|
| liveness_verified is checked first: rows created before liveness_status
| existed got "pending" whatever their real result, and a driver who passed
| must not be asked to verify again.
*/

export type LivenessState = "approved" | "in_review" | "declined" | "unverified";

/**
 * What to show for a driver's identity check, or null while nothing is known
 * (render no badge rather than a wrong one).
 */
export function resolveLiveness(
    status?: string | null,
    verified?: boolean | null,
): LivenessState | null {
    if (verified === true) return "approved";

    switch (status) {
        case "approved":
        case "in_review":
        case "declined":
            return status;
    }

    if (status === undefined && (verified === undefined || verified === null)) {
        return null;
    }
    return "unverified";
}

export interface LivenessBadge {
    /** The pill on the profile card. */
    label: string;
    /** The shorter label on the Verification tile. */
    tileLabel: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    color: string;
    bg: string;
    border: string;
    /** Whether tapping the badge does anything (start or re-check the check). */
    actionable: boolean;
}

/*
| Colours are literals on purpose. theme.err is an 8-digit hex, so the usual
| `${color}18` tint would produce an invalid colour from it; the blue comes from
| theme.primaryButton, which is 6-digit in both themes, so tinting it is safe.
*/
export function livenessBadge(state: LivenessState, primaryColor: string): LivenessBadge {
    switch (state) {
        case "approved":
            return {
                label: "ID VERIFIED",
                tileLabel: "VERIFIED",
                icon: "shield-check",
                color: "#22C55E",
                bg: "#22C55E18",
                border: "#22C55E30",
                actionable: false,
            };
        case "in_review":
            return {
                label: "ID IN REVIEW",
                tileLabel: "IN REVIEW",
                icon: "clock-outline",
                color: "#F59E0B",
                bg: "#F59E0B18",
                border: "#F59E0B30",
                actionable: true,
            };
        case "declined":
            return {
                label: "ID DECLINED · RETRY",
                tileLabel: "RETRY",
                icon: "alert-circle-outline",
                color: "#EF4444",
                bg: "#EF444418",
                border: "#EF444430",
                actionable: true,
            };
        case "unverified":
            return {
                label: "VERIFY ID",
                tileLabel: "VERIFY",
                icon: "shield-alert-outline",
                color: primaryColor,
                bg: `${primaryColor}18`,
                border: `${primaryColor}30`,
                actionable: true,
            };
    }
}
