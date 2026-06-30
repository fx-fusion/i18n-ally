import { window } from 'vscode';
import { getNodeOrRecord, CommandOptions, getNode } from './common';
import { LocaleTreeItem, ProgressSubmenuItem } from '~/views';
import { Translator, CurrentFile, Config, Global, LocaleNode, AccaptableTranslateItem } from '~/core';
import i18n from '~/i18n';
import { Telemetry, TelemetryKey } from '~/core/Telemetry';

export async function promptForSourceLocale(defaultLocale: string, node?: LocaleNode) {
  const locales = Global.allLocales;
  const placeHolder = i18n.t('prompt.select_source_language_for_translating', defaultLocale);

  const result = await window.showQuickPick(
    locales.map((locale) => ({
      label: locale,
      description: node?.getValue(locale),
    })),
    {
      placeHolder,
    },
  );

  if (result == null) return undefined;

  return result.label || defaultLocale;
}

export async function TranslateKeys(item?: LocaleTreeItem | ProgressSubmenuItem | CommandOptions) {
  let source: string | undefined;
  // console.log('[TranslateKeys-item]', item);

  if (item && !(item instanceof LocaleTreeItem) && !(item instanceof ProgressSubmenuItem) && item.from) {
    source = item.from;
  } else {
    const node = getNode(item);

    source = Config.sourceLanguage;
    if (Config.translatePromptSource) source = await promptForSourceLocale(source, node);

    if (source == null) return;
  }
  Telemetry.track(TelemetryKey.TranslateKey, { actionSource: Telemetry.getActionSource(item) });

  let nodes: AccaptableTranslateItem[] = [];
  let targetLocales: string[] | undefined;

  if (item instanceof ProgressSubmenuItem) {
    const to = item.node.locale;
    nodes = item
      .getKeys()
      .map((key) => CurrentFile.loader.getRecordByKey(key, to, true)!)
      .filter((i) => i);
  } else {
    if (item instanceof LocaleTreeItem) {
      targetLocales = item.listedLocales;

      // if it's a tree node, collect all descendant leaf nodes for translation
      // @ts-ignore
      if (item.node && item.node.type === 'tree') {
        const collect = (n: any): AccaptableTranslateItem[] => {
          const r: AccaptableTranslateItem[] = []
          if (!n) return r
          if (n.type === 'node') {
            r.push(n)
            return r
          }
          if (n.type === 'tree') {
            for (const child of Object.values(n.children || {})) {
              r.push(...collect(child))
            }
          }
          return r
        }

        nodes = collect(item.node)
      }
      else {
        targetLocales = item.listedLocales;
        const node = getNodeOrRecord(item);
        if (node) nodes.push(node);
      }
    } else {
      targetLocales = item?.locales;

      const node = getNodeOrRecord(item);
      if (node) nodes.push(node);
    }
  }

  // @ts-ignore
  Translator.translateNodes(CurrentFile.loader, nodes, source, targetLocales, item?.force ?? true);
}
