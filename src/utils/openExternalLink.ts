import * as WebBrowser from "expo-web-browser";
import { Alert, Linking } from "react-native";

/*
| Open a web page without leaving the app.
|
| A Chrome Custom Tab (Safari view on iOS) keeps the driver one Back press away
| from the app. A phone with no browser that supports one falls back to
| whatever opens links, and only if nothing can is the driver shown the
| address to type in themselves.
*/
export async function openExternalLink(
    url: string,
    colors?: { toolbar?: string; controls?: string },
): Promise<void> {
    try {
        await WebBrowser.openBrowserAsync(url, {
            toolbarColor: colors?.toolbar,
            controlsColor: colors?.controls,
            showTitle: true,
            enableBarCollapsing: true,
            // iOS: the Safari view's corner button reads "Close" rather than "Done".
            dismissButtonStyle: "close",
        });
        return;
    } catch (err) {
        console.warn("[openExternalLink] In-app browser failed:", err);
    }

    try {
        await Linking.openURL(url);
    } catch {
        Alert.alert("Couldn't open the page", `Please visit ${url} in your browser.`);
    }
}
