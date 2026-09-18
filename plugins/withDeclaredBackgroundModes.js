const { withInfoPlist } = require("@expo/config-plugins");

/*
| Force UIBackgroundModes to exactly what app.json declares.
|
| expo-task-manager's plugin appends "fetch" unconditionally, on the assumption
| that anything using TaskManager might run a background fetch. This app uses
| TaskManager only for location updates and never registers a fetch task, so
| the capability is declared but unused — which App Store review guideline
| 2.5.4 treats as a reason to reject ("apps may only use background services
| for their intended purposes").
|
| Editing app.json alone cannot fix it: that plugin runs afterwards and puts
| "fetch" back. Registered FIRST in the plugins array so its mod runs LAST,
| because config-plugins composes mods in reverse.
|
| Adding a genuine background-fetch feature later means adding "fetch" back to
| app.json, not removing this plugin.
*/
module.exports = function withDeclaredBackgroundModes(config) {
  const declared = config.ios?.infoPlist?.UIBackgroundModes;
  if (!Array.isArray(declared)) return config;

  return withInfoPlist(config, (mod) => {
    mod.modResults.UIBackgroundModes = [...declared];
    return mod;
  });
};
