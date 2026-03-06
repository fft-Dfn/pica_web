// ==UserScript==
// @name         manhuabika_downloader_to_cbz_Pro
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  纯视觉提取版：修复SPA路由导致面板不显示，重回右上角，彻底无视防爬虫，SPA 强制挂载：我加入了一个“全天候巡逻队”，它会每秒钟盯着地址栏看。只要发现你进入了 /reader/（阅读页），不管网页刷没刷新，都会强行把悬浮面板“拍”在右上角！
// @author       User
// @match        https://manhuabika.com/comic/*
// @grant        GM_xmlhttpRequest
// @connect      *
// @require      https://unpkg.com/fflate@0.8.2/umd/index.js
// ==/UserScript==

(function() {
    'use strict';
    /* global fflate */

    const CONCURRENCY = 3;
    let imageLibrary = new Set();
    let chapterName = "Chapter";
    let isExtracting = false;

    // --- 1. 全天候无声扫描器 (仅在阅读页生效) ---
    setInterval(() => {
        // 如果不在阅读页，直接罢工并清空缓存
        if (!window.location.pathname.includes('/reader/')) {
            imageLibrary.clear();
            return;
        }

        // 只要在阅读页，就开始无情地抠图片
        document.querySelectorAll('img, [data-src], [data-original]').forEach(el => {
            let src = el.getAttribute('data-original') || el.getAttribute('data-src') || el.src;
            if (!src || src.startsWith('data:image')) return;

            const lowerSrc = src.toLowerCase();
            if (lowerSrc.includes('storage') || lowerSrc.includes('tobeimg') || lowerSrc.includes('picacomic')) {
                imageLibrary.add(src);
            } else {
                let rect = el.getBoundingClientRect();
                if ((rect.width > 200 || rect.height > 200) && !lowerSrc.includes('avatar') && !lowerSrc.includes('logo')) {
                    imageLibrary.add(src);
                }
            }
        });

        // 实时更新右上角按钮状态
        const packBtn = document.getElementById('gemini-pack-btn');
        if (packBtn && !isExtracting && imageLibrary.size > 0) {
            packBtn.innerText = `2. 打包当前发现的 ${imageLibrary.size} 张图`;
            packBtn.classList.add('ready');
        }
    }, 1000);

    // --- 2. 强制UI注入守护神 (解决SPA单页应用不刷新的问题) ---
    setInterval(() => {
        const isReaderPage = window.location.pathname.includes('/reader/');
        const panel = document.getElementById('gemini-floating-panel');

        // 如果不在阅读页，但面板存在，就隐藏它
        if (!isReaderPage) {
            if (panel) panel.style.display = 'none';
            return;
        }

        // 如果在阅读页，且面板已经存在，显示出来即可
        if (panel) {
            panel.style.display = 'flex';

            // 顺手提取一下章节名
            if (chapterName === "Chapter") {
                const titleEl = document.querySelector('h1') || document.querySelector('.comic-title');
                if (titleEl) chapterName = (titleEl.innerText || titleEl.textContent).split('-')[0].trim();
            }
            return;
        }

        // --- 开始构建右上角悬浮面板 ---
        const style = document.createElement('style');
        style.innerHTML = `
            #gemini-floating-panel {
                position: fixed;
                top: 20px; /* 遵照要求：改回右上角 */
                right: 20px;
                z-index: 999999;
                background: rgba(25, 30, 36, 0.95);
                padding: 15px;
                border-radius: 8px;
                box-shadow: 0 8px 20px rgba(0,0,0,0.6);
                display: flex;
                flex-direction: column;
                gap: 12px;
                border: 1px solid #444;
            }
            .gemini-btn {
                padding: 12px 15px;
                background-color: #457b9d;
                color: white;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                border: none;
                font-weight: bold;
                transition: all 0.2s ease;
                text-align: center;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            }
            .gemini-btn:hover { background-color: #1d3557; transform: translateY(-1px); }
            .gemini-btn.ready { background-color: #e63946; }
            .gemini-btn.ready:hover { background-color: #d62828; }
            .gemini-btn.loading { background-color: #fca311; cursor: wait; pointer-events: none; }
            .gemini-btn.success { background-color: #2a9d8f; }
            .gemini-tips { color: #ccc; font-size: 12px; max-width: 200px; line-height: 1.5; margin-top: 5px; }
        `;
        document.body.appendChild(style);

        const newPanel = document.createElement('div');
        newPanel.id = 'gemini-floating-panel';

        const scrollBtn = document.createElement('button');
        scrollBtn.id = 'gemini-scroll-btn';
        scrollBtn.className = 'gemini-btn';
        scrollBtn.innerText = '1. 自动滚屏 (破解懒加载)';

        const packBtn = document.createElement('button');
        packBtn.id = 'gemini-pack-btn';
        packBtn.className = 'gemini-btn';
        packBtn.innerText = '2. 等待提取图片...';

        const tips = document.createElement('div');
        tips.className = 'gemini-tips';
        tips.innerText = '原理：所见即所得。请确保所有图片都滑过一遍再点击打包。';

        newPanel.appendChild(scrollBtn);
        newPanel.appendChild(packBtn);
        newPanel.appendChild(tips);
        document.body.appendChild(newPanel);

        // --- 绑定按钮事件 ---
        scrollBtn.onclick = async () => {
            if (scrollBtn.classList.contains('loading')) return;
            scrollBtn.innerText = '正在自动滑翔...';
            scrollBtn.classList.add('loading');

            // 寻找包含内容最多的滚动容器
            let scrollTarget = document.scrollingElement || document.body;
            let maxScrollHeight = scrollTarget.scrollHeight;

            document.querySelectorAll('div').forEach(el => {
                if (el.scrollHeight > maxScrollHeight) {
                    const overflowY = window.getComputedStyle(el).overflowY;
                    if (overflowY === 'auto' || overflowY === 'scroll') {
                        maxScrollHeight = el.scrollHeight;
                        scrollTarget = el;
                    }
                }
            });

            let lastTop = -1;
            let noChangeCount = 0;

            let timer = setInterval(() => {
                let step = window.innerHeight * 0.7; // 每次滚动大半屏
                scrollTarget.scrollTop += step;
                window.scrollBy(0, step);

                let currentTop = scrollTarget.scrollTop || window.scrollY;

                if (currentTop === lastTop) {
                    noChangeCount++;
                    if (noChangeCount >= 4) {
                        clearInterval(timer);
                        scrollTarget.scrollTop = 0;
                        window.scrollTo(0,0);
                        scrollBtn.innerText = '滚动完成, 请打包';
                        scrollBtn.className = 'gemini-btn success';
                    }
                } else {
                    noChangeCount = 0;
                    lastTop = currentTop;
                }
            }, 600); // 留出时间给图片加载
        };

        packBtn.onclick = async () => {
            if (packBtn.classList.contains('loading')) return;
            if (imageLibrary.size === 0) {
                alert("还没提取到任何漫画图片！\n请先往下滚动网页，或者点击【自动滚屏】。");
                return;
            }

            isExtracting = true;
            packBtn.className = 'gemini-btn loading';
            packBtn.innerText = '开始极速抓取...';

            const urls = Array.from(imageLibrary);
            const zipFiles = {};
            let downloadedCount = 0;
            const total = urls.length;

            try {
                await asyncPool(CONCURRENCY, urls, async (url, index) => {
                    const ext = url.split('.').pop().split('?')[0] || 'jpg';
                    const fileName = `${String(index + 1).padStart(3, '0')}.${ext}`;

                    const arrayBuffer = await fetchImageBuffer(url);
                    zipFiles[fileName] = new Uint8Array(arrayBuffer);

                    downloadedCount++;
                    packBtn.innerText = `抓取 [${downloadedCount}/${total}]`;
                });

                packBtn.innerText = '正在无损压缩...';
                const outBuffer = fflate.zipSync(zipFiles, { level: 0 });
                const finalBlob = new Blob([outBuffer], { type: "application/zip" });

                saveAs(finalBlob, `${chapterName}.cbz`);

                packBtn.className = 'gemini-btn success';
                packBtn.innerText = '打包完成！';

                setTimeout(() => {
                    isExtracting = false;
                    packBtn.className = 'gemini-btn ready';
                    packBtn.innerText = `再次打包 (${total}张)`;
                }, 4000);

            } catch (err) {
                console.error("下载出错", err);
                isExtracting = false;
                packBtn.className = 'gemini-btn';
                packBtn.style.backgroundColor = '#457b9d';
                packBtn.innerText = '网络抖动，请重试';
            }
        };

    }, 1000); // 每秒检查一次是否需要注入UI

    // --- 底层网络与文件工具 ---
    function fetchImageBuffer(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: url,
                headers: { "Referer": window.location.origin + "/" },
                responseType: "arraybuffer",
                timeout: 20000,
                onload: (res) => {
                    if (res.status === 200) resolve(res.response);
                    else reject(`图裂(${res.status})`);
                },
                onerror: () => reject('图片网络错误')
            });
        });
    }

    function saveAs(blob, fileName) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { document.body.removeChild(a); window.URL.revokeObjectURL(url); }, 1000);
    }

    async function asyncPool(poolLimit, array, iteratorFn) {
        const ret = [];
        const executing = [];
        for (const [index, item] of array.entries()) {
            const p = Promise.resolve().then(() => iteratorFn(item, index));
            ret.push(p);
            if (poolLimit <= array.length) {
                const e = p.then(() => executing.splice(executing.indexOf(e), 1));
                executing.push(e);
                if (executing.length >= poolLimit) {
                    await Promise.race(executing);
                }
            }
        }
        return Promise.all(ret);
    }
})();
