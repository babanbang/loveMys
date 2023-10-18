import Cfg from '../Cfg.js'

export default class apiTool {
  /**
   * @param uid 用户uid
   * @param server 区服
   * @param game 游戏
   */
  constructor (server) {
    this.server = server
    this.api = Cfg.getConfig('api')
  }

  getUrlMap = (data = {}) => {
    let hostRecord
    if (['cn_gf01', 'cn_qd01', 'prod_gf_cn', 'prod_qd_cn'].includes(this.server)) {
      hostRecord = 'https://api-takumi-record.mihoyo.com/'
    } else if (['os_usa', 'os_euro', 'os_asia', 'os_cht'].includes(this.server)) {
      hostRecord = 'https://bbs-api-os.mihoyo.com/'
    }

    return {
      createVerification: {
        url: `${hostRecord}game_record/app/card/wapi/createVerification`,
        query: 'is_high=true'
      },
      verifyVerification: {
        url: `${hostRecord}game_record/app/card/wapi/verifyVerification`,
        body: {
          geetest_challenge: data.eetest_challenge || data.challenge,
          geetest_validate: data.geetest_validate || data.validate,
          geetest_seccode: data.geetest_seccode || `${data.validate}|jordan`
        }
      },
      validate: {
        url: `${this.api.api}`,
        query: `${this.api.token ? `token=${this.api.token}` : ''}${this.api.query || ''}&gt=${data.gt}&challenge=${data.challenge}`,
        types: 'noheader'
      },
      /** fp参数用于减少验证码 */
      getFp: {
        url: 'https://public-data-api.mihoyo.com/device-fp/api/getFp',
        body: {
          seed_id: data.seed_id,
          device_id: data.deviceId,
          platform: '1',
          seed_time: new Date().getTime() + '',
          ext_fields: '{"proxyStatus":"0","accelerometer":"-0.159515x-0.830887x-0.682495","ramCapacity":"3746","IDFV":"8F4E403B-4C28-4F7F-B740-2DD317948B8A","gyroscope":"-0.191951x-0.112927x0.632637","isJailBreak":"0","model":"iPhone12,5","ramRemain":"115","chargeStatus":"1","networkType":"WIFI","vendor":"--","osVersion":"17.0.2","batteryStatus":"50","screenSize":"414×896","cpuCores":"6","appMemory":"55","romCapacity":"488153","romRemain":"157348","cpuType":"CPU_TYPE_ARM64","magnetometer":"-84.426331x-89.708435x-37.117889"}',
          app_name: 'bbs_cn',
          device_fp: '38d7ee834d1e9'
        }
      }
    }
  }
}
