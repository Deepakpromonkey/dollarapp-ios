const { withEntitlementsPlist } = require("@expo/config-plugins");

/*
| Remove the push entitlement so a free Apple ID can sign the app.
|
| Dropping onesignal-expo-plugin is not enough: expo-notifications adds
| `aps-environment` on its own, and Xcode refuses to sign for a personal team
| with an entitlement that team cannot be granted. The local notifications this
| app actually uses — the location-off alerts in utils/localNotifications — are
| scheduled on-device and need no entitlement at all, so nothing that works
| today stops working.
|
| Registered FIRST in the plugins array on purpose. config-plugins composes
| mods in reverse, so the plugin registered earliest is the one whose mod runs
| last — which is what lets this delete an entitlement a later plugin added.
*/
module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (mod) => {
    delete mod.modResults["aps-environment"];
    delete mod.modResults["com.apple.security.application-groups"];
    return mod;
  });
};
