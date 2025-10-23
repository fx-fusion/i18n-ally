import path from 'path'
import fs from 'fs'
import { Disposable, ExtensionContext, WebviewView, WebviewViewProvider, Uri, ViewColumn, window, workspace, Selection, TextEditorRevealType, EventEmitter } from 'vscode'
import { EXT_EDITOR_VIEW_ID } from '~/meta'
import { Protocol } from '~/protocol'
import { CurrentFile, Global, KeyInDocument, KeyDetector, Config, Telemetry, TelemetryKey, ActionSource } from '~/core'

export class SidebarEditorProvider implements WebviewViewProvider {
  public static readonly viewType = EXT_EDITOR_VIEW_ID
  private _view?: WebviewView
  private _protocol?: Protocol
  private _disposables: Disposable[] = []
  private _editing_key: string | undefined
  private _ctx: ExtensionContext
  private _mode: 'standalone' | 'currentFile' = 'currentFile'
  private _onResolved = new EventEmitter<void>()

  constructor(ctx: ExtensionContext) {
    this._ctx = ctx
  }

  get mode() {
    return this._mode
  }

  set mode(v) {
    if (this._mode !== v)
      this._mode = v
  }

  resolveWebviewView(webviewView: WebviewView): void | Thenable<void> {
    this._view = webviewView

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        Uri.file(path.join(this._ctx.extensionPath, 'res')),
      ],
    }

    this._protocol = new Protocol(
      async(message) => {
        if (!this._view)
          return
        if (message.type === 'switch-to')
          this.openKey(message.keypath!)
        else
          this._view.webview.postMessage(message)
      },
      async(message) => {
        switch (message.type) {
          case 'webview.refresh':
            this.init()
            break
          case 'navigate-key':
            this.navigateKey(message.data)
            break
        }
        return undefined
      },
      {
        get extendConfig() {
          return {
            extensionRoot: webviewView.webview.asWebviewUri(Uri.file(Config.extensionPath!)).toString(),
          }
        },
      },
    )

    webviewView.onDidDispose(() => this.dispose(), null, this._disposables)

    webviewView.webview.onDidReceiveMessage(
      msg => this._protocol?.handleMessages(msg),
      null,
      this._disposables,
    )

    CurrentFile.loader.onDidChange(
      () => {
        if (this._editing_key)
          this.openKey(this._editing_key)
      },
      null,
      this._disposables,
    )

    workspace.onDidChangeConfiguration(
      () => this._protocol?.updateConfig(),
      null,
      this._disposables,
    )

    Global.reviews.onDidChange(
      (keypath?: string) => {
        if (this._editing_key && (!keypath || this._editing_key === keypath))
          this.openKey(this._editing_key)
      },
      null,
      this._disposables,
    )

    // keep context in sync with current editor
    this._disposables.push(
      workspace.onDidSaveTextDocument(() => this.sendCurrentFileContext()),
      window.onDidChangeActiveTextEditor(() => this.sendCurrentFileContext()),
    )

    this.init()
    this._onResolved.fire()
  }

  init() {
    if (!this._view)
      return
    this._view.webview.html = fs.readFileSync(
      path.join(this._ctx.extensionPath, 'dist/editor/index.html'),
      'utf-8',
    )
    this._protocol?.updateI18nMessages()
    // populate current file context by default
    this.sendCurrentFileContext()
  }

  public setContext(context: { filepath?: string; keys?: KeyInDocument[] } = {}) {
    this._protocol?.postMessage({
      type: 'context',
      data: context,
    })
  }

  public sendCurrentFileContext() {
    if (this.mode === 'standalone')
      this.setContext({})

    const doc = window.activeTextEditor?.document

    if (!doc || !Global.isLanguageIdSupported(doc.languageId))
      return false

    let keys = KeyDetector.getKeys(doc) || []
    if (!keys.length)
      return false

    keys = keys.map(k => ({
      ...k,
      value: CurrentFile.loader.getValueByKey(k.key),
    }))

    const context = {
      filepath: doc.uri.fsPath,
      keys,
    }

    this.setContext(context)
    return true
  }

  public openKey(keypath: string, locale?: string, index?: number) {
    const node = CurrentFile.loader.getNodeByKey(keypath, true)
    if (node) {
      this._editing_key = keypath
      this._protocol?.postMessage({
        type: 'route',
        route: 'open-key',
        data: {
          locale,
          keypath,
          records: CurrentFile.loader.getShadowLocales(node),
          reviews: Global.reviews.getReviews(keypath),
          keyIndex: index,
        },
      })
      this.sendCurrentFileContext()
    }
  }

  async navigateKey(data: KeyInDocument & { filepath: string; keyIndex: number }) {
    Telemetry.track(TelemetryKey.GoToKey, { source: ActionSource.UiEditor })

    if (!data.filepath)
      return

    this.openKey(data.key, undefined, data.keyIndex)
    const doc = await workspace.openTextDocument(Uri.file(data.filepath))
    const editor = await window.showTextDocument(doc, ViewColumn.One)
    editor.selection = new Selection(
      doc.positionAt(data.end),
      doc.positionAt(data.start),
    )
    editor.revealRange(editor.selection, TextEditorRevealType.InCenter)
  }

  public dispose() {
    Disposable.from(...this._disposables).dispose()
  }

  public onViewResolved(listener: () => any) {
    return this._onResolved.event(listener)
  }
}
