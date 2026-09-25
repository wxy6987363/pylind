import {
	loadPyodide
} from 'pyodide';
import {
	Terminal
} from 'xterm';
import {
	FitAddon
} from 'xterm/addon-fit';
import {
	WebLinksAddon
} from 'xterm/addon-web-links';
import tosContent from './tos.js';

const initApp = (async function() {
	// ----- DOM refs -----
	const fileListView = document.getElementById('file-list-view');
	const fileGrid = document.getElementById('file-grid');
	const newFileBtn = document.getElementById('new-file-btn');
	const importFileBtn = document.getElementById('import-file-btn');
	const editView = document.getElementById('edit-view');
	const editorTitle = document.getElementById('editor-title');
	const backBtns = document.getElementsByClassName('back-btn');
	const saveBtn = document.getElementById('save-btn');
	const runBtn = document.getElementById('run-btn');
	const consoleOverlay = document.getElementById('console-overlay');
	const closeConsoleBtn = document.getElementById('close-console-btn');
	const terminalContainer = document.getElementById('terminal-container');
	const shareBtn = document.getElementById('share-btn');

	// ----- PyPI DOM refs -----
	const pypiView = document.getElementById('pypi-view');
	const pypiBtn = document.getElementById('pypi-btn');
	const aboutBtn = document.getElementById('about-btn');

	const packageSearch = document.getElementById('package-search');
	const searchPackageBtn = document.getElementById('search-package-btn');
	const barcodeBtn = document.getElementById('barcode-btn');
	const pypiResults = document.getElementById('pypi-results');
	const installedPackagesList = document.getElementById('installed-packages-list');

	const aboutIcon = document.getElementById("about-icon");

	const isDarkMode = plus.navigator.getUIStyle() === 'dark';

	// ============================================================
	// 页面切换管理
	// ============================================================

	// 定义页面ID映射
	const PAGE_VIEWS = {
		files: 'file-list-view',
		edit: 'edit-view',
		pypi: 'pypi-view',
		about: 'about-view'
	};

	const views = Object.values(PAGE_VIEWS).map(key => document.getElementById(key));

	let currentView = 'files';

	// 切换页面函数
	function togglePage(pageId) {
		currentView = pageId;

		// 移除所有页面的 active 类
		views.forEach(view => {
			if (view) {
				view.classList.remove('active');
			}
		});

		// 显示目标页面
		const targetView = document.getElementById(PAGE_VIEWS[pageId]);
		if (targetView) {
			targetView.classList.add('active');
		}
	}

	// 辅助函数：切换到文件列表页
	function showFileListView() {
		togglePage('files');
		plus.navigator.setFullscreen(false);
		renderFileList();
	}

	// 辅助函数：切换到编辑页
	function showEditView() {
		togglePage('edit');
		plus.navigator.setFullscreen(true);
		editor.refresh();
	}

	// 辅助函数：切换到PyPI页
	function showPypiView() {
		togglePage('pypi');
		plus.navigator.setFullscreen(false);
		renderInstalledPackages();
		pypiResults.innerHTML = '<div class="pypi-empty">Enter the package name</div>';
		packageSearch.value = '';
		setTimeout(() => packageSearch.focus(), 50);
	}

	// ----- CodeMirror -----
	const textarea = document.getElementById('code-area');
	const editor = window.CodeMirror.fromTextArea(textarea, {
		mode: 'python',
		theme: isDarkMode ? 'monokai' : 'idea',
		lineNumbers: true,
		indentUnit: 4,
		tabSize: 4,
		indentWithTabs: false,
		lineWrapping: false,
		autofocus: true,
		matchBrackets: true,
		autoCloseBrackets: true,
		fontFamily: 'Cascadia Code, Consolas, Menlo, monospace',
		extraKeys: {
			'Ctrl-Enter': () => runBtn.click(),
			'Cmd-Enter': () => runBtn.click(),
			'F5': () => {
				runBtn.click();
				return false;
			},
			'Ctrl-S': (cm) => {
				saveCurrentFile();
				return false;
			},
			'Cmd-S': (cm) => {
				saveCurrentFile();
				return false;
			},
			'Ctrl-Alt-S': (cm) => {
				saveAsHandler();
				return false;
			},
		}
	});
	editor.setSize('100%', '100%');

	// 定义两套主题
	const darkTheme = {
		background: '#1e1e1e',
		foreground: '#d4d4d4',
		cursor: '#d4d4d4',
		selectionBackground: '#404040',
		black: '#000000',
		red: '#cd3131',
		green: '#0dbc79',
		yellow: '#e5e510',
		blue: '#2472c8',
		magenta: '#bc3fbc',
		cyan: '#11a8cd',
		white: '#e5e5e5',
		brightBlack: '#666666',
		brightRed: '#f14c4c',
		brightGreen: '#23d18b',
		brightYellow: '#f5f543',
		brightBlue: '#3b8eea',
		brightMagenta: '#d670d6',
		brightCyan: '#29b8db',
		brightWhite: '#ffffff'
	};

	const lightGreenTheme = {
		background: '#f5f9f5', // 极浅灰绿底，比纯白护眼
		foreground: '#1a3320', // 深墨绿色文字，对比舒适
		cursor: '#2d7a4a', // 中绿色光标
		selectionBackground: '#c8e0d0', // 浅绿选中背景
		black: '#2d3a30',
		red: '#b33a3a',
		green: '#2d8a4e',
		yellow: '#a68b2a',
		blue: '#2a6ba8',
		magenta: '#8a4a8a',
		cyan: '#1f8a8a',
		white: '#d0d8d0',
		brightBlack: '#7a8a7a',
		brightRed: '#d45a5a',
		brightGreen: '#3dab62',
		brightYellow: '#c4a83a',
		brightBlue: '#3a82c4',
		brightMagenta: '#a85aa8',
		brightCyan: '#3aa8a8',
		brightWhite: '#eaf0ea'
	};

	// 使用时根据 isDarkMode 选择
	const term = new Terminal({
		cursorBlink: true,
		fontSize: 16,
		fontFamily: '"Cascadia Code","Courier New",Consolas,monospace',
		theme: isDarkMode ? darkTheme : lightGreenTheme,
		scrollback: 10000
	});

	const fitAddon = new FitAddon();
	const webLinksAddon = new WebLinksAddon();
	term.loadAddon(fitAddon);
	term.loadAddon(webLinksAddon);
	term.open(terminalContainer);
	setTimeout(() => fitAddon.fit(), 50);
	window.addEventListener('resize', () => fitAddon.fit());

	plus.nativeUI.setUIStyle('dark');

	// ----- 状态 -----
	let currentFileName = null;
	let pyodide = null;
	let isPyodideReady = false;

	let adReward = null;

	function showAdvert(callback, args) {
		if (adReward) {
			return;
		}
		
		adReward = plus.ad.createRewardedVideoAd({
			adpid: '1580082566',
		});
		adReward.onLoad(function() {
			adReward.show();
		});
		adReward.onError(function(e) {
			console.error('加载失败: ' + JSON.stringify(e));
			adReward.destroy();
			adReward = null;
		});
		adReward.onClose(function(e) {
			if (e.isEnded) {
				callback(args);
			}
			adReward.destroy();
			adReward = null;
		});
		adReward.load();
	}

	function shareApp() {
		// 获取微信服务对象
		plus.share.getServices(function(services) {
			var sweixin = null;
			for (var i = 0; i < services.length; i++) {
				if (services[i].id === 'weixin') {
					sweixin = services[i];
					break;
				}
			}

			if (sweixin) {
				// 构造纯文字消息
				var msg = {
					type: 'web',
					title: 'Pylind',
					content: 'Click to download Pylind',
					href: "https://wxy6987363.github.io/pylind",
					thumbs: ['res/mipmap-xxxhdpi/Pylind.png'],
					extra: {
						scene: 'WXSceneSession'
					},
				};

				sweixin.send(msg, () => {}, function(e) {
					console.error('文字分享失败：' + JSON.stringify(e));
				});
			} else {
				console.error('未找到微信服务');
			}
		}, function(e) {
			console.error('获取服务失败：' + e.message);
		});
	}

	// ============================================================
	// 文件操作 (直接使用 _downloads 目录)
	// ============================================================
	const FILE_DIR = '_downloads';

	// 获取文件系统根目录
	function getFileSystem(callback) {
		plus.io.requestFileSystem(plus.io.PRIVATE_DOC, callback, function(err) {
			console.error('获取文件系统失败：', err.message);
		});
	}

	// 获取文件条目
	function getFileEntry(fileName, create, callback) {
		getFileSystem(function(fs) {
			fs.root.getFile(FILE_DIR + fileName, {
				create: create
			}, callback, function(err) {
				console.error('获取文件失败：', err.message);
			});
		});
	}

	// 读取文件内容
	async function getFile(name) {
		return new Promise((resolve, reject) => {
			getFileEntry(name, false, function(fileEntry) {
				fileEntry.file(function(file) {
					var reader = new plus.io.FileReader();
					reader.onloadend = function(e) {
						resolve({
							name: name,
							content: e.target.result
						});
					};
					reader.onerror = function(e) {
						reject(e);
					};
					reader.readAsText(file);
				}, function(err) {
					reject(err);
				});
			}, function(err) {
				resolve(null);
			});
		});
	}

	// 写入文件
	async function putFile(name, content) {
		return new Promise((resolve, reject) => {
			getFileEntry(name, true, function(fileEntry) {
				fileEntry.createWriter(function(writer) {
					writer.onwrite = function() {
						resolve();
					};
					writer.onerror = function(err) {
						reject(err);
					};
					writer.write(content);
				}, function(err) {
					reject(err);
				});
			}, function(err) {
				reject(err);
			});
		});
	}

	// 删除文件
	async function deleteFile(name) {
		return new Promise((resolve, reject) => {
			getFileEntry(name, false, function(fileEntry) {
				fileEntry.remove(function() {
					resolve();
				}, function(err) {
					reject(err);
				});
			}, function(err) {
				resolve();
			});
		});
	}

	// 重命名文件
	async function renameFile(oldName, newName) {
		return new Promise((resolve, reject) => {
			getFileEntry(oldName, false, function(fileEntry) {
				fileEntry.getParent(function(parent) {
					// 加/是因为moveTo实现有bug
					fileEntry.moveTo(parent, '/' + newName, function() {
						resolve();
					}, function(err) {
						reject(err);
					});
				}, function(err) {
					reject(err);
				});
			}, function(err) {
				reject(err);
			});
		});
	}

	async function getAllFiles() {
		return new Promise(function(resolve, reject) {
			// 1. 解析目录路径
			plus.io.resolveLocalFileSystemURL(FILE_DIR, function(entry) {
				// 2. 创建目录读取器
				var reader = entry.createReader();

				// 3. 读取目录内容
				reader.readEntries(function(entries) {
					var results = [];
					// 4. 遍历所有条目，只处理文件，忽略子目录
					for (var i = 0; i < entries.length; i++) {
						if (entries[i].isFile) {
							results.push({
								content: null,
								name: entries[i].name
							});
						}
					}
					// 5. 通过 resolve 返回 results
					resolve(results);
				}, function(e) {
					// 读取失败时 reject
					reject(new Error("读取目录失败: " + e.message));
				});
			}, function(e) {
				// 获取目录失败时 reject
				reject(new Error("获取目录失败: " + e.message));
			});
		});
	}


	// ============================================================
	// 渲染文件列表 (带长按菜单)
	// ============================================================
	async function renderFileList() {
		try {
			const files = await getAllFiles();
			fileGrid.innerHTML = '';
			if (files.length === 0) {
				fileGrid.innerHTML = '<div class="empty-msg">Empty</div>';
				return;
			}
			files.sort((a, b) => a.name.localeCompare(b.name));
			for (const f of files) {
				const div = document.createElement('div');
				div.className = 'file-item';
				const nameSpan = document.createElement('span');
				nameSpan.className = 'name';
				nameSpan.textContent = f.name;
				const moreBtn = document.createElement('button');
				moreBtn.className = 'more';
				moreBtn.innerHTML =
					'<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="24" r="3" fill="currentColor"/><circle cx="24" cy="24" r="3" fill="currentColor"/><circle cx="36" cy="24" r="3" fill="currentColor"/></svg>';
				moreBtn.title = 'More';
				moreBtn.addEventListener('click', async (e) => {
					e.stopPropagation();
					showFileLongPressMenu(f.name);
				});
				div.appendChild(nameSpan);
				div.appendChild(moreBtn);
				div.addEventListener('click', () => openFile(f.name));

				// ----- 长按菜单 (重命名 / 分享) -----
				let longPressTimer = null;
				let isLongPress = false;

				div.addEventListener('mousedown', (e) => {
					isLongPress = false;
					longPressTimer = setTimeout(() => {
						isLongPress = true;
						showFileLongPressMenu(f.name);
					}, 600);
				});

				div.addEventListener('mouseup', () => {
					clearTimeout(longPressTimer);
				});

				div.addEventListener('mouseleave', () => {
					clearTimeout(longPressTimer);
				});

				// 触摸事件 (移动端)
				div.addEventListener('touchstart', (e) => {
					isLongPress = false;
					longPressTimer = setTimeout(() => {
						isLongPress = true;
						showFileLongPressMenu(f.name);
						// 震动反馈
						if (navigator.vibrate) navigator.vibrate(30);
					}, 600);
				});

				div.addEventListener('touchend', () => {
					clearTimeout(longPressTimer);
				});

				div.addEventListener('touchmove', () => {
					clearTimeout(longPressTimer);
				});

				fileGrid.appendChild(div);
			}
		} catch (e) {
			console.warn('renderFileList error', e);
		}
	}

	// ----- 长按弹出菜单 -----
	function showFileLongPressMenu(fileName) {
		// plus 环境使用原生对话框
		plus.nativeUI.actionSheet({
			title: fileName,
			cancel: 'Cancel',
			buttons: [{
					title: 'Share'
				},
				{
					title: 'Rename'
				},
				{
					title: 'Shortcut'
				},
				{
					title: 'Delete',
					style: 'destructive'
				},
			]
		}, function(e) {
			if (e.index === 0) {
				// 取消
				return;
			} else if (e.index === 1) {
				shareFileFromList(fileName);
			} else if (e.index === 2) {
				renameFileFromList(fileName);
			} else if (e.index === 3) {
				plus.navigator.createShortcut({
					name: fileName,
					extra: {
						toast: "",
						name: fileName
					}
				});
			} else if (e.index === 4) {
				deleteFile(fileName);
				renderFileList();
			}
		});
	}

	async function shareFileFromList(fileName) {
		try {
			const entry = await getFile(fileName);
			if (!entry) {
				return;
			}
			await shareTextAsFile(fileName, entry.content);
		} catch (e) {
			plus.nativeUI.alert('Share error: ' + e.message);
			console.error('分享失败', e);
		}
	}

	function shareTextAsFile(fileName, textContent) {
		var filePath = FILE_DIR + fileName;

		plus.io.requestFileSystem(plus.io.PRIVATE_DOC, function(fs) {
			fs.root.getFile(fileName, {
				create: true
			}, function(fileEntry) {
				fileEntry.createWriter(function(writer) {
					writer.write(textContent);
					writer.onwrite = function() {
						var absolutePath = fileEntry.fullPath;

						// 调起系统分享
						plus.share.sendWithSystem({
							type: 'image',
							pictures: [absolutePath],
							content: 'Share file: ' + fileName
						}, function() {
							// 分享后删除临时文件（可选）
							fileEntry.remove(() => {});
						}, function(e) {
							plus.nativeUI.toast('Sharing failed')
							console.error('分享失败：' + JSON.stringify(e));
						});
					};
					writer.onerror = function(e) {
						console.error('写入失败：' + e.message);
					};
				});
			});
		}, function(e) {
			console.error('打开文件系统失败：' + e.message);
		});
	}

	// ----- 从列表重命名文件 -----
	async function renameFileFromList(oldName) {
		plus.nativeUI.prompt('Enter the filename:', function(e) {
				if (e.index === 0 && e.value) {
					doRenameFile(oldName, e.value.trim());
				}
			},
			'Rename',
			oldName,
			['Ok', 'Cancel']);
	}

	async function doRenameFile(oldName, newName) {
		// 检查新文件名是否已存在
		const files = await getAllFiles();
		if (files.some(f => f.name === newName)) {
			plus.nativeUI.alert('File "' + newName + '" already exists');
			return;
		}

		try {
			await renameFile(oldName, newName);

			renderFileList();
		} catch (e) {
			plus.nativeUI.alert('Rename error: ' + e.message + e.code);
		}
	}

	// ============================================================
	// 打开/编辑文件
	// ============================================================
	async function openFile(name) {
		try {
			const entry = await getFile(name);
			if (!entry) return;
			currentFileName = name;
			editor.setValue(entry.content);
			editorTitle.textContent = name;
			showEditView();
		} catch (e) {
			console.warn('openFile error', e);
		}
	}

	async function saveCurrentFile() {
		if (!currentFileName) {
			await saveAsHandler();
			return;
		}
		const content = editor.getValue();
		await putFile(currentFileName, content);
		renderFileList();
		editorTitle.textContent = currentFileName + ' (Saved)';
		setTimeout(() => {
			editorTitle.textContent = currentFileName;
		}, 600);
	}

	async function saveAsHandler() {
		plus.nativeUI.prompt('Enter the filename:', function(e) {
				if (e.index === 0 && e.value) {
					doSaveAs(e.value.trim());
				}
			},
			'Save As',
			currentFileName || 'main.py',
			['Ok', 'Cancel']);
	}

	async function doSaveAs(trimmed) {
		const content = editor.getValue();
		await putFile(trimmed, content);
		currentFileName = trimmed;
		editorTitle.textContent = trimmed;
		renderFileList();
	}

	function newFileHandler() {
		currentFileName = null;
		editor.setValue('print("Hello")\n');
		editorTitle.textContent = 'Unnamed File';
		showEditView();
	}

	function importBtnHandler() {
		var input = document.createElement('input');
		input.type = 'file';
		input.multiple = true;

		input.accept = 'text/plain,application/json,text/x-python,text/x-pyw';

		input.addEventListener('change', function(e) {
			var files = e.target.files;
			if (!files || files.length === 0) return;

			for (var i = 0; i < files.length; i++) {
				var file = files[i];
				var reader = new FileReader();
				reader.onload = function(evt) {
					var content = evt.target.result;
					putFile(file.name, content);
					renderFileList();
				};
				reader.readAsText(file);
			}
			input.remove();
		});

		document.body.appendChild(input);
		input.click();
	}

	function goBack() {
		// 如果当前有未保存的文件，提示保存
		const content = editor.getValue();
		if (currentFileName) {
			// 检查是否有修改（简单对比）
			getFile(currentFileName).then(entry => {
				if (entry && entry.content !== content) {
					plus.nativeUI.confirm(
						'The current file has been modified. Do you want to save it?',
						function(e) {
							if (e.index === 0) {
								saveCurrentFile();
							}
							doGoBack();
						}, {
							title: 'Tip',
							buttons: ['Save', 'No']
						});
				} else {
					doGoBack();
				}
			});
		} else {
			doGoBack();
		}
	}

	function doGoBack() {
		showFileListView();
		consoleOverlay.classList.remove('visible');
	}

	// ===== 发送推送消息的辅助函数 =====
	function sendPush(title, subtitle, content, cover = false) {
		try {
			plus.push.createMessage(content, '', {
				title,
				subtitle,
				cover,
				icon: 'message.png'
			});
		} catch (e) {
			console.warn('[Push] Failed:', e.message);
		}
	}

	// ===== 请求权限并发送推送 =====
	function requestPermAndSend(title, subtitle, content, cover) {
		// Android：请求权限
		requestPermissions(
			['android.permission.POST_NOTIFICATIONS'],
			function() {
				// 成功
				sendPush(title, subtitle, content, cover);
			},
			function(error) {
				// 失败也尝试发送
				console.warn('[Permission] Request failed:', error);
				sendPush(title, subtitle, content, cover);
			}
		);
	}


	// 保存原始 fetch
	const originalFetch = window.fetch;

	// ===== 替换 fetch =====
	window.fetch = function(input, options) {
		// 获取真实 URL
		let url;
		try {
			url = typeof input === 'string' ? input : (input ? input.url : undefined);
		} catch (e) {
			url = undefined;
		}

		// URL 无效时直接放行
		if (!url) {
			console.warn('[Fetch] URL undefined, passing through');
			return originalFetch.call(this, input, options);
		}

		// 只拦截 .whl 文件
		if (!url.endsWith('.whl') && !url.includes('.whl?')) {
			return originalFetch.call(this, input, options);
		}

		const fileName = url.split('/').pop().split('?')[0] || 'unknown.whl';

		// 发送开始下载通知
		requestPermAndSend('Installing Package', 'Download Start', 'File: ' + fileName, false);

		return new Promise((resolve, reject) => {
			const xhr = new XMLHttpRequest();
			xhr.open('GET', url, true);
			xhr.responseType = 'blob';

			let lastProgress = 0;

			xhr.onprogress = function(event) {
				if (event.lengthComputable) {
					const percent = Math.round((event.loaded / event.total) * 100);
					if (percent - lastProgress >= 10 || percent === 100) {
						lastProgress = percent;
						requestPermAndSend(
							'Installing Package',
							'Download Progress',
							'File: ' + fileName + ' - ' + percent + '%',
							true
						);
					}
				}
			};

			xhr.onload = function() {
				const responseSize = xhr.response ? xhr.response.size : 0;
				const sizeInMB = (responseSize / (1024 * 1024)).toFixed(2);

				requestPermAndSend(
					'Installed Package',
					'Download Complete',
					'File: ' + fileName + ' (' + sizeInMB + ' MiB)',
					true
				);

				setTimeout(plus.push.clear, 3000);

				const response = new Response(xhr.response, {
					status: xhr.status,
					statusText: xhr.statusText,
					headers: new Headers({
						'content-length': responseSize,
						'content-type': xhr.getResponseHeader(
								'content-type') ||
							'application/octet-stream'
					})
				});
				resolve(response);
			};

			xhr.onerror = function() {
				requestPermAndSend(
					'Installing Package',
					'Download Error',
					'File: ' + fileName + ' - Network error',
					true
				);
				setTimeout(plus.push.clear, 3000);

				reject(new Error('Download failed'));
			};

			xhr.ontimeout = function() {
				requestPermAndSend(
					'Installing Package',
					'Download Error',
					'File: ' + fileName + ' - Timeout',
					true,
				);

				setTimeout(plus.push.clear, 3000);

				reject(new Error('Download timeout'));
			};

			xhr.send();
		});
	};

	// ============================================================
	// Pyodide 初始化 (懒加载)
	// ============================================================

	const PhoneModule = {
		vibrate: function(time = 50) {
			plus.device.vibrate(time);
		},
		beep: function(times = 1) {
			plus.device.beep(times);
		}
	};

	const SMSModule = {
		send: function(phoneNumbers, content, success, error) {

			var phones = Array.isArray(phoneNumbers) ? phoneNumbers : [phoneNumbers];

			requestPermissions(['android.permission.SEND_SMS'], function() {
				try {
					if (plus.os.name === 'iOS') {
						var msg = plus.messaging.createMessage(plus.messaging.TYPE_SMS);
						msg.to = phones;
						msg.body = content || '';
						plus.messaging.sendMessage(msg, function() {
							if (typeof success === 'function') success({
								code: 0,
								message: 'Sent'
							});
						}, function(e) {
							if (typeof error === 'function') error({
								code: -1,
								message: e.message
							});
						});
					} else {
						var android = plus.android;
						var context = android.runtimeMainActivity();
						var SmsManager = android.importClass(
						'android.telephony.SmsManager');
						var PendingIntent = android.importClass(
						'android.app.PendingIntent');
						var Intent = android.importClass('android.content.Intent');

						var smsManager = SmsManager.getDefault();

						phones.forEach(function(phone) {
							var sentIntent = PendingIntent.getBroadcast(context, 0,
								new Intent('SMS_SENT'), 0);
							var deliveredIntent = PendingIntent.getBroadcast(
								context, 0, new Intent('SMS_DELIVERED'), 0);
							smsManager.sendTextMessage(phone, null, content || '',
								sentIntent, deliveredIntent);
						});

						if (typeof success === 'function') success({
							code: 0,
							message: 'Sent successfully'
						});
					}
				} catch (e) {
					if (typeof error === 'function') error({
						code: -2,
						message: e.message
					});
				}
			}, function(e) {
				if (typeof error === 'function') error({
					code: -3,
					message: 'Text message permission denied'
				});
			});
		},

		sendMulti: function(phoneList, content, success, error) {
			this.send(phoneList, content, success, error);
		},

		getSupported: function() {
			return !!(plus && typeof plus.messaging !== 'undefined');
		}
	};

	async function ensurePyodide() {
		if (isPyodideReady && pyodide) return pyodide;

		try {
			pyodide = await loadPyodide({
				stdout: (text) => term.writeln(text),
				stderr: (text) => term.writeln('\x1b[31m' + text + '\x1b[0m')
			});
			pyodide.globals.set('js_input', (prompt) => {
				const val = window.prompt(prompt);
				term.writeln(prompt + val);
				return val;
			});
			pyodide.registerJsModule('phone', PhoneModule);
			pyodide.registerJsModule('sms', SMSModule);
			pyodide.runPython(`
                import builtins
                builtins.input = js_input
            `);
			isPyodideReady = true;
		} catch (e) {
			console.error('Pyodide load error', e);
			plus.webview.open('404.html', '404', {
				disablePlus: true,
				top: '0px',
				left: '0px',
				width: '100%',
				height: '100%'
			}, 'slide-in-top');
		} finally {
			plus.navigator.closeSplashscreen();
		}
		return pyodide;
	}

	// ============================================================
	// 运行代码
	// ============================================================
	async function runCode() {
		const code = editor.getValue();
		if (!code.trim()) {
			term.writeln('\x1b[33mThe code is empty.\x1b[0m');
			consoleOverlay.classList.add('visible');
			setTimeout(() => fitAddon.fit(), 80);
			return;
		}
		await ensurePyodide();
		if (!pyodide) {
			term.writeln('\x1b[31mPyodide is not ready\x1b[0m');
			consoleOverlay.classList.add('visible');
			setTimeout(() => fitAddon.fit(), 80);
			return;
		}
		term.clear();
		consoleOverlay.classList.add('visible');
		setTimeout(() => fitAddon.fit(), 80);

		try {
			await pyodide.runPythonAsync(code);
		} catch (error) {
			const pyError = error.error || error.cause || error;
			term.writeln('');
			term.writeln('\x1b[31m' + (pyError.message || error.message || 'Unkown') + '\x1b[0m');
			if (pyError.stack) {
				const lines = pyError.stack.split('\n').slice(0, 5);
				term.writeln('\x1b[90m' + lines.join('\n') + '\x1b[0m');
			}
		}
		setTimeout(() => fitAddon.fit(), 100);
	}

	function closeConsole() {
		consoleOverlay.classList.remove('visible');
		setTimeout(() => editor.focus(), 50);
	}

	// ============================================================
	// PyPI 包管理 (使用 plus.storage)
	// ============================================================
	
	const INSTALLED_PACKAGES_KEY = 'pyodide-packages-storage';

	function getInstalledPackages() {
		try {
			const data = plus.storage.getItem(INSTALLED_PACKAGES_KEY);
			return data ? JSON.parse(data) : [];
		} catch {
			return [];
		}
	}

	function saveInstalledPackages(packages) {
		plus.storage.setItem(INSTALLED_PACKAGES_KEY, JSON.stringify(packages));
	}

	function isPackageInstalled(packageName) {
		const installed = getInstalledPackages();
		return installed.some(pkg => pkg.toLowerCase() === packageName.toLowerCase());
	}

	function renderInstalledPackages() {
		const packages = getInstalledPackages();
		installedPackagesList.innerHTML = '';

		if (packages.length === 0) {
			installedPackagesList.innerHTML = '<span class="pypi-empty">Empty</span>';
			return;
		}

		packages.sort((a, b) => a.localeCompare(b));

		for (const pkg of packages) {
			const tag = document.createElement('span');
			tag.className = 'package-tag';

			const nameSpan = document.createElement('span');
			nameSpan.textContent = pkg;

			const removeBtn = document.createElement('button');
			removeBtn.className = 'remove-pkg';
			removeBtn.textContent = '×';
			removeBtn.title = 'Uninstall';
			removeBtn.addEventListener('click', async (e) => {
				e.stopPropagation();
				await uninstallPackage(pkg);
			});

			tag.appendChild(nameSpan);
			tag.appendChild(removeBtn);
			installedPackagesList.appendChild(tag);
		}
	}

	function showPypiView() {
		togglePage('pypi');
		plus.navigator.setFullscreen(false);
		renderInstalledPackages();
		pypiResults.innerHTML = '<div class="pypi-empty">Enter the package name</div>';
		packageSearch.value = '';
		packageSearch.focus();
	}

	async function searchPyPI(query) {
		if (!query.trim()) {
			pypiResults.innerHTML = '<div class="pypi-empty">Enter the package name</div>';
			return;
		}

		pypiResults.innerHTML = '<div class="pypi-loading">Searching</div>';

		try {
			const response = await fetch(
				`https://pypi.org/pypi/${encodeURIComponent(query.trim())}/json`);

			if (!response.ok) {
				if (response.status === 404) {
					pypiResults.innerHTML =
					`<div class="pypi-error">Not Found: "${query.trim()}"</div>`;
				} else {
					pypiResults.innerHTML =
						`<div class="pypi-error">Search error: ${response.statusText}</div>`;
				}
				return;
			}

			const data = await response.json();
			displaySearchResult(data);

		} catch (error) {
			console.error('Search error:', error);
			pypiResults.innerHTML = `<div class="pypi-error">Search error: ${error.message}</div>`;
		}
	}

	function scanWheel() {
		// 先请求相机权限
		plus.android.requestPermissions(
			['android.permission.CAMERA'],
			function() {
				startScan();
			},
			() => {}
		);

		function startScan() {
			let barcode = plus.barcode.create('barcode', [plus.barcode.QR], {
				position: 'absolute',
				top: '0px',
				left: '0px',
				width: '100%',
				height: '100%',
				frameColor: "#d4a843",
				scanbarColor: '#f5d99b'
			});

			barcode.onmarked = async function(type, result) {
				barcode.close();

				try {
					if (!result.endsWith('.whl') && !result.includes('.whl?')) {
						plus.nativeUI.toast('The QR codemcontains incorrect information');
						return;
					}

					await pyodide.loadPackage('micropip');

					// 用 Python 解析文件名获取包名
					let pkgName = await pyodide.runPythonAsync(`
                        import re
                        from urllib.parse import urlparse
                        from pathlib import Path

                        url = '${result}'
                        filename = Path(urlparse(url).path).name
                        # whl 文件名格式：{name}-{version}-{python_tag}-{abi_tag}-{platform_tag}.whl
                        name = re.split(r'-[0-9]', filename)[0]
                        name
                    `);

					plus.nativeUI.toast('Install: ' + pkgName);

					// 安装
					await pyodide.runPythonAsync(`
                        import micropip
                        await micropip.install('${result}')
                    `);

					const installed = getInstalledPackages();
					installed.push(pkgName);
					saveInstalledPackages(installed);

					renderInstalledPackages();
				} catch (e) {
					plus.ui.toast('Install error：' + e.message);
				}
			};

			barcode.onerror = function(error) {
				barcode.close();
				plus.ui.toast('Scan failed：' + error.message);
			};

			plus.webview.currentWebview().append(barcode);
			barcode.start();
		}
	}

	function displaySearchResult(data) {
		const info = data.info;
		const versions = data.releases ? Object.keys(data.releases).sort((a, b) => {
			return b.localeCompare(a, undefined, {
				numeric: true
			});
		}) : [];

		const latestVersion = versions[0] || info.version || 'Unkown';
		const installed = isPackageInstalled(info.name);
		
		function truncate(str, maxLength = 30) {
		  if (str.length <= maxLength) return str;
		  return String(str).substring(0, maxLength) + '...';
		}

		pypiResults.innerHTML = `
            <div class="pypi-result-item">
                <div class="info">
                    <div>
                        <span class="name">${info.name}</span>
                        <span class="version">v${latestVersion}</span>
                    </div>
                    <div class="description">${truncate(info.summary || 'None', 40)}</div>
                    <div style="font-size:12px;color:#666;margin-top:4px;">
                        Author: ${info.author || 'Unkown'} | 
                        License: ${truncate(info.license || 'Unkown')} | 
                        Version: ${truncate(versions.length || 'None')}
                    </div>
                </div>
                <div class="actions">
                    ${installed ? 
                        '' :
                        `<button class="install-btn" onclick="window.installPackage('${info.name}')">Install</button>`
                    }
                    ${installed ? 
                        `<button class="uninstall-btn" onclick="window.uninstallPackage('${info.name}')">Uninstall</button>` :
                        ''
                    }
                </div>
            </div>
        `;
	}

	async function installPackage(packageName) {
		if (isPackageInstalled(packageName)) {
			alert('It is Insalled');
			return;
		}

		var networkType = plus.networkinfo.getCurrentType();
		var isCellular = (networkType === plus.networkinfo.CONNECTION_CELLULAR);
		var isWifi = (networkType === plus.networkinfo.CONNECTION_WIFI);
		var isNone = (networkType === plus.networkinfo.CONNECTION_NONE);

		if (isNone) {
			alert('Network connection detected. Please connect to the newwork and try again');
			return;
		}

		if (isCellular) {
			var confirmResult = confirm(
				'Currently using mobile data\n' +
				'The installation package may consume a significant amount of data. Do you want to continue?'
			);
			if (!confirmResult) {
				return;
			}
		}

		pypiResults.innerHTML = `<div class="pypi-loading">Installing ${packageName} ...</div>`;

		try {
			await ensurePyodide();
			if (!pyodide) {
				throw new Error('Pyodide is not ready');
			}

			await pyodide.loadPackage('micropip');
			const micropip = pyodide.pyimport('micropip');
			await micropip.install(packageName);
			

			const installed = getInstalledPackages();
			installed.push(packageName);
			saveInstalledPackages(installed);

			renderInstalledPackages();

			pypiResults.innerHTML = `
                <div class="pypi-result-item" style="border-left-color: #0ebe7f;">
                    <div class="info">
                        <div class="name" style="color:#0ebe7f;">${packageName} installed successfully！</div>
                    </div>
                    <div class="actions">
                        <button class="install-btn installed" disabled>Installed</button>
                        <button class="uninstall-btn" onclick="window.uninstallPackage('${packageName}')">Uninstall</button>
                    </div>
                </div>
            `;

			if (packageSearch.value.trim()) {
				setTimeout(() => searchPyPI(packageSearch.value), 500);
			}

		} catch (error) {
			console.error('Install error:', error);
			pypiResults.innerHTML = `
                <div class="pypi-result-item" style="border-left-color: #ff6b6b;">
                    <div class="info">
                        <div class="name" style="color:#ff6b6b;">Install with errors</div>
                        <div class="description" style="color:#ff6b6b;">${error.message || 'Unkown'}</div>
                    </div>
                </div>
            `;
		}
	}

	async function uninstallPackage(packageName) {
		try {
			let installed = getInstalledPackages();
			installed = installed.filter(pkg => pkg.toLowerCase() !== packageName.toLowerCase());
			saveInstalledPackages(installed);

			renderInstalledPackages();

			if (packageSearch.value.trim()) {
				setTimeout(() => searchPyPI(packageSearch.value), 500);
			}

			pypiResults.innerHTML = `
                <div class="pypi-result-item" style="border-left-color: #ff6b6b;">
                    <div class="info">
                        <div class="name" style="color:#ff6b6b;">${packageName} Uninstall successfully</div>
                    </div>
                </div>
            `;

		} catch (error) {
			console.error('Uninstall error:', error);
			alert(`Uninstall with errors: ${error.message}`);
		}
	}

	async function initPyPI() {
		try {
			await ensurePyodide();
			if (!pyodide) return;

			const packages = getInstalledPackages();
			if (packages.length === 0) return;

			term.writeln('\x1b[90m正在预加载已安装的包...\x1b[0m');

			await pyodide.loadPackage('micropip');
			const micropip = pyodide.pyimport('micropip');

			for (const pkg of packages) {
				try {
					await micropip.install(pkg);
				} catch (e) {
					console.warn(`预加载包失败: ${pkg}`, e);
				}
			}
		} catch (e) {
			console.warn('预加载包失败:', e);
		}
	}

	// ============================================================
	// 事件绑定
	// ============================================================
	newFileBtn.addEventListener('click', newFileHandler);
	importFileBtn.addEventListener('click', importBtnHandler)
	Array.from(backBtns).forEach((b) => {
		b.addEventListener('click', goBack);
	})
	saveBtn.addEventListener('click', saveCurrentFile);
	runBtn.addEventListener('click', runCode);
	closeConsoleBtn.addEventListener('click', closeConsole);
	shareBtn.addEventListener('click', shareApp);

	aboutBtn.addEventListener('click', () => {
		togglePage('about');
	})
	pypiBtn.addEventListener('click', showPypiView);
	searchPackageBtn.addEventListener('click', () => {
		searchPyPI(packageSearch.value);
	});
	barcodeBtn.addEventListener('click', scanWheel);
	packageSearch.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') {
			searchPyPI(packageSearch.value);
		}
	});

	aboutIcon.addEventListener('click', () => {
		plus.webview.open('https://wxy6987363.github.io/pylind', '404', {
			disablePlus: true,
			top: '0px',
			left: '0px',
			width: '100%',
			height: '100%'
		}, 'slide-in-top');
	});

	window.installPackage = (packageName) => {
		if (packageName === 'matplotlib') {
			showAdvert(installPackage, packageName);
		} else {
			installPackage(packageName);
		}
	};
	window.uninstallPackage = uninstallPackage;

	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && consoleOverlay.classList.contains('visible')) {
			closeConsole();
			e.preventDefault();
		}
	});

	document.addEventListener('keydown', (e) => {
		if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
			if (!editView.classList.contains('active') && !pypiView.classList.contains('active')) {
				e.preventDefault();
				newFileHandler();
			}
		}
	});

	function checkLaunch() {
		if (plus.runtime.launcher === 'shortcut') {
			let args = plus.runtime.arguments;
			if (args) {
				let params = JSON.parse(args);
				openFile(params.name);
			}
		}
	}

	checkLaunch();

	document.addEventListener('newintent', function() {
		checkLaunch();
	}, false);

	plus.key.addEventListener('backbutton', () => {
		if (plus.webview.all().length > 1) {
			plus.webview.close(plus.webview.getTopWebview());
			return;
		}

		if (currentView !== 'files') {
			doGoBack();
			return;
		}

		plus.nativeUI.confirm('Are you sure want to quit?', (e) => {
			if (e.index === 0) {
				plus.runtime.quit();
			}
		}, {
			title: 'Tip',
			button: ['Quit', 'Back']
		});
	});

	// ============================================================
	// 启动
	// ============================================================
	await renderFileList();
	showFileListView();
	consoleOverlay.classList.remove('visible');

	renderInstalledPackages();
	setTimeout(() => initPyPI(), 1000);
});

