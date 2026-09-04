# 中文跟打器 Fcitx5 IME 兼容补偿

一个面向 Linux、Fcitx5/Rime 整句输入用户的浏览器用户脚本，用于补偿跟打网站无法收到完整物理 `keydown` 时造成的击键、码长和完成检查问题。

## 支持站点

- [虎码官网健康练习](https://www.tiger-code.com/practice/health/type)
- [木易跟打器 Web 版](https://typer.owenyang.top/)

## 功能

- 根据 `compositionupdate` 补偿被浏览器隐藏的击键事件。
- 匹配已经收到的真实 `keydown`，避免重复计数。
- 修复虎码健康练习中的击键和码长漏记。
- 修复木易跟打器整句上屏后不自动完成的问题。
- 不发送网络请求，不收集或上传任何数据。

## 安装

安装 Tampermonkey 或 Violentmonkey，新建用户脚本，然后复制
[`typing-ime-fix.user.js`](./typing-ime-fix.user.js) 的全部内容并保存。

脚本发布到 Greasy Fork 后，也可以直接通过 Greasy Fork 安装并自动更新。

## 诊断

打开浏览器开发者工具，在控制台输入：

```js
__typingImeFix
```

可以查看真实按键、输入法合成更新和补偿次数。

## 限制

浏览器没有暴露的物理按键只能根据输入法合成事件推算，无法恢复具体键位。虎码整句在组句时预编辑文本可能缩短，因此脚本将每次没有匹配真实按键的合成更新视为一次击键；如果 Backspace 同样被浏览器完全隐藏，统计可能存在少量误差。

## 隐私

脚本完全在浏览器本地运行，没有统计上报、广告、追踪或外部依赖。

## 许可证

[MIT](./LICENSE)
