import MysApi from './mys/mysApi.js'
import Cfg from './Cfg.js'

export default class LoveMys {
  async getvali (mysapi, type, data = {}, gtest = false) {
    let api = Cfg.getConfig('api')
    if (!api.api || !(api.token || api.query)) {
      return { data: null, message: '未正确填写配置文件', retcode: 1034 }
    }

    let res
    try {
      if (gtest) {
        res = await mysapi.getData(type, data)
        if (res?.retcode == 0 || (type == 'detail' && res?.retcode == -1002)) return res
      }

      let option = {
        ...mysapi.option,
        devicefp: data?.headers?.['x-rpc-device_fp'] || ''
      }

      res = await this.geetest(mysapi.uid, mysapi.cookie, option, mysapi.isSr ? 'sr' : 'gs')
      if (!res || res?.retcode !== 0 || !res?.data?.challenge) {
        return { data: null, message: '验证码失败', retcode: 1034 }
      }

      data.headers = {
        ...data.headers,
        'x-rpc-challenge': res?.data?.challenge,
        'x-rpc-device_fp': res?.devicefp
      }
      res = await mysapi.getData(type, data)

      if (!(res?.retcode == 0 || (type == 'detail' && res?.retcode == -1002))) {
        return { data: null, message: '', retcode: 1034 }
      }
    } catch (error) {
      logger.error(error)
      return { data: null, message: '出错了', retcode: 1034 }
    }
    return res
  }

  async geetest (uid, cookie, option = {}, game = 'gs', device = '') {
    let res
    let vali = new MysApi(uid, cookie, option, game, device)

    try {
      let devicefp = option.devicefp || (await vali.getData('getFp')).data?.device_fp
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

      res = await vali.getData('validate', res?.data)

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
}