function onPageReady(callback) {
	if (document.readyState === 'complete') {
		callback();
		return;
	}

	if (document.readyState === 'interactive') {
		document.addEventListener('DOMContentLoaded', callback);
		return;
	}

	document.addEventListener('DOMContentLoaded', callback);
}

function requestPermissions(permissions, success, fail) {
	if (plus.os.name === 'iOS') {
		if (typeof success === 'function') success();
		return;
	}
	if (plus.os.name === 'Android') {
		plus.android.requestPermissions(permissions, function(e) {
			if (!e) {
				if (typeof success === 'function') success();
				return;
			}
			if (e.deniedAlways.length > 0 || e.deniedPresent.length > 0) {
				if (typeof fail === 'function') fail(e);
			} else {
				if (typeof success === 'function') success();
			}
		}, function(e) {
			if (typeof fail === 'function') fail(e);
		});
	}
}

document.addEventListener('plusready', function() {
	var agreed = plus.storage.getItem('agreed');
	if (!agreed) {
		showAgreement();
	} else {
		onPageReady(initApp);
	}
}, false);

function showAgreement() {
	plus.nativeUI.confirm(
		tosContent,
		function(e) {
			if (e.index === 0) {
				plus.storage.setItem('agreed', 'true');
				onPageReady(initApp);
			} else {
				plus.runtime.quit();
			}
		}, {
			title: 'Terms of Service',
			buttons: ['I have read and agree to the Terms', 'Disagree']
		}
	);
}