import MysApi from './mys/mysApi.js'
import Cfg from './Cfg.js'

export default class LoveMys {
  async getvali (e, mysapi, type, data = {}) {
    let res
    try {
      res = await mysapi.getData(type, data)
      if (res?.retcode == 0 || (type == 'detail' && res?.retcode == -1002)) return res

      if (mysapi.option) {
        mysapi.option = {
          ...mysapi.option,
          devicefp: data?.headers?.['x-rpc-device_fp'] || ''
        }
      } else {
        mysapi.option = {
          devicefp: data?.headers?.['x-rpc-device_fp'] || ''
        }
      }

      res = await this.geetest(e, mysapi)
      if (!res?.data?.challenge) {
        return { data: null, message: '验证码失败', retcode: 1034 }
      }

      data.headers = {
        ...data.headers,
        'x-rpc-challenge': res?.data?.challenge,
        'x-rpc-device_fp': res?.devicefp
      }
      res = await mysapi.getData(type, data)

      if (!(res?.retcode == 0 || (type == 'detail' && res?.retcode == -1002))) {
        return { data: null, message: '验证码失败', retcode: 1034 }
      }
    } catch (error) {
      logger.error(error)
      return { data: null, message: '出错了', retcode: 1034 }
    }
    return res
  }

  async geetest (e, data) {
    let res
    let { uid, cookie, game } = data
    let vali = new MysApi(uid, cookie, game, data.option || {}, data.device || '')

    try {
      let devicefp = data?.option?.devicefp || (await vali.getData('getFp')).data?.device_fp
      let headers = {
        'x-rpc-device_fp': devicefp
      }
      if (game == 'sr') headers['x-rpc-challenge_game'] = '6'

      res = await vali.getData('createVerification', { headers })
      if (!res || res?.retcode !== 0) {
        return { data: null, message: '未知错误，可能为cookie失效', retcode: res?.retcode || 1034 }
      }
      let gt = res?.data?.gt
      let challenge = res?.data?.challenge

      let GtestType = Cfg.getConfig('api')
      if ([2, 1].includes(GtestType)) res = await vali.getData('validate', res?.data)
      if ([2, 0].includes(GtestType)) res = await this.Manual_geetest(e, res?.data)

      if (!res?.data?.validate) return { data: null, message: '验证码失败', retcode: 1034 }

      res = await vali.getData('verifyVerification', {
        gt: res?.data?.gt || gt,
        challenge: res?.data?.challenge || challenge,
        validate: res?.data?.validate,
        headers
      })

      if (res?.data?.challenge) return { ...res, devicefp }
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
      if (validate?.data) return validate.data

      await new Promise((resolve) => setTimeout(resolve, 1500))
    }
    return false
  }
}
