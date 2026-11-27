/*
 * Offline quote-sheet PNG export helper.
 * Load vendor/dist/html2canvas.min.js (html2canvas 1.4.1, MIT) first.
 *
 * Usage: await window.quoteSheetPng(document.querySelector('.quote-sheet'))
 * Returns: Promise<Blob> (image/png)
 */
(function installQuoteSheetPng(global) {
  "use strict";

  const EXPORT_WIDTH = 1280;
  const PIXEL_RATIO = 2;
  const IMAGE_TIMEOUT_MS = 15000;

  function nextFrame(win) {
    return new Promise((resolve) => {
      // Chrome may suspend an off-screen child frame's animation clock when
      // the tool itself is embedded. The editor's timer remains available.
      const fallback = global.setTimeout(resolve, 50);
      if (win?.requestAnimationFrame) win.requestAnimationFrame(() => {
        global.clearTimeout(fallback);
        resolve();
      });
    });
  }

  function copyRootAttributes(from, to) {
    for (const attribute of Array.from(from.attributes)) {
      if (attribute.name === "xmlns" || attribute.name === "style") continue;
      to.setAttribute(attribute.name, attribute.value);
    }
    if (from.hasAttribute("style")) to.setAttribute("style", from.getAttribute("style"));
  }

  function createExportFrame(sourceDocument) {
    const frame = sourceDocument.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.setAttribute("tabindex", "-1");
    frame.setAttribute("title", "Quote PNG export renderer");
    frame.style.cssText = [
      "position:fixed",
      "left:-20000px",
      "top:0",
      `width:${EXPORT_WIDTH}px`,
      "height:10000px",
      "border:0",
      "opacity:0",
      "pointer-events:none",
      "z-index:-1"
    ].join(";");

    (sourceDocument.body || sourceDocument.documentElement).appendChild(frame);
    const exportDocument = frame.contentDocument;
    if (!exportDocument) {
      frame.remove();
      throw new Error("无法创建离屏导出文档。");
    }

    exportDocument.open();
    exportDocument.write(
      "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=1280,initial-scale=1\"><style>" +
        `html,body{width:${EXPORT_WIDTH}px!important;min-width:${EXPORT_WIDTH}px!important;max-width:none!important;margin:0!important;}` +
        `body{box-sizing:border-box!important;position:relative!important;overflow:visible!important;}` +
        "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;}" +
        "</style></head><body></body></html>"
    );
    exportDocument.close();

    copyRootAttributes(sourceDocument.documentElement, exportDocument.documentElement);
    copyRootAttributes(sourceDocument.body, exportDocument.body);
    for (const root of [exportDocument.documentElement, exportDocument.body]) {
      root.style.setProperty("width", `${EXPORT_WIDTH}px`, "important");
      root.style.setProperty("min-width", `${EXPORT_WIDTH}px`, "important");
      root.style.setProperty("max-width", "none", "important");
      root.style.setProperty("margin", "0", "important");
      root.style.setProperty("overflow", "visible", "important");
      root.style.setProperty("transform", "none", "important");
      root.style.setProperty("zoom", "1", "important");
    }

    // The final quote HTML is single-file/offline, so its inline styles are the
    // source of truth. Copy every inline style block in document order; external
    // stylesheets are intentionally not fetched here.
    for (const sourceStyle of Array.from(sourceDocument.querySelectorAll("style"))) {
      const style = exportDocument.createElement("style");
      for (const attribute of Array.from(sourceStyle.attributes)) {
        style.setAttribute(attribute.name, attribute.value);
      }
      style.textContent = sourceStyle.textContent || "";
      exportDocument.head.appendChild(style);
    }

    return { frame, document: exportDocument, window: frame.contentWindow };
  }

  function cloneAncestorsAndTarget(sourceElement, exportDocument) {
    // Clone only the customer sheet: editor layout, collapsed state and sticky
    // preview geometry must never change the copied image.
    const clone = sourceElement.cloneNode(true);
    clone.style.width = EXPORT_WIDTH + 'px';
    exportDocument.body.appendChild(clone);
    copyLiveFormState(sourceElement, clone, exportDocument);
    return clone;
  }

  function copyLiveFormState(sourceRoot, clonedRoot, exportDocument) {
    const sourceNodes = [sourceRoot, ...sourceRoot.querySelectorAll("*")];
    const clonedNodes = [clonedRoot, ...clonedRoot.querySelectorAll("*")];
    const length = Math.min(sourceNodes.length, clonedNodes.length);

    for (let index = 0; index < length; index += 1) {
      const source = sourceNodes[index];
      const clone = clonedNodes[index];
      const tag = source.localName;

      if (tag === "input") {
        clone.value = source.value;
        if (source.type === "checkbox" || source.type === "radio") {
          clone.checked = source.checked;
          if (source.checked) clone.setAttribute("checked", "");
          else clone.removeAttribute("checked");
        } else {
          clone.setAttribute("value", source.value);
        }
      } else if (tag === "textarea") {
        clone.value = source.value;
        clone.textContent = source.value;
      } else if (tag === "select") {
        clone.selectedIndex = source.selectedIndex;
        for (let optionIndex = 0; optionIndex < source.options.length; optionIndex += 1) {
          if (source.options[optionIndex].selected) clone.options[optionIndex].setAttribute("selected", "");
          else clone.options[optionIndex].removeAttribute("selected");
        }
      } else if (tag === "img") {
        const currentSource = source.currentSrc || source.src;
        if (currentSource) {
          clone.src = currentSource;
          clone.removeAttribute("srcset");
          clone.removeAttribute("sizes");
        }
        clone.loading = "eager";
      } else if (tag === "canvas") {
        try {
          const image = exportDocument.createElement("img");
          image.src = source.toDataURL("image/png");
          image.width = source.width;
          image.height = source.height;
          clone.replaceWith(image);
        } catch (error) {
          throw new Error("报价内容中的画布无法读取，不能导出 PNG。", { cause: error });
        }
      }
    }
  }

  function waitForImages(root) {
    const images = Array.from(root.querySelectorAll("img"));
    return Promise.all(
      images.map((image) => {
        if (!image.getAttribute("src")) return Promise.resolve();
        if (image.complete) {
          return image.naturalWidth > 0
            ? Promise.resolve()
            : Promise.reject(new Error("报价图片未能加载，请确认图片已内嵌为 data URL。"));
        }

        return new Promise((resolve, reject) => {
          const timer = global.setTimeout(() => {
            cleanup();
            reject(new Error("等待报价图片加载超时，请确认图片已内嵌为 data URL。"));
          }, IMAGE_TIMEOUT_MS);
          const cleanup = () => {
            global.clearTimeout(timer);
            image.removeEventListener("load", onLoad);
            image.removeEventListener("error", onError);
          };
          const onLoad = () => {
            cleanup();
            image.naturalWidth > 0
              ? resolve()
              : reject(new Error("报价图片内容为空或格式不受支持。"));
          };
          const onError = () => {
            cleanup();
            reject(new Error("报价图片未能加载，请确认图片已内嵌为 data URL。"));
          };
          image.addEventListener("load", onLoad, { once: true });
          image.addEventListener("error", onError, { once: true });
        });
      })
    );
  }

  async function waitForFonts(exportDocument) {
    if (!exportDocument.fonts || !exportDocument.fonts.ready) return;
    await Promise.race([
      exportDocument.fonts.ready,
      new Promise((resolve) => global.setTimeout(resolve, IMAGE_TIMEOUT_MS))
    ]);
  }

  function canvasToPng(canvas) {
    return new Promise((resolve, reject) => {
      if (typeof canvas.toBlob !== "function") {
        reject(new Error("当前浏览器不支持 PNG Blob 导出。"));
        return;
      }
      canvas.toBlob((blob) => {
        if (blob && blob.type === "image/png") resolve(blob);
        else reject(new Error("PNG 生成失败；可能有未内嵌的跨域图片资源。"));
      }, "image/png");
    });
  }

  async function renderQuoteSheetPng(element, archiveRecord) {
    if (!element || element.nodeType !== 1 || typeof element.cloneNode !== "function") {
      throw new TypeError("quoteSheetPng 需要一个完整报价容器 HTMLElement。");
    }
    if (!element.isConnected) {
      throw new Error("报价容器尚未显示在页面中，无法按正式版式导出。");
    }
    if (typeof global.html2canvas !== "function") {
      throw new Error("html2canvas 未加载。请先内联 vendor/dist/html2canvas.min.js，再内联 quote-sheet-png.js。");
    }

    const sourceDocument = element.ownerDocument;
    const { frame, document: exportDocument, window: exportWindow } = createExportFrame(sourceDocument);

    try {
      const clonedElement = cloneAncestorsAndTarget(element, exportDocument);
      await waitForFonts(exportDocument);
      await waitForImages(clonedElement);
      await nextFrame(exportWindow);
      await nextFrame(exportWindow);

      const bounds = clonedElement.getBoundingClientRect();
      const width = Math.ceil(Math.max(EXPORT_WIDTH, bounds.width, clonedElement.scrollWidth));
      const height = Math.ceil(Math.max(bounds.height, clonedElement.scrollHeight));
      if (!Number.isFinite(width) || !Number.isFinite(height) || height < 1) {
        throw new Error("报价容器尺寸无效，无法导出 PNG。");
      }

      const canvas = await global.html2canvas(clonedElement, {
        scale: PIXEL_RATIO,
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: false,
        allowTaint: false,
        imageTimeout: IMAGE_TIMEOUT_MS,
        width,
        height,
        windowWidth: EXPORT_WIDTH,
        windowHeight: Math.max(900, height),
        scrollX: 0,
        scrollY: 0
      });

      if (!canvas || canvas.width < 1 || canvas.height < 1) {
        throw new Error("html2canvas 返回了空画布。");
      }
      if (archiveRecord) global.QuotePicture.stamp(canvas, clonedElement, archiveRecord);
      return await canvasToPng(canvas);
    } finally {
      frame.remove();
    }
  }

  // The public API accepts only the visible sheet, even if a caller passes extra arguments.
  global.quoteSheetPng = element => renderQuoteSheetPng(element);
  global.quoteSheetInternalPng = function quoteSheetInternalPng(element, record) {
    if (!record) throw new Error('内部图缺少还原记录。');
    return renderQuoteSheetPng(element, record);
  };
})(window);
