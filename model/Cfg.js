import chokidar from 'chokidar'
import YAML from 'yaml'
import fs from 'node:fs'

/** 配置文件 */
class Cfg {
  constructor () {
    /** 默认设置 */
    this.defSetPath = './plugins/loveMys-plugin/defSet'
    this.defSet = {}

    /** 用户设置 */
    this.configPath = './plugins/loveMys-plugin/config'
    this.config = {}

    /** 监听文件 */
    this.watcher = { config: {}, defSet: {} }
  }

  /** 默认配置 */
  getdefSet (app) {
    return this.getYaml(app, 'defSet')
  }

  /** 用户配置 */
  getConfig (app) {
    return { ...this.getdefSet(app), ...this.getYaml(app, 'config') }
  }

  /**
   * 获取配置yaml
   * @param app 配置文件名称
   * @param type 默认配置-defSet，用户配置-config
   */
  getYaml (app, type) {
    let file = this.getFilePath(app, type)

    if (this[type][app]) return this[type][app]

    try {
      this[type][app] = YAML.parse(
        fs.readFileSync(file, 'utf8')
      )
    } catch (error) {
      logger.error(`[${app}] 格式错误 ${error}`)
      return false
    }

    this.watch(file, app, type)

    return this[type][app]
  }

  getFilePath (app, type) {
    if (type == 'defSet') return `${this.defSetPath}/${app}.yaml`
    else return `${this.configPath}/${app}.yaml`
  }

  /** 监听配置文件 */
  watch (file, app, type = 'defSet') {
    if (this.watcher[type][app]) return

    const watcher = chokidar.watch(file)
    watcher.on('change', path => {
      delete this[type][app]
      logger.mark(`[修改配置文件][${type}][${app}]`)
      if (this[`change_${app}`]) {
        this[`change_${app}`]()
      }
    })

    this.watcher[type][app] = watcher
  }

  copyPath () {
    if (!fs.existsSync(this.configPath)) fs.mkdirSync(this.configPath)

    let yamlfiles = fs.readdirSync(`${this.defSetPath}`).filter(file => file.endsWith('.yaml'))
    for (let item of yamlfiles) {
      if (!fs.existsSync(`${this.configPath}/${item}`)) {
        fs.copyFileSync(`${this.defSetPath}/${item}`, `${this.configPath}/${item}`)
      }
    }
  }
}

export default new Cfg()
