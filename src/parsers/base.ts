/* eslint-disable @typescript-eslint/no-unused-vars */
import vscode, { TextDocument } from 'vscode';
import { KeyStyle, ParserOptions, KeyInDocument, Config, PendingWrite } from '~/core';
import { File } from '~/utils';
import fs from 'fs';
import path from 'path';

export abstract class Parser {
  abstract readonly id: string;

  private supportedExtsRegex: RegExp;

  readonly readonly: boolean = false;

  constructor(
    public readonly languageIds: string[],
    public readonly supportedExts: string,
    public options: ParserOptions = {
      get indent() {
        return Config.indent;
      },
      get tab() {
        return Config.tabStyle;
      },
    },
  ) {
    this.supportedExtsRegex = new RegExp(`.?(${this.supportedExts})$`);
  }

  supports(ext: string) {
    return !!ext.toLowerCase().match(this.supportedExtsRegex);
  }

  async load(filepath: string): Promise<object> {
    const raw = await File.read(filepath);
    if (!raw) return {};
    return await this.parse(raw);
  }

  async save(
    filepath: string,
    object: object,
    sort: boolean,
    compare: ((x: string, y: string) => number) | undefined,
    pendings: PendingWrite[] = [],
  ) {
    const text = await this.dump(object, sort, compare, pendings);
    await File.write(filepath, text);
  }

  abstract parse(text: string): Promise<object>;

  abstract dump(
    object: object,
    sort: boolean,
    compare: ((x: string, y: string) => number) | undefined,
    pendings: PendingWrite[],
  ): Promise<string>;

  parseAST(text: string): KeyInDocument[] {
    return [];
  }

  navigateToKey(text: string, keypath: string, keystyle: KeyStyle) {
    return this.parseAST(text).find((k) => k.key === keypath);
  }

  annotationSupported = false;
  annotationLanguageIds: string[] = [];
  annotationGetKeys(document: TextDocument) {
    return this.parseAST(document.getText());
  }

  /**
   *  Save to history
   */
  saveToHistory = async (filepath: string, pendings: PendingWrite[]) => {
    const p = path.parse(filepath);
    const basePath = `.vscode/.i18n-ally`;
    const revisionPattern = path.join(`${basePath}/history`, p.name + '.history');
    const revisionPattern2 = path.join(`${basePath}`, '.gitignore');
    const workspaceRoot = this.getWorkspaceRoot(filepath);
    const historyFile = workspaceRoot ? path.join(workspaceRoot, revisionPattern) : revisionPattern;
    const ignoreFile = workspaceRoot ? path.join(workspaceRoot, revisionPattern2) : revisionPattern2;
    if (this.mkDirRecursive(historyFile)) {
      let str = [];
      for (const pending of pendings) {
        const { keypath, value } = pending;
        str.push(`"${keypath}" : ${JSON.stringify(value)},\n`);
      }
      if (str.length == 0) return;
      if (fs.existsSync(historyFile)) {
        // 文件存在，追加内容
        fs.appendFileSync(historyFile, str.join(''));
      } else {
        // 文件不存在，创建文件并写入内容
        fs.writeFileSync(historyFile, str.join(''));
      }
      if (!fs.existsSync(ignoreFile)) {
        fs.writeFileSync(ignoreFile, `*`);
      }
    }
  };

  private mkDirRecursive(fileName: string): boolean {
    try {
      fs.mkdirSync(path.dirname(fileName), { recursive: true });
      // mkdirp.sync(path.dirname(fileName));
      return true;
    } catch (err) {
      vscode.window.showErrorMessage(
        // @ts-ignore
        `Error with mkdir: '${err.toString()}' file '${fileName}`,
      );
      return false;
    }
  }

  private getWorkspaceRoot(filepath: string): string | undefined {
    const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filepath));
    return folder?.uri.fsPath;
  }
}
