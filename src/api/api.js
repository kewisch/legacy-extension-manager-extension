/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var { ExtensionCommon: { ExtensionAPI } } = ChromeUtils.importESModule("resource://gre/modules/ExtensionCommon.sys.mjs");
var { ShortcutUtils } = ChromeUtils.importESModule("resource://gre/modules/ShortcutUtils.sys.mjs");
var { setTimeout } = ChromeUtils.importESModule("resource://gre/modules/Timer.sys.mjs");

this.legacyshortcuts = class extends ExtensionAPI {
  monitor = {
    monitorName: "legacy-shortcut-manager",
    onTabTitleChanged(tab) {},
    onTabSwitched(tab, oldTab) {},
    onTabClosing(tab) {},
    onTabPersist(tab) {},
    onTabRestored(tab, state, firstTab) {},

    onTabOpened(tab) {
      let self = this;
      var replacement = new Proxy({}, {
        get(target, prop) {
          if (prop == "validate") {
            return self.validate;
          }

          return ShortcutUtils[prop];
        }
      });

      setTimeout(() => {
        if (tab.linkedBrowser.contentDocument.location != "about:addons") {
          return;
        }
        let window = tab.linkedBrowser.contentWindow;
        window.ShortcutUtils = replacement;
        // TODO don't use a timeout
      }, 500);
    },

    /* eslint-disable */
    validate(string, { extensionManifest = false } = {}) {
      // A valid shortcut key for a webextension manifest
      const MEDIA_KEYS =
        /^(MediaNextTrack|MediaPlayPause|MediaPrevTrack|MediaStop)$/;
      const BASIC_KEYS =
        /^([A-Z0-9]|Comma|Period|Home|End|PageUp|PageDown|Space|Insert|Delete|Up|Down|Left|Right)$/;
      // NOTE: only allow F1-F12 keys when validating shortcuts defined in extension manifests,
      // but allow F13-19 to be assigned to user-customized shortcut keys (assigned by users
      // through the about:addons "Manage Shortcuts" view).
      const FUNCTION_KEYS_BASIC = /^(F[1-9]|F1[0-2])$/;
      const FUNCTION_KEYS_EXTENDED = /^(F[1-9]|F1[0-9])$/;
      const FUNCTION_KEYS = extensionManifest
        ? FUNCTION_KEYS_BASIC
        : FUNCTION_KEYS_EXTENDED;

      if (MEDIA_KEYS.test(string.trim())) {
        return this.IS_VALID;
      }

      let modifiers = string.split("+").map(s => s.trim());
      let key = modifiers.pop();

      let chromeModifiers = modifiers.map(
        m => ShortcutUtils.chromeModifierKeyMap[m]
      );
      // If the modifier wasn't found it will be undefined.
      if (chromeModifiers.some(modifier => !modifier)) {
        return this.INVALID_MODIFIER;
      }

      if (
        FUNCTION_KEYS === FUNCTION_KEYS_BASIC &&
        !FUNCTION_KEYS_BASIC.test(key) &&
        FUNCTION_KEYS_EXTENDED.test(key)
      ) {
        return this.INVALID_KEY_IN_EXTENSION_MANIFEST;
      }

      switch (modifiers.length) {
        case 0:
          // A lack of modifiers is only allowed with function keys.
          if (!FUNCTION_KEYS.test(key)) {
            return this.MODIFIER_REQUIRED;
          }
          break;
        case 1:
          // Changed: Allow with one modifier
          break;
        case 2:
          if (chromeModifiers[0] == chromeModifiers[1]) {
            return this.DUPLICATE_MODIFIER;
          }
          break;
        default:
          return this.INVALID_COMBINATION;
      }

      if (!BASIC_KEYS.test(key) && !FUNCTION_KEYS.test(key)) {
        return this.INVALID_KEY;
      }

      return this.IS_VALID;
    }
    /* eslint-enable */
  };


  onStartup() {
    var { ExtensionSupport } = ChromeUtils.import("resource:///modules/ExtensionSupport.jsm");
    ExtensionSupport.registerWindowListener("legacy-shortcut-manager", {
      chromeURLs: ["chrome://messenger/content/messenger.xhtml"],
      onLoadWindow: window => {
        window.tabmail.registerTabMonitor(this.monitor);
      }
    });

    for (let window of ExtensionSupport.openWindows) {
      if (window.location.href != "chrome://messenger/content/messenger.xhtml") {
        continue;
      }

      for (let tab of window.tabmail.tabs) {
        if (tab.linkedBrowser?.contentDocument?.location == "about:addons") {
          this.monitor.onTabOpened(tab);
        }
      }
    }
  }

  onShutdown() {
    var { ExtensionSupport } = ChromeUtils.import("resource:///modules/ExtensionSupport.jsm");
    ExtensionSupport.unregisterWindowListener("legacy-shortcut-manager");

    for (let window of ExtensionSupport.openWindows) {
      if (window.location.href != "chrome://messenger/content/messenger.xhtml") {
        continue;
      }

      window.tabmail.unregisterTabMonitor(this.monitor);
    }
  }

  getAPI(context) {
    return {
      legacyshortcuts: {
        async updateCommand(extensionId, { name, shortcut }) {
          let { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
          let { ExtensionUtils: { ExtensionError } } = ChromeUtils.importESModule("resource://gre/modules/ExtensionUtils.sys.mjs");

          let policy = ExtensionParent.WebExtensionPolicy.getByID(extensionId);
          let shortcuts = policy?.extension?.shortcuts;
          if (shortcuts) {
            shortcuts.updateCommand({ name, shortcut });
          } else {
            throw new ExtensionError("Invalid extension " + extensionId);
          }
        }
      }
    };
  }
};
