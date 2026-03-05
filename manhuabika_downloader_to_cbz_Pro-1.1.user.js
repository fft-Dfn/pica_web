// ==UserScript==
// @name         manhuabika_downloader_to_cbz_Pro
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  完美绝杀版：原生 Fetch 接管 API 绕过预检，彻底解决空数据与熟肉问题
// @author       User (逆向工程)
// @match        https://manhuabika.com/comic/*
// @grant        GM_xmlhttpRequest
// @connect      *
// @require      https://unpkg.com/fflate@0.8.2/umd/index.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';
    /* global fflate, CryptoJS */

    const CONCURRENCY = 3;

    let capturedToken = "";
    let capturedHeaders = {};
    let capturedApiDomain = "https://picaapi.go2778.com"; // 默认兜底域名

    // ★ 间谍武器：拦截 Fetch/XHR，精准窃取 Token 和 动态域名
    const injectInterceptor = () => {
        const code = `
            (function() {
                const sendData = (headers, url) => {
                    window.postMessage({ 
                        type: 'PICA_STEALER', 
                        headers: JSON.parse(JSON.stringify(headers)),
                        url: url
                    }, '*');
                };

                const origOpen = XMLHttpRequest.prototype.open;
                XMLHttpRequest.prototype.open = function(method, url) {
                    this._reqUrl = url;
                    return origOpen.apply(this, arguments);
                };

                const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;
                XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
                    this._headers = this._headers || {};
                    this._headers[name.toLowerCase()] = value;
                    if (name.toLowerCase() === 'authorization') sendData(this._headers, this._reqUrl);
                    return origSetHeader.apply(this, arguments);
                };

                const origFetch = window.fetch;
                window.fetch = async function(...args) {
                    const reqUrl = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
                    const opts = args[1] || {};
                    const headers = opts.headers || {};
                    let extracted = {};
                    if (headers instanceof Headers) {
                        headers.forEach((v, k) => extracted[k.toLowerCase()] = v);
                    } else if (Array.isArray(headers)) {
                        headers.forEach(h => extracted[h[0].toLowerCase()] = h[1]);
                    } else {
                        for (let k in headers) extracted[k.toLowerCase()] = headers[k];
                    }
                    if (extracted['authorization']) sendData(extracted, reqUrl);
                    return origFetch.apply(this, args);
                };
            })();
        `;
        const script = document.createElement('script');
        script.textContent = code;
        document.documentElement.appendChild(script);
        script.remove();
    };
    injectInterceptor();

    window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'PICA_STEALER') {
            const h = e.data.headers;
            const url = e.data.url;
            
            if (h['authorization']) capturedToken = h['authorization'];
            if (h['app-channel']) capturedHeaders['app-channel'] = h['app-channel'];
            if (h['app-platform']) capturedHeaders['app-platform'] = h['app-platform'];
            if (h['app-uuid']) capturedHeaders['app-uuid'] = h['app-uuid'];
            if (h['app-version']) capturedHeaders['app-version'] = h['app-version'];

            // 锁定真实 API 域名
            if (url && url.includes('/comics/')) {
                const match = url.match(/^https?:\/\/[^\/]+/);
                if (match) capturedApiDomain = match[0];
            }
        }
    });

    window.addEventListener('DOMContentLoaded', () => {
        const findToken = (storage) => {
            for (let i = 0; i < storage.length; i++) {
                let key = storage.key(i);
                let val = storage.getItem(key);
                if (val && typeof val === 'string' && val.includes('eyJhbGciOi')) {
                    return val.replace(/["']/g, ''); 
                }
            }
            return null;
        };
        if (!capturedToken) capturedToken = findToken(localStorage) || findToken(sessionStorage) || "";
        
        setTimeout(injectButtons, 1500);
        const observer = new MutationObserver(injectButtons);
        observer.observe(document.body, { childList: true, subtree: true });
    });

    // --- 签名防伪算法 ---
    function getNonce() {
        const possible = "abcdefghijklmnopqrstuvwxyz0123456789";
        let text = "";
        for (let i = 0; i < 32; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));
        return text;
    }

    function createPicaSignature(urlPath, method, time, nonce) {
        const apiKey = "C69BAF41DA5ABD1FFEDC6D2FEA56B";
        const apiSecret = "~d}$Q7$eIniTce^F'GzGSRRoPPJxgfRo2ej536ewOmF}Aqk]q^Nzy[Zg,n#Q";
        let raw = urlPath + time + nonce + method + apiKey;
        let hash = CryptoJS.HmacSHA256(raw.toLowerCase(), apiSecret);
        return CryptoJS.enc.Hex.stringify(hash);
    }

    // --- UI 注入逻辑 ---
    const style = document.createElement('style');
    style.innerHTML = `
        .download-btn {
            margin: 5px 0 5px 10px;
            padding: 4px 10px;
            background-color: #e63946;
            color: white;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            border: none;
            display: inline-block;
            transition: background-color 0.2s;
        }
        .download-btn:hover { background-color: #d62828; }
        .download-btn.loading { background-color: #fca311; cursor: wait; }
        .download-btn.error { background-color: #457b9d; }
        .download-btn.success { background-color: #2a9d8f; }
    `;
    if(document.head) document.head.appendChild(style);
    else document.documentElement.appendChild(style);

    function injectButtons() {
        if (window.location.pathname.includes('/reader/')) return;

        const mangaName = document.querySelector('h1')?.innerText.trim() || document.title.split('-')[0].trim() || 'Manga';
        const chapterButtons = document.querySelectorAll('.chapter-grid-button, .chapter-list-button, .chapter-item a');

        chapterButtons.forEach(btn => {
            if (btn.dataset.hasDownloadBtn) return;
            btn.dataset.hasDownloadBtn = "true";

            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'download-btn';
            downloadBtn.innerText = '破解下载';

            downloadBtn.onclick = async (e) => {
                e.preventDefault();
                e.stopPropagation();

                if (!capturedToken) {
                    alert("还未偷取到网站令牌！\n请等网页完全加载完毕（或点击任意章节进去看一眼图片再返回）让脚本完成拦截。");
                    return;
                }
                
                const paths = window.location.pathname.split('/').filter(Boolean);
                const comicId = paths[paths.length - 1];

                // 完美提取章节名，无视角标，支持熟肉等纯汉字
                let chapterTitleRaw = "";
                btn.childNodes.forEach(n => {
                    if (n.nodeType === Node.TEXT_NODE) chapterTitleRaw += n.textContent;
                });
                chapterTitleRaw = chapterTitleRaw.trim() || btn.innerText.split('\n')[0].trim();
                
                startDownload(comicId, chapterTitleRaw, mangaName, downloadBtn);
            };

            btn.parentNode.insertBefore(downloadBtn, btn.nextSibling);
        });
    }

    // ★ 三级智能雷达：精准定位章节真实 Order
    async function getRealOrder(comicId, chapterTitleRaw) {
        let page = 1;
        let totalPages = 1;
        
        const targetNumMatch = chapterTitleRaw.match(/[\d.]+/);
        const targetNum = targetNumMatch ? targetNumMatch[0] : null;

        while (page <= totalPages) {
            const urlPath = `comics/${comicId}/eps?page=${page}`;
            const json = await fetchJsonAPI(urlPath);
            
            if (!json.data || !json.data.eps) throw new Error("获取目录被阻截:" + JSON.stringify(json).substring(0, 30));
            
            totalPages = json.data.eps.pages;
            const docs = json.data.eps.docs;
            
            // 策略1：字面完全或包含匹配（适用于“熟肉”）
            let found = docs.find(d => d.title.trim() === chapterTitleRaw || chapterTitleRaw.includes(d.title.trim()) || d.title.trim().includes(chapterTitleRaw));
            if (found) return found.order; 
            
            // 策略2：数字内核匹配（应对繁简体差异）
            if (targetNum) {
                found = docs.find(d => {
                    const dNum = d.title.match(/[\d.]+/);
                    return dNum && dNum[0] === targetNum;
                });
                if (found) return found.order;
            }
            page++;
        }
        
        // 策略3：降级盲猜
        if (targetNum) return parseInt(targetNum);
        throw new Error("整个数据库找不到章节且无数字: " + chapterTitleRaw);
    }

    async function startDownload(comicId, chapterName, mangaName, btn) {
        if (btn.classList.contains('loading')) return;

        try {
            updateBtn(btn, '正在定位序号...', 'loading');
            
            const realOrder = await getRealOrder(comicId, chapterName);
            console.log(`[雷达定位成功] 章节 "${chapterName}" 的真实 Order 是: ${realOrder}`);

            updateBtn(btn, '正在拉取图片...', 'loading');
            let allImageUrls = [];
            const basePath = `comics/${comicId}/order/${realOrder}/pages`;

            const page1Data = await fetchJsonAPI(`${basePath}?page=1`);
            if (!page1Data.data || !page1Data.data.pages) throw new Error("API返回无数据:" + JSON.stringify(page1Data).substring(0, 30));

            const totalPages = page1Data.data.pages.pages || 1;
            const totalImages = page1Data.data.pages.total || 0;

            const extractUrls = (docs) => {
                return docs.map(doc => {
                    if (!doc.media) return null;
                    const fs = doc.media.fileServer || 'https://storage-b.picacomic.com';
                    const path = doc.media.path || '';
                    if (!path) return null;
                    return path.startsWith('http') ? path : `${fs}/${path}`;
                }).filter(Boolean);
            };

            allImageUrls.push(...extractUrls(page1Data.data.pages.docs));

            for (let p = 2; p <= totalPages; p++) {
                updateBtn(btn, `破解分页 ${p}/${totalPages}...`, 'loading');
                const pageData = await fetchJsonAPI(`${basePath}?page=${p}`);
                allImageUrls.push(...extractUrls(pageData.data.pages.docs));
            }

            if (allImageUrls.length === 0) throw new Error('提取到的图片URL为空');
            
            const zipFiles = {}; 
            let downloadedCount = 0;
            const total = allImageUrls.length;

            await asyncPool(CONCURRENCY, allImageUrls, async (url, index) => {
                const ext = url.split('.').pop().split('?')[0] || 'jpg';
                const fileName = `${String(index + 1).padStart(3, '0')}.${ext}`;
                
                const arrayBuffer = await fetchImageBuffer(url);
                zipFiles[fileName] = new Uint8Array(arrayBuffer);
                
                downloadedCount++;
                updateBtn(btn, `抓取 [${downloadedCount}/${total}]`, 'loading');
            });

            updateBtn(btn, '打包中...', 'loading');
            const outBuffer = fflate.zipSync(zipFiles, { level: 0 });
            const finalBlob = new Blob([outBuffer], { type: "application/zip" });
            const fullFileName = `${mangaName}_${chapterName}.cbz`;
            
            saveAs(finalBlob, fullFileName);
            updateBtn(btn, '完成', 'success');
            setTimeout(() => updateBtn(btn, '破解下载', ''), 3000);
            
        } catch (err) {
            console.error('[破解失败详细日志]', err);
            const errorMsg = typeof err === 'string' ? err : (err.message || '未知错误');
            updateBtn(btn, `失败: ${errorMsg.substring(0, 15)}...`, 'error');
            alert(`下载失败详情:\n${errorMsg}`);
        }
    }

    function updateBtn(btn, text, statusClass) {
        btn.innerText = text;
        btn.className = `download-btn ${statusClass}`;
    }

    // ★ 终极升级：使用原生 Fetch 获取 JSON，完美处理 OPTIONS 预检
    async function fetchJsonAPI(urlPath) {
        const time = Math.floor(Date.now() / 1000).toString();
        const nonce = getNonce();
        const method = "GET";
        const signature = createPicaSignature(urlPath, method, time, nonce);
        const fullUrl = `${capturedApiDomain}/${urlPath}`;

        const headers = new Headers();
        headers.append("accept", "application/vnd.picacomic.com.v1+json");
        headers.append("authorization", capturedToken);
        headers.append("time", time);
        headers.append("nonce", nonce);
        headers.append("signature", signature);
        headers.append("app-channel", capturedHeaders["app-channel"] || "1");
        headers.append("app-platform", capturedHeaders["app-platform"] || "android");
        headers.append("app-uuid", capturedHeaders["app-uuid"] || "webUUIDv2");
        headers.append("app-version", capturedHeaders["app-version"] || "20251017");

        const response = await window.fetch(fullUrl, {
            method: "GET",
            headers: headers,
            mode: "cors"
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const json = await response.json();
        if (json.code && json.code !== 200) {
            throw new Error(`API报错(Code:${json.code}): ${json.message}`);
        }
        if (!json.data) {
            throw new Error(`异常结构: ${JSON.stringify(json)}`);
        }
        return json;
    }

    // 跨域获取图片依旧使用 GM_xmlhttpRequest，绕过图床防盗链
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
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 1000);
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
