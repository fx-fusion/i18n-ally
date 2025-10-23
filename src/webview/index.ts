import { commands, window } from 'vscode'
import { EXT_EDITOR_VIEW_ID } from '~/meta'
import type { ExtensionModule } from '~/modules'
import { SidebarEditorProvider } from './sidebar'

export let sidebarProviderInstance: SidebarEditorProvider | undefined
let pendingOpen: { keypath: string; locale?: string; index?: number } | undefined

export async function focusSidebarView(preserveFocus = false) {
  // Focus the specific view; VS Code provides a <viewId>.focus command
  await commands.executeCommand(`${EXT_EDITOR_VIEW_ID}.focus`)
}

export async function openInSidebar(keypath?: string, locale?: string, index?: number) {
  await focusSidebarView()
  if (keypath) {
    if (sidebarProviderInstance)
      sidebarProviderInstance.openKey(keypath, locale, index)
    else
      pendingOpen = { keypath, locale, index }
  }
}

const m: ExtensionModule = (ctx) => {
  const provider = new SidebarEditorProvider(ctx)
  sidebarProviderInstance = provider
  const disposable = window.registerWebviewViewProvider(EXT_EDITOR_VIEW_ID, provider, {
    webviewOptions: {
      retainContextWhenHidden: true,
    },
  })
  // When view resolves later, consume any pending open
  provider.onViewResolved(() => {
    if (pendingOpen) {
      const { keypath, locale, index } = pendingOpen
      pendingOpen = undefined
      provider.openKey(keypath, locale, index)
    }
  })
  return disposable
}

export default m
