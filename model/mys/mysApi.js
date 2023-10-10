import cfg from '../../../../lib/config/config.js'
import apiTool from './apiTool.js'
import fetch from 'node-fetch'
import Cfg from '../Cfg.js'
import md5 from 'md5'

let HttpsProxyAgent = ''
export default class MysApi {
  /**
   * @param uid 游戏uid
   * @param cookie 米游社cookie
   * @param option 其他参数
   * @param option.log 是否显示日志
   */
  constructor(uid, cookie, option = {}, game = 'gs', device = '') {
    this.uid = uid
    this.cookie = cookie
    this.isSr = game
    this.server = this.getServer()
    this.apiTool = new apiTool(uid, this.server, game)
    /** 5分钟缓存 */
    this.cacheCd = 300

    this._device = device
    this.device_fp = false
    this.option = {
      log: true,
      ...option
    }
  }

  /* eslint-disable quotes */
  get device() {
    if (!this._device) this._device = `Yz-${md5(this.uid).substring(0, 5)}`
    return this._device
  }

  getUrl(type, data = {}) {
    let urlMap = this.apiTool.getUrlMap({ ...data, deviceId: this.device })
    if (!urlMap[type]) return false

    let { url, query = '', body = '', types = '' } = urlMap[type]

    if (query) url += `?${query}`
    if (body) body = JSON.stringify(body)

    let headers = this.getHeaders(types, query, body)

    return { url, headers, body, types }
  }

  getServer() {
    let uid = this.uid
    switch (String(uid)[0]) {
      case '1':
      case '2':
        return this.isSr == 'sr' ? 'prod_gf_cn' : 'cn_gf01' // 官服
      case '5':
        return this.isSr == 'sr' ? 'prod_qd_cn' : 'cn_qd01' // B服
      case '6':
        return this.isSr == 'sr' ? 'prod_official_usa' : 'os_usa' // 美服
      case '7':
        return this.isSr == 'sr' ? 'prod_official_euro' : 'os_euro' // 欧服
      case '8':
        return this.isSr == 'sr' ? 'prod_official_asia' : 'os_asia' // 亚服
      case '9':
        return this.isSr == 'sr' ? 'prod_official_cht' : 'os_cht' // 港澳台服
    }
    return this.isSr == 'sr' ? 'prod_gf_cn' : 'cn_gf01'
  }

  async getData(type, data = {}, cached = false) {
    if (type == 'getFp') data = { seed_id: this.generateSeed(16) }
    let { url, headers, body, types } = this.getUrl(type, data)

    if (!url) return false

    let cacheKey = this.cacheKey(type, data)
    let cahce = await redis.get(cacheKey)
    if (cahce) return JSON.parse(cahce)

    if (data.headers && types != 'noheader') {
      headers = { ...headers, ...data.headers }
      delete data.headers
    }

    let param = {
      headers,
      agent: await this.getAgent(),
      timeout: 10000
    }
    if (body) {
      param.method = 'post'
      param.body = body
    } else {
      param.method = 'get'
    }
    let response = {}
    let start = Date.now()
    try {
      response = await fetch(url, param)
    } catch (error) {
      logger.error(error.toString())
      return false
    }

    if (!response.ok) {
      logger.error(`[米游社接口][${type}][${this.uid}] ${response.status} ${response.statusText}`)
      return false
    }
    if (this.option.log) {
      logger.mark(`[米游社接口][${type}][${this.uid}] ${Date.now() - start}ms`)
    }
    let res = await response.json()

    if (!res) {
      logger.mark('mys接口没有返回')
      return false
    }

    if (res.retcode !== 0 && this.option.log) {
      logger.debug(`[米游社接口][请求参数] ${url} ${JSON.stringify(param)}`)
    }

    res.api = type

    if (cached) this.cache(res, cacheKey)

    return res
  }

