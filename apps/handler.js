import plugin from '../../../lib/plugins/plugin.js'
import LoveMys from '../model/loveMys.js'
import Cfg from '../model/Cfg.js'

let loveMys = new LoveMys()

export class loveMysHandler extends plugin {
  constructor () {
    super({
      name: 'mys请求错误处理',
      priority: 1,
      namespace: 'loveMys',
      handler: [{
        key: 'mys.req.err',
        fn: 'mysReqErrHandler'
      }]
    })
  }

  /**
   * @param {{uid, cookie, game, option?: {log?, devicefp?}, device?}} args.mysApi
   * @param args.OnlyGtest 是否仅调用过码
   */
  async mysReqErrHandler (e, args, reject) {
    let { mysApi, res } = args

    // 仅调用过码(供其他插件使用)
    if (args.OnlyGtest) {
      let { uid, cookie, game } = mysApi
      return loveMys.geetest(uid, cookie, game, mysApi.option || {}, mysApi.device || '')
    }

    if (res.retcode !== 1034) {
      // 暂时只处理1034情况
      return reject()
    }

    let apiCfg = Cfg.getConfig('api')
    if (!apiCfg.api || !(apiCfg.token || apiCfg.query)) {
      return reject('loveMys: 未正确填写配置文件')
    }

    // 本体过码
    return await loveMys.getvali(mysApi, args.type, args.data)
  }
}
