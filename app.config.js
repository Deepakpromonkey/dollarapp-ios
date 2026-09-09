/*
| app.json holds the whole configuration; this file exists for the two values
| that cannot be static.
|
| 1. onesignal-expo-plugin writes the `aps-environment` entitlement from its
|    `mode`. "development" points the app at the APNs sandbox, "production" at
|    the live gateway, and a build signed for one will silently receive nothing
|    from the other. Shipping a static "development" to TestFlight or the App
|    Store means push stops working for every driver, with no error anywhere.
|    EAS sets APP_ENV per build profile (see eas.json), so the entitlement now
|    follows the build instead of whatever was last committed.
|
| 2. EXPO_NO_PUSH=1 drops OneSignal's iOS wiring entirely, for running on a
|    device signed with a free Apple ID. Free personal teams cannot provision
|    Push Notifications or App Groups, and Xcode refuses to sign a target that
|    asks for either — so the entitlement and the Notification Service
|    Extension have to be absent, not merely unused. Everything else (maps,
|    camera, OCR, background location) behaves normally; push is the only
|    casualty. This is a local escape hatch: never set it for a build you
|    intend to ship.
*/
const ONESIGNAL_MODE =
  process.env.APP_ENV === "production" ? "production" : "development";

const NO_PUSH = process.env.EXPO_NO_PUSH === "1";

module.exports = ({ config }) => {
  const plugins = (config.plugins ?? []).flatMap((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    if (name !== "onesignal-expo-plugin") return [plugin];
    if (NO_PUSH) return [];
    return [[name, { ...(Array.isArray(plugin) ? plugin[1] : {}), mode: ONESIGNAL_MODE }]];
  });

  const ios = { ...config.ios };
  if (NO_PUSH) {
    /*
    | The background mode is what makes a silent push wake the app. Without the
    | entitlement no push arrives to wake it, and leaving the capability
    | declared invites an "unsupported capability" signing failure on a free
    | team.
    */
    const infoPlist = { ...ios.infoPlist };
    infoPlist.UIBackgroundModes = (infoPlist.UIBackgroundModes ?? []).filter(
      (mode) => mode !== "remote-notification",
    );
    ios.infoPlist = infoPlist;
  }

  if (NO_PUSH) {
    // Prepended, not appended: config-plugins composes mods in reverse, so
    // registering first is what makes this run after expo-notifications has
    // added its own `aps-environment`.
    plugins.unshift(require("./plugins/withoutPushEntitlement"));
  }

  /*
  | Registered first so its mod runs last, overriding the background modes
  | expo-task-manager appends. Uses `ios`, not `config.ios`, so the NO_PUSH
  | filtering above is what it enforces.
  */
  plugins.unshift((c) => require("./plugins/withDeclaredBackgroundModes")({ ...c, ios }));

  return { ...config, ios, plugins };
};
