/* ============================================================
   Markdown Editor — GitHub-like with safe HTML
   ============================================================ */

(function (global) {
    'use strict';

    /* ============================================================
       SANITIZER — whitelist approach like GitHub
       ============================================================ */
    const ALLOWED_TAGS = new Set([
        'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
        'P', 'BR', 'HR', 'DIV', 'SPAN',
        'STRONG', 'B', 'EM', 'I', 'U', 'S', 'DEL', 'INS', 'MARK',
        'SMALL', 'SUB', 'SUP', 'ABBR', 'CITE', 'Q',
        'BLOCKQUOTE', 'PRE', 'CODE', 'KBD', 'SAMP',
        'UL', 'OL', 'LI',
        'A', 'IMG',
        'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD', 'CAPTION',
        'DETAILS', 'SUMMARY',
        'INPUT', // only checkbox
        'FIGURE', 'FIGCAPTION'
    ]);

    // attribute های مجاز به تفکیک tag
    const ALLOWED_ATTRS = {
        '*': ['class', 'id', 'title', 'dir', 'lang'],
        'A': ['href', 'title', 'target', 'rel'],
        'IMG': ['src', 'alt', 'title', 'width', 'height', 'loading'],
        'INPUT': ['type', 'checked', 'disabled'],
        'CODE': ['class', 'data-lang'],
        'PRE': ['class', 'data-lang'],
        'TH': ['align', 'colspan', 'rowspan', 'scope'],
        'TD': ['align', 'colspan', 'rowspan'],
        'OL': ['start', 'type'],
        'DETAILS': ['open'],
        'DIV': ['class', 'align'],
        'P': ['class', 'align']
    };

    /**
     * HTML رو با استفاده از DOMParser پاک‌سازی می‌کنه.
     * - تگ‌های غیرمجاز رو unwrap می‌کنه (محتوا حفظ می‌شه)
     * - attributeهای خطرناک (on*, javascript:, data:, ...) رو حذف می‌کنه
     * - لینک‌های خارجی رو ایمن می‌کنه
     */
    function sanitizeHtml(html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');

        function walk(node) {
            if (node.nodeType === Node.TEXT_NODE)
                return;

            // حذف کامل comment ها
            if (node.nodeType === Node.COMMENT_NODE) {
                node.parentNode.removeChild(node);

                return;
            }

            if (node.nodeType !== Node.ELEMENT_NODE) return;

            const tag = node.tagName.toUpperCase();

            /* ---------- تگ غیرمجاز → unwrap ---------- */
            if (!ALLOWED_TAGS.has(tag)) {
                // اگه script/style/iframe بود، کاملاً حذف کن (نه unwrap)
                if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'META', 'LINK', 'BASE', 'SVG', 'MATH'].includes(tag)) {
                    node.parentNode.removeChild(node);

                    return;
                }

                const parent = node.parentNode;
                while (node.firstChild)
                    parent.insertBefore(node.firstChild, node);

                parent.removeChild(node);

                return;
            }

            /* ---------- پاک‌سازی attributeها ---------- */
            const attrs = Array.from(node.attributes);
            for (const attr of attrs) {
                const name = attr.name.toLowerCase();
                const value = String(attr.value || '');

                // event handlers
                if (name.startsWith('on')) {
                    node.removeAttribute(attr.name);

                    continue;
                }

                // URL های خطرناک
                if ((name === 'href' || name === 'src' || name === 'xlink:href')) {
                    const trimmed = value.trim().toLowerCase();
                    if (
                        trimmed.startsWith('javascript:') ||
                        trimmed.startsWith('data:') && !trimmed.startsWith('data:image/') ||
                        trimmed.startsWith('vbscript:')
                    ) {
                        node.removeAttribute(attr.name);

                        continue;
                    }
                }

                // style attribute ممنوع (برای جلوگیری از XSS)
                if (name === 'style') {
                    node.removeAttribute(attr.name);

                    continue;
                }

                // whitelist
                const allowedForTag = ALLOWED_ATTRS[tag] || [];
                const allowedCommon = ALLOWED_ATTRS['*'] || [];
                if (!allowedForTag.includes(name) && !allowedCommon.includes(name)) {
                    node.removeAttribute(attr.name);
                }
            }

            /* ---------- محدودیت INPUT ---------- */
            if (tag === 'INPUT') {
                if (node.getAttribute('type') !== 'checkbox') {
                    node.parentNode.removeChild(node);

                    return;
                }

                node.setAttribute('disabled', '');
            }

            /* ---------- ایمن کردن لینک‌ها ---------- */
            if (tag === 'A') {
                const href = node.getAttribute('href') || '';
                // لینک‌های نسبی رو نگه دار، خارجی‌ها رو با rel ایمن کن
                if (/^https?:\/\//i.test(href) || href.startsWith('//')) {
                    node.setAttribute('target', '_blank');
                    node.setAttribute('rel', 'noopener noreferrer nofollow');
                }
            }

            /* ---------- lazy load برای تصاویر ---------- */
            if (tag === 'IMG') {
                node.setAttribute('loading', 'lazy');
            }

            // بازگشت به فرزندان (بعد از تغییرات، چون ممکنه حذف شده باشن)
            Array.from(node.childNodes).forEach(walk);
        }

        Array.from(doc.body.childNodes).forEach(walk);

        return doc.body.innerHTML;
    }

    /* ============================================================
       Markdown parser
       ============================================================ */
    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * بررسی اینکه آیا این خط HTML block هست یا نه
     */
    function isHtmlBlock(line) {
        return /^\s*<\/?[a-z][\s\S]*>/i.test(line.trim());
    }

    function parseMarkdown(md) {
        if (!md)
            return '';

        let html = md.replace(/\r\n?/g, '\n');

        /* ---------- 1) Code fences (قبل از هر پردازش) ---------- */
        const codeBlocks = [];
        html = html.replace(/```(\w+)?\n?([\s\S]*?)```/g, (_, lang, code) => {
            const idx = codeBlocks.length;
            const langAttr = lang ? ` data-lang="${escapeHtml(lang)}"` : '';
            const cls = lang ? ` class="language-${escapeHtml(lang)}"` : '';
            codeBlocks.push(
                `<pre${langAttr}><code${cls}>${escapeHtml(code.replace(/\n$/, ''))}</code></pre>`
            );

            return `\u0000CB${idx}\u0000`;
        });

        /* ---------- 2) Inline code (قبل از HTML) ---------- */
        const inlineCodes = [];
        html = html.replace(/`([^`\n]+)`/g, (_, code) => {
            const idx = inlineCodes.length;
            inlineCodes.push(`<code>${escapeHtml(code)}</code>`);

            return `\u0000IC${idx}\u0000`;
        });

        /* ---------- 3) Headings ---------- */
        html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
        html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
        html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
        html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
        html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

        /* ---------- 4) HR ---------- */
        html = html.replace(/^(?:\*{3,}|-{3,}|_{3,})\s*$/gm, '<hr>');

        /* ---------- 5) Blockquote ---------- */
        html = html.replace(/^>\s?(.+)$/gm, '<blockquote>$1</blockquote>');
        html = html.replace(/<\/blockquote>\n<blockquote>/g, '\n');

        /* ---------- 6) Tables ---------- */
        html = html.replace(
            /^\|(.+)\|\s*\n\|[\s:|-]+\|\s*\n((?:\|.+\|\s*\n?)+)/gm,
            (_, headerRow, bodyRows) => {
                const headers = headerRow.split('|').map((h) => h.trim());
                const rows = bodyRows.trim().split('\n').map((r) =>
                    r.split('|').slice(1, -1).map((c) => c.trim())
                );

                let t = '<table><thead><tr>';
                t += headers.map((h) => `<th>${h}</th>`).join('');
                t += '</tr></thead><tbody>';
                for (const row of rows) {
                    t += '<tr>' + row.map((c) => `<td>${c}</td>`).join('') + '</tr>';
                }

                t += '</tbody></table>';

                return t;
            }
        );

        /* ---------- 7) Task lists ---------- */
        html = html.replace(/^(\s*)[-*]\s+\[\s\]\s+(.+)$/gm,
            '$1<li class="task"><input type="checkbox" disabled> $2</li>');

        html = html.replace(/^(\s*)[-*]\s+\[x\]\s+(.+)$/gim,
            '$1<li class="task"><input type="checkbox" checked disabled> $2</li>');

        /* ---------- 8) Lists ---------- */
        html = html.replace(/^(\s*)[-*+]\s+(.+)$/gm, '$1<li>$2</li>');
        html = html.replace(/^(\s*)\d+\.\s+(.+)$/gm, '$1<li data-ordered>$2</li>');

        // wrap li
        html = html.replace(/((?:<li[^>]*>[\s\S]*?<\/li>\n?)+)/g, (match) => {
            const isOrdered = match.includes('data-ordered');
            const tag = isOrdered ? 'ol' : 'ul';

            return `<${tag}>${match.replace(/ data-ordered/g, '')}</${tag}>`;
        });

        /* ---------- 9) Bold / Italic / Strike ---------- */
        html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
        html = html.replace(/_(.+?)_/g, '<em>$1</em>');
        html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
        html = html.replace(/==(.+?)==/g, '<mark>$1</mark>');

        /* ---------- 10) Links + Images ---------- */
        html = html.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
            '<img src="$2" alt="$1"${3 ? ` title="$3"` : \'\'}>');
        html = html.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
            '<a href="$2"${3 ? ` title="$3"` : \'\'}>$1</a>');

        /* ---------- 11) Line breaks ---------- */
        html = html.replace(/ {2,}\n/g, '<br>\n');

        /* ---------- 12) Paragraphs ---------- */
        // خطوط رو دسته‌بندی می‌کنیم
        const lines = html.split('\n');
        const out = [];
        let para = [];

        const isBlockLine = (l) => {
            const t = l.trim();
            if (!t)
                return false;

            // block tags
            if (/^<\/?(?:h[1-6]|hr|blockquote|pre|ul|ol|table|details|li|div|p|figure|section|article|header|footer|nav|aside|main)/i.test(t))
                return true;

            // self-closing
            if (/^<(?:hr|br)\b/i.test(t))
                return true;

            return false;
        };

        const flushPara = () => {
            if (para.length) {
                const text = para.join(' ').trim();
                if (text)
                    out.push(`<p>${text}</p>`);

                para = [];
            }
        };

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) {
                flushPara();

                continue;
            }

            if (isBlockLine(line)) {
                flushPara();
                out.push(line);
            }

            else if (isHtmlBlock(line) && trimmed.startsWith('<')) {
                // HTML بلاک (مثل <div>...</div>)
                flushPara();
                out.push(line);
            }

            else {
                para.push(line);
            }
        }

        flushPara();

        html = out.join('\n');

        /* ---------- 13) Restore code ---------- */
        html = html.replace(/\u0000CB(\d+)\u0000/g, (_, i) => codeBlocks[Number(i)]);
        html = html.replace(/\u0000IC(\d+)\u0000/g, (_, i) => inlineCodes[Number(i)]);

        /* ---------- 14) Sanitize (مثل GitHub) ---------- */
        html = sanitizeHtml(html);

        return html;
    }

    /* ============================================================
       SVG Icons
       ============================================================ */
    const ICONS = {
        bold: `<svg viewBox="0 0 24 24"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path></svg>`,
        italic: `<svg viewBox="0 0 24 24"><line x1="19" y1="4" x2="10" y2="4"></line><line x1="14" y1="20" x2="5" y2="20"></line><line x1="15" y1="4" x2="9" y2="20"></line></svg>`,
        strike: `<svg viewBox="0 0 24 24"><path d="M17.5 9.5a3.5 3.5 0 0 0-3.5-3.5h-3a3 3 0 0 0-3 3c0 1.5 1 2.5 3 3"></path><path d="M6.5 14.5a3.5 3.5 0 0 0 3.5 3.5h3a3 3 0 0 0 3-3c0-1.5-1-2.5-3-3"></path><line x1="4" y1="12" x2="20" y2="12"></line></svg>`,
        mark: `<svg viewBox="0 0 24 24"><path d="M18 2l4 4-12 12H6v-4z"></path><path d="M2 22h20"></path></svg>`,
        h1: `<svg viewBox="0 0 24 24"><path d="M4 6v12"></path><path d="M12 6v12"></path><path d="M4 12h8"></path><path d="M17 10v8"></path><path d="M15 12l2-2 2 2"></path></svg>`,
        h2: `<svg viewBox="0 0 24 24"><path d="M4 6v12"></path><path d="M12 6v12"></path><path d="M4 12h8"></path><path d="M15 12a2 2 0 1 1 4 0c0 1.5-1.5 2.5-4 4h4"></path></svg>`,
        h3: `<svg viewBox="0 0 24 24"><path d="M4 6v12"></path><path d="M12 6v12"></path><path d="M4 12h8"></path><path d="M15 11a2 2 0 0 1 2-2h1a2 2 0 0 1 0 4h-1"></path><path d="M15 15a2 2 0 0 0 2 2h1a2 2 0 0 0 0-4"></path></svg>`,
        quote: `<svg viewBox="0 0 24 24"><path d="M6 17h3l2-4V7H5v6h3z"></path><path d="M14 17h3l2-4V7h-6v6h3z"></path></svg>`,
        code: `<svg viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`,
        codeblock: `<svg viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline><line x1="14" y1="4" x2="10" y2="20"></line></svg>`,
        link: `<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`,
        image: `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`,
        ul: `<svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>`,
        ol: `<svg viewBox="0 0 24 24"><line x1="10" y1="6" x2="21" y2="6"></line><line x1="10" y1="12" x2="21" y2="12"></line><line x1="10" y1="18" x2="21" y2="18"></line><path d="M4 6h1v4"></path><path d="M4 10h2"></path><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"></path></svg>`,
        task: `<svg viewBox="0 0 24 24"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>`,
        table: `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg>`,
        hr: `<svg viewBox="0 0 24 24"><line x1="3" y1="12" x2="21" y2="12"></line></svg>`,
        details: `<svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline><path d="M3 6v12h18V6z"></path></svg>`,
        html: `<svg viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline><line x1="14" y1="4" x2="10" y2="20"></line></svg>`
    };

    /* ============================================================
       Class
       ============================================================ */
    class MarkdownEditor {
        constructor(target, options = {}) {
            this.root = typeof target === 'string' ? document.querySelector(target) : target;
            if (!this.root)
                throw new Error('MarkdownEditor: target not found');

            this.name = options.name || 'content';
            this.value = options.value || '';
            this.placeholder = options.placeholder || 'شرح را اینجا بنویسید... (Markdown + HTML پشتیبانی می‌شود)';
            this.minHeight = options.minHeight || 260;
            this.onChange = options.onChange || (() => { });
            this.maxLength = options.maxLength || null;

            this._build();
            this._bind();
            this._updatePreview();
        }

        _build() {
            this.root.innerHTML = `
                <div class="md-editor">
                    <div class="md-editor__header">
                        <div class="md-editor__tabs">
                            <button type="button" class="md-tab active" data-tab="write">
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M12 20h9"></path>
                                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                                </svg>
                                نوشتن
                            </button>
                            <button type="button" class="md-tab" data-tab="preview">
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                    <circle cx="12" cy="12" r="3"></circle>
                                </svg>
                                پیش‌نمایش
                            </button>
                        </div>

                        <div class="md-editor__toolbar" data-role="toolbar">
                            <button type="button" class="md-tool" data-action="bold" title="Bold (Ctrl+B)">${ICONS.bold}</button>
                            <button type="button" class="md-tool" data-action="italic" title="Italic (Ctrl+I)">${ICONS.italic}</button>
                            <button type="button" class="md-tool" data-action="strike" title="Strikethrough">${ICONS.strike}</button>
                            <button type="button" class="md-tool" data-action="mark" title="Highlight">${ICONS.mark}</button>

                            <span class="md-toolbar-divider"></span>

                            <button type="button" class="md-tool" data-action="h1" title="Heading 1">${ICONS.h1}</button>
                            <button type="button" class="md-tool" data-action="h2" title="Heading 2">${ICONS.h2}</button>
                            <button type="button" class="md-tool" data-action="h3" title="Heading 3">${ICONS.h3}</button>

                            <span class="md-toolbar-divider"></span>

                            <button type="button" class="md-tool" data-action="quote" title="Quote">${ICONS.quote}</button>
                            <button type="button" class="md-tool" data-action="code" title="Inline code">${ICONS.code}</button>
                            <button type="button" class="md-tool" data-action="codeblock" title="Code block">${ICONS.codeblock}</button>

                            <span class="md-toolbar-divider"></span>

                            <button type="button" class="md-tool" data-action="ul" title="Bullet list">${ICONS.ul}</button>
                            <button type="button" class="md-tool" data-action="ol" title="Numbered list">${ICONS.ol}</button>
                            <button type="button" class="md-tool" data-action="task" title="Task list">${ICONS.task}</button>

                            <span class="md-toolbar-divider"></span>

                            <button type="button" class="md-tool" data-action="link" title="Link (Ctrl+K)">${ICONS.link}</button>
                            <button type="button" class="md-tool" data-action="image" title="Image">${ICONS.image}</button>
                            <button type="button" class="md-tool" data-action="table" title="Table">${ICONS.table}</button>
                            <button type="button" class="md-tool" data-action="hr" title="Horizontal rule">${ICONS.hr}</button>

                            <span class="md-toolbar-divider"></span>

                            <button type="button" class="md-tool" data-action="details" title="Collapsible section">${ICONS.details}</button>
                            <button type="button" class="md-tool md-tool--text" data-action="html" title="HTML tag">HTML</button>
                        </div>
                    </div>

                    <div class="md-editor__body">
                        <div class="md-editor__write" data-role="write">
                            <textarea
                                class="md-textarea"
                                data-role="textarea"
                                name="${this.name}"
                                placeholder="${this.placeholder}"
                                style="min-height:${this.minHeight}px"
                            ></textarea>
                        </div>
                        <div class="md-editor__preview" data-role="preview">
                            <div class="md-preview-content" data-role="preview-content"></div>
                        </div>
                    </div>

                    <div class="md-editor__footer">
                        <div class="md-editor__footer-right">
                            <span data-role="wordcount">0 کلمه</span>
                            ${this.maxLength ? `<span data-role="charcount">0 / ${this.maxLength}</span>` : ''}
                        </div>
                        <span>Markdown + HTML مجاز (مثل GitHub)</span>
                    </div>
                </div>
            `;

            this.els = {
                textarea: this.root.querySelector('[data-role="textarea"]'),
                write: this.root.querySelector('[data-role="write"]'),
                preview: this.root.querySelector('[data-role="preview"]'),
                previewContent: this.root.querySelector('[data-role="preview-content"]'),
                tabs: Array.from(this.root.querySelectorAll('.md-tab')),
                toolbar: this.root.querySelector('[data-role="toolbar"]'),
                wordcount: this.root.querySelector('[data-role="wordcount"]'),
                charcount: this.root.querySelector('[data-role="charcount"]'),
            };

            this.els.textarea.value = this.value;
            this._updateCounter();
        }

        _bind() {
            const ta = this.els.textarea;

            ta.addEventListener('input', () => {
                this.value = ta.value;
                this._updatePreview();
                this._updateCounter();
                this.onChange(this.value);
            });

            this.els.tabs.forEach((tab) => {
                tab.addEventListener('click', () => this._setTab(tab.dataset.tab));
            });

            this.els.toolbar.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-action]');
                if (!btn)
                    return;

                e.preventDefault();
                this._applyAction(btn.dataset.action);
            });

            ta.addEventListener('keydown', (e) => {
                const ctrl = e.ctrlKey || e.metaKey;

                if (ctrl && e.key.toLowerCase() === 'b') {
                    e.preventDefault(); this._applyAction('bold');
                }

                else if (ctrl && e.key.toLowerCase() === 'i') {
                    e.preventDefault(); this._applyAction('italic');
                }

                else if (ctrl && e.key.toLowerCase() === 'k') {
                    e.preventDefault(); this._applyAction('link');
                }

                else if (e.key === 'Tab') {
                    e.preventDefault(); this._insertText('  ');
                }
            });
        }

        _setTab(tab) {
            this.els.tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));

            if (tab === 'preview') {
                this._updatePreview();
                this.els.write.classList.add('hidden');
                this.els.preview.classList.add('active');
            }

            else {
                this.els.write.classList.remove('hidden');
                this.els.preview.classList.remove('active');
                this.els.textarea.focus();
            }
        }

        _updatePreview() {
            const html = parseMarkdown(this.value);
            this.els.previewContent.innerHTML = html || '<div class="md-empty">چیزی برای نمایش نیست — شروع به نوشتن کنید</div>';
        }

        _updateCounter() {
            const text = this.value.trim();
            const words = text ? text.split(/\s+/).length : 0;
            if (this.els.wordcount)
                this.els.wordcount.textContent = `${words} کلمه`;

            if (this.els.charcount && this.maxLength) {
                this.els.charcount.textContent = `${this.value.length} / ${this.maxLength}`;
            }
        }

        _insertText(before, after = '') {
            const ta = this.els.textarea;
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            const selected = ta.value.slice(start, end);
            const text = before + selected + after;

            ta.setRangeText(text, start, end, 'end');

            if (!selected) {
                ta.setSelectionRange(start + before.length, start + before.length);
            }

            ta.focus();
            ta.dispatchEvent(new Event('input', { bubbles: true }));
        }

        _toggleLinePrefix(prefix) {
            const ta = this.els.textarea;
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            const value = ta.value;

            let lineStart = value.lastIndexOf('\n', start - 1) + 1;
            let lineEnd = value.indexOf('\n', end);
            if (lineEnd === -1)
                lineEnd = value.length;

            const block = value.slice(lineStart, lineEnd);
            const lines = block.split('\n');
            const hasPrefix = lines.every((l) => l.startsWith(prefix));

            const newLines = lines.map((l) => {
                if (hasPrefix)
                    return l.slice(prefix.length);

                return prefix + l.replace(/^(#{1,6}\s+|[-*+]\s+|\d+\.\s+|>\s+|- \[[ x]\]\s+)/, '');
            });

            ta.setRangeText(newLines.join('\n'), lineStart, lineEnd, 'end');
            ta.focus();
            ta.dispatchEvent(new Event('input', { bubbles: true }));
        }

        _applyAction(action) {
            const ta = this.els.textarea;
            ta.focus();

            switch (action) {
                case 'bold': this._insertText('**', '**'); break;
                case 'italic': this._insertText('*', '*'); break;
                case 'strike': this._insertText('~~', '~~'); break;
                case 'mark': this._insertText('==', '=='); break;
                case 'code': this._insertText('`', '`'); break;
                case 'codeblock': this._insertText('\n```\n', '\n```\n'); break;

                case 'h1': this._toggleLinePrefix('# '); break;
                case 'h2': this._toggleLinePrefix('## '); break;
                case 'h3': this._toggleLinePrefix('### '); break;

                case 'quote': this._toggleLinePrefix('> '); break;
                case 'ul': this._toggleLinePrefix('- '); break;
                case 'ol': this._toggleLinePrefix('1. '); break;
                case 'task': this._toggleLinePrefix('- [ ] '); break;

                case 'link': this._insertText('[', '](url)'); break;
                case 'image': this._insertText('![alt](', ')'); break;

                case 'hr': this._insertText('\n\n---\n\n'); break;

                case 'table':
                    this._insertText(
                        '\n| ستون ۱ | ستون ۲ | ستون ۳ |\n|--------|--------|--------|\n|        |        |        |\n'
                    );
                    break;

                case 'details':
                    this._insertText(
                        '\n<details>\n<summary>عنوان</summary>\n\nمحتوا...\n\n</details>\n'
                    );
                    break;

                case 'html':
                    this._insertText('<div>\n  ', '\n</div>\n');
                    break;
            }
        }

        /* API */
        getValue() {
            return this.value;
        }

        setValue(v) {
            this.value = v || '';
            this.els.textarea.value = this.value;
            this._updatePreview();
            this._updateCounter();
        }

        focus() {
            this.els.textarea.focus();
        }

        getTextarea() {
            return this.els.textarea;
        }
    }

    /* ---------- Expose ---------- */
    global.MarkdownEditor = MarkdownEditor;
    global.parseMarkdown = parseMarkdown;
    global.sanitizeHtml = sanitizeHtml;

})(window);

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */