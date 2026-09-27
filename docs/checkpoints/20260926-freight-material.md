# 2026-09-26 鎏金材质组选项修复

状态：完成，`v2026.09.26.2`，未上传GitHub。用户指出硬质／软质按钮外多余浅灰区域，确认“修改好”。只维护原5.1完整文件夹，不改旧版，不生成压缩包。

## 原因和处理

动态容器同时有`item-material segmented`；共享`.segmented`覆盖了原透明背景/零内距，历史`.segmented label`又保留52px最小高度，内部按钮较矮，使底部多出灰条。

- `tools/freight-gold.html`：移除该容器的`segmented`，保留独立的两列布局和12px间距。所有动态明细自动生效。
- `tools/apple-ui.css`：仅对本页`.item-material .option span`统一44px最小高度、auto高度；保留原蓝色选中及焦点规则。没有覆盖全局`.segmented`，不影响其他工具。
- 十页CSS缓存统一`20260926-2`，首页及维护文档版本更新；公共业务JS未改。

## 验证

- `node --test --test-reporter=dot tests/*.test.js`：149/149通过，新增1项界面回归。
- `tests/freight-material-browser.cjs`：1812、1332、916、660、390、320px全部通过。
- 每档检查初始行、新增行：透明容器、零内距、无阴影；容器/label/span均44px、顶部一致、12px间距、文本无溢出；页面无横溢。
- 硬6张复制仍226KG；切换软质数量保留，切回硬质复制文本不变；新增软质2张后独立选择正确，删除后恢复原复制文本；键盘切换和蓝色焦点显示通过。
- console/pageerror为0；主线程已查看桌面和手机截图。独立只读复核确认JS按radio name绑定，不依赖segmented类。

浏览器运行：

```sh
NODE_PATH=/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules PW_TEST_SCREENSHOT_NO_FONTS_READY=1 node tests/freight-material-browser.cjs
```

可用`CHROME_PATH`/`OUTPUT_DIR`指定环境。截图、结果放在主工具外`../work/freight-material-20260926/`。测试使用隔离会话并捕获复制文本，不改真实客户记录或系统剪贴板；未重复外部聊天软件、Safari/Windows或全站视觉验收。

前一轮巡检5项修复保持，详见[上一交接](20260926-audit-fixes.md)。
