# Layout 模块 README
	
	> 一个用 Python 操作界面元素的布局库。支持创建元素、绑定事件、表单、列表、异步更新等能力。
	
	---
	
	## 目录
	
	- [简介](#简介)
	- [快速开始](#快速开始)
	- [基础元素](#基础元素)
	- [列表元素](#列表元素)
	- [表单](#表单)
	- [元素通用 API](#元素通用-api)
	- [回调机制](#回调机制)
	- [异步支持](#异步支持)
	- [全局工具函数](#全局工具函数)
	- [完整示例](#完整示例)
	
	---
	
	## 简介
	
	\`layout\` 是一个纯 Python 调用的布局模块，让你用 Python 代码创建和操作界面元素：
	
	- 创建各种元素（文本、按钮、输入框、图片、链接等）
	- 绑定事件与 Python 回调函数
	- 表单字段管理与校验
	- 动态列表增删
	- 与 \`asyncio\` 协作实现异步更新
	
	所有元素默认挂载到预先指定的渲染区域，Python 端无需关心底层细节。
	
	---
	
	## 快速开始
	
	\`\`\`python
	from layout import div, button
	
	# 创建元素（自动挂载到渲染区域）
	div("title", "title", "Hello Layout")
	
	# 绑定事件
	def on_click(event):
	    print("clicked!")
	
	button("btn", "", "点我").on("click", callback(on_click))
	
	# 保持程序运行（等待事件循环）
	loop()
	\`\`\`
	
	---
	
	## 基础元素
	
	所有创建函数签名形如 \`func(id, classes, ...)\`，均返回对应元素对象。
	
	### span
	
	\`\`\`python
	span(id, classes, content)
	\`\`\`
	
	### div
	
	\`\`\`python
	div(id, classes, content)
	\`\`\`
	
	### button
	
	\`\`\`python
	button(id, classes, content)
	\`\`\`
	
	额外方法：
	
	| 方法 | 说明 |
	|------|------|
	| \`disable()\` | 禁用按钮 |
	| \`enable()\` | 启用按钮 |
	
	### input
	
	\`\`\`python
	input(id, classes, type='text', placeholder='')
	\`\`\`
	
	属性：
	
	| 属性 | 说明 |
	|------|------|
	| \`value\` | 输入值 |
	| \`placeholder\` | 占位符 |
	| \`type\` | 输入类型 |
	
	方法：\`focus()\`、\`blur()\`
	
	### textarea
	
	\`\`\`python
	textarea(id, classes, placeholder='', rows=4, cols=50)
	\`\`\`
	
	属性：\`value\`、\`placeholder\`、\`rows\`、\`cols\`
	
	方法：\`focus()\`、\`blur()\`
	
	### img
	
	\`\`\`python
	img(id, classes, src='', alt='')
	\`\`\`
	
	属性：\`src\`、\`alt\`、\`width\`、\`height\`、\`title\`、\`naturalWidth\`、\`naturalHeight\`、\`complete\`
	
	方法：
	
	| 方法 | 说明 |
	|------|------|
	| \`setSrc(src)\` | 设置图片地址 |
	| \`setAlt(alt)\` | 设置替代文本 |
	| \`setSize(width, height)\` | 设置尺寸 |
	| \`reload()\` | 重新加载图片 |
	| \`onLoad(fn)\` | 加载完成回调 |
	| \`onError(fn)\` | 加载失败回调 |
	| \`getNaturalSize()\` | 获取原始尺寸 |
	| \`getInfo()\` | 获取图片信息（返回 dict） |
	
	### a（链接）
	
	\`\`\`python
	a(id, classes, content='', href='#', target='_self')
	\`\`\`
	
	属性：\`href\`、\`target\`、\`download\`、\`rel\`
	
	方法：
	
	| 方法 | 说明 |
	|------|------|
	| \`open()\` | 打开链接 |
	| \`setHref(href)\` | 设置地址 |
	| \`setTarget(target)\` | 设置打开方式 |
	| \`setDownload(filename)\` | 设置下载文件名 |
	| \`getInfo()\` | 获取链接信息（返回 dict） |
	
	---
	
	## 列表元素
	
	### ul
	
	\`\`\`python
	ul(id, classes, items=[])
	\`\`\`
	
	### ol
	
	\`\`\`python
	ol(id, classes, items=[])
	\`\`\`
	
	\`ol\` 额外方法：
	
	| 方法 | 说明 |
	|------|------|
	| \`setType(type)\` | 编号类型（\`1\` / \`A\` / \`a\` / \`I\` / \`i\`） |
	| \`setStart(start)\` | 起始编号 |
	| \`setReversed(flag)\` | 反转顺序 |
	
	### li
	
	\`\`\`python
	li(content='', id='', classes='')
	\`\`\`
	
	> 单独创建的 \`li\` **不会自动挂载**，需要通过 \`list.addItem(li)\` 添加。
	
	### 列表通用方法
	
	| 方法 | 说明 |
	|------|------|
	| \`addItem(content)\` | 添加一项（string 或 \`li\`） |
	| \`addItems(items)\` | 批量添加 |
	| \`insertItem(index, content)\` | 指定位置插入 |
	| \`removeItem(index)\` | 删除指定项 |
	| \`clearItems()\` | 清空所有项 |
	| \`updateItem(index, content)\` | 更新某项内容 |
	| \`getItems()\` | 返回所有项内容（list） |
	| \`getItemObjects()\` | 返回所有项对象（list） |
	| \`getInfo()\` | 返回列表信息（dict） |
	| \`toPythonList()\` | 转换为 Python list |
	
	属性：\`count\`、\`length\`（项数）
	
	---
	
	## 表单
	
	### 创建表单
	
	\`\`\`python
	from layout import form, input, button
	
	f = form("my-form", "form-class")
	
	name = input("name", "", "text", "姓名")
	name.attrs.set("required", "")
	
	age = input("age", "", "number", "年龄")
	
	f.form.addField("name", name)
	f.form.addField("age", age)
	\`\`\`
	
	### 表单方法
	
	| 方法 / 属性 | 说明 |
	|-------------|------|
	| \`f.form.addField(name, element)\` | 注册字段 |
	| \`f.form.getValue(name)\` | 获取字段值 |
	| \`f.form.setValue(name, value)\` | 设置字段值 |
	| \`f.form.data\` | 获取全部数据（返回 dict） |
	| \`f.form.validate()\` | 校验必填项，返回 \`{isValid, errors}\` |
	| \`f.form.reset()\` | 重置所有字段 |
	| \`f.form.clear()\` | 清空字段与内容 |
	| \`f.data\` | 快捷访问数据 |
	| \`f.onSubmit(fn)\` | 绑定提交回调 |
	
	### 提交示例
	
	\`\`\`python
	def on_submit(event):
	    result = f.form.validate()
	    if not result["isValid"]:
	        print("校验失败：", result["errors"])
	        return
	    print("提交数据：", f.data)
	
	f.onSubmit(callback(on_submit))
	\`\`\`
	
	---
	
	## 元素通用 API
	
	所有元素对象都具备以下能力。
	
	### 内容 content
	
	\`\`\`python
	el.content = "新的文本"
	print(el.content)
	\`\`\`
	
	### 属性 attrs
	
	\`\`\`python
	el.attrs.set("data-id", "123")
	el.attrs.get("data-id")
	el.attrs.has("data-id")
	el.attrs.remove("data-id")
	el.attrs.batch({"title": "提示", "lang": "zh"})
	el.attrs.getAll()       # 返回 dict
	\`\`\`
	
	也支持快捷写法：
	
	\`\`\`python
	el.setAttr("title", "提示")
	el.getAttr("title")
	el.setAttrs({"a": "1", "b": "2"})
	\`\`\`
	
	### 样式 css
	
	\`\`\`python
	el.css.set("color", "red")
	el.css.get("color")
	el.css.batch({"fontSize": "14px", "marginTop": "8px"})
	el.css.setAll("color: red; font-size: 14px;")
	el.css.getAll()
	\`\`\`
	
	### 类名 classes
	
	\`\`\`python
	el.classes.add("active")
	el.classes.remove("active")
	el.classes.toggle("active")
	el.classes.contains("active")
	el.classes.list()
	\`\`\`
	
	### 子元素 children
	
	\`\`\`python
	parent.children.add(child)      # 添加子元素
	parent.children.remove(child)   # 移除子元素
	parent.children.clear()         # 清空
	parent.children.list            # 获取子元素列表
	parent.children.length          # 数量
	\`\`\`
	
	### 事件 on / off
	
	\`\`\`python
	el.on("click", callback(handler))
	el.off("click", handler)
	\`\`\`
	
	常用事件名：\`click\`、\`input\`、\`change\`、\`submit\`、\`mouseover\`、\`mouseout\`、\`focus\`、\`blur\` 等。
	
	### 显示 / 隐藏
	
	\`\`\`python
	el.show()
	el.hide()
	\`\`\`
	
	### 移除 remove
	
	\`\`\`python
	el.remove()
	\`\`\`
	
	### 其他
	
	| 属性 / 方法 | 说明 |
	|-------------|------|
	| \`el.id\` | 元素 ID |
	| \`el.html\` | innerHTML |
	| \`el.parent\` | 父元素对象 |
	| \`el.getPosition()\` | 获取位置信息（返回 dict） |
	
	---
	
	## 回调机制
	
	Python 函数要作为事件回调时，**必须**用 \`callback()\` 包装(callback不用导入)：
	
	\`\`\`python
	def on_click(event):
	    print("clicked")
	
	button("b", "", "点击").on("click", callback(on_click))
	\`\`\`
	
	回调函数的第一个参数为事件对象（一般是 \`None\`，可在需要时读取）。
	
	---
	
	## 异步支持
	
	模块内置了 \`asyncio\` 事件循环入口，可直接启动后台任务：
	
	\`\`\`python
	import asyncio
	
	async def ticker():
	    import datetime
	    while True:
	        now = datetime.datetime.now().strftime("%H:%M:%S")
	        clock.content = f"当前时间：{now}"
	        await asyncio.sleep(1)
	
	asyncio.ensure_future(ticker())
	\`\`\`
	
	启动后台任务后，需要调用 \`loop()\` 保持程序运行(不用导入)：
	
	\`\`\`python
	loop()
	\`\`\`
	
	---
	
	## 全局工具函数
	
	| 函数 | 说明 |
	|------|------|
	| \`css(cssText)\` | 注入全局样式 |
	| \`clear()\` | 清空渲染区域与样式 |
	| \`createMany(elements)\` | 批量创建元素（传入 dict 列表） |
	| \`getPosition(element)\` | 获取元素位置（返回 dict） |
	| \`scrollTo(element, behavior='smooth')\` | 滚动到元素 |
	
	### createMany 示例
	
	\`\`\`python
	from layout import createMany
	
	items = [
	    {"type": "div", "id": "a", "classes": "card", "content": "卡片 A"},
	    {"type": "button", "id": "b", "classes": "", "content": "按钮"},
	    {"type": "input", "id": "c", "classes": "", "type": "text", "placeholder": "输入"},
	]
	createMany(items)
	\`\`\`
	
	---
	
	## 完整示例
	
	\`\`\`python
	from layout import (
	    div, span, button, input, textarea, form,
	    img, a, ul, ol, li, css
	)
	
	# ============================================================
	# 1. 注入全局 CSS
	# ============================================================
	css("""
	.card {
	    border: 1px solid #ddd;
	    border-radius: 8px;
	    padding: 16px;
	    margin-bottom: 12px;
	}
	.title {
	    font-size: 20px;
	    font-weight: 600;
	    margin-bottom: 8px;
	}
	.btn {
	    padding: 8px 16px;
	    border: none;
	    border-radius: 6px;
	    background: #4f46e5;
	    color: white;
	    cursor: pointer;
	}
	.btn:hover {
	    background: #4338ca;
	}
	.muted {
	    color: #888;
	    font-size: 13px;
	}
	""")
	
	
	# ============================================================
	# 2. 基础元素 + 事件回调
	# ============================================================
	card1 = div("card-1", "card", "")
	
	title = div("", "title", "1. 基础元素与事件")
	card1.children.add(title)
	
	count = {"value": 0}
	
	counter_label = span("counter-label", "muted", "当前计数：0")
	card1.children.add(counter_label)
	
	
	def on_click(event):
	    count["value"] += 1
	    counter_label.content = f"当前计数：{count['value']}"
	
	
	btn = button("btn-1", "btn", "点我 +1")
	btn.on("click", callback(on_click))
	card1.children.add(btn)
	
	
	# ============================================================
	# 3. 表单 + 校验 + 数据读取
	# ============================================================
	card2 = div("card-2", "card", "")
	card2.children.add(div("", "title", "2. 表单交互"))
	
	my_form = form("my-form", "")
	
	name_input = input("name", "", "text", "请输入姓名")
	name_input.attrs.set("required", "")
	
	age_input = input("age", "", "number", "请输入年龄")
	
	intro_area = textarea("intro", "", "简单介绍一下自己", 3, 40)
	
	my_form.form.addField("name", name_input)
	my_form.form.addField("age", age_input)
	my_form.form.addField("intro", intro_area)
	
	card2.children.add(my_form)
	
	result_label = div("", "muted", "")
	card2.children.add(result_label)
	
	
	def on_submit(event):
	    validation = my_form.form.validate()
	    if not validation["isValid"]:
	        result_label.content = f"❌ 校验失败：{validation['errors']}"
	        result_label.css.set("color", "#e91e63")
	        return
	
	    data = my_form.data
	    result_label.content = (
	        f"✅ 提交成功：姓名={data['name']}, "
	        f"年龄={data['age']}, 简介={data['intro']}"
	    )
	    result_label.css.set("color", "#16a34a")
	
	
	submit_btn = button("submit-1", "btn", "提交表单")
	submit_btn.on("click", callback(on_submit))
	card2.children.add(submit_btn)
	
	
	def on_reset(event):
	    my_form.form.reset()
	    result_label.content = "已重置"
	    result_label.css.set("color", "#888")
	
	
	reset_btn = button("reset-1", "btn", "重置")
	reset_btn.css.set("background", "#888")
	reset_btn.css.set("margin-left", "8px")
	reset_btn.on("click", callback(on_reset))
	card2.children.add(reset_btn)
	
	
	# ============================================================
	# 4. 列表（ul / ol）
	# ============================================================
	card3 = div("card-3", "card", "")
	card3.children.add(div("", "title", "3. 列表"))
	
	fruits = ul("fruit-list", "", ["苹果", "香蕉", "橙子"])
	card3.children.add(fruits)
	
	
	def add_fruit(event):
	    fruits.addItem(f"水果 {fruits.count + 1}")
	
	
	add_btn = button("add-fruit", "btn", "添加一项")
	add_btn.on("click", callback(add_fruit))
	card3.children.add(add_btn)
	
	
	def remove_fruit(event):
	    fruits.removeItem(fruits.count - 1)
	
	
	remove_btn = button("remove-fruit", "btn", "删除最后一项")
	remove_btn.css.set("background", "#ef4444")
	remove_btn.css.set("margin-left", "8px")
	remove_btn.on("click", callback(remove_fruit))
	card3.children.add(remove_btn)
	
	
	# ============================================================
	# 5. 图片 + 链接
	# ============================================================
	card4 = div("card-4", "card", "")
	card4.children.add(div("", "title", "4. 图片与链接"))
	
	logo = img(
	    "logo",
	    "",
	    "https://www.python.org/static/community_logos/python-logo.png",
	    "Python Logo"
	)
	logo.css.set("width", "120px")
	card4.children.add(logo)
	
	link = a("python-link", "muted", "访问 Python 官网 →",
	         "https://www.python.org", "_blank")
	link.css.set("display", "block")
	link.css.set("margin-top", "8px")
	card4.children.add(link)
	
	
	# ============================================================
	# 6. 动态更新（异步）
	# ============================================================
	import asyncio
	
	card5 = div("card-5", "card", "")
	card5.children.add(div("", "title", "5. 异步更新"))
	
	clock_label = div("clock", "muted", "加载中...")
	card5.children.add(clock_label)
	
	
	async def start_clock():
	    import datetime
	    while True:
	        now = datetime.datetime.now().strftime("%H:%M:%S")
	        clock_label.content = f"当前时间：{now}"
	        await asyncio.sleep(1)
	
	
	# 启动后台任务
	asyncio.ensure_future(start_clock())
	
	# 保持运行，等待事件循环
	loop()
	
	print("✅ 示例页面已渲染完成")
	\`\`\`
	
	---
	
	## 注意事项
	
	1. **默认挂载**：所有创建函数默认挂载到渲染区域。若要挂到指定父元素，使用 \`parent.children.add(child)\`。
	2. **回调包装**：绑定 Python 函数时，必须通过 \`callback(fn)\` 包装。
	3. **列表项**：\`li()\` 创建的项不会自动挂载，需通过 \`list.addItem(li)\` 添加到列表。
	4. **表单字段**：只有通过 \`form.form.addField(name, element)\` 注册的字段，才能被 \`validate()\` 和 \`data\` 识别。
	5. **异步任务**：使用 \`asyncio.ensure_future(...)\` 启动后台任务后，脚本末尾需调用 \`loop()\` 保持程序运行。
	6. **属性值类型**：所有属性值最终会转为字符串；数值型可直接传入。
        7. callback和loop为内置函数，不用import layout导入
