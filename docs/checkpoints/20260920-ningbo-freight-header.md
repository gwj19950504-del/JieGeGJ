# 2026-09-20 宁波开单物流首行交接

版本：`v2026.09.20.1`。已完成，无剩余编码待办。主源码仍为本完整文件夹，未上传、未压缩、未更改5.0。

## 用户本次要求

仅宁波仓的完整开单信息在第一行再次写出物流与付款信息，例如“明邦，到付”。原正文运费照常保留，其他仓不需要。

## 实现与边界

- `tools/order-template.html`：新增`ningboFreightHeader`，基于现有`freightText`结果构造首行，严格判断宁波仓；自动生成时插入一次。明邦/安能/货拉拉均支持，运费金额不丢失，默认只写已有付款内容，自提写“工厂自提”。
- 不改正文格式、材料价格、木箱、税金、KD、运费询价和公共核心。不改CSS及共享脚本，因此缓存版本不变。
- 原复制按钮继续复制完整结果。用户手工修改结果后保持手工内容；点击恢复自动生成才重新生成首行。
- 首页、README、开发入口、需求归档和恢复入口同步更新。

## 验收

- `node --test --test-reporter=dot tests/*.test.js`：127项全部通过。
- `tests/ningbo-header-browser.cjs`：实际Chrome检查明邦/安能/货拉拉、金额代付、默认、自提、其他五仓、来回切仓、完整复制、手工编辑和恢复自动生成。
- 示例复算：1200×2400，28片，75元/㎡，材料6048；木箱260，税金783，合计8700，KD仍1609。代付100.5时KD仍按原规则为1508.5。
- 运费询价内容未改变。1440px桌面与390px手机显示/复制通过，手机无整页横溢，脚本和控制台错误为0。剪贴板使用模拟对象，未覆盖用户剪贴板。
- 本地验收截图：`../../../work/ningbo-header-20260920/ningbo-header-desktop.png`、`../../../work/ningbo-header-20260920/ningbo-header-mobile.png`（工作目录下辅助证据，不是运行依赖）。
- 浏览器脚本依赖Playwright；本机运行时通过`NODE_PATH=/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules`定位，Chrome默认使用`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`。可设置`OUTPUT_DIR`与`CHROME_PATH`。

后续只跟进新请求，不重复处理历史截图。
