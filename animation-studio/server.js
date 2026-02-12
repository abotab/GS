/**
 * خادم Node.js - Node.js Server
 * لخدمة التطبيق ومعالجة حفظ/تحميل الملفات
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// إعدادات الخادم
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname);

// أنواع MIME
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.ts': 'application/typescript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf'
};

// إنشاء الخادم
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    let pathname = parsedUrl.pathname;

    // الصفحة الرئيسية
    if (pathname === '/') {
        pathname = '/index.html';
    }

    const filePath = path.join(PUBLIC_DIR, pathname);
    const ext = path.extname(filePath).toLowerCase();

    // معالجة API
    if (pathname.startsWith('/api/')) {
        handleAPI(req, res, pathname, parsedUrl);
        return;
    }

    // قراءة الملف
    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                // ملف غير موجود
                res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(`
                    <!DOCTYPE html>
                    <html dir="rtl">
                    <head>
                        <title>404 - الصفحة غير موجودة</title>
                        <style>
                            body { 
                                font-family: Arial, sans-serif; 
                                text-align: center; 
                                padding: 50px;
                                background: #1a1a2e;
                                color: white;
                            }
                            h1 { color: #ff4757; font-size: 4rem; }
                        </style>
                    </head>
                    <body>
                        <h1>404</h1>
                        <p>الصفحة المطلوبة غير موجودة</p>
                        <a href="/" style="color: #00d4aa;">العودة للرئيسية</a>
                    </body>
                    </html>
                `);
            } else {
                // خطأ في الخادم
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('خطأ في الخادم');
            }
            return;
        }

        // إرسال الملف
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        
        // CORS headers للسماح بالوصول من أي مصدر
        res.writeHead(200, {
            'Content-Type': contentType + '; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Cache-Control': 'no-cache'
        });

        res.end(data);
    });
});

// معالجة API
function handleAPI(req, res, pathname, parsedUrl) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // حفظ المشروع
    if (pathname === '/api/save' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const filename = `project_${Date.now()}.json`;
                const filepath = path.join(__dirname, 'projects', filename);

                // إنشاء مجلد المشاريع إذا لم يكن موجوداً
                if (!fs.existsSync(path.join(__dirname, 'projects'))) {
                    fs.mkdirSync(path.join(__dirname, 'projects'));
                }

                fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
                
                res.writeHead(200);
                res.end(JSON.stringify({ 
                    success: true, 
                    message: 'تم الحفظ بنجاح',
                    filename: filename 
                }));
            } catch (error) {
                res.writeHead(500);
                res.end(JSON.stringify({ 
                    success: false, 
                    error: 'فشل في الحفظ' 
                }));
            }
        });
        return;
    }

    // تحميل المشروع
    if (pathname === '/api/load' && req.method === 'GET') {
        const filename = parsedUrl.query.file;
        if (!filename) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'اسم الملف مطلوب' }));
            return;
        }

        const filepath = path.join(__dirname, 'projects', filename);
        
        try {
            const data = fs.readFileSync(filepath, 'utf8');
            res.writeHead(200);
            res.end(data);
        } catch (error) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'الملف غير موجود' }));
        }
        return;
    }

    // قائمة المشاريع
    if (pathname === '/api/projects' && req.method === 'GET') {
        const projectsDir = path.join(__dirname, 'projects');
        
        try {
            if (!fs.existsSync(projectsDir)) {
                res.writeHead(200);
                res.end(JSON.stringify([]));
                return;
            }

            const files = fs.readdirSync(projectsDir)
                .filter(f => f.endsWith('.json'))
                .map(f => ({
                    name: f,
                    date: fs.statSync(path.join(projectsDir, f)).mtime
                }));

            res.writeHead(200);
            res.end(JSON.stringify(files));
        } catch (error) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'فشل في قراءة المشاريع' }));
        }
        return;
    }

    // تصدير الفيديو (محاكاة)
    if (pathname === '/api/export' && req.method === 'POST') {
        res.writeHead(200);
        res.end(JSON.stringify({ 
            success: true, 
            message: 'جاري معالجة التصدير...',
            downloadUrl: '/api/download/video.mp4'
        }));
        return;
    }

    // نقطة نهاية غير معروفة
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'نقطة النهاية غير موجودة' }));
}

// تشغيل الخادم
server.listen(PORT, () => {
    console.log(`
    🎬 استوديو الرسوم المتحركة يعمل!
    📍 العنوان: http://localhost:${PORT}
    📁 المجلد: ${PUBLIC_DIR}
    
    الاختصارات:
    - Ctrl+Z: تراجع
    - Ctrl+Y: إعادة
    - Space: تشغيل/إيقاف
    - Delete: حذف العظمة المحددة
    `);
});

// معالجة الأخطاء
process.on('uncaughtException', (err) => {
    console.error('خطأ غير متوقع:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('وعد مرفوض:', reason);
});