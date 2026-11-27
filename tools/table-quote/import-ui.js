(() => {
    'use strict';
    const byId = id => document.getElementById(id);
    let engineLoading;
    function loadReader() {
        if (window.QuoteOCR) return Promise.resolve(window.QuoteOCR);
        if (!engineLoading) {
            engineLoading = new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'table-quote/engine-packed.js?v=20261127-1';
                script.onload = () => resolve(window.QuoteOCR);
                script.onerror = () => {
                    script.remove();
                    engineLoading = null;
                    reject(new Error('未能加载本地识图组件，请检查网络后重试；报价图片不会上传。'));
                };
                document.head.append(script);
            });
        }
        return engineLoading;
    }
    const money = amount => Number(amount).toLocaleString('zh-CN', {maximumFractionDigits: 2});
    function init({applyState, undoState}) {
        const dialog = byId('restoreDialog');
        let revision = 0, prepared = null, reader = null, originalUrl = '';
        let sourceRows = [], sourceImages = {}, sourceArt = {}, sourceWarnings = [], isImage = false;
        let correctionTimer;
        function status(value, error = false) {
            byId('restoreStatus').textContent = value;
            byId('restoreStatus').dataset.error = String(error);
        }
        function clearReview() {
            prepared = null;
            byId('restoreReview').hidden = true;
            byId('restoreApply').disabled = true;
            byId('restoreAck').checked = false;
        }
        function invalidate() {
            revision++;
            clearTimeout(correctionTimer);
            if (reader) { const oldReader = reader; reader = null; Promise.resolve(oldReader.close()).catch(() => {}); }
            clearReview();
        }
        function resetInput() {
            invalidate();
            sourceRows = []; sourceImages = {}; sourceArt = {}; sourceWarnings = []; isImage = false;
            byId('restoreOriginal').hidden = true;
            byId('restoreCellsBox').hidden = true; byId('restoreCellsBox').open = false;
            byId('restoreCells').replaceChildren();
            byId('restoreOriginal').open = false;
            byId('restorePicture').removeAttribute('src');
            if (originalUrl) URL.revokeObjectURL(originalUrl);
            originalUrl = '';
            byId('restoreFile').value = '';
            status('在确认还原前，不会改动正在填写的报价。');
        }
        function list(element, values) {
            element.replaceChildren(...values.map(value => {
                const li = document.createElement('li'); li.textContent = value; return li;
            }));
        }
        function review(rows, images = {}, warnings = []) {
            clearReview();
            if (rows.length > 600 || rows.some(row => row.length > 80)) throw Error('一次只能还原一张报价单，请缩小所选区域。');
            if (rows.filter(row => row.some(cell => String(cell).replace(/\s/g,'') === '产品报价单')).length > 1)
                throw Error('发现多张报价单，请一次只粘贴一张完整报价。');
            const candidate = QuoteTableParser.parse(rows, images);
            const lettering=Object.values(sourceArt);
            if(lettering.length===candidate.state.products.length)candidate.state.products.forEach((product,index)=>{product.labelArt={...lettering[index]};});
            return reviewCandidate(candidate, warnings);
        }
        function reviewCandidate(candidate, warnings = []) {
            const {state, sourceTotal} = candidate;
            const result = QuoteMath.calculate(state);
            const messages = new Set([...warnings, ...(candidate.warnings || [])]);
            if (isImage) messages.add('请核对识别出的尺寸、数量、单价和费用。只改数量时，报价上的品名和类目保留原图字样；手改名称或类目才替换文字。');
            if (Number(state.tax) > 0 && !state.autoTax) messages.add('原单税金按原金额保留，不猜税率。若改数量后需要重新计税，可清空手填税金并选择原税率。');
            if (sourceTotal === null) messages.add('没有读到原单总价，无法自动对账。');
            const difference = sourceTotal === null ? null : Math.round((result.total - sourceTotal) * 100) / 100;
            if (difference) messages.add('原单与重算相差 ' + money(difference) + ' 元。请修正识别内容，或确认接受重算金额。');
            byId('restoreCount').textContent = [state.customer || '未填客户', state.date || '未读到日期', state.products.length + ' 项产品',
                state.different ? '分仓发货' : '同仓发货'].join(' · ');
            list(byId('restoreLines'), state.products.map((product, index) => product.name + ' · ' + [product.width,product.height,product.thickness].filter(Boolean).join('×')
                + ' · ' + product.qty + ' 片' + (product.mode === 'area' ? '（' + money(result.rows[index].area) + ' ㎡）' : '')
                + ' · ' + product.price + (product.mode === 'area' ? ' 元/㎡' : ' 元/片') + ' → ' + money(result.rows[index].amount) + ' 元'));
            state.products.forEach((product,index) => {
                if (!product.labelArt?.name) return;
                const line = byId('restoreLines').children[index];
                const details = line.textContent.slice(product.name.length);
                const image = document.createElement('img');
                image.src = product.labelArt.name; image.alt = '原单产品 '+(index+1)+' 品名';
                image.className = 'restore-label-art';
                line.replaceChildren(image, document.createTextNode(details));
            });
            byId('restoreCosts').textContent = '木箱 ' + money(result.box) + '　运费 ' + (result.hasFreight ? money(result.freight) : '到付')
                + '　加工 ' + money(result.processing) + '　辅料 ' + money(result.auxiliary) + '　税金 ' + money(result.tax);
            byId('restoreTotals').textContent = '原单：' + (sourceTotal === null ? '未读到' : '¥' + money(sourceTotal))
                + '　重算：¥' + money(result.total) + (difference === 0 ? '　✓ 金额一致' : '');
            list(byId('restoreWarnings'), [...messages]);
            const requireAck = messages.size > 0;
            byId('restoreAckWrap').hidden = !requireAck;
            byId('restoreApply').disabled = requireAck;
            prepared = state;
            byId('restoreReview').hidden = false;
            status('核对后再点「还原并修改数量」。当前报价在确认前不会被替换。');
        }
        function drawCells() {
            const box = byId('restoreCellsBox'), host = byId('restoreCells');
            host.replaceChildren();
            box.hidden = !sourceRows.length || sourceRows.length > 90 || sourceRows.some(row => row.length > 22);
            if (box.hidden) return;
            const table = document.createElement('table');
            sourceRows.forEach((row, rowIndex) => {
                const tr = table.insertRow();
                const heading = document.createElement('th'); heading.scope = 'row'; heading.textContent = rowIndex + 1;
                tr.append(heading);
                row.forEach((value, column) => {
                    const input = document.createElement('input');input.value = String(value ?? '').replaceAll('\n',' ');
                    input.setAttribute('aria-label','第 ' + (rowIndex + 1) + ' 行第 ' + (column + 1) + ' 列');
                    input.size = Math.max(5, Math.min(29, [...input.value].length * 2));
                    input.addEventListener('input', () => {
                        invalidate(); row[column] = input.value;
                        if(sourceArt[rowIndex] && column<2)delete sourceArt[rowIndex][column===0?'category':'name'];
                        correctionTimer = setTimeout(() => {
                            try { review(sourceRows, sourceImages, sourceWarnings); }
                            catch (error) { status(error.message, true); }
                        }, 300);
                    });
                    tr.insertCell().append(input);
                });
            });
            host.append(table);
        }
        function showRows(data) {
            sourceRows = data.rows; sourceImages = data.images || {}; sourceArt = data.labelArt || {}; sourceWarnings = data.warnings || [];
            drawCells();
            if (!sourceRows.length) { clearReview(); status(sourceWarnings.join(' ') || '图片里没有识别到报价明细，请拖入完整原图。',true); return; }
            try { review(sourceRows, sourceImages, sourceWarnings); }
            catch (error) {
                status(error.message + ' 可在下方逐格核对并修正。', true);
                if (!byId('restoreCellsBox').hidden) byId('restoreCellsBox').open = true;
            }
        }
        async function readFile(file) {
            if (!file) return;
            resetInput();
            const token = revision;
            let activeReader = null;
            try {
                if (!/^image\/(png|jpeg|webp)$/i.test(file.type) && !/\.(png|jpe?g|webp)$/i.test(file.name)) {
                    throw Error('请拖入本工具生成的报价图片（PNG、JPG 或 WebP）。');
                }
                if (file.size > 24 * 1024 * 1024) throw Error('图片超过 24 MB，请使用清晰的完整报价表截图。');
                isImage = true;
                originalUrl = URL.createObjectURL(file); byId('restorePicture').src = originalUrl;
                byId('restoreOriginal').hidden = false;
                const progress = value => {
                    if(token !== revision) return false;
                    if(typeof value === 'string') status(value);
                    else if(value?.message) status(value.message + (value.percent !== undefined ? ' · ' + value.percent + '%' : ''));
                    else if(value?.status === 'recognizing text') status('正在本机识别报价表格 · ' + Math.round(value.progress*100) + '%');
                    else status('正在本机识别报价单…');
                    return true;
                };
                progress('正在读取报价原图…');
                const exact = await QuotePicture.read(file);
                if (token !== revision) return;
                if (exact) {
                    isImage = false;
                    reviewCandidate(exact);
                    status('已从图片精确还原，可直接修改数量。');
                    return;
                }
                progress('这张图片需要按表格识别，正在本机载入…');
                const engine = await loadReader();
                if (token !== revision) return;
                activeReader = await engine.open(progress);
                if (token !== revision) return;
                reader = activeReader;
                const data = await QuoteGrid.read(file, activeReader.recognize, progress);
                if (token !== revision) return;
                await QuoteCellOCR.refine(file, data, activeReader.recognize, progress);
                if (token === revision) showRows(data);
            } catch (error) {
                const detail = error?.message || (typeof error === 'string' ? error : '');
                if (token === revision) status((detail || '无法读取这张报价单。')
                    + ' 请使用完整、清晰的报价原图。', true);
            } finally {
                if (activeReader && (reader === activeReader || token !== revision)) {
                    if (reader === activeReader) reader = null;
                    try { await activeReader.close(); } catch { /* A canceled read may already be closed. */ }
                }
            }
        }
        function paste(event) {
            const file = [...(event.clipboardData?.items || [])].find(item => item.kind === 'file' && item.type.startsWith('image/'))?.getAsFile();
            if (file) { event.preventDefault(); readFile(file); }
        }
        byId('restoreOpen').onclick = () => { resetInput(); dialog.showModal(); byId('restoreDrop').focus(); };
        byId('restoreClose').onclick = () => dialog.close();
        dialog.addEventListener('close', resetInput);
        byId('restoreBrowse').onclick = () => byId('restoreFile').click();
        byId('restoreFile').onchange = event => readFile(event.target.files[0]);
        dialog.addEventListener('paste', paste);
        const drop = byId('restoreDrop');
        dialog.addEventListener('dragover', event => { event.preventDefault(); drop.classList.add('over'); });
        dialog.addEventListener('dragleave', () => drop.classList.remove('over'));
        dialog.addEventListener('drop', event => {
            event.preventDefault(); drop.classList.remove('over'); readFile(event.dataTransfer.files[0]);
        });
        byId('restoreAck').onchange = event => { byId('restoreApply').disabled = !prepared || !event.target.checked; };
        byId('restoreApply').onclick = () => {
            if (!prepared || byId('restoreApply').disabled) return;
            const state = prepared;
            dialog.close();
            applyState(state);
        };
        // Outside the two product-photo targets, an image dropped on the page means a quote to restore.
        function photoTarget(node) { return node?.closest?.('.drop,[data-photo-index],#saveDialog'); }
        document.addEventListener('dragover', event => {
            if (!dialog.open && !photoTarget(event.target) && Array.from(event.dataTransfer?.types || []).includes('Files')) event.preventDefault();
        });
        document.addEventListener('drop', event => {
            if (dialog.open || event.defaultPrevented || photoTarget(event.target)) return;
            const file = event.dataTransfer?.files?.[0]; if (!file) return;
            event.preventDefault(); dialog.showModal(); readFile(file);
        });
        byId('restoreUndo').onclick = undoState;
    }
    window.QuoteRestoreUI = {init};
})();
