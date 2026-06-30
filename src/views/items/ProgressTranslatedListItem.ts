import { ProgressSubmenuItem } from './ProgressSubmenuItem'
import { ProgressRootItem } from './ProgressRootItem'
import { Config } from '~/core';

export class ProgressTranslatedListItem extends ProgressSubmenuItem {
  constructor(protected root: ProgressRootItem) {
    super(root, 'view.progress_submenu.translated_keys', 'checkmark')
  }

  // @ts-expect-error
  get contextValue() {
    const values: string[] = []
    if (this.node.locale !== Config.sourceLanguage)
      values.push('translatable')
    return values.join('-')
  }

  getKeys() {
    return this.root.node.translatedKeys
  }
}
