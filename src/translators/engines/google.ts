import axios from 'axios';
import TranslateEngine, { TranslateOptions, TranslateResult } from './base';
import { Config } from '~/core';
export default class GoogleTranslate extends TranslateEngine {
  link = 'https://translate.google.com';
  apiRoot = 'https://translate.googleapis.com';
  apiRootIfUserSuppliedKey = 'https://translation.googleapis.com';

  async translate(options: TranslateOptions) {
    let { from = 'auto', to = 'auto' } = options;

    const key = Config.googleApiKey;

    if (key) {
      from = this.convertToSupportedLocalesForGoogleCloud(from);
      to = this.convertToSupportedLocalesForGoogleCloud(to);
    }

    const slugs = {
      from: from === 'auto' || !from ? '' : `&source=${from}`,
      to: to === 'auto' || !to ? '' : `&target=${to}`,
    };
    const proxyUrl =
      Config.proxyHost ||
      process.env.ALL_PROXY ||
      process.env.all_proxy ||
      process.env.HTTPS_PROXY ||
      process.env.HTTP_PROXY ||
      process.env.https_proxy ||
      process.env.http_proxy ||
      '';

    const requestConfig: any = {
      method: 'GET',
      url: key
        ? `${this.apiRootIfUserSuppliedKey}/language/translate/v2?key=${key}&q=${encodeURI(options.text)}${slugs.from}${
            slugs.to
          }&alt=json&format=text`
        : `${
            this.apiRoot
          }/translate_a/single?client=gtx&sl=${from}&tl=${to}&hl=zh-CN&dt=t&dt=bd&ie=UTF-8&oe=UTF-8&dj=1&source=icon&q=${encodeURI(
            options.text,
          )}`,
    };

    if (proxyUrl) {
      try {
        const parsed = new (require('url').URL)(proxyUrl);
        const isSocks = parsed.protocol.startsWith('socks');
        if (isSocks) {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const agent = new (require('socks-proxy-agent').SocksProxyAgent)(proxyUrl);
          requestConfig.proxy = false;
          requestConfig.httpAgent = agent;
          requestConfig.httpsAgent = agent;
        }
        else {
          requestConfig.proxy = {
            protocol: parsed.protocol.replace(':', ''),
            host: parsed.hostname,
            port: Number(parsed.port) || (parsed.protocol === 'https:' ? 443 : 80),
          };
          if (parsed.username || parsed.password) {
            requestConfig.proxy.auth = {
              username: decodeURIComponent(parsed.username),
              password: decodeURIComponent(parsed.password),
            };
          }
        }
      } catch (error) {
        console.log('[proxy parse error]', error);
      }
    }

    const { data } = await axios(requestConfig);

    return this.transform(data, options, !!key);
  }

  convertToSupportedLocalesForGoogleCloud(locale: string): string {
    const longSupportedLocales = ['ceb', 'zh-TW', 'haw', 'hmn', 'auto'];
    if (locale && !longSupportedLocales.includes(locale)) locale = locale.substring(0, 2);

    return locale;
  }

  transform(response: any, options: TranslateOptions, apiKeySuppliedByUser: boolean): TranslateResult {
    const { text, to = 'auto' } = options;

    const r: TranslateResult = {
      text,
      to,
      from: response.src,
      response,
      linkToResult: `${this.link}/#auto/${to}/${text}`,
    };

    if (apiKeySuppliedByUser) {
      try {
        const result: string[] = [];
        response.data.translations.forEach((v: any) => {
          result.push(v.translatedText);
        });
        r.result = result;
      } catch (e) {}
    } else {
      // 尝试获取详细释义
      try {
        const detailed: string[] = [];
        response.dict.forEach((v: any) => {
          detailed.push(`${v.pos}：${(v.terms.slice(0, 3) || []).join(',')}`);
        });
        r.detailed = detailed;
      } catch (e) {}

      // 尝试取得翻译结果
      try {
        const result: string[] = [];
        response.sentences.forEach((v: any) => {
          result.push(v.trans);
        });
        r.result = result;
      } catch (e) {}
    }

    if (!r.detailed && !r.result) r.error = new Error('No result');

    return r;
  }
}
