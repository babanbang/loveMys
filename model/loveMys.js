import MysApi from './mys/mysApi.js'
import fetch from 'node-fetch'
import Cfg from './Cfg.js'

export default class LoveMys {
  async getvali (e, mysApi, type, data = {}) {
    let res
    try {
      res = await mysApi.getData(type, data)
      if (res?.retcode == 0 || (type == 'detail' && res?.retcode == -1002)) return res

      res = await this.geetest(e, mysApi, res?.retcode)
      if (!res?.data?.challenge) {
        return { data: null, message: '验证码失败', retcode: 1034 }
      }

      if (data?.headers) {
        data.headers = {
          ...data.headers,
          'x-rpc-challenge': res?.data?.challenge,
        }
      } else {
        if (!data) data = {}
        data.headers = {
          'x-rpc-challenge': res?.data?.challenge,
        }
      }
      res = await mysApi.getData(type, data)

      if (!(res?.retcode === 0 || (type == 'detail' && res?.retcode === -1002))) {
        return { data: null, message: '验证码失败', retcode: res.retcode || 1034 }
      }
    } catch (error) {
      logger.error(error)
      return { data: null, message: '出错了', retcode: 1034 }
    }
    return res
  }

  async geetest (e, data, retcode = 1034) {
    let res
    let { uid, cookie, game = 'gs', isSr } = data
    if (isSr) game = 'sr'
    let vali = new MysApi(uid, cookie, game, data.option || {}, data._device || '')

    try {
      vali._device_fp = data?._device_fp || await vali.getData('getFp')
      let headers = {}; let app_key = ''
      if (game === 'sr') {
        app_key = 'hkrpg_game_record'
        headers['x-rpc-challenge_game'] = '6'
      }

      res = await vali.getData((retcode === 10035 && game === 'sr') ? 'createGeetest' : 'createVerification', { headers, app_key })
      if (!res || res?.retcode !== 0) {
        return { data: null, message: '未知错误，可能为cookie失效', retcode: res?.retcode || 1034 }
      }

      let GtestType = Cfg.api.GtestType
      if ([2, 1].includes(GtestType)) res = await vali.getData('validate', res?.data)
      if (!res?.data?.validate && [2, 0].includes(GtestType)) {
        if (GtestType === 2) res = await vali.getData((retcode === 10035 && game === 'sr') ? 'createGeetest' : 'createVerification', { headers, app_key })
        res = await this.Manual_geetest(e, res?.data)
      }

      if (!res?.data?.validate && !res?.data?.geetest_validate) {
        return { data: null, message: '验证码失败', retcode: 1034 }
      }

      res = await vali.getData((retcode === 10035 && game === 'sr') ? 'verifyGeetest' : 'verifyVerification', {
        ...res.data,
        app_key,
        headers
      })

      if (res?.data?.challenge) return res
    } catch (error) {
      logger.error(error)
    }
    return { data: null, message: '验证码失败', retcode: 1034 }
  }

  /**
   * @param {{gt, challenge}} data
   */
  async Manual_geetest (e, data) {
    if (!data.gt || !data.challenge || !e?.reply) return false
    let apiCfg = Cfg.getConfig('api')
    if (!apiCfg.verifyAddr || (!apiCfg.startApi && !(apiCfg.Host || apiCfg.Port))) {
      return { data: null, message: '未正确填写配置文件[api.yaml]', retcode: 1034 }
    }

    let res = await fetch(`${apiCfg.verifyAddr}`, {
      method: 'post',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!res.ok) {
      logger.error(`[loveMys][GT-Manual] ${res.status} ${res.statusText}`)
      return false
    }
    res = await res.json()
    if (!res.data) return false

    await e.reply(`请打开地址并完成验证\n${res.data.link}`, true)

    for (let i = 0; i < 80; i++) {
      let validate = await (await fetch(res.data.result)).json()
      if (validate?.data) return validate

      await new Promise((resolve) => setTimeout(resolve, 1500))
    }
    return false
  }
}
