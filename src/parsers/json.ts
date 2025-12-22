import type * as JSONCType from 'jsonc-parser'
const JSONC: typeof JSONCType = require('jsonc-parser')
import SortedStringify from 'json-stable-stringify'
// @ts-ignore
import JsonMap from 'json-source-map'
import { Parser } from './base'
import { KeyStyle, PendingWrite } from '~/core'
import { File } from '~/utils'

export class JsonParser extends Parser {
  id = 'json'

  constructor() {
    super(['json'], 'json')
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

    let text = File.readSync(filepath);
    const updates: { path: (string | number)[]; value: any }[] = [];
    for (const pending of pendings) {
      const { keypath, value } = pending
      updates.push({
        path: keypath.split('.'),
        value: value
      })
      text = JSONC.applyEdits(text, JSONC.modify(text, keypath.split('.'), value, {
        formattingOptions: {
          tabSize: 2,
          insertSpaces: true,
          eol: '\n'
        }
      }))
    }
    await File.writeSync(filepath, text)
  }

  async dump(object: object, sort: boolean, compare: ((x: string, y: string) => number) | undefined) {
    const indent = this.options.tab === '\t' ? this.options.tab : this.options.indent

    if (sort)
      return `${SortedStringify(object, { space: indent, cmp: compare ? (a, b) => compare(a.key, b.key) : undefined })}\n`
    else
      return `${JSON.stringify(object, null, indent)}\n`
  }

  annotationSupported = true
  annotationLanguageIds = ['json']

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

  parseAST(text: string) {
    if (!text || !text.trim())
      return []

    const map = JsonMap.parse(text).pointers
    const pairs = Object.entries<any>(map)
      .filter(([k, v]) => k)
      .map(([k, v]) => ({
        quoted: true,
        start: v.value.pos + 1,
        end: v.valueEnd.pos - 1,
        // https://tools.ietf.org/html/rfc6901
        key: k.slice(1)
          .replace(/\//g, '.')
          .replace(/~0/g, '~')
          .replace(/~1/g, '/'),
      }))

    return pairs
  }
}
