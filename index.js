import LoveMys from './model/loveMys.js'
import Cfg from './model/Cfg.js'
import fs from 'node:fs'

Cfg.copyPath()
Cfg.startGT()
// 暂时仍保留全局的Gtest以兼容老版本调用，待Handler普及后删除
global.Gtest = new LoveMys()
const files = fs.readdirSync('./plugins/loveMys-plugin/apps').filter(file => file.endsWith('.js'))

let ret = []
files.forEach((file) => {
  ret.push(import(`./apps/${file}`))
})

ret = await Promise.allSettled(ret)

let apps = {}
for (let i in files) {
  let name = files[i].replace('.js', '')

  if (ret[i].status != 'fulfilled') {
    logger.error(`载入插件错误：${logger.red(name)}`)
    logger.error(ret[i].reason)
    continue
  }
  apps[name] = ret[i].value[Object.keys(ret[i].value)[0]]
}
export { apps }
