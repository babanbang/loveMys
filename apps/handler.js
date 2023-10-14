import plugin from '../../../lib/plugins/plugin.js'
import Cfg from '../model/Cfg.js'
import LoveMys from '../model/loveMys.js'

let loveMys = new LoveMys()

export class update extends plugin {
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
    this.typeName = 'loveMys-plugin'
  }

  // 接受的参数
  async mysReqErrHandler (e, args, reject) {
    let { mysApi, type, data, res } = args
    if (res.retcode !== 1034) {
      // 暂时只处理1034情况
      return reject()
    }

    let apiCfg = Cfg.getConfig('api')
    if (!apiCfg.api || !(apiCfg.token || apiCfg.query)) {
      return reject('loveMys: 未正确填写配置文件')
    }

    // 调用过码
    return await loveMys.getvali(mysApi, type, data, gtest)
  }
}
