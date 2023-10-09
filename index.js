import Cfg from './model/Cfg.js'
import fs from 'node:fs'

if (!fs.existsSync(Cfg.configPath))
  fs.mkdirSync(Cfg.configPath)

let yamlfiles = fs.readdirSync(`${Cfg.defSetPath}`).filter(file => file.endsWith('.yaml'))
for (let item of yamlfiles)
  if (!fs.existsSync(`${Cfg.configPath}/${item}`))
    fs.copyFileSync(`${Cfg.defSetPath}/${item}`, `${Cfg.configPath}/${item}`)

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
