/**
 * Main JavaScript for Shopee Affiliate Static Site
 * Handles: Data loading, User Agent detection, IP fetching, Deep linking, Text Parsing
 */

const CONFIG_URL = './data/urls.json';
let appConfig = {};
let userIP = '127.0.0.1'; // Default Fallback

// 1. Detect User Agent
function detectOS() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    if (/android/i.test(userAgent)) return 'android';
    if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) return 'ios';
    return 'web';
}

// 2. Fetch User IP
async function fetchUserIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        userIP = data.ip;
        console.log('User IP:', userIP);
    } catch (error) {
        console.error('Failed to fetch IP:', error);
    }
}

// 3. Load Configuration
async function loadConfig() {
    try {
        const response = await fetch(CONFIG_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        appConfig = await response.json();
        console.log("Config Loaded:", appConfig);
    } catch (error) {
        console.error('Failed to load config:', error);
        alert('Không thể tải cấu hình (urls.json). Nếu bạn chạy trực tiếp file HTML, hãy thử dùng Local Server hoặc deploy lên GitHub.');
    }
}

// 4. Core Deep Link Logic (Generic)
function openDeepLink(url) {
    // Append Affiliate Params if not already present
    // Params: mmp_pid=an_17345950423&utm_content={ip}
    let targetUrl = url;
    if (!targetUrl.includes('mmp_pid=')) {
        const separator = targetUrl.includes('?') ? '&' : '?';
        targetUrl = `${targetUrl}${separator}mmp_pid=an_17345950423&utm_content=${userIP}`;
    }

    const os = detectOS();
    let deepLink = targetUrl;

    // Construct Deep Link based on OS
    if (os === 'android') {
        // Android Intent for Shopee
        const cleanUrl = targetUrl.replace(/^https?:\/\//, '');
        deepLink = `intent://${cleanUrl}#Intent;scheme=https;package=com.shopee.vn;end`;
    } else if (os === 'ios') {
        // iOS Scheme
        const cleanUrl = targetUrl.replace(/^https?:\/\//, '');
        deepLink = `shopee://${cleanUrl}`;
    }

    console.log(`Open Deep Link: ${deepLink} (OS: ${os})`);

    if (os === 'android') {
        window.location.href = deepLink;
    } else if (os === 'ios') {
        window.location.href = deepLink;
        setTimeout(() => {
            // Fallback to Web if App not open
            if (document.visibilityState === 'visible') {
                window.location.href = targetUrl;
            }
        }, 1500);
    } else {
        // Desktop
        window.open(targetUrl, '_blank');
    }
}

// Wrapper for Configured Keys (from urls.json)
function handleDeepLink(key) {
    if (Object.keys(appConfig).length === 0) {
        alert('Đang tải dữ liệu... Vui lòng thử lại sau giây lát.');
        return;
    }

    if (!appConfig[key]) {
        alert(`Lỗi: Không tìm thấy cấu hình cho key "${key}"`);
        return;
    }

    const os = detectOS();
    const urlData = appConfig[key];
    let target = urlData[os] || urlData['web'];

    if (!target) {
        alert('Lỗi: Không tìm thấy link đích.');
        return;
    }

    // Append params for web links
    if (target.startsWith('http')) {
        const separator = target.includes('?') ? '&' : '?';
        target = `${target}${separator}mmp_pid=an_17345950423&utm_content=${userIP}`;
    }

    console.log(`Handling ${key} -> ${target} (${os})`);

    if (os === 'web') {
        window.open(target, '_blank');
    } else {
        window.location.href = target;
        // Fallback logic for iOS
        if (os === 'ios') {
            setTimeout(() => {
                if (document.visibilityState === 'visible') {
                    window.location.href = urlData['web'];
                }
            }, 1500);
        }
    }
}

// 5. Convert & Open (Input field)
function convertAndRedirect() {
    const inputUrl = document.getElementById('shopee-link-input').value.trim();
    if (inputUrl) openDeepLink(inputUrl);
}

// 6. Parse & Render Deal Text
function parseDealText(text) {
    const lines = text.split('\n');
    let html = '';
    let inGroup = false;

    lines.forEach(line => {
        line = line.trim();
        if (!line) return;

        // 1. Main Category (•)
        if (line.startsWith('•')) {
            if (inGroup) { html += '</div>'; inGroup = false; }
            html += `<h3 class="deal-header">${line.substring(1).trim()}</h3>`;
            html += `<div class="deal-grid">`; // Start Grid
            inGroup = false;
        }
        // 2. Sub Category / Product Name (📌 or 👉)
        else if (line.startsWith('📌') || line.startsWith('👉')) {
            if (inGroup) html += '</div>'; // Close previous product card
            html += `<div class="deal-card">`; // Start Product Card
            html += `<div class="deal-title">${line.substring(1).trim()}</div>`;
            inGroup = true;
        }
        // 3. Store Link (Contains http)
        else if (line.includes('http')) {
            // Extract URL (find http...)
            const match = line.match(/(https?:\/\/[^\s]+)/g);
            if (match) {
                const url = match[0];
                let name = line.replace(url, '').trim();
                // Clean up name
                name = name.replace(/[-:]/g, '').trim();
                if (!name) name = "Mua Ngay";

                html += `<button class="btn-shop" onclick="openDeepLink('${url}')">
                            <span class="shop-name">${name}</span>
                            <span class="shop-icon">➜</span>
                         </button>`;
            }
        }
        // 4. Plain text info inside a group
        else if (inGroup) {
            html += `<p class="deal-note">${line}</p>`;
        }
        // 5. Stray text
        else {
            // Maybe a standalone note or top description
            html += `<p class="deal-intro">${line}</p>`;
        }
    });

    if (inGroup) html += '</div>'; // Close last card
    if (html.includes('deal-grid')) html += '</div>'; // Close last grid (rough logic)

    return html;
}

// 7. Load Deal Content
async function loadContent(fileId, elementId) {
    try {
        const response = await fetch(`./data/${fileId}.txt`);
        if (!response.ok) throw new Error('File not found');
        const text = await response.text();
        const html = parseDealText(text);
        document.getElementById(elementId).innerHTML = html;
    } catch (error) {
        console.error('Failed to load content:', error);
        document.getElementById(elementId).innerHTML = '<p>Đang cập nhật dữ liệu...</p>';
    }
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    fetchUserIP();
});
