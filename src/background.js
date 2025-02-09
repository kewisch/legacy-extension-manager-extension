/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

browser.runtime.onMessageExternal.addListener((message, sender) => {
  if (message.action == "ping") {
    return "pong";
  } else if (message.action == "updateCommand") {
    return browser.legacyshortcuts.updateCommand(sender.id, {
      name: message.name,
      shortcut: message.shortcut
    });
  } else if (message.action == "updateCommands") {
    return Promise.all(message.commands.map(command => {
      return browser.legacyshortcuts.updateCommand(sender.id, {
        name: command.name,
        shortcut: command.shortcut
      });
    }));
  }
  return undefined;
});
