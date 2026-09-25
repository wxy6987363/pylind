// layout-module.js - Pyodide Layout 模块完整封装（重构版）

/**
 * 初始化 Layout 模块
 *
 * @param {Object} pyodide - Pyodide 实例
 * @param {HTMLElement} renderEl - 渲染目标元素
 */
export async function importLayout(pyodide, renderEl) {

    // ============================================================
    // 1. CSS 类
    // ============================================================
    class CSS {
        constructor(element) {
            this._el = element;
        }

        set(name, value) {
            this._el.style[name] = value;
            return this;
        }

        get(name) {
            return this._el.style[name];
        }

        setAll(cssText) {
            this._el.style.cssText = cssText;
            return this;
        }

        getAll() {
            return this._el.style.cssText;
        }

        batch(styles) {
            for (let key in styles) {
                this._el.style[key] = styles[key];
            }
            return this;
        }
    }

    // ============================================================
    // 2. 子元素管理类
    // ============================================================
    class Children {
        constructor(element) {
            this._el = element;
        }

        get list() {
            const children = [];
            for (let child of this._el.children) {
                if (child._elementRef) {
                    children.push(child._elementRef);
                } else {
                    children.push(child);
                }
            }
            return children;
        }

        add(child) {
            if (child instanceof Element) {
                this._el.appendChild(child.el);
                child.el._elementRef = child;
            } else if (child instanceof HTMLElement) {
                this._el.appendChild(child);
            } else {
                this._el.appendChild(child);
            }
            return this;
        }

        remove(child) {
            if (child instanceof Element) {
                if (child.el.parentNode === this._el) {
                    this._el.removeChild(child.el);
                    delete child.el._elementRef;
                }
            } else if (child instanceof HTMLElement) {
                if (child.parentNode === this._el) {
                    this._el.removeChild(child);
                }
            }
            return this;
        }

        clear() {
            while (this._el.firstChild) {
                const child = this._el.firstChild;
                if (child._elementRef) {
                    delete child._elementRef;
                }
                this._el.removeChild(child);
            }
            return this;
        }

        get length() {
            return this._el.children.length;
        }
    }

    // ============================================================
    // 3. 属性管理类
    // ============================================================
    class Attributes {
        constructor(element) {
            this._el = element;
        }

        get(name) {
            return this._el.getAttribute(name);
        }

        set(name, value) {
            if (value === null || value === undefined) {
                this._el.removeAttribute(name);
            } else {
                this._el.setAttribute(name, value);
            }
            return this;
        }

        batch(attributes) {
            const attrs = attributes && typeof attributes === 'object' ? attributes : {};
            for (let key in attrs) {
                if (attrs.hasOwnProperty(key)) {
                    this.set(key, attrs[key]);
                }
            }
            return this;
        }

        has(name) {
            return this._el.hasAttribute(name);
        }

        remove(name) {
            this._el.removeAttribute(name);
            return this;
        }

        getAll() {
            const attrs = {};
            for (let attr of this._el.attributes) {
                attrs[attr.name] = attr.value;
            }
            return pyodide.toPy(attrs);
        }
    }

    // ============================================================
    // 4. 表单数据类
    // ============================================================
    class FormData {
        constructor() {
            this._data = {};
        }

        set(name, value) {
            this._data[name] = value;
            return this;
        }

        get(name) {
            return this._data[name] || null;
        }

        toPy() {
            return pyodide.toPy(this._data);
        }

        has(name) {
            return name in this._data;
        }

        delete(name) {
            delete this._data[name];
            return this;
        }

        clear() {
            this._data = {};
            return this;
        }

        keys() {
            return Object.keys(this._data);
        }

        values() {
            return Object.values(this._data);
        }

        forEach(callback) {
            for (let key in this._data) {
                callback(this._data[key], key);
            }
            return this;
        }

        toJSON() {
            return JSON.stringify(this._data);
        }

        toFormData() {
            const formData = new window.FormData();
            for (let key in this._data) {
                formData.append(key, this._data[key]);
            }
            return formData;
        }
    }

    // ============================================================
    // 5. 表单管理类
    // ============================================================
    class FormManager {
        constructor(element) {
            this._el = element;
            this._fields = {};
            this._formData = new FormData();
        }

        addField(name, element) {
            this._fields[name] = element;
            if (element.el && element.el.setAttribute) {
                element.el.setAttribute('name', name);
            }
            this._el.appendChild(element.el);

            if (element.el) {
                element.el.addEventListener('input', () => {
                    this._updateData(name);
                });
                element.el.addEventListener('change', () => {
                    this._updateData(name);
                });
            }

            return this;
        }

        _updateData(name) {
            const field = this._fields[name];
            if (!field) return;

            let value = '';
            if (field.value !== undefined) {
                value = field.value;
            } else {
                value = field.content || '';
            }
            this._formData.set(name, value);
        }

        updateAllData() {
            for (let name in this._fields) {
                this._updateData(name);
            }
            return this;
        }

        getValue(name) {
            const field = this._fields[name];
            if (!field) return null;
            if (field.value !== undefined) {
                return field.value;
            }
            return field.content || '';
        }

        setValue(name, value) {
            const field = this._fields[name];
            if (!field) return this;
            if (field.value !== undefined) {
                field.value = value;
            } else {
                field.content = value;
            }
            this._formData.set(name, value);
            return this;
        }

        get fields() {
            return this._fields;
        }

        get data() {
            this.updateAllData();
            return this._formData.toPy();
        }

        validate() {
            const errors = {};
            let isValid = true;
            for (let name in this._fields) {
                const field = this._fields[name];
                const value = this.getValue(name);
                if (field.el && field.el.hasAttribute('required')) {
                    if (!value || value.trim() === '') {
                        errors[name] = '此字段为必填项';
                        isValid = false;
                        field.css.set('border-color', '#e91e63');
                    } else {
                        field.css.set('border-color', '');
                    }
                }
            }
            return pyodide.toPy({ isValid, errors });
        }

        reset() {
            for (let name in this._fields) {
                const field = this._fields[name];
                if (field.value !== undefined) {
                    field.value = '';
                } else {
                    field.content = '';
                }
                field.css.set('border-color', '');
                this._formData.set(name, '');
            }
            return this;
        }

        clear() {
            this._fields = {};
            this._formData.clear();
            this._el.innerHTML = '';
            return this;
        }
    }

    // ============================================================
    // 6. 元素基类
    // ============================================================
    /**
     * 元素基类
     * @param {HTMLElement} el - 实际 DOM 元素
     * @param {string} id
     * @param {string} classes
     * @param {string} content
     * @param {Object} [opts]
     * @param {HTMLElement|null} [opts.parent] - 挂载父节点。默认为 renderEl；
     *                                            传 null 表示不挂载（由调用方负责）。
     */
    class Element {
        constructor(el, id, classes, content, opts = {}) {
            if (id) el.id = id;
            if (classes) {
                classes.split(' ').forEach(cls => {
                    if (cls.trim()) el.classList.add(cls.trim());
                });
            }
            el.textContent = content || '';

            this.el = el;
            el._elementRef = this;

            // 组合：使用类实例
            this._css = new CSS(el);
            this._children = new Children(el);
            this._attrs = new Attributes(el);

            // ✅ 统一挂载策略
            if (opts.parent === null) {
                // 不挂载，交给调用方
            } else {
                const parent = opts.parent || renderEl;
                if (parent) parent.appendChild(el);
            }
        }

        // --- 内容 ---
        get content() {
            return this.el.textContent;
        }
        set content(val) {
            this.el.textContent = val;
        }

        // --- ID ---
        get id() {
            return this.el.id;
        }
        set id(val) {
            this.el.id = val;
        }

        // --- CSS ---
        get css() {
            return this._css;
        }

        // --- 子元素 ---
        get children() {
            return this._children;
        }

        // --- 属性 ---
        get attrs() {
            return this._attrs;
        }

        // 兼容旧 API
        get attr() {
            return this._attrs;
        }

        // --- 父元素 ---
        get parent() {
            if (this.el.parentNode && this.el.parentNode._elementRef) {
                return this.el.parentNode._elementRef;
            }
            return null;
        }

        // --- 类名操作 ---
        get classes() {
            return {
                add: (cls) => this.el.classList.add(cls),
                remove: (cls) => this.el.classList.remove(cls),
                toggle: (cls) => this.el.classList.toggle(cls),
                contains: (cls) => this.el.classList.contains(cls),
                list: () => Array.from(this.el.classList)
            };
        }

        // --- 快捷属性方法 ---
        getAttr(name) {
            return this._attrs.get(name);
        }

        setAttr(name, value) {
            return this._attrs.set(name, value);
        }

        setAttrs(attributes) {
            return this._attrs.batch(attributes);
        }

        // --- HTML ---
        get html() {
            return this.el.innerHTML;
        }
        set html(val) {
            this.el.innerHTML = val;
        }

        // --- 显示/隐藏 ---
        show() {
            this.el.style.display = '';
            return this;
        }

        hide() {
            this.el.style.display = 'none';
            return this;
        }

        // --- 事件 ---
        on(eventName, callback) {
            this.el.addEventListener(eventName, (e) => {
                callback(e);
            });
            return this;
        }

        off(eventName, callback) {
            this.el.removeEventListener(eventName, callback);
            return this;
        }

        // --- 移除 ---
        remove() {
            if (this.el.parentNode) {
                this.el.parentNode.removeChild(this.el);
            }
            delete this.el._elementRef;
            return this;
        }
    }

    // ============================================================
    // 7. 列表项类（不自动挂载到 renderEl）
    // ============================================================
    class ListItem extends Element {
        constructor(content = '', id = '', classes = '') {
            const el = document.createElement('li');
            // ✅ parent: null → 不挂载，由 List.addItem 负责
            super(el, id, classes, content, { parent: null });
        }

        // 设置列表项内容
        setContent(content) {
            this.content = content;
            return this;
        }

        // 获取列表项内容
        getContent() {
            return this.content;
        }
    }

    // ============================================================
    // 8. 列表基类 (Ul 和 Ol 的父类)
    // ============================================================
    class List extends Element {
        constructor(tag, id, classes, items = []) {
            const el = document.createElement(tag);
            // ✅ 先 super（挂载到 renderEl），再初始化 _items
            super(el, id, classes, '');
            this._items = [];
            if (Array.isArray(items) && items.length > 0) {
                this.addItems(items);
            }
        }

        // 内部工具：把输入统一成 ListItem
        _normalizeItem(content) {
            if (content instanceof ListItem) return content;
            if (content instanceof Element) {
                throw new TypeError('List.addItem 只接受 string 或 ListItem');
            }
            return new ListItem(String(content ?? ''));
        }

        // 添加列表项（支持字符串或 ListItem 对象）
        addItem(content) {
            const item = this._normalizeItem(content);
            this.el.appendChild(item.el);       // ✅ 唯一挂载点
            item.el._elementRef = item;          // 确保引用
            this._items.push(item);
            return this;
        }

        // 批量添加列表项
        addItems(items) {
            for (let item of items) {
                this.addItem(item);
            }
            return this;
        }

        // 插入列表项到指定位置
        insertItem(index, content) {
            const item = this._normalizeItem(content);

            if (index >= 0 && index < this._items.length) {
                this.el.insertBefore(item.el, this._items[index].el);
                item.el._elementRef = item;
                this._items.splice(index, 0, item);
            } else {
                this.el.appendChild(item.el);
                item.el._elementRef = item;
                this._items.push(item);
            }
            return this;
        }

        // 移除列表项
        removeItem(index) {
            if (index >= 0 && index < this._items.length) {
                const item = this._items[index];
                if (item.el.parentNode === this.el) {
                    this.el.removeChild(item.el);
                }
                delete item.el._elementRef;
                this._items.splice(index, 1);
            }
            return this;
        }

        // 移除所有列表项
        clearItems() {
            for (let item of this._items) {
                if (item.el.parentNode === this.el) {
                    this.el.removeChild(item.el);
                }
                delete item.el._elementRef;
            }
            this._items = [];
            return this;
        }

        // 获取所有列表项内容
        getItems() {
            return this._items.map(item => item.content);
        }

        // 获取列表项对象列表（返回副本，防止外部乱改内部数组）
        getItemObjects() {
            return this._items.slice();
        }

        // 获取列表项数量
        get count() {
            return this._items.length;
        }

        // 获取列表项数量（兼容属性）
        get length() {
            return this._items.length;
        }

        // 更新列表项
        updateItem(index, content) {
            if (index >= 0 && index < this._items.length) {
                this._items[index].content = content;
            }
            return this;
        }

        // 获取列表信息（返回 Python 字典）
        getInfo() {
            const items = this._items.map(item => item.content);
            return pyodide.toPy({
                type: this.el.tagName.toLowerCase(),
                count: this._items.length,
                items: items,
                id: this.id,
                classes: this.el.className
            });
        }

        // 转换为 Python 列表
        toPythonList() {
            const items = this._items.map(item => item.content);
            return pyodide.toPy(items);
        }

        // 覆盖父类 remove：同时清理 _items
        remove() {
            this.clearItems();
            return super.remove();
        }
    }

    // ============================================================
    // 9. 无序列表类
    // ============================================================
    class Ul extends List {
        constructor(id, classes, items = []) {
            super('ul', id, classes, items);
        }
    }

    // ============================================================
    // 10. 有序列表类
    // ============================================================
    class Ol extends List {
        constructor(id, classes, items = []) {
            super('ol', id, classes, items);
        }

        // 设置列表类型（1, A, a, I, i）
        setType(type) {
            this.el.type = type;
            return this;
        }

        // 设置起始编号
        setStart(start) {
            this.el.start = start;
            return this;
        }

        // 反转编号顺序
        setReversed(reversed = true) {
            this.el.reversed = reversed;
            return this;
        }
    }

    // ============================================================
    // 11. 具体元素类
    // ============================================================

    // --- Span ---
    class Span extends Element {
        constructor(id, classes, content) {
            const el = document.createElement('span');
            super(el, id, classes, content);
        }
    }

    // --- Div ---
    class Div extends Element {
        constructor(id, classes, content) {
            const el = document.createElement('div');
            super(el, id, classes, content);
        }
    }

    // --- Button ---
    class Button extends Element {
        constructor(id, classes, content) {
            const el = document.createElement('button');
            super(el, id, classes, content);
        }

        disable() {
            this.el.disabled = true;
            return this;
        }

        enable() {
            this.el.disabled = false;
            return this;
        }
    }

    // --- Input ---
    class Input extends Element {
        constructor(id, classes, type = 'text', placeholder = '') {
            const el = document.createElement('input');
            if (type) el.type = type;
            if (placeholder) el.placeholder = placeholder;
            super(el, id, classes, '');
        }

        get value() {
            return this.el.value;
        }
        set value(val) {
            this.el.value = val;
        }

        get placeholder() {
            return this.el.placeholder;
        }
        set placeholder(val) {
            this.el.placeholder = val;
        }

        get type() {
            return this.el.type;
        }
        set type(val) {
            this.el.type = val;
        }

        focus() {
            this.el.focus();
            return this;
        }

        blur() {
            this.el.blur();
            return this;
        }
    }

    // --- Textarea ---
    class Textarea extends Element {
        constructor(id, classes, placeholder = '', rows = 4, cols = 50) {
            const el = document.createElement('textarea');
            if (placeholder) el.placeholder = placeholder;
            if (rows) el.rows = rows;
            if (cols) el.cols = cols;
            super(el, id, classes, '');
        }

        get value() {
            return this.el.value;
        }
        set value(val) {
            this.el.value = val;
        }

        get placeholder() {
            return this.el.placeholder;
        }
        set placeholder(val) {
            this.el.placeholder = val;
        }

        get rows() {
            return this.el.rows;
        }
        set rows(val) {
            this.el.rows = val;
        }

        get cols() {
            return this.el.cols;
        }
        set cols(val) {
            this.el.cols = val;
        }

        focus() {
            this.el.focus();
            return this;
        }

        blur() {
            this.el.blur();
            return this;
        }
    }

    // --- Image ---
    class Image extends Element {
        constructor(id, classes, src = '', alt = '') {
            const el = document.createElement('img');
            if (src) el.src = src;
            if (alt) el.alt = alt;
            super(el, id, classes, '');
        }

        get src() {
            return this.el.src;
        }
        set src(val) {
            this.el.src = val;
        }

        get alt() {
            return this.el.alt;
        }
        set alt(val) {
            this.el.alt = val;
        }

        get width() {
            return this.el.width;
        }
        set width(val) {
            this.el.width = val;
        }

        get height() {
            return this.el.height;
        }
        set height(val) {
            this.el.height = val;
        }

        get title() {
            return this.el.title;
        }
        set title(val) {
            this.el.title = val;
        }

        get naturalWidth() {
            return this.el.naturalWidth;
        }

        get naturalHeight() {
            return this.el.naturalHeight;
        }

        get complete() {
            return this.el.complete;
        }

        onLoad(callback) {
            this.el.addEventListener('load', callback);
            return this;
        }

        onError(callback) {
            this.el.addEventListener('error', callback);
            return this;
        }

        getNaturalSize() {
            return {
                width: this.el.naturalWidth,
                height: this.el.naturalHeight
            };
        }

        getInfo() {
            return pyodide.toPy({
                src: this.el.src || '',
                alt: this.el.alt || '',
                width: this.el.width || 0,
                height: this.el.height || 0,
                naturalWidth: this.el.naturalWidth || 0,
                naturalHeight: this.el.naturalHeight || 0,
                complete: this.el.complete || false,
                title: this.el.title || '',
                currentSrc: this.el.currentSrc || ''
            });
        }

        setSrc(src) {
            this.el.src = src;
            return this;
        }

        setAlt(alt) {
            this.el.alt = alt;
            return this;
        }

        setSize(width, height) {
            if (width !== undefined) this.el.width = width;
            if (height !== undefined) this.el.height = height;
            return this;
        }

        reload() {
            const src = this.el.src;
            this.el.src = '';
            setTimeout(() => {
                this.el.src = src;
            }, 10);
            return this;
        }
    }

    // --- Link ---
    class Link extends Element {
        constructor(id, classes, content = '', href = '#', target = '_self') {
            const el = document.createElement('a');
            el.href = href;
            el.target = target;
            super(el, id, classes, content);
        }

        get href() {
            return this.el.href;
        }
        set href(val) {
            this.el.href = val;
        }

        get target() {
            return this.el.target;
        }
        set target(val) {
            this.el.target = val;
        }

        get download() {
            return this.el.download;
        }
        set download(val) {
            this.el.download = val;
        }

        get rel() {
            return this.el.rel;
        }
        set rel(val) {
            this.el.rel = val;
        }

        open() {
            window.open(this.el.href, this.el.target);
            return this;
        }

        getInfo() {
            return pyodide.toPy({
                href: this.el.href || '',
                target: this.el.target || '_self',
                download: this.el.download || '',
                rel: this.el.rel || '',
                text: this.el.textContent || '',
                hostname: this.el.hostname || '',
                pathname: this.el.pathname || ''
            });
        }

        setHref(href) {
            this.el.href = href;
            return this;
        }

        setTarget(target) {
            this.el.target = target;
            return this;
        }

        setDownload(filename) {
            this.el.download = filename;
            return this;
        }
    }

    // --- Form ---
    class Form extends Element {
        constructor(id, classes) {
            const el = document.createElement('form');
            el.addEventListener('submit', (e) => {
                e.preventDefault();
            });
            super(el, id, classes, '');
            this._formManager = new FormManager(el);
        }

        get form() {
            return this._formManager;
        }

        get data() {
            return this._formManager.data;
        }

        onSubmit(callback) {
            this.el.addEventListener('submit', (e) => {
                e.preventDefault();
                callback(e);
            });
            return this;
        }
    }

    // ============================================================
    // 12. Layout 模块
    // ============================================================
    const layoutModule = {
        // 基础元素
        span: function (id, classes, content) {
            return new Span(id, classes, content);
        },

        div: function (id, classes, content) {
            return new Div(id, classes, content);
        },

        button: function (id, classes, content) {
            return new Button(id, classes, content);
        },

        input: function (id, classes, type, placeholder) {
            return new Input(id, classes, type, placeholder);
        },

        textarea: function (id, classes, placeholder, rows, cols) {
            return new Textarea(id, classes, placeholder, rows, cols);
        },

        form: function (id, classes) {
            return new Form(id, classes);
        },

        img: function (id, classes, src, alt) {
            return new Image(id, classes, src, alt);
        },

        a: function (id, classes, content, href, target) {
            return new Link(id, classes, content, href, target);
        },

        // 列表元素
        ul: function (id, classes, items = []) {
            return new Ul(id, classes, items);
        },

        ol: function (id, classes, items = []) {
            return new Ol(id, classes, items);
        },

        // 注意：单独创建的 li 不会自动挂到 renderEl，
        // 需要通过 list.addItem(li) 挂载。
        li: function (content = '', id = '', classes = '') {
            return new ListItem(content, id, classes);
        },

        // CSS 样式管理
        css: function (cssText) {
            let styleEl = document.getElementById('layout-styles');
            if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = 'layout-styles';
                document.head.appendChild(styleEl);
            }
            styleEl.textContent += '\n' + cssText;
        },

        // 清除所有内容
        clear: function () {
            renderEl.innerHTML = '';
            const styleEl = document.getElementById('layout-styles');
            if (styleEl) {
                styleEl.textContent = '';
            }
        },

        // 批量创建元素
        createMany: function (elements) {
            return elements.map(({ type, id, classes, content, ...props }) => {
                const elementMap = {
                    'span': () => new Span(id, classes, content),
                    'div': () => new Div(id, classes, content),
                    'button': () => new Button(id, classes, content),
                    'input': () => new Input(id, classes, props.type, props.placeholder),
                    'textarea': () => new Textarea(id, classes, props.placeholder, props.rows, props.cols),
                    'img': () => new Image(id, classes, props.src, props.alt),
                    'a': () => new Link(id, classes, content, props.href, props.target),
                    'form': () => new Form(id, classes),
                    'ul': () => new Ul(id, classes, props.items || []),
                    'ol': () => new Ol(id, classes, props.items || [])
                };
                return elementMap[type] ? elementMap[type]() : null;
            }).filter(el => el !== null);
        },

        // 获取元素位置
        getPosition: function (element) {
            const rect = element.el.getBoundingClientRect();
            return pyodide.toPy({
                top: rect.top,
                left: rect.left,
                bottom: rect.bottom,
                right: rect.right,
                width: rect.width,
                height: rect.height,
                x: rect.x,
                y: rect.y
            });
        },

        // 滚动到元素
        scrollTo: function (element, behavior = 'smooth') {
            if (element && element.el) {
                element.el.scrollIntoView({ behavior });
            }
            return this;
        }
    };

    // ============================================================
    // 13. 注册到 Pyodide + 内部初始化（callback / loop 等）
    // ============================================================
    pyodide.registerJsModule('layout', layoutModule);
	
	renderEl.innerHTML = '';
	const styleEl = document.getElementById('layout-styles');
	if (styleEl) {
	    styleEl.textContent = '';
	}
}

// --- 默认导出 ---
export default importLayout;