  static async getvali(mysapi, type, data = {}) {
    let vali = new MysApi(mysapi.uid, mysapi.cookie, mysapi.option, mysapi.isSr ? 'sr' : 'gs')
    
    let api = Cfg.getConfig('api')
    if (!api.api || !(api.token || api.query))
      return { "data": null, "message": `未正确填写配置文件`, "retcode": 1034 }

    let res
    try {
      res = await vali.getData(type, data)
      if (res?.retcode == 0 || (type == 'detail' && res?.retcode == -1002)) return res

      let headers = {
        'x-rpc-device_fp': data?.headers?.['x-rpc-device_fp'] || (await vali.getData('getFp')).data?.device_fp
      }
      if (vali.game == 'sr')
        headers['x-rpc-challenge_game'] = '6'

      res = await vali.getData("createVerification", { headers })
      if (!res?.retcode == 0) return { "data": null, "message": "未知错误，可能为cookie失效", "retcode": res?.retcode || 1034 }

      res = await vali.getData(`validate`, res?.data)

      if (!res?.data?.validate)
        return { "data": null, "message": `验证码失败`, "retcode": 1034 }

      res = await vali.getData("verifyVerification", {
        ...res?.data,
        headers
      })

      if (res?.data?.challenge) {
        if (data?.headers) {
          headers = { ...data.headers, ...headers }
          delete data.headers
        }

        res = await vali.getData(type, {
          ...data,
          headers: {
            "x-rpc-challenge": res?.data?.challenge,
            ...headers
          }
        })
      }
      if (res?.retcode !== 0)
        return { "data": null, "message": "", "retcode": 1034 }

    } catch (error) {
      logger.error(error)
      return { "data": null, "message": "出错了", "retcode": 1034 }
    }
    return res
  }

  getHeaders(types, query = '', body = '') {
    const cn = {
      app_version: '2.40.1',
      User_Agent: `Mozilla/5.0 (Linux; Android 12; ${this.device}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.73 Mobile Safari/537.36 miHoYoBBS/2.40.1`,
      client_type: 5,
      Origin: 'https://webstatic.mihoyo.com',
      X_Requested_With: 'com.mihoyo.hyperion',
      Referer: 'https://webstatic.mihoyo.com'
    }
    const os = {
      app_version: '2.9.0',
      User_Agent: `Mozilla/5.0 (Linux; Android 12; ${this.device}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.73 Mobile Safari/537.36 miHoYoBBSOversea/2.9.0`,
      client_type: '2',
      Origin: 'https://webstatic-sea.hoyolab.com',
      X_Requested_With: 'com.mihoyo.hoyolab',
      Referer: 'https://webstatic-sea.hoyolab.com'
    }
    let client
    if (this.server.startsWith('os')) {
      client = os
    } else {
      client = cn
    }

    switch (types) {
      case 'noheader':
        return {}
    }

    return {
      'x-rpc-app_version': client.app_version,
      'x-rpc-client_type': client.client_type,
      'User-Agent': client.User_Agent,
      'Referer': client.Referer,
      'Cookie': this.cookie,
      DS: this.getDs(query, body)
    }
  }

  getDs(q = '', b = '') {
    let n = ''
    if (['cn_gf01', 'cn_qd01', 'prod_gf_cn', 'prod_qd_cn'].includes(this.server)) {
      n = 'xV8v4Qu54lUKrEYFZkJhB8cuOh9Asafs'
    } else if (/os_|official/.test(this.server)) {
      n = 'okr4obncj8bw5a65hbnn5oo6ixjc3l9w'
    }
    let t = Math.round(new Date().getTime() / 1000)
    let r = Math.floor(Math.random() * 900000 + 100000)
    let DS = md5(`salt=${n}&t=${t}&r=${r}&b=${b}&q=${q}`)
    return `${t},${r},${DS}`
  }

  getGuid() {
    function S4() {
      return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1)
    }

    return (S4() + S4() + '-' + S4() + '-' + S4() + '-' + S4() + '-' + S4() + S4() + S4())
  }

  cacheKey(type, data) {
    return 'Yz:genshin:mys:cache:' + md5(this.uid + type + JSON.stringify(data))
  }

  async cache(res, cacheKey) {
    if (!res || res.retcode !== 0) return
    redis.setEx(cacheKey, this.cacheCd, JSON.stringify(res))
  }

  async getAgent() {
    let proxyAddress = cfg.bot.proxyAddress
    if (!proxyAddress) return null
    if (proxyAddress === 'http://0.0.0.0:0') return null

    if (!this.server.startsWith('os')) return null

    if (HttpsProxyAgent === '') {
      HttpsProxyAgent = await import('https-proxy-agent').catch((err) => {
        logger.error(err)
      })

      HttpsProxyAgent = HttpsProxyAgent ? HttpsProxyAgent.HttpsProxyAgent : undefined
    }

    if (HttpsProxyAgent) {
      return new HttpsProxyAgent(proxyAddress)
    }

    return null
  }

  generateSeed(length = 16) {
    const characters = '0123456789abcdef'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += characters[Math.floor(Math.random() * characters.length)]
    }
    return result
  }
}

