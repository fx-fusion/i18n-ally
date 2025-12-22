import * as vscode from "vscode";

import { HistoryController } from "./historyController";
import HistoryTreeProvider from "./historyTreeProvider";

/**
 * Activate the extension.
 */
export function historyProviderActivate(context: vscode.ExtensionContext) {
  const controller = new HistoryController();

  context.subscriptions.push(
    vscode.commands.registerTextEditorCommand(
      "i18n-ally-local-history.showAll",
      controller.showAll,
      controller
    )
  );
  context.subscriptions.push(
    vscode.commands.registerTextEditorCommand(
      "i18n-ally-local-history.showCurrent",
      controller.showCurrent,
      controller
    )
  );
  context.subscriptions.push(
    vscode.commands.registerTextEditorCommand(
      "i18n-ally-local-history.compareToActive",
      controller.compareToActive,
      controller
    )
  );
  context.subscriptions.push(
    vscode.commands.registerTextEditorCommand(
      "i18n-ally-local-history.compareToCurrent",
      controller.compareToCurrent,
      controller
    )
  );
  context.subscriptions.push(
    vscode.commands.registerTextEditorCommand(
      "i18n-ally-local-history.compareToPrevious",
      controller.compareToPrevious,
      controller
    )
  );

  // Tree
  const treeProvider = new HistoryTreeProvider(controller);
  // vscode.window.registerTreeDataProvider('i18n-ally-treeLocalHistory', treeProvider);
  // vscode.window.registerTreeDataProvider('i18n-ally-treeLocalHistoryExplorer', treeProvider);

  vscode.commands.registerCommand(
    "i18n-ally-treeLocalHistory.deleteAll",
    treeProvider.deleteAll,
    treeProvider
  );
  vscode.commands.registerCommand(
    "i18n-ally-treeLocalHistory.refresh",
    treeProvider.refresh,
    treeProvider
  );
  vscode.commands.registerCommand(
    "i18n-ally-treeLocalHistory.more",
    treeProvider.more,
    treeProvider
  );

  vscode.commands.registerCommand(
    "i18n-ally-treeLocalHistory.forCurrentFile",
    treeProvider.forCurrentFile,
    treeProvider
  );
  vscode.commands.registerCommand(
    "i18n-ally-treeLocalHistory.forAll",
    treeProvider.forAll,
    treeProvider
  );
  vscode.commands.registerCommand(
    "i18n-ally-treeLocalHistory.forSpecificFile",
    treeProvider.forSpecificFile,
    treeProvider
  );

  vscode.commands.registerCommand(
    "i18n-ally-treeLocalHistory.showEntry",
    treeProvider.show,
    treeProvider
  );
  vscode.commands.registerCommand(
    "i18n-ally-treeLocalHistory.showSideEntry",
    treeProvider.showSide,
    treeProvider
  );
  vscode.commands.registerCommand(
    "i18n-ally-treeLocalHistory.deleteEntry",
    treeProvider.delete,
    treeProvider
  );
  vscode.commands.registerCommand(
    "i18n-ally-treeLocalHistory.compareToCurrentEntry",
    treeProvider.compareToCurrent,
    treeProvider
  );
  vscode.commands.registerCommand(
    "i18n-ally-treeLocalHistory.selectEntry",
    treeProvider.select,
    treeProvider
  );
  vscode.commands.registerCommand(
    "i18n-ally-treeLocalHistory.compareEntry",
    treeProvider.compare,
    treeProvider
  );
  // vscode.commands.registerCommand(
  //   "i18n-ally-treeLocalHistory.restoreEntry",
  //   treeProvider.restore,
  //   treeProvider
  // );

  // Create first history before save document
  // vscode.workspace.onWillSaveTextDocument(e =>
  //   e.waitUntil(controller.saveFirstRevision(e.document))
  // );

  // Create history on save document
  // vscode.workspace.onDidSaveTextDocument(document => {
  //   controller.saveRevision(document).then(saveDocument => {
  //     // refresh viewer (if any)
  //     if (saveDocument) {
  //       treeProvider.refresh();
  //     }
  //   });
  // });

  // vscode.window.onDidChangeActiveTextEditor(e =>
  //   treeProvider.changeActiveFile()
  // );

  vscode.workspace.onDidChangeConfiguration(configChangedEvent => {
    if (
      configChangedEvent.affectsConfiguration(
        "i18n-ally.local-history.treeLocation"
      )
    ) {
      treeProvider.initLocation();
    } else if (
      configChangedEvent.affectsConfiguration("i18n-ally.local-history")
    ) {
      controller.clearSettings();
      treeProvider.refresh();
    }
  });

  return treeProvider;
}

// function deactivate() {
// }
