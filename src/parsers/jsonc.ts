import type * as JSONCType from 'jsonc-parser'
const JSONC: typeof JSONCType = require('jsonc-parser')
import { File } from '~/utils'
import { Parser } from './base'
import { KeyStyle, PendingWrite } from '~/core'

export class JsoncParser extends Parser {
  id = 'jsonc'

  constructor() {
    super(['jsonc'], 'jsonc')
  }

  async parse(text: string) {
    if (!text || !text.trim())
      return {}
    try {
      return JSONC.parse(text)
    } catch (e) {
      return JSON.parse(text)
    }
  }

  async save(filepath: string, object: object, sort: boolean, compare: ((x: string, y: string) => number) | undefined, pendings: PendingWrite[] = []) {
    // 将修改保存到历史记录中
    await this.saveToHistory(filepath, pendings);

    let text = File.readSync(filepath)
    const updates: { path: (string | number)[]; value: any }[] = []
    for (const pending of pendings) {
      const { keypath, value } = pending
      updates.push({
        path: keypath.split('.'),
        value: value,
      })
      text = JSONC.applyEdits(text, JSONC.modify(text, keypath.split('.'), value, {}))
    }
    await File.writeSync(filepath, text)
  }

  async dump(object: object) {
    return JSON.stringify(object)
  }

  navigateToKey(text: string, keypath: string, keystyle: KeyStyle) {
    const keys = keystyle === 'flat'
      ? [keypath]
      : keypath.split('.')

    // build regex to search key
    let regexString = keys
      .map((key, i) => `^[ \\t]{${(i + 1) * this.options.indent}}"?${key}"?: ?`)
      .join('[\\s\\S]*')
    regexString += '(?:"?(.*)"?|({))'
    const regex = new RegExp(regexString, 'gm')

    const match = regex.exec(text)
    if (match && match.length >= 2) {
      const end = match.index + match[0].length - 1
      const value = match[1] || match[2]
      const start = end - value.length
      return { start, end, key: keypath, quoted: true }
    }
    else {
      return undefined
    }
  }

}
