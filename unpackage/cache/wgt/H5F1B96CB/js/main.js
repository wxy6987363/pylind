import {
	loadPyodide
} from 'pyodide';

import {
	monaco,
	loadCss,
	initMonaco
} from 'monaco';

import editorWorker from 'monaco/workers/editor';
import typescriptWorker from 'monaco/workers/typescript';

import layout from './layout.js';

import {
	AIClient
} from './ai.js';

import {
	donate,
	purchase
} from './pay.js'

import {
	Terminal
} from './xterm/xterm.mjs';

import {
	FitAddon
} from './xterm/addon-fit.mjs';

import {
	marked
} from './marked.js';

marked.setOptions({
	slient: true,
});

loadCss();

initMonaco({
	workers: {
		editor: editorWorker,
		typescript: typescriptWorker,
	}
});

monaco.languages.registerCompletionItemProvider('python', {
	triggerCharacters: ['.', '(', ' ', ':', '"', "'"],

	provideCompletionItems: function(model, position) {
		const word = model.getWordUntilPosition(position);
		const range = {
			startLineNumber: position.lineNumber,
			endLineNumber: position.lineNumber,
			startColumn: word.startColumn,
			endColumn: word.endColumn
		};

		const textBeforeCursor = model.getValueInRange({
			startLineNumber: position.lineNumber,
			startColumn: 1,
			endLineNumber: position.lineNumber,
			endColumn: position.column
		});

		const isAfterDot = textBeforeCursor.trim().endsWith('.');
		const isAfterParen = textBeforeCursor.trim().endsWith('(');

		const suggestions = [];

		function makeSuggestion(label, insertText, kind, detail, doc, sortText) {
			const safeRange = {
				startLineNumber: position.lineNumber,
				endLineNumber: position.lineNumber,
				startColumn: word.startColumn,
				endColumn: word.endColumn || position.column
			};
			return {
				label: label,
				kind: kind,
				insertText: insertText,
				insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
				range: safeRange,
				detail: detail || '',
				documentation: doc || '',
				sortText: sortText || 'z'
			};
		}

		const keywords = [
			['def', 'def ${1:function_name}($2):\n    """${3:docstring}"""\n    ${4:pass}', 'Keyword',
				'Define function', 'a'
			],
			['class',
				'class ${1:ClassName}:\n    """${2:docstring}"""\n    def __init__(self${3:, params}):\n        ${4:pass}',
				'Keyword', 'Define class', 'a'
			],
			['if', 'if ${1:condition}:\n    ${2:pass}', 'Keyword', 'Conditional statement', 'a'],
			['for', 'for ${1:item} in ${2:iterable}:\n    ${3:pass}', 'Keyword', 'For loop', 'a'],
			['return', 'return ${1:value}', 'Keyword', 'Return value', 'a'],
			['import', 'import ${1:module}', 'Keyword', 'Import module', 'a'],
			['from', 'from ${1:module} import ${2:name}', 'Keyword', 'Import from module', 'a'],
			['else', 'else:\n    ${1:pass}', 'Keyword', 'Else conditional', 'b'],
			['elif', 'elif ${1:condition}:\n    ${2:pass}', 'Keyword', 'Else-if conditional', 'b'],
			['while', 'while ${1:condition}:\n    ${2:pass}', 'Keyword', 'While loop', 'b'],
			['try', 'try:\n    ${1:pass}\nexcept ${2:Exception} as e:\n    ${3:pass}', 'Keyword',
				'Exception handling', 'b'
			],
			['with', 'with ${1:context_manager} as ${2:var}:\n    ${3:pass}', 'Keyword',
				'Context manager', 'b'
			],
			['async', 'async def ${1:function_name}($2):\n    ${3:pass}', 'Keyword', 'Async function',
				'b'
			],
			['await', 'await ${1:awaitable}', 'Keyword', 'Await async task', 'b'],
			['lambda', 'lambda ${1:params}: ${2:return_value}', 'Keyword', 'Anonymous function', 'b'],
			['raise', 'raise ${1:Exception}(${2:message})', 'Keyword', 'Raise exception', 'b'],
			['assert', 'assert ${1:condition}, "${2:message}"', 'Keyword', 'Assert condition', 'b'],
			['break', 'break', 'Keyword', 'Break out of loop', 'c'],
			['continue', 'continue', 'Keyword', 'Continue to next iteration', 'c'],
			['pass', 'pass', 'Keyword', 'No-op placeholder', 'c'],
			['del', 'del ${1:var}', 'Keyword', 'Delete variable', 'c'],
			['global', 'global ${1:var_name}', 'Keyword', 'Declare global variable', 'c'],
			['nonlocal', 'nonlocal ${1:var_name}', 'Keyword', 'Declare nonlocal variable', 'c'],
			['yield', 'yield ${1:value}', 'Keyword', 'Generator yield', 'c'],
		];
		keywords.forEach(([label, insert, kind, doc, sort]) => {
			suggestions.push(makeSuggestion(label, insert, monaco.languages.CompletionItemKind[
				kind] || monaco.languages.CompletionItemKind.Keyword, '', doc, sort));
		});

		const builtins = [
			['print', 'print(${1:value})', 'Function', '(value: Any, *args) -> None',
				'Print to console', 'a'
			],
			['len', 'len(${1:obj})', 'Function', '(obj: Sized) -> int', 'Return length', 'a'],
			['type', 'type(${1:obj})', 'Function', '(obj: Any) -> type', 'Return type', 'a'],
			['int', 'int(${1:value})', 'Function', '(value: Any) -> int', 'Convert to integer', 'a'],
			['str', 'str(${1:value})', 'Function', '(value: Any) -> str', 'Convert to string', 'a'],
			['list', 'list(${1:iterable})', 'Function', '(iterable: Iterable) -> list',
				'Convert to list', 'a'
			],
			['dict', 'dict(${1:kwargs})', 'Function', '(**kwargs) -> dict', 'Convert to dict', 'a'],
			['range', 'range(${1:start}, ${2:stop}, ${3:step})', 'Function', '(...) -> range',
				'Generate number sequence', 'a'
			],
			['sum', 'sum(${1:list})', 'Function', '(iterable: Iterable) -> int', 'Sum values', 'a'],
			['max', 'max(${1:iterable})', 'Function', '(iterable: Iterable) -> Any', 'Maximum value',
				'a'
			],
			['min', 'min(${1:iterable})', 'Function', '(iterable: Iterable) -> Any', 'Minimum value',
				'a'
			],
			['sorted', 'sorted(${1:iterable})', 'Function', '(iterable: Iterable) -> list',
				'Sort iterable', 'a'
			],
			['float', 'float(${1:value})', 'Function', '(value: Any) -> float', 'Convert to float',
				'b'
			],
			['bool', 'bool(${1:value})', 'Function', '(value: Any) -> bool', 'Convert to boolean', 'b'],
			['tuple', 'tuple(${1:iterable})', 'Function', '(iterable: Iterable) -> tuple',
				'Convert to tuple', 'b'
			],
			['set', 'set(${1:iterable})', 'Function', '(iterable: Iterable) -> set', 'Convert to set',
				'b'
			],
			['enumerate', 'enumerate(${1:iterable})', 'Function', '(iterable: Iterable) -> enumerate',
				'Enumerate iterable', 'b'
			],
			['zip', 'zip(${1:iterable1}, ${2:iterable2})', 'Function', '(*iterables) -> zip',
				'Zip multiple iterables', 'b'
			],
			['open', 'open(${1:filepath}, "${2:mode}")', 'Function', '(file: str, mode: str) -> file',
				'Open file', 'b'
			],
			['input', 'input("${1:prompt}")', 'Function', '(prompt: str) -> str', 'Get user input',
				'b'
			],
			['abs', 'abs(${1:num})', 'Function', '(num: int/float) -> int/float', 'Absolute value',
				'b'
			],
			['round', 'round(${1:num}, ${2:ndigits})', 'Function',
				'(num: float, ndigits: int) -> float', 'Round number', 'b'
			],
			['map', 'map(${1:func}, ${2:iterable})', 'Function',
				'(func: Callable, iterable: Iterable) -> map', 'Map function to iterable', 'b'
			],
			['filter', 'filter(${1:func}, ${2:iterable})', 'Function',
				'(func: Callable, iterable: Iterable) -> filter', 'Filter iterable', 'b'
			],
			['any', 'any(${1:iterable})', 'Function', '(iterable: Iterable) -> bool',
				'True if any is True', 'b'
			],
			['all', 'all(${1:iterable})', 'Function', '(iterable: Iterable) -> bool',
				'True if all are True', 'b'
			],
			['isinstance', 'isinstance(${1:obj}, ${2:type})', 'Function',
				'(obj: Any, type: type) -> bool', 'Check if object is of type', 'b'
			],
			['super', 'super()', 'Function', '() -> super', 'Call parent class method', 'b'],
			['dir', 'dir(${1:obj})', 'Function', '(obj: Any) -> list[str]', 'Return object attributes',
				'c'
			],
			['help', 'help(${1:obj})', 'Function', '(obj: Any) -> None', 'View help', 'c'],
			['id', 'id(${1:obj})', 'Function', '(obj: Any) -> int', 'Return object memory address',
				'c'
			],
			['issubclass', 'issubclass(${1:cls}, ${2:parent})', 'Function',
				'(cls: type, parent: type) -> bool', 'Check if class is subclass', 'c'
			],
		];
		builtins.forEach(([label, insert, kind, detail, doc, sort]) => {
			suggestions.push(makeSuggestion(label, insert, monaco.languages.CompletionItemKind[
					kind] || monaco.languages.CompletionItemKind.Function, detail, doc,
				sort));
		});

		const snippets = [
			['main', 'if __name__ == "__main__":\n    ${1:pass}', 'Snippet', 'Script main entry point',
				'a'
			],
			['init', 'def __init__(self${1:, params}):\n    ${2:pass}', 'Snippet', 'Class init method',
				'a'
			],
			['property', '@property\ndef ${1:name}(self):\n    return self._${2:name}', 'Snippet',
				'Property decorator', 'b'
			],
		];
		snippets.forEach(([label, insert, kind, doc, sort]) => {
			suggestions.push(makeSuggestion(label, insert, monaco.languages.CompletionItemKind[
				kind] || monaco.languages.CompletionItemKind.Snippet, '', doc, sort));
		});

		const constants = [
			['True', 'True', 'Constant', 'bool', 'Boolean true', 'a'],
			['False', 'False', 'Constant', 'bool', 'Boolean false', 'a'],
			['None', 'None', 'Constant', 'NoneType', 'Null value', 'a'],
		];
		constants.forEach(([label, insert, kind, detail, doc, sort]) => {
			suggestions.push(makeSuggestion(label, insert, monaco.languages.CompletionItemKind[
					kind] || monaco.languages.CompletionItemKind.Constant, detail, doc,
				sort));
		});

		const listMethods = [
			['append', 'append(${1:item})', 'Method', '-> None', 'Add item to end', 'a'],
			['pop', 'pop(${1:index})', 'Method', '-> Any', 'Remove and return item at index', 'a'],
			['extend', 'extend(${1:iterable})', 'Method', '-> None', 'Extend list with iterable', 'a'],
			['insert', 'insert(${1:index}, ${2:item})', 'Method', '-> None', 'Insert item at position',
				'a'
			],
			['remove', 'remove(${1:item})', 'Method', '-> None', 'Remove first matching item', 'b'],
			['sort', 'sort(${1:key}, ${2:reverse})', 'Method', '-> None', 'Sort the list in place',
				'b'
			],
			['reverse', 'reverse()', 'Method', '-> None', 'Reverse the list in place', 'b'],
			['index', 'index(${1:item})', 'Method', '-> int', 'Return index of first occurrence', 'c'],
			['count', 'count(${1:item})', 'Method', '-> int', 'Count occurrences of item', 'c'],
			['clear', 'clear()', 'Method', '-> None', 'Remove all items', 'c'],
			['copy', 'copy()', 'Method', '-> list', 'Return shallow copy', 'c'],
		];
		listMethods.forEach(([label, insert, kind, detail, doc, sort]) => {
			suggestions.push(makeSuggestion(label, insert, monaco.languages.CompletionItemKind[
				kind] || monaco.languages.CompletionItemKind.Method, detail, doc, sort));
		});

		const stringMethods = [
			['split', 'split(${1:sep})', 'Method', '-> list[str]', 'Split string by separator', 'a'],
			['strip', 'strip()', 'Method', '-> str', 'Remove leading/trailing whitespace', 'a'],
			['replace', 'replace(${1:old}, ${2:new})', 'Method', '-> str', 'Replace substring', 'a'],
			['join', 'join(${1:iterable})', 'Method', '-> str', 'Join strings with separator', 'a'],
			['format', 'format(${1:args})', 'Method', '-> str', 'Format string', 'a'],
			['lower', 'lower()', 'Method', '-> str', 'Convert to lowercase', 'b'],
			['upper', 'upper()', 'Method', '-> str', 'Convert to uppercase', 'b'],
			['capitalize', 'capitalize()', 'Method', '-> str', 'Capitalize first letter', 'b'],
			['title', 'title()', 'Method', '-> str', 'Title case', 'b'],
			['startswith', 'startswith(${1:prefix})', 'Method', '-> bool',
				'Check if starts with prefix', 'b'
			],
			['endswith', 'endswith(${1:suffix})', 'Method', '-> bool', 'Check if ends with suffix',
				'b'
			],
			['find', 'find(${1:sub})', 'Method', '-> int', 'Find substring index', 'c'],
			['index', 'index(${1:sub})', 'Method', '-> int', 'Return index of substring', 'c'],
			['lstrip', 'lstrip()', 'Method', '-> str', 'Remove leading whitespace', 'c'],
			['rstrip', 'rstrip()', 'Method', '-> str', 'Remove trailing whitespace', 'c'],
			['swapcase', 'swapcase()', 'Method', '-> str', 'Swap case', 'c'],
			['encode', 'encode(${1:encoding})', 'Method', '-> bytes', 'Encode string', 'c'],
			['isalpha', 'isalpha()', 'Method', '-> bool', 'Check if all alphabetic', 'd'],
			['isdigit', 'isdigit()', 'Method', '-> bool', 'Check if all digits', 'd'],
			['isalnum', 'isalnum()', 'Method', '-> bool', 'Check if alphanumeric', 'd'],
			['isspace', 'isspace()', 'Method', '-> bool', 'Check if all whitespace', 'd'],
			['isupper', 'isupper()', 'Method', '-> bool', 'Check if all uppercase', 'd'],
			['islower', 'islower()', 'Method', '-> bool', 'Check if all lowercase', 'd'],
		];
		stringMethods.forEach(([label, insert, kind, detail, doc, sort]) => {
			suggestions.push(makeSuggestion(label, insert, monaco.languages.CompletionItemKind[
				kind] || monaco.languages.CompletionItemKind.Method, detail, doc, sort));
		});

		const dictMethods = [
			['get', 'get(${1:key}, ${2:default})', 'Method', '-> Any', 'Get value or default', 'a'],
			['keys', 'keys()', 'Method', '-> KeysView', 'Return all keys', 'a'],
			['values', 'values()', 'Method', '-> ValuesView', 'Return all values', 'a'],
			['items', 'items()', 'Method', '-> ItemsView', 'Return all key-value pairs', 'a'],
			['pop', 'pop(${1:key}, ${2:default})', 'Method', '-> Any', 'Remove and return value', 'b'],
			['update', 'update(${1:other_dict})', 'Method', '-> None', 'Update dict with another', 'b'],
			['setdefault', 'setdefault(${1:key}, ${2:default})', 'Method', '-> Any',
				'Get or set default', 'b'
			],
			['popitem', 'popitem()', 'Method', '-> tuple', 'Remove and return last item', 'c'],
			['clear', 'clear()', 'Method', '-> None', 'Remove all items', 'c'],
			['copy', 'copy()', 'Method', '-> dict', 'Return shallow copy', 'c'],
		];
		dictMethods.forEach(([label, insert, kind, detail, doc, sort]) => {
			suggestions.push(makeSuggestion(label, insert, monaco.languages.CompletionItemKind[
				kind] || monaco.languages.CompletionItemKind.Method, detail, doc, sort));
		});

		let filteredSuggestions = suggestions;

		if (isAfterDot) {
			filteredSuggestions = suggestions.filter(s =>
				s.kind === monaco.languages.CompletionItemKind.Method ||
				s.kind === monaco.languages.CompletionItemKind.Function
			);
		} else if (isAfterParen) {
			filteredSuggestions = suggestions.filter(s =>
				s.kind === monaco.languages.CompletionItemKind.Variable ||
				s.kind === monaco.languages.CompletionItemKind.Function ||
				s.kind === monaco.languages.CompletionItemKind.Method
			);
			if (filteredSuggestions.length < 3) {
				filteredSuggestions = suggestions;
			}
		}

		return {
			suggestions: filteredSuggestions
		};
	}
});



const initApp = (async function() {
	// ----- DOM refs -----
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
	const updateBtn = document.getElementById('update-btn');
	const emailBtn = document.getElementById('email-btn');
	const QQBtn = document.getElementById('qq-btn');

	// ----- AI 侧边栏 DOM refs -----
	const aiSidebar = document.getElementById('ai-sidebar');
	const closeAiSidebar = document.getElementById('close-ai-sidebar');
	const aiMessages = document.getElementById('ai-messages');
	const aiInput = document.getElementById('ai-input');
	const aiSendBtn = document.getElementById('ai-send-btn');
	const presetBtns = document.querySelectorAll('.preset-btn');

	// ----- PyPI DOM refs -----
	const pypiView = document.getElementById('pypi-view');
	const pypiBtn = document.getElementById('pypi-btn');
	const aboutBtn = document.getElementById('about-btn');

	const packageSearch = document.getElementById('package-search');
	const searchPackageBtn = document.getElementById('search-package-btn');
	const installPackageBtn = document.getElementById('install-package-btn');
	const pypiResults = document.getElementById('pypi-results');
	const installedPackagesList = document.getElementById('installed-packages-list');

	const aboutIcon = document.getElementById("about-icon");
	const chatwayBtn = document.getElementById("chatway-btn");

	const isDarkMode = matchMedia('(prefers-color-scheme: dark)');

	// ----- 项目系统状态 -----
	let currentProject = null;
	let currentFileName = null;

	// AI 状态
	let isAiSidebarOpen = false;
	let aiCredits = 0;
	let conversationHistory = [];
	const MAX_HISTORY_ROUNDS = 10;

	let aiClient = null;

	(async () => {
		function getAndroidId() {
			if (plus.os.name.toLowerCase() !== 'android') return '';
			try {
				// 关键：用 invoke 直接调用 Settings$Secure 的 getString 方法
				var main = plus.android.runtimeMainActivity();
				var resolver = main.getContentResolver();

				var androidId = plus.android.invoke(
					'android.provider.Settings$Secure',
					'getString',
					resolver,
					'android_id'
				);

				// 过滤已知的无效值
				if (!androidId || androidId === '9774d56d682e549c') return '';
				return androidId;
			} catch (e) {
				console.error('获取 Android ID 失败:', e);
				return '';
			}
		}

		aiClient = new AIClient({
			token: '57b43a1858f7b562f103599872a432ce57afd5fa6180d20cd66084712aadd2fc',
			userId: getAndroidId()
		});
	})();

	// ============================================================
	// 多选项卡管理 (移入 initApp 内部)
	// ============================================================
	let openTabs = [];
	let activeTabId = null;
	let tabIdCounter = 0;
	const tabsScroll = document.getElementById('tabs-scroll');
	const tabModels = new Map();

	function getTabId(filePath, projectName) {
		return `${projectName}:${filePath}`;
	}

	function findTabByPath(filePath, projectName) {
		const tabId = getTabId(filePath, projectName);
		return openTabs.find(t => t.id === tabId);
	}

	function getActiveTab() {
		return openTabs.find(t => t.id === activeTabId);
	}

	function getActiveTabModel() {
		if (!activeTabId) return null;
		return tabModels.get(activeTabId) || null;
	}

	function getMonacoLanguage(fileName) {
		if (!fileName) return 'plaintext';

		const ext = fileName.split('.').pop().toLowerCase();

		const map = {
			// Web 前端
			'html': 'html',
			'htm': 'html',
			'css': 'css',
			'scss': 'scss',
			'less': 'less',
			'js': 'javascript',
			'mjs': 'javascript',
			'cjs': 'javascript',
			'jsx': 'javascript',
			'ts': 'typescript',
			'tsx': 'typescript',

			// JSON / 配置
			'json': 'json',
			'jsonc': 'jsonc',
			'json5': 'json',

			// 后端语言
			'py': 'python',
			'pyw': 'python',
			'java': 'java',
			'c': 'c',
			'cpp': 'cpp',
			'cc': 'cpp',
			'cxx': 'cpp',
			'h': 'cpp',
			'hpp': 'cpp',
			'cs': 'csharp',
			'go': 'go',
			'rs': 'rust',
			'rb': 'ruby',
			'php': 'php',
			'swift': 'swift',
			'kt': 'kotlin',

			// 脚本 & Shell
			'sh': 'shell',
			'bash': 'shell',
			'zsh': 'shell',
			'ps1': 'powershell',

			// SQL
			'sql': 'sql',

			// 标记语言
			'md': 'markdown',
			'xml': 'xml',
			'svg': 'xml',
			'yaml': 'yaml',
			'yml': 'yaml',
			'toml': 'toml',

			// 其他
			'r': 'r',
			'scala': 'scala',
			'lua': 'lua',
			'pl': 'perl',
			'pm': 'perl',
		};

		return map[ext] || 'plaintext';
	}

	async function createTab(filePath, projectName, content = '') {
		const tabId = getTabId(filePath, projectName);

		if (openTabs.some(t => t.id === tabId)) {
			activateTab(tabId);
			return tabId;
		}

		const fileName = filePath.split('/').pop();

		const tab = {
			id: tabId,
			filePath: filePath,
			projectName: projectName,
			fileName: fileName,
			isDirty: false,
			content: content
		};

		openTabs.push(tab);
		tabIdCounter++;

		const model = monaco.editor.createModel(content, getMonacoLanguage(fileName));
		tabModels.set(tabId, model);

		renderTabs();
		activateTab(tabId);

		return tabId;
	}

	async function closeTab(tabId, skipConfirm = false) {
		const tab = openTabs.find(t => t.id === tabId);
		if (!tab) return;

		if (tab.isDirty && !skipConfirm) {
			const result = await new Promise((resolve) => {
				plus.nativeUI.confirm(
					`"${tab.fileName}" has unsaved changes. Save before closing?`,
					function(e) {
						if (e.index === 0) resolve(true);
						else if (e.index === 1) resolve(false);
						else resolve(null);
					}, {
						title: 'Tip',
						buttons: ['Save', 'Don\'t Save', 'Cancel']
					}
				);
			});

			if (result === null) return;
			if (result === true) {
				await saveTabContent(tabId);
			}
		}

		const model = tabModels.get(tabId);
		if (model) {
			model.dispose();
			tabModels.delete(tabId);
		}

		const index = openTabs.findIndex(t => t.id === tabId);
		if (index !== -1) {
			openTabs.splice(index, 1);
		}

		if (activeTabId === tabId) {
			if (openTabs.length > 0) {
				const newIndex = Math.min(index, openTabs.length - 1);
				activateTab(openTabs[newIndex].id);
			} else {
				activeTabId = null;
				editor.setModel(null);
				editorTitle.textContent = 'No file opened';
			}
		}

		renderTabs();
	}

	function activateTab(tabId) {
		const tab = openTabs.find(t => t.id === tabId);
		if (!tab) return;

		activeTabId = tabId;

		const model = tabModels.get(tabId);
		if (model) {
			editor.setModel(model);
			if (tab.content && model.getValue() !== tab.content) {
				model.setValue(tab.content);
			}
		}

		editorTitle.textContent = `${tab.filePath.split('/').slice(1).join('/')}`;
		if (tab.isDirty) {
			editorTitle.textContent = '* ' + editorTitle.textContent;
		}

		renderTabs();
	}

	async function saveTabContent(tabId) {
		const tab = openTabs.find(t => t.id === tabId);
		if (!tab) return;

		const model = tabModels.get(tabId);
		if (!model) return;

		const content = model.getValue();
		await putFile(tab.filePath, content);

		tab.content = content;
		tab.isDirty = false;

		renderTabs();

		if (activeTabId === tabId) {
			editorTitle.textContent = `${tab.filePath.split('/').slice(1).join('/')}`;
		}
	}

	function renderTabs() {
		tabsScroll.innerHTML = '';

		if (openTabs.length === 0) {
			tabsScroll.innerHTML = '';
			return;
		}

		const groups = {};
		for (const tab of openTabs) {
			if (!groups[tab.projectName]) {
				groups[tab.projectName] = [];
			}
			groups[tab.projectName].push(tab);
		}

		for (const [project, tabs] of Object.entries(groups)) {
			for (const tab of tabs) {
				const tabEl = document.createElement('div');
				tabEl.className = 'tab-item';
				if (tab.id === activeTabId) {
					tabEl.classList.add('active');
				}

				const nameSpan = document.createElement('span');
				nameSpan.className = 'tab-name';
				nameSpan.textContent = tab.fileName;
				if (tab.isDirty) {
					nameSpan.textContent = '* ' + nameSpan.textContent;
				}

				const closeBtn = document.createElement('button');
				closeBtn.className = 'tab-close';
				closeBtn.innerHTML = `
                <svg width='1em' height='1em' viewBox="0 0 48 48" fill="none"
                    xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 8L40 40" stroke="currentColor" stroke-width="4" stroke-linecap="round"
                        stroke-linejoin="round" />
                    <path d="M8 40L40 8" stroke="currentColor" stroke-width="4" stroke-linecap="round"
                        stroke-linejoin="round" />
                </svg>`;
				closeBtn.title = 'Close tab';
				closeBtn.addEventListener('click', (e) => {
					e.stopPropagation();
					closeTab(tab.id);
				});

				tabEl.appendChild(nameSpan);
				tabEl.appendChild(closeBtn);

				tabEl.addEventListener('click', () => {
					activateTab(tab.id);
				});

				tabEl.addEventListener('contextmenu', (e) => {
					e.preventDefault();
					e.stopPropagation();
					showTabContextMenu(tab.id, tabEl);
				});

				tabsScroll.appendChild(tabEl);
			}
		}
	}

	function showTabContextMenu(tabId, anchor = null) {
		const tab = openTabs.find(t => t.id === tabId);
		if (!tab) return;

		showCustomActionSheet({
			anchor: anchor,
			buttons: [{
					title: 'Close',
					onClick: () => closeTab(tabId)
				},
				{
					title: 'Close Others',
					onClick: () => {
						const toClose = openTabs.filter(t => t.id !== tabId);
						for (const t of toClose) {
							closeTab(t.id, true);
						}
					}
				},
				{
					title: 'Close All',
					onClick: () => {
						const tabsToClose = [...openTabs];
						for (const t of tabsToClose) {
							closeTab(t.id, true);
						}
					}
				},
				{
					title: 'Copy Path',
					onClick: () => {
						navigator.clipboard.writeText(FILE_DIR + tab.filePath);
					}
				}
			]
		});
	}

	function closeAllTabsForProject(projectName) {
		const toClose = openTabs.filter(t => t.projectName === projectName);
		for (const tab of toClose) {
			const model = tabModels.get(tab.id);
			if (model) {
				model.dispose();
				tabModels.delete(tab.id);
			}
		}
		openTabs = openTabs.filter(t => t.projectName !== projectName);
		if (openTabs.length > 0) {
			activateTab(openTabs[0].id);
		} else {
			activeTabId = null;
			editor.setModel(null);
			editorTitle.textContent = 'No file opened';
		}
		renderTabs();
	}

	// ============================================================
	// 视频广告状态管理
	// ============================================================
	let adDailyCount = 0;
	let adLastPlayTime = 0;
	let adTodayDate = '';

	function loadAdState() {
		try {
			const saved = plus.storage.getItem('video-ad-state');
			if (saved) {
				const data = JSON.parse(saved);
				adDailyCount = data.count || 0;
				adLastPlayTime = data.lastTime || 0;
				adTodayDate = data.date || '';
				const today = new Date().toDateString();
				if (adTodayDate !== today) {
					adDailyCount = 0;
					adLastPlayTime = 0;
					adTodayDate = today;
					saveAdState();
				}
			} else {
				adTodayDate = new Date().toDateString();
				saveAdState();
			}
		} catch (e) {
			console.warn('加载广告状态失败:', e);
		}
	}

	function saveAdState() {
		try {
			plus.storage.setItem('video-ad-state', JSON.stringify({
				count: adDailyCount,
				lastTime: adLastPlayTime,
				date: adTodayDate
			}));
		} catch (e) {
			console.warn('保存广告状态失败:', e);
		}
	}

	function canPlayVideoAd() {
		const today = new Date().toDateString();
		if (adTodayDate !== today) {
			adDailyCount = 0;
			adLastPlayTime = 0;
			adTodayDate = today;
			saveAdState();
		}

		if (adDailyCount >= 20) {
			plus.nativeUI.toast('The number of views today has reached the limit.');
			return false;
		}

		const now = Date.now();
		if (adLastPlayTime > 0 && (now - adLastPlayTime) < 3 * 60 * 1000) {
			const remaining = Math.ceil((3 * 60 * 1000 - (now - adLastPlayTime)) / 1000);
			plus.nativeUI.toast(`Please wait ${remaining} seconds before watching the AD.`);
			return false;
		}

		return true;
	}

	function recordAdPlaySuccess() {
		const today = new Date().toDateString();
		if (adTodayDate !== today) {
			adDailyCount = 0;
			adTodayDate = today;
		}
		adDailyCount++;
		adLastPlayTime = Date.now();
		saveAdState();
	}

	function loadAiCredits() {
		const today = new Date().toDateString();
		const freeKey = 'free-credits-date';
		const savedDate = plus.storage.getItem(freeKey);

		const saved = plus.storage.getItem('ai-credits');
		aiCredits = saved ? parseInt(saved, 10) : 0;

		if (savedDate !== today) {
			aiCredits += 10;
			plus.storage.setItem(freeKey, today);
			saveAiCredits();
		}

		updateCreditDisplay();
	}

	function updateCreditDisplay() {
		const creditDisplay = document.getElementById('credit-count');
		if (creditDisplay) {
			creditDisplay.textContent = aiCredits;
		}
	}

	function saveAiCredits() {
		plus.storage.setItem('ai-credits', String(aiCredits));
		updateCreditDisplay();
	}

	function watchAdForCredits() {
		if (!canPlayVideoAd()) {
			return;
		}
		showVideoAdvert(() => {
			recordAdPlaySuccess();
			aiCredits += 10;
			saveAiCredits();
		}, null);
	}

	// ============================================================
	// 页面切换管理
	// ============================================================

	const PAGE_VIEWS = {
		files: 'file-list-view',
		edit: 'edit-view',
		pypi: 'pypi-view',
		about: 'about-view'
	};

	const views = Object.values(PAGE_VIEWS).map(key => document.getElementById(key));

	let currentView = 'files';

	function togglePage(pageId) {
		currentView = pageId;

		views.forEach(view => {
			if (view) {
				view.classList.remove('active');
			}
		});

		const targetView = document.getElementById(PAGE_VIEWS[pageId]);
		if (targetView) {
			targetView.classList.add('active');
		}
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

	function renderMarkdown(md) {
		if (!md) return '';

		return marked.parse(md.trim()).slice(0, -1);
	}

	async function sendAiMessage(userInput) {
		if (!userInput.trim()) return;

		if (aiCredits <= 0) {
			addAiMessage('Not Enough Coins', null, 'system');
			return;
		}

		aiCredits -= 1;
		saveAiCredits();

		addAiMessage(userInput, null, 'user');
		aiInput.value = '';

		// 创建流式气泡
		const streamDiv = document.createElement('div');
		streamDiv.className = 'ai-message assistant';

		// ---------- 工具调用区（固定在气泡最上面，覆盖式） ----------
		const toolCallDiv = document.createElement('div');
		toolCallDiv.className = 'ai-toolcall';
		toolCallDiv.innerHTML = `
	<svg class="ai-toolcall-icon" viewBox="0 0 24 24" fill="none"
		stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M14.7 6.3a4 4 0 0 0 5 5l-9.4 9.4a2.8 2.8 0 0 1-4-4z"/>
		<path d="M14.7 6.3 17 4"/>
	</svg>
	<span class="ai-toolcall-text"></span>
`;
		const toolCallText = toolCallDiv.querySelector('.ai-toolcall-text');
		const showToolCall = (text, done = false) => {
			toolCallText.textContent = text;
			toolCallDiv.classList.add('visible');
			toolCallDiv.classList.toggle('done', done);
		};

		// ---------- 思考区（默认展开） ----------
		const streamReasoningDiv = document.createElement('div');
		streamReasoningDiv.className = 'ai-reasoning';
		streamReasoningDiv.style.display = 'none'; // 没思考就不显示

		const reasoningHeader = document.createElement('div');
		reasoningHeader.className = 'ai-reasoning-header expanded'; // 默认展开
		reasoningHeader.innerHTML = `
	<svg class="ai-reasoning-arrow" viewBox="0 0 24 24" fill="none"
		stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M9 6l6 6-6 6"/>
	</svg>
	<span>Thinking...</span>
`;

		// 默认不折叠
		const reasoningBody = document.createElement('div');
		reasoningBody.className = 'ai-reasoning-body';

		streamReasoningDiv.appendChild(reasoningHeader);
		streamReasoningDiv.appendChild(reasoningBody);

		// ---------- 正文区 ----------
		const streamContentDiv = document.createElement('div');
		streamContentDiv.textContent = 'Thinking...';

		// 顺序：工具区 → 思考区 → 正文
		streamDiv.appendChild(toolCallDiv);
		streamDiv.appendChild(streamReasoningDiv);
		streamDiv.appendChild(streamContentDiv);
		aiMessages.appendChild(streamDiv);
		aiMessages.scrollTop = aiMessages.scrollHeight;

		let rawBuffer = '';
		let reasoningBuffer = '';
		let firstChunk = true;
		let renderScheduled = false;
		let reasoningScheduled = false;
		let reasoningDone = false;
		let userToggledReasoning = false; // 用户是否手动干预过

		// 点击标题展开/收起
		reasoningHeader.onclick = () => {
			userToggledReasoning = true;
			const hidden = reasoningBody.classList.contains('collapsed');
			reasoningBody.classList.toggle('collapsed', !hidden);
			reasoningHeader.classList.toggle('expanded', hidden);
		};

		function scheduleRender() {
			if (renderScheduled) return;
			renderScheduled = true;
			requestAnimationFrame(() => {
				renderScheduled = false;
				streamContentDiv.innerHTML = renderMarkdown(rawBuffer);
				aiMessages.scrollTop = aiMessages.scrollHeight;
			});
		}

		function scheduleReasoningRender() {
			if (reasoningScheduled) return;
			reasoningScheduled = true;
			requestAnimationFrame(() => {
				reasoningScheduled = false;
				streamReasoningDiv.style.display = 'block';
				reasoningBody.textContent = reasoningBuffer;
				aiMessages.scrollTop = aiMessages.scrollHeight;
			});
		}

		const markReasoningDone = () => {
			if (reasoningDone) return;
			reasoningDone = true;

			const label = reasoningHeader.querySelector('span');
			if (label) label.textContent = 'Thought for a moment';

			// 思考完成后自动折叠（用户没手动干预过才折叠）
			if (!userToggledReasoning) {
				reasoningBody.classList.add('collapsed');
				reasoningHeader.classList.remove('expanded');
			}
		};

		const onDelta = (chunk) => {
			if (firstChunk) {
				firstChunk = false;
				streamContentDiv.textContent = '';
			}
			// 正文一到，标记思考完成（保持折叠）
			if (reasoningBuffer) markReasoningDone();
			rawBuffer += chunk;
			scheduleRender();
		};

		try {
			const activeTab = getActiveTab();
			let currentCode = '';
			let projectName = null;

			if (activeTab) {
				projectName = activeTab.projectName;
				const model = tabModels.get(activeTab.id);
				if (model) {
					currentCode = model.getValue();
				}
			}

			conversationHistory.push({
				role: 'user',
				content: userInput
			});

			if (conversationHistory.length > MAX_HISTORY_ROUNDS * 2) {
				conversationHistory = conversationHistory.slice(-MAX_HISTORY_ROUNDS * 2);
			}

			const prompt = `You are a senior code debugging expert. The current file content is:
\`\`\`${activeTab ? activeTab.fileName.split('.').pop() : 'text'}
${currentCode}
\`\`\`

Current project: ${projectName || '(no project opened)'}
Current file: ${activeTab ? activeTab.fileName : '(none)'}

Answer directly in natural language (Markdown format). When code is needed, wrap it in a \`\`\`language code block.

User: ${userInput}`;

			await aiClient.send(prompt, {
				onReasoning: (chunk) => {
					reasoningBuffer += chunk;
					scheduleReasoningRender();
				},
				onContent: onDelta,
				onToolCall: (name, args) => {
					const argsStr = Object.entries(args).map(([key, value]) =>
						`${key} = ${value}`).join(', ');
					console.log(`🔧 调用 ${name}`, args);
					showToolCall(`${name}(${argsStr})`, false);
				},
				onToolResult: (name) => {
					console.log(`✅ ${name}`);
					showToolCall('', true);
				},
				onDone: () => {},
				onError: (e) => {
					throw e;
				}
			});

			// 收尾渲染
			if (firstChunk) {
				streamContentDiv.innerHTML = renderMarkdown(rawBuffer || '');
			} else {
				streamContentDiv.innerHTML = renderMarkdown(rawBuffer);
			}

			// 只有思考、没有正文的情况
			if (reasoningBuffer) markReasoningDone();

			conversationHistory.push({
				role: 'assistant',
				content: rawBuffer
			});

		} catch (error) {
			streamDiv.remove();
			addAiMessage(`Error：${error.message}`, null, 'system');
			aiCredits += 1;
			saveAiCredits();
		}
	}

	function showFileListView() {
		togglePage('files');
		renderProjectList();
		if (isAiSidebarOpen) {
			toggleAiSidebar();
		}
	}

	function showEditView() {
		togglePage('edit');
		editor.layout();
	}

	function showPypiView() {
		togglePage('pypi');
		renderInstalledPackages();
		pypiResults.innerHTML = '<div class="pypi-empty">Enter the package name</div>';
		packageSearch.value = '';
		setTimeout(() => packageSearch.focus(), 50);
		if (isAiSidebarOpen) {
			toggleAiSidebar();
		}
	}

	// ----- Monaco -----
	const container = document.getElementById('code-area');

	const editor = monaco.editor.create(container, {
		value: 'print("Hello, Pylind!")',
		language: 'python',
		theme: isDarkMode.matches ? 'vs-dark' : 'vs',
		automaticLayout: true,
		fontSize: 14,
		fontFamily: 'Cascadia Code, Consolas, Menlo, monospace',
		lineNumbers: 'on',
		tabSize: 4,
		insertSpaces: true,
		wordWrap: 'off',
		autoIndent: 'full',
		matchBrackets: true,
		autoClosingBrackets: 'always',
		minimap: {
			enabled: false
		},
		scrollbar: {
			vertical: 'auto',
			horizontal: 'auto'
		}
	});

	editor.focus();

	// ============================================================
	// 自动保存逻辑
	// ============================================================
	let autoSaveTimer = null;
	let pendingCharCount = 0;
	const AUTO_SAVE_CHAR_THRESHOLD = 5;
	const AUTO_SAVE_INTERVAL = 10000; // 10 秒

	async function autoSaveActiveTab(reason = '') {
		const activeTab = getActiveTab();
		if (!activeTab) return;
		if (!activeTab.isDirty) return;

		try {
			await saveTabContent(activeTab.id);

			// 保存后刷新一下标题，去掉 *
			if (activeTabId === activeTab.id) {
				editorTitle.textContent = `${activeTab.filePath.split('/').slice(1).join('/')}`;
			}

			console.log(`[AutoSave] 已保存 (${reason}) -> ${activeTab.fileName}`);
		} catch (e) {
			console.warn('[AutoSave] 保存失败:', e);
		}
	}

	function resetAutoSaveTimer() {
		if (autoSaveTimer) {
			clearInterval(autoSaveTimer);
		}
		autoSaveTimer = setInterval(() => {
			autoSaveActiveTab('15s 定时');
		}, AUTO_SAVE_INTERVAL);
	}

	function resetCharCounter() {
		pendingCharCount = 0;
	}

	// 启动定时器
	resetAutoSaveTimer();

	// 监听内容变化
	editor.onDidChangeModelContent((e) => {
		const model = editor.getModel();
		if (!model) return;

		// ---------- 1. 原有 dirty 标记逻辑 ----------
		for (const [tabId, tabModel] of tabModels) {
			if (tabModel === model) {
				const tab = openTabs.find(t => t.id === tabId);
				if (tab) {
					if (!tab.isDirty) {
						const currentContent = model.getValue();
						if (currentContent !== tab.content) {
							tab.isDirty = true;
							if (activeTabId === tabId) {
								editorTitle.textContent =
									`* ${tab.filePath.split('/').slice(1).join('/')}`;
							}
							renderTabs();
						}
					}

					// ---------- 2. 累计修改字符数 ----------
					const changes = e.changes || [];
					let delta = 0;
					for (const ch of changes) {
						delta += (ch.text ? ch.text.length : 0);
						delta += (ch.rangeLength || 0);
					}
					pendingCharCount += delta;

					// 达到阈值就保存
					if (pendingCharCount >= AUTO_SAVE_CHAR_THRESHOLD) {
						resetCharCounter();
						autoSaveActiveTab('累计修改 10 字符');
					}
				}
				break;
			}
		}
	});

	editor.onDidBlurEditorText(() => {
		autoSaveActiveTab('编辑器失焦');
	});

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
		background: '#f5f9f5',
		foreground: '#1a3320',
		cursor: '#2d7a4a',
		selectionBackground: '#c8e0d0',
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

	const term = new Terminal({
		cursorBlink: true,
		fontSize: 16,
		fontFamily: '"Cascadia Code","Courier New",Consolas,monospace',
		theme: isDarkMode.matches ? darkTheme : lightGreenTheme,
		scrollback: 10000
	});

	isDarkMode.addEventListener('change', (e) => {
		term.options.theme = e.matches ? darkTheme : lightGreenTheme;
		editor.updateOptions({
			'theme': e.matches ? 'vs-dark' : 'vs'
		});
	})

	const fitAddon = new FitAddon();
	term.loadAddon(fitAddon);
	term.open(terminalContainer);
	setTimeout(() => fitAddon.fit(), 50);
	window.addEventListener('resize', () => fitAddon.fit());

	plus.nativeUI.setUIStyle('dark');

	// ----- 状态 -----
	let pyodide = null;
	let pyodideEmptyState = null;
	let isPyodideReady = false;

	let adVidioReward = null;

	function showVideoAdvert(callback, args) {
		if (adVidioReward) {
			return;
		}

		adVidioReward = plus.ad.createRewardedVideoAd({
			adpid: '1580082566',
		});
		adVidioReward.onLoad(function() {
			adVidioReward.show();
		});
		adVidioReward.onError(function(e) {
			console.error('加载失败: ' + JSON.stringify(e));
			plus.nativeUI.toast('The AD failed to load. Please try again later.');
			adVidioReward.destroy();
			adVidioReward = null;
		});
		adVidioReward.onClose(function(e) {
			if (callback && typeof callback === 'function') {
				callback(args);
			}
			adVidioReward.destroy();
			adVidioReward = null;
		});
		adVidioReward.load();
	}

	let adView = null;

	function showMiniAdvert() {
		if (Math.random() >= 0.1) {
			return;
		}

		if (adView) {
			return;
		}

		adView = plus.ad.createAdView({
			top: '0px',
			left: '0px',
			width: '100%',
			height: '0px',
			position: 'static'
		});
		plus.webview.currentWebview().append(adView);
		adView.setRenderingListener(function(e) {
			if (0 != e.result) {
				console.error('渲染失败！');
			} else {
				adView.setStyle({
					top: window.innerHeight - e.height + 'px',
					height: e.height + 'px'
				});
			}
		});
		plus.ad.getAds({
			adpid: '1070918345',
			width: '100%',
			count: 3
		}, function(e) {
			if (!e || !e.ads || e.ads.length < 1) {
				console.log('无广告数据！');
			} else {
				adView.renderingBind(e.ads[0]);
				adView.setDislikeListener(() => {
					adView.close();
					adView = null;
				});
			}
		}, function(e) {
			console.error('获取广告失败: ' + JSON.stringify(e));
		});
	}

	function shareApp() {
		plus.share.getServices(function(services) {
			let sweixin = null;
			for (let i = 0; i < services.length; i++) {
				if (services[i].id === 'weixin') {
					sweixin = services[i];
					break;
				}
			}

			if (sweixin) {
				const msg = {
					type: 'web',
					title: 'Pylind',
					content: 'Click to download Pylind',
					href: "https://pylind.pages.dev",
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

	async function checkUpdate() {
		const res = await fetch('https://pylind.pages.dev/api/version');
		const serverVersion = parseInt((await res.json())?.version) ?? 0;
		const localVersion = plus.runtime.versionCode;
		if (serverVersion > localVersion) {
			plus.runtime.openURL('https://pylind.pages.dev/');
		} else {
			plus.nativeUI.toast('It it already the latest version.')
		}
	}

	// ============================================================
	// 文件操作 (使用 /storage/emulated/0/Pylind 目录，支持项目子目录)
	// ============================================================
	const FILE_DIR = '/storage/emulated/0/Pylind/';

	// ============================================================
	// 自定义长按菜单（锚点定位，替代 plus.nativeUI.actionSheet）
	// ============================================================
	let activeActionSheet = null;

	function showCustomActionSheet({
		buttons,
		anchor = null
	}) {
		closeCustomActionSheet();

		const overlay = document.createElement('div');
		overlay.className = 'custom-action-overlay';

		const sheet = document.createElement('div');
		sheet.className = 'custom-action-sheet';

		const btnGroup = document.createElement('div');
		btnGroup.className = 'custom-action-buttons';

		buttons.forEach((btn) => {
			const btnEl = document.createElement('button');
			btnEl.className = 'custom-action-btn';
			if (btn.style === 'destructive') btnEl.classList.add('destructive');
			btnEl.textContent = btn.title;
			btnEl.addEventListener('click', (e) => {
				e.stopPropagation();
				closeCustomActionSheet();
				if (typeof btn.onClick === 'function') {
					setTimeout(() => btn.onClick(), 50);
				}
			});
			btnGroup.appendChild(btnEl);
		});

		sheet.appendChild(btnGroup);

		overlay.addEventListener('click', () => closeCustomActionSheet());
		sheet.addEventListener('click', (e) => e.stopPropagation());

		overlay.appendChild(sheet);
		document.body.appendChild(overlay);
		activeActionSheet = overlay;

		requestAnimationFrame(() => {
			overlay.classList.add('visible');
			positionActionSheet(sheet, anchor);
		});
	}

	function positionActionSheet(sheet, anchor) {
		const sheetRect = sheet.getBoundingClientRect();
		const sheetW = sheetRect.width;
		const sheetH = sheetRect.height;

		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const margin = 8;

		let top, left;

		if (anchor && anchor.getBoundingClientRect) {
			const a = anchor.getBoundingClientRect();

			top = a.bottom + 4;
			left = a.right - sheetW;
			if (left < margin) left = a.left;
			if (left + sheetW > vw - margin) left = vw - sheetW - margin;

			if (top + sheetH > vh - margin) {
				const above = a.top - sheetH - 4;
				if (above >= margin) {
					top = above;
				} else {
					top = Math.max(margin, vh - sheetH - margin);
				}
			}
		} else {
			top = (vh - sheetH) / 2;
			left = (vw - sheetW) / 2;
		}

		top = Math.max(margin, Math.min(top, vh - sheetH - margin));
		left = Math.max(margin, Math.min(left, vw - sheetW - margin));

		sheet.style.top = top + 'px';
		sheet.style.left = left + 'px';
	}

	function closeCustomActionSheet() {
		if (!activeActionSheet) return;
		const overlay = activeActionSheet;
		activeActionSheet = null;
		overlay.classList.remove('visible');
		const sheet = overlay.querySelector('.custom-action-sheet');
		const onEnd = () => {
			if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
		};
		if (sheet) {
			sheet.addEventListener('transitionend', onEnd, {
				once: true
			});
			setTimeout(onEnd, 250);
		} else {
			onEnd();
		}
	}

	function requestManageStoragePermission() {
		var Build = plus.android.importClass("android.os.Build");
		var Environment = plus.android.importClass("android.os.Environment");
		var Intent = plus.android.importClass("android.content.Intent");
		var Settings = plus.android.importClass("android.provider.Settings");
		var Uri = plus.android.importClass("android.net.Uri");

		if (Build.VERSION.SDK_INT >= 30) {
			if (!Environment.isExternalStorageManager()) {
				var main = plus.android.runtimeMainActivity();
				var pkName = main.getPackageName();

				var intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
				var uri = Uri.fromParts("package", pkName, null);
				intent.setData(uri);

				main.startActivity(intent);
			}
		} else {
			console.log("当前系统版本无需此权限");
		}
	}

	function getFileSystem(callback) {
		plus.io.requestFileSystem(plus.io.PRIVATE_DOC, callback, function(err) {
			console.error('获取文件系统失败：', err.message);
		});
	}

	function getFileEntry(filePath, create, callback) {
		getFileSystem(function(fs) {
			fs.root.getFile(filePath, {
				create: create
			}, callback, function(err) {
				console.error('获取文件失败：', err.message);
				callback(null);
			});
		});
	}

	async function getFile(filePath) {
		return new Promise((resolve, reject) => {
			getFileEntry(FILE_DIR + filePath, false, function(fileEntry) {
				fileEntry.file(function(file) {
					const reader = new plus.io.FileReader();
					reader.onloadend = function(e) {
						resolve({
							name: filePath,
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

	async function putFile(filePath, content) {
		return new Promise((resolve, reject) => {
			getFileEntry(FILE_DIR + filePath, true, function(fileEntry) {
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

	async function deleteFile(filePath) {
		return new Promise((resolve, reject) => {
			getFileEntry(FILE_DIR + filePath, false, function(fileEntry) {
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

	async function renameFile(oldPath, newPath) {
		return new Promise((resolve, reject) => {
			getFileEntry(FILE_DIR + oldPath, false, function(fileEntry) {
				fileEntry.getParent(function(parent) {
					fileEntry.moveTo(parent, '/' + newPath, function() {
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

	// ============ 自动创建目录（最简版） ============
	async function ensureDirectory(subPath) {
		return new Promise((resolve, reject) => {
			const fullPath = FILE_DIR + subPath;

			plus.io.resolveLocalFileSystemURL(
				fullPath,
				function(dirEntry) {
					resolve(dirEntry);
				},
				function(err) {
					if (err.code === 14) {
						createDirectoryRecursive(fullPath, resolve, reject);
					} else {
						reject(err);
					}
				}
			);
		});
	}

	function createDirectoryRecursive(fullPath, resolve, reject) {
		const parts = fullPath.replace(/^\//, '').split('/');

		let currentPath = '';
		let currentEntry = null;

		function createNext(index) {
			if (index >= parts.length) {
				resolve(currentEntry);
				return;
			}

			const part = parts[index];
			currentPath += (index === 0 ? '' : '/') + part;

			plus.io.resolveLocalFileSystemURL(
				currentPath,
				function(entry) {
					currentEntry = entry;
					createNext(index + 1);
				},
				function(err) {
					if (err.code === 14) {
						const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/')) ||
							'/';
						plus.io.resolveLocalFileSystemURL(
							parentPath,
							function(parentEntry) {
								parentEntry.getDirectory(
									part, {
										create: true,
										exclusive: false
									},
									function(dirEntry) {
										currentEntry = dirEntry;
										createNext(index + 1);
									},
									reject
								);
							},
							reject
						);
					} else {
						reject(err);
					}
				}
			);
		}

		createNext(0);
	}

	async function listDirectory(dirPath) {
		return new Promise(function(resolve, reject) {
			const fullPath = FILE_DIR + dirPath;
			plus.io.resolveLocalFileSystemURL(fullPath, function(entry) {
				const reader = entry.createReader();
				reader.readEntries(function(entries) {
					const results = [];
					for (let i = 0; i < entries.length; i++) {
						if (entries[i].isFile) {
							results.push({
								name: entries[i].name,
								path: dirPath + '/' + entries[i]
									.name,
								isFile: true
							});
						} else if (entries[i].isDirectory) {
							results.push({
								name: entries[i].name,
								path: dirPath + '/' + entries[i]
									.name,
								isFile: false
							});
						}
					}
					resolve(results);
				}, function(e) {
					reject(new Error("读取目录失败: " + e.message));
				});
			}, function(e) {
				resolve([]);
			});
		});
	}

	async function listProjects() {
		try {
			const entries = await listDirectory('');
			return entries.filter(e => !e.isFile);
		} catch (e) {
			return [];
		}
	}

	async function getProjectFiles(projectName) {
		try {
			const entries = await listDirectory(projectName);
			return entries.filter(e => e.isFile);
		} catch (e) {
			return [];
		}
	}

	async function deleteProject(projectName) {
		return new Promise((resolve, reject) => {
			const fullPath = FILE_DIR + projectName;
			plus.io.resolveLocalFileSystemURL(fullPath, function(entry) {
				entry.removeRecursively(() => {
					entry.remove(function() {
						resolve();
					}, function(err) {
						reject(err.message);
					});
				}, (err) => {
					reject(err.message);
				});
			}, function(err) {
				resolve();
			});
		});
	}

	// ============================================================
	// 渲染项目列表
	// ============================================================
	async function renderProjectList() {
		try {
			const projects = await listProjects();
			fileGrid.innerHTML = '';
			if (projects.length === 0) {
				fileGrid.innerHTML = '<div class="empty-msg">No projects</div>';
				return;
			}
			projects.sort((a, b) => a.name.localeCompare(b.name));

			for (const proj of projects) {
				const div = document.createElement('div');
				div.className = 'file-item project-item';

				const nameSpan = document.createElement('span');
				nameSpan.className = 'name';
				nameSpan.textContent = proj.name;

				const moreBtn = document.createElement('button');
				moreBtn.className = 'more';
				moreBtn.innerHTML =
					'<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="24" r="3" fill="currentColor"/><circle cx="24" cy="24" r="3" fill="currentColor"/><circle cx="36" cy="24" r="3" fill="currentColor"/></svg>';
				moreBtn.title = 'More';
				moreBtn.addEventListener('click', async (e) => {
					e.stopPropagation();
					showProjectLongPressMenu(proj.name, moreBtn);
				});

				const nameContainer = document.createElement('div');
				nameContainer.style.display = 'flex';
				nameContainer.style.alignItems = 'center';
				nameContainer.appendChild(nameSpan);

				div.appendChild(nameContainer);
				div.appendChild(moreBtn);
				div.addEventListener('click', () => openProject(proj.name));

				let longPressTimer = null;
				let isLongPress = false;

				div.addEventListener('mousedown', (e) => {
					isLongPress = false;
					longPressTimer = setTimeout(() => {
						isLongPress = true;
						showProjectLongPressMenu(proj.name, div);
					}, 600);
				});

				div.addEventListener('mouseup', () => {
					clearTimeout(longPressTimer);
				});

				div.addEventListener('mouseleave', () => {
					clearTimeout(longPressTimer);
				});

				div.addEventListener('touchstart', (e) => {
					isLongPress = false;
					longPressTimer = setTimeout(() => {
						isLongPress = true;
						showProjectLongPressMenu(proj.name, div);
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
			console.warn('renderProjectList error', e);
		}
	}

	function showProjectLongPressMenu(projectName, anchor = null) {
		showCustomActionSheet({
			anchor: anchor,
			buttons: [{
					title: 'Rename',
					onClick: () => renameProject(projectName)
				},
				{
					title: 'Package',
					onClick: () => packageProject(projectName)
				},
				{
					title: 'Delete',
					style: 'destructive',
					onClick: () => {
						plus.nativeUI.confirm(`Delete project "${projectName}"?`,
							async function(
								confirm) {
								if (confirm.index === 0) {
									try {
										await deleteProject(projectName);
									} catch (e) {
										console.error(e);
									}
									closeAllTabsForProject(projectName);
									renderProjectList();
								}
							}, {
								title: 'Confirm',
								buttons: ['Delete', 'Cancel']
							});
					}
				},
			]
		});
	}

	async function renameProject(oldName) {
		plus.nativeUI.prompt('Enter new project name:', function(e) {
			if (e.index === 0 && e.value) {
				doRenameProject(oldName, e.value.trim());
			}
		}, 'Rename Project', oldName, ['Ok', 'Cancel']);
	}

	function packageProject(projectName) {
		plus.zip.compress(FILE_DIR + projectName, FILE_DIR + projectName + '.zip', () => {
			plus.nativeUI.alert('Packaged successfully');
		});
	}

	async function doRenameProject(oldName, newName) {
		const projects = await listProjects();
		if (projects.some(p => p.name === newName)) {
			plus.nativeUI.alert('Project "' + newName + '" already exists');
			return;
		}

		try {
			const oldPath = FILE_DIR + oldName;
			const newPath = FILE_DIR + newName;

			console.log(oldPath)

			plus.io.resolveLocalFileSystemURL(oldPath, function(entry) {
				entry.getParent(function(parent) {
					console.log(parent.fullPath, newName);
					entry.moveTo(parent, '/' + newName, function() {
						renderProjectList();
					}, function(err) {
						plus.nativeUI.alert('Rename error: ' + err.message);
					});
				}, function(err) {
					plus.nativeUI.alert('Rename error: ' + err.message);
				});
			}, function(err) {
				plus.nativeUI.alert('Rename error: ' + err.message);
			});
		} catch (e) {
			plus.nativeUI.alert('Rename error: ' + e.message);
		}
	}

	// ============================================================
	// 打开项目
	// ============================================================
	async function openProject(projectName) {
		currentProject = projectName;

		const oldTabs = openTabs.filter(t => t.projectName !== projectName);
		for (const tab of openTabs) {
			if (tab.projectName !== projectName) {
				const model = tabModels.get(tab.id);
				if (model) {
					model.dispose();
					tabModels.delete(tab.id);
				}
			}
		}
		openTabs = openTabs.filter(t => t.projectName === projectName);

		const files = await getProjectFiles(projectName);
		const mainFile = files.find(f => f.name === 'main.py');

		if (mainFile) {
			await openFileInProject(projectName, 'main.py');
		} else {
			const defaultContent = '# ' + projectName + '\nprint("Hello, ' + projectName + '!")\n';
			await putFile(projectName + '/main.py', defaultContent);
			await openFileInProject(projectName, 'main.py');
		}
	}

	async function openFileInProject(projectName, fileName) {
		const filePath = projectName + '/' + fileName;

		try {
			console.log(filePath)
			const entry = await getFile(filePath);
			const content = entry ? entry.content : '';

			const existingTab = findTabByPath(filePath, projectName);
			if (existingTab) {
				if (entry && existingTab.content !== content) {
					const model = tabModels.get(existingTab.id);
					if (model) {
						model.setValue(content);
						existingTab.content = content;
					}
				}
				activateTab(existingTab.id);
				showEditView();
				return;
			}

			const tabId = await createTab(filePath, projectName, content);

			currentProject = projectName;
			currentFileName = filePath;

			showEditView();
		} catch (e) {
			console.warn('openFileInProject error', e.message);
		}
	}

	// ============================================================
	// 文件列表抽屉（弹出式覆盖层，类似 AI 侧边栏）- 支持文件夹展开
	// ============================================================
	let fileDrawerOpen = false;
	let drawerOverlay = null;

	const fileDrawer = document.getElementById('file-drawer');
	drawerOverlay = document.getElementById('drawer-overlay');

	const drawerToggleBtn = document.getElementById('drawer-toggle-btn');

	drawerToggleBtn.addEventListener('click', function(e) {
		e.stopPropagation();
		e.preventDefault();
		openFileDrawer();
	});

	document.addEventListener('click', function(e) {
		if (fileDrawerOpen && !fileDrawer.contains(e.target) && e.target !== drawerToggleBtn &&
			!
			drawerToggleBtn.contains(e.target)) {
			closeFileDrawer();
		}
	});

	function toggleFileDrawer() {
		if (fileDrawerOpen) {
			closeFileDrawer();
		} else {
			openFileDrawer();
		}
	}

	async function openFileDrawer() {
		if (!currentProject) {
			plus.nativeUI.toast('No project opened');
			return;
		}
		fileDrawerOpen = true;
		fileDrawer.classList.add('open');
		drawerOverlay.classList.add('visible');
		document.getElementById('drawer-project-name').textContent = currentProject;
		await renderDrawerFileList();
	}

	function closeFileDrawer() {
		fileDrawerOpen = false;
		fileDrawer.classList.remove('open');
		drawerOverlay.classList.remove('visible');
	}

	// 文件夹展开状态存储
	if (!window._folderExpanded) {
		window._folderExpanded = {};
	}

	// 创建文件项
	function createDrawerFileItem(fileName, isInFolder = false, folderName = '') {
		const item = document.createElement('div');
		item.className = 'drawer-file-item';

		const relativePath = isInFolder ?
			(folderName ? folderName + '/' + fileName : fileName) :
			fileName;

		const fullPath = currentProject + '/' + relativePath;
		const isActive = (currentFileName === fullPath);

		if (isActive) {
			item.style.background = 'var(--bg-active, #3d3d3d)';
		}

		const nameDiv = document.createElement('div');
		nameDiv.className = 'file-name';

		const icon = document.createElement('span');
		icon.className = 'file-icon';
		if (fileName.endsWith('.py') || fileName.endsWith('.pyw')) {
			icon.innerHTML = `<svg viewBox="0 0 110 120" width="16" height="16">
	        <defs><linearGradient id="blue" x1="172.94" y1="77.48" x2="26.67" y2="76.31" gradientTransform="matrix(0.5625,0,0,0.568,-14.99,-11.7)">
	            <stop offset="0" stop-color="#5a9fd4"/><stop offset="1" stop-color="#306998"/>
	        </linearGradient>
	        <linearGradient id="yellow" x1="224.24" y1="144.76" x2="-65.31" y2="144.76" gradientTransform="matrix(0.5625,0,0,0.568,-14.99,-11.7)">
	            <stop offset="0" stop-color="#ffd43b"/><stop offset="1" stop-color="#ffe873"/>
	        </linearGradient></defs>
	        <path d="M54.92,0 C50.34,0.02 45.96,0.41 42.11,1.09 30.76,3.1 28.7,7.29 28.7,15.03v10.22h26.81v3.41H28.7 18.64c-7.79,0-14.62,4.68-16.75,13.59 -2.46,10.21-2.57,16.59 0,27.25 1.91,7.94 6.46,13.59 14.25,13.59h9.22V70.9c0-8.85 7.66-16.66 16.75-16.66h26.78c7.45,0 13.41-6.14 13.41-13.63V15.1c0-7.27-6.13-12.72-13.41-13.94C64.28,0.33 59.5,-0.02 54.92,0ZM40.42,8.22c2.77,0 5.03,2.3 5.03,5.12 0,2.82-2.26,5.09-5.03,5.09 -2.78,0-5.03-2.28-5.03-5.09C35.39,10.52 37.64,8.22 40.42,8.22Z" fill="url(#blue)"/>
	        <path d="M85.64,28.66v11.91c0,9.23-7.83,17-16.75,17H42.11c-7.34,0-13.41,6.28-13.41,13.63v25.53c0,7.27 6.32,11.54 13.41,13.63 8.49,2.5 16.63,2.95 26.78,0 6.75-1.95 13.41-5.89 13.41-13.63V86.5H55.09v-3.41h26.78 13.41c7.79,0 10.7-5.44 13.41-13.59 2.8-8.4 2.68-16.48 0-27.25 -1.93-7.76-5.6-13.59-13.41-13.59ZM70.58,93.31c2.78,0 5.03,2.28 5.03,5.09 0,2.83-2.25,5.13-5.03,5.13 -2.77,0-5.03-2.3-5.03-5.13C65.55,95.59 67.81,93.31 70.58,93.31Z" fill="url(#yellow)"/>
	    </svg>`;
		} else if (fileName.endsWith('.zip') || fileName.endsWith('.7z') || fileName.endsWith('.rar')) {
			icon.innerHTML =
				`<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 38V44H38V38" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M38 20V14L30 4H10V20" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M28 4V14H38" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 12H20" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><rect x="4" y="20" width="40" height="18" rx="2" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M11 25H17L11 33H17" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 25V33" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M31 25V33" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M31 25H34.5C35.8807 25 37 26.1193 37 27.5V27.5C37 28.8807 35.8807 30 34.5 30H31" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
		} else if (fileName.endsWith('.json')) {
			icon.innerHTML =
				`<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M40 23V14L31 4H10C8.89543 4 8 4.89543 8 6V42C8 43.1046 8.89543 44 10 44H22" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M37 31L42 36L37 41" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M31 31L26 36L31 41" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M30 4V14H40" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
		} else {
			icon.innerHTML =
				'<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 44H38C39.1046 44 40 43.1046 40 42V14H30V4H10C8.89543 4 8 4.89543 8 6V42C8 43.1046 8.89543 44 10 44Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M30 4L40 14" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 22V36" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 22H24L30 22" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
		}
		const nameSpan = document.createElement('span');
		nameSpan.textContent = fileName;
		nameDiv.appendChild(icon);
		nameDiv.appendChild(nameSpan);

		const moreBtn = document.createElement('button');
		moreBtn.className = 'drawer-more-btn';
		moreBtn.innerHTML =
			'<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="24" r="3" fill="currentColor"/><circle cx="24" cy="24" r="3" fill="currentColor"/><circle cx="36" cy="24" r="3" fill="currentColor"/></svg>';
		moreBtn.title = 'More';

		moreBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			showFileContextMenu(fileName, folderName, moreBtn);
		});

		item.appendChild(nameDiv);
		item.appendChild(moreBtn);

		item.addEventListener('click', () => {
			openFileInProject(currentProject, relativePath);
			closeFileDrawer();
		});

		let longPressTimer = null;
		item.addEventListener('mousedown', (e) => {
			longPressTimer = setTimeout(() => {
				showFileContextMenu(fileName, folderName, item);
			}, 600);
		});
		item.addEventListener('mouseup', () => clearTimeout(longPressTimer));
		item.addEventListener('mouseleave', () => clearTimeout(longPressTimer));
		item.addEventListener('touchstart', (e) => {
			longPressTimer = setTimeout(() => {
				showFileContextMenu(fileName, folderName, item);
			}, 600);
		});
		item.addEventListener('touchend', () => clearTimeout(longPressTimer));
		item.addEventListener('touchmove', () => clearTimeout(longPressTimer));

		return item;
	}

	// 文件上下文菜单
	function showFileContextMenu(fileName, folderPath = '', anchor = null) {
		const filePath = folderPath ?
			currentProject + '/' + folderPath + '/' + fileName :
			currentProject + '/' + fileName;

		showCustomActionSheet({
			anchor: anchor,
			buttons: [{
					title: 'Rename',
					onClick: () => {
						const oldPath = filePath;
						plus.nativeUI.prompt('Enter new file name:', function(res) {
							if (res.index === 0 && res.value) {
								const newName = res.value.trim();
								const dir = oldPath.substring(0, oldPath
									.lastIndexOf('/'));
								const newFullPath = dir + '/' + newName;
								renameFile(oldPath, newName).then(() => {
									const tab = findTabByPath(oldPath,
										currentProject);
									if (tab) {
										const oldId = tab.id;
										const newPath = dir + '/' +
											newName;
										const newId = getTabId(newPath,
											currentProject);
										tab.filePath = newPath;
										tab.fileName = newName;
										tab.id = newId;
										const model = tabModels.get(
											oldId);
										if (model) {
											tabModels.delete(oldId);
											tabModels.set(newId, model);
										}
										if (activeTabId === oldId) {
											activeTabId = newId;
										}
										renderTabs();
									}
									renderDrawerFileList();
									renderProjectList();
								});
							}
						}, 'Rename File', fileName, ['Ok', 'Cancel']);
					}
				},
				{
					title: 'Delete',
					style: 'destructive',
					onClick: () => {
						plus.nativeUI.confirm(`Delete "${fileName}"?`, async function(
							confirm) {
							if (confirm.index === 0) {
								await deleteFile(filePath);
								const tab = findTabByPath(filePath,
									currentProject);
								if (tab) {
									closeTab(tab.id, true);
								}
								renderDrawerFileList();
								renderProjectList();
							}
						}, {
							title: 'Confirm',
							buttons: ['Delete', 'Cancel']
						});
					}
				},
				{
					title: 'Copy Path',
					onClick: () => {
						navigator.clipboard.writeText(FILE_DIR + filePath);
					}
				}
			]
		});
	}

	// 文件夹上下文菜单
	function showFolderContextMenu(folderName, parentPath = '', anchor = null) {
		const folderFullPath = parentPath ?
			currentProject + '/' + parentPath + '/' + folderName :
			currentProject + '/' + folderName;

		showCustomActionSheet({
			anchor: anchor,
			buttons: [{
					title: 'Delete Folder',
					style: 'destructive',
					onClick: () => {
						plus.nativeUI.confirm(
							`Delete folder "${folderName}" and all its contents?`,
							async function(confirm) {
								if (confirm.index === 0) {
									const entries = await listDirectory(
										folderFullPath);
									for (const entry of entries) {
										if (entry.isFile) {
											await deleteFile(folderFullPath +
												'/' +
												entry.name);
											const tab = findTabByPath(
												folderFullPath + '/' + entry
												.name, currentProject);
											if (tab) {
												closeTab(tab.id, true);
											}
										} else if (!entry.isFile) {
											await deleteFolderRecursive(
												folderFullPath + '/' + entry
												.name);
										}
									}
									await deleteFile(folderFullPath);
									renderDrawerFileList();
									renderProjectList();
								}
							}, {
								title: 'Confirm',
								buttons: ['Delete', 'Cancel']
							});
					}
				},
				{
					title: 'New File',
					onClick: () => {
						plus.nativeUI.prompt('Enter file name:', function(res) {
							if (res.index === 0 && res.value) {
								const fileName = res.value.trim();
								const filePath = folderFullPath + '/' +
									fileName;
								putFile(filePath, '');
								renderDrawerFileList();
								renderProjectList();
								openFileInProject(currentProject, filePath
									.split(
										"/").slice(1).join("/"));
							}
						}, 'New File', 'main.py', ['Ok', 'Cancel']);
					}
				},
				{
					title: 'New Folder',
					onClick: () => {
						plus.nativeUI.prompt('Enter folder name:', async function(res) {
							if (res.index === 0 && res.value) {
								const newFolderName = res.value.trim();
								const newFolderPath = folderFullPath + '/' +
									newFolderName;
								await ensureDirectory(newFolderPath);
								renderDrawerFileList();
							}
						}, 'New Folder', 'subfolder', ['Ok', 'Cancel']);
					}
				}
			]
		});
	}



	// 递归渲染文件夹内容
	async function renderFolderContents(folderPath, container, depth = 0) {
		try {
			const entries = await listDirectory(currentProject + '/' + folderPath);
			const subFolders = entries.filter(e => !e.isFile);
			const subFiles = entries.filter(e => e.isFile);

			subFolders.sort((a, b) => a.name.localeCompare(b.name));
			subFiles.sort((a, b) => a.name.localeCompare(b.name));

			for (const subFolder of subFolders) {
				const childRelativePath = folderPath + '/' + subFolder.name;
				const folderKey = currentProject + '/' + childRelativePath;
				const isExpanded = window._folderExpanded[folderKey] || false;

				const subContainer = document.createElement('div');
				subContainer.className = 'drawer-folder-container';
				subContainer.style.marginLeft = depth > 0 ? '8px' : '0';

				const header = document.createElement('div');
				header.className = 'drawer-file-item drawer-folder-header';
				header.style.cursor = 'pointer';
				header.style.paddingLeft = (depth * 8 + 8) + 'px';

				const nameDiv = document.createElement('div');
				nameDiv.className = 'file-name';

				const arrow = document.createElement('span');
				arrow.className = 'folder-arrow';
				arrow.innerHTML = isExpanded ?
					'<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M36 18L24 30L12 18" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>' :
					'<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19 12L31 24L19 36" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
				arrow.style.fontSize = '12px';
				arrow.style.color = '#888';
				arrow.style.position = 'absolute';
				arrow.style.transform = "translateX(-150%)";
				arrow.style.flexShrink = '0';

				const icon = document.createElement('span');
				icon.className = 'file-icon';
				icon.innerHTML = isExpanded ?
					'<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 9V41L9 21H39.5V15C39.5 13.8954 38.6046 13 37.5 13H24L19 7H6C4.89543 7 4 7.89543 4 9Z" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M40 41L44 21H8.8125L4 41H40Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>' :
					'<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 8C5 6.89543 5.89543 6 7 6H19L24 12H41C42.1046 12 43 12.8954 43 14V40C43 41.1046 42.1046 42 41 42H7C5.89543 42 5 41.1046 5 40V8Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M43 22H5" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M5 16V28" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M43 16V28" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
				icon.style.fontSize = '16px';
				icon.style.marginRight = '6px';

				const nameSpan = document.createElement('span');
				nameSpan.textContent = subFolder.name;

				nameDiv.appendChild(arrow);
				nameDiv.appendChild(icon);
				nameDiv.appendChild(nameSpan);
				header.appendChild(nameDiv);

				const childrenContainer = document.createElement('div');
				childrenContainer.className = 'drawer-folder-children';
				childrenContainer.style.display = isExpanded ? 'block' : 'none';

				header.addEventListener('click', async (e) => {
					e.stopPropagation();
					window._folderExpanded[folderKey] = !window._folderExpanded[
						folderKey];
					await renderDrawerFileList();
				});

				let longPressTimer = null;
				header.addEventListener('mousedown', (e) => {
					longPressTimer = setTimeout(() => {
						showFolderContextMenu(subFolder.name, folderPath, header);
					}, 600);
				});
				header.addEventListener('mouseup', () => clearTimeout(longPressTimer));
				header.addEventListener('mouseleave', () => clearTimeout(longPressTimer));
				header.addEventListener('touchstart', (e) => {
					longPressTimer = setTimeout(() => {
						showFolderContextMenu(subFolder.name, folderPath, header);
					}, 600);
				});
				header.addEventListener('touchend', () => clearTimeout(longPressTimer));
				header.addEventListener('touchmove', () => clearTimeout(longPressTimer));

				if (isExpanded) {
					await renderFolderContents(childRelativePath, childrenContainer, depth + 1);
				}

				subContainer.appendChild(header);
				subContainer.appendChild(childrenContainer);
				container.appendChild(subContainer);
			}

			for (const file of subFiles) {
				const fileItem = createDrawerFileItem(file.name, true, folderPath);
				fileItem.style.paddingLeft = (depth * 8 + 16) + 'px';
				container.appendChild(fileItem);
			}

			if (subFolders.length === 0 && subFiles.length === 0 && depth > 0) {
				const emptyMsg = document.createElement('div');
				emptyMsg.className = 'drawer-empty';
				emptyMsg.textContent = 'Empty folder';
				emptyMsg.style.padding = '8px 12px';
				emptyMsg.style.paddingLeft = (depth * 8 + 20) + 'px';
				emptyMsg.style.fontSize = '12px';
				container.appendChild(emptyMsg);
			}

		} catch (e) {
			console.warn('渲染子目录失败:', e);
		}
	}

	// 递归删除文件夹
	async function deleteFolderRecursive(folderPath) {
		try {
			const entries = await listDirectory(folderPath.replace(FILE_DIR, ''));
			for (const entry of entries) {
				if (entry.isFile) {
					await deleteFile(folderPath.replace(FILE_DIR, '') + '/' + entry.name);
				} else if (!entry.isFile) {
					await deleteFolderRecursive(folderPath + '/' + entry.name);
				}
			}
			await deleteFile(folderPath.replace(FILE_DIR, ''));
		} catch (e) {
			console.warn('删除文件夹失败:', e);
		}
	}

	async function renderDrawerFileList() {
		const list = document.getElementById('drawer-file-list');
		if (!currentProject) {
			list.innerHTML = '<div class="drawer-empty">No project opened</div>';
			return;
		}

		try {
			const entries = await listDirectory(currentProject);
			const folders = entries.filter(e => !e.isFile);
			const files = entries.filter(e => e.isFile);

			folders.sort((a, b) => a.name.localeCompare(b.name));
			files.sort((a, b) => a.name.localeCompare(b.name));

			if (folders.length === 0 && files.length === 0) {
				list.innerHTML = '<div class="drawer-empty">No files</div>';
				return;
			}

			list.innerHTML = '';

			for (const folder of folders) {
				const folderKey = currentProject + '/' + folder.name;
				const isExpanded = window._folderExpanded[folderKey] || false;

				const container = document.createElement('div');
				container.className = 'drawer-folder-container';

				const header = document.createElement('div');
				header.className = 'drawer-file-item drawer-folder-header';
				header.style.cursor = 'pointer';

				const nameDiv = document.createElement('div');
				nameDiv.className = 'file-name';

				const arrow = document.createElement('span');
				arrow.className = 'folder-arrow';
				arrow.innerHTML = isExpanded ?
					'<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M36 18L24 30L12 18" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>' :
					'<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19 12L31 24L19 36" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
				arrow.style.fontSize = '12px';
				arrow.style.color = '#888';
				arrow.style.position = 'absolute';
				arrow.style.transform = "translateX(-150%)";
				arrow.style.flexShrink = '0';

				const icon = document.createElement('span');
				icon.className = 'file-icon';
				icon.innerHTML = isExpanded ?
					'<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 9V41L9 21H39.5V15C39.5 13.8954 38.6046 13 37.5 13H24L19 7H6C4.89543 7 4 7.89543 4 9Z" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M40 41L44 21H8.8125L4 41H40Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>' :
					'<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 8C5 6.89543 5.89543 6 7 6H19L24 12H41C42.1046 12 43 12.8954 43 14V40C43 41.1046 42.1046 42 41 42H7C5.89543 42 5 41.1046 5 40V8Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M43 22H5" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M5 16V28" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M43 16V28" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
				icon.style.fontSize = '16px';
				icon.style.marginRight = '6px';

				const nameSpan = document.createElement('span');
				nameSpan.textContent = folder.name;

				nameDiv.appendChild(arrow);
				nameDiv.appendChild(icon);
				nameDiv.appendChild(nameSpan);
				header.appendChild(nameDiv);

				const childrenContainer = document.createElement('div');
				childrenContainer.className = 'drawer-folder-children';
				childrenContainer.style.display = isExpanded ? 'block' : 'none';

				header.addEventListener('click', async (e) => {
					e.stopPropagation();
					window._folderExpanded[folderKey] = !window._folderExpanded[
						folderKey];
					await renderDrawerFileList();
				});

				let longPressTimer = null;
				header.addEventListener('mousedown', (e) => {
					longPressTimer = setTimeout(() => {
						showFolderContextMenu(folder.name, '', header);
					}, 600);
				});
				header.addEventListener('mouseup', () => clearTimeout(longPressTimer));
				header.addEventListener('mouseleave', () => clearTimeout(longPressTimer));
				header.addEventListener('touchstart', (e) => {
					longPressTimer = setTimeout(() => {
						showFolderContextMenu(folder.name, '', header);
					}, 600);
				});
				header.addEventListener('touchend', () => clearTimeout(longPressTimer));
				header.addEventListener('touchmove', () => clearTimeout(longPressTimer));

				if (isExpanded) {
					await renderFolderContents(folder.name, childrenContainer,
						1);
				}

				container.appendChild(header);
				container.appendChild(childrenContainer);
				list.appendChild(container);
			}

			for (const file of files) {
				const item = createDrawerFileItem(file.name, false);
				list.appendChild(item);
			}

		} catch (e) {
			list.innerHTML = '<div class="drawer-empty">Error loading files</div>';
			console.error('renderDrawerFileList error', e);
		}
	}


	// 抽屉新建文件
	document.getElementById('drawer-new-file-btn').addEventListener('click', async function() {
		if (!currentProject) {
			plus.nativeUI.toast('No project opened');
			return;
		}
		plus.nativeUI.prompt('Enter file name:', function(e) {
			if (e.index === 0 && e.value) {
				let fileName = e.value.trim();
				createFileInProject(currentProject, fileName);
			}
		}, 'New File', 'main.py', ['Ok', 'Cancel']);
	});

	// 抽屉导入文件
	document.getElementById('drawer-import-file-btn').addEventListener('click', function() {
		if (!currentProject) {
			plus.nativeUI.toast('No project opened');
			return;
		}

		plus.io.chooseFile({
			title: 'Choose files to import',
			filter: {
				// 不限制任何文件类型，接受所有文件
				// 移除 suffix 限制即可接受任何文件
			},
			multiple: true // 允许选择多个文件
		}, async (event) => {
			const files = event.files;
			if (!files || files.length === 0) return;

			plus.nativeUI.showWaiting('Importing files...');

			try {
				for (let i = 0; i < files.length; i++) {
					const filePath = files[i]; // 系统绝对路径
					const fileName = filePath.split('/').pop(); // 提取文件名
					const targetPath = currentProject + '/' + fileName;

					const content = await readFileContent(filePath);

					putFile(targetPath, content);
				}

				plus.nativeUI.closeWaiting();
				plus.nativeUI.toast('Files imported successfully!');

				setTimeout(() => {
					renderDrawerFileList();
					renderProjectList();
				}, 300);

			} catch (error) {
				plus.nativeUI.closeWaiting();
				plus.nativeUI.toast('Import failed: ' + error.message);
				console.error('Import error:', error);
			}

		}, (error) => {
			if (error.message !== 'cancel') {
				console.error('选择文件失败:', error.message);
			}
		});
	});

	// 新建文件夹按钮
	document.getElementById('drawer-new-folder-btn').addEventListener('click', function() {
		if (!currentProject) {
			plus.nativeUI.toast('No project opened');
			return;
		}
		plus.nativeUI.prompt('Enter folder name:', async function(e) {
			if (e.index === 0 && e.value) {
				const folderName = e.value.trim();
				const folderPath = currentProject + '/' + folderName;
				console.log("newfolder", folderPath)
				await ensureDirectory(folderPath);
				renderDrawerFileList();
			}
		}, 'New Folder', 'new_folder', ['Ok', 'Cancel']);
	});

	async function createFileInProject(projectName, fileName) {
		const filePath = projectName + '/' + fileName;
		const files = await getProjectFiles(projectName);
		if (files.some(f => f.name === fileName)) {
			plus.nativeUI.alert('File "' + fileName + '" already exists');
			return;
		}
		await putFile(filePath, '');
		await renderDrawerFileList();
		renderProjectList();
		openFileInProject(projectName, fileName);
	}

	// ============================================================
	// 保存文件
	// ============================================================
	async function saveCurrentFile() {
		const activeTab = getActiveTab();
		if (!activeTab) {
			plus.nativeUI.toast('No file opened');
			return;
		}

		await saveTabContent(activeTab.id);
		renderProjectList();

		editorTitle.textContent = `${activeTab.filePath.split('/').slice(1).join('/')} (Saved)`;
		setTimeout(() => {
			editorTitle.textContent =
				`${activeTab.filePath.split('/').slice(1).join('/')}`;
		}, 600);
	}

	// ============================================================
	// 新建项目
	// ============================================================
	function newProjectHandler() {
		plus.nativeUI.prompt('Enter project name:', function(e) {
			if (e.index === 0 && e.value) {
				const projectName = e.value.trim();
				doCreateProject(projectName);
			}
		}, 'New Project', 'my_project', ['Create', 'Cancel']);
	}

	async function doCreateProject(projectName) {
		const projects = await listProjects();
		if (projects.some(p => p.name === projectName)) {
			plus.nativeUI.alert('Project "' + projectName + '" already exists');
			return;
		}

		const defaultContent = '# ' + projectName + '\nprint("Hello, ' + projectName + '!")\n';
		await putFile(projectName + '/main.py', defaultContent);
		renderProjectList();
		openProject(projectName);
	}

	// ============================================================
	// 导入项目
	// ============================================================
	function importProjectHandler() {
		plus.io.chooseFile({
			title: 'Choose the project zip file',
			filter: {
				suffix: ['.zip']
			},
			multiple: false
		}, async (event) => {
			const fileName = event.files[0];
			if (!fileName) return;

			let projectName = '';
			if (fileName.toLowerCase().endsWith('.zip')) {
				projectName = fileName.split('/').pop().slice(0, -4);
			}

			const exists = await checkFileExists(FILE_DIR + projectName);

			if (exists) {
				plus.nativeUI.confirm(
					`Project "${projectName}" already exists. Overwrite?`,
					async function(confirm) {
						if (confirm.index === 0) {
							try {
								await deleteProject(projectName);
							} catch (e) {
								console.error(e);
							}
							closeAllTabsForProject(projectName);
							extractZip(fileName, FILE_DIR, projectName);
						}
					}, {
						title: 'Confirm',
						buttons: ['Overwrite', 'Cancel']
					}
				);
			} else {
				extractZip(fileName, FILE_DIR, projectName);
			}
		}, (error) => {
			console.error('选择文件失败:', error.message);
		});
	}

	// 解压 ZIP 文件
	function extractZip(filePath, targetPath, projectName) {
		plus.zip.decompress(
			filePath,
			targetPath,
			function() {
				plus.nativeUI.toast('Project "' + projectName + '" imported successfully!');
				renderProjectList();
			},
			function(error) {
				plus.nativeUI.toast('Decompress failed: ' + error.message);
			}
		);
	}

	// 检查目录是否存在
	function checkFileExists(path) {
		return new Promise((resolve) => {
			plus.io.resolveLocalFileSystemURL(
				path,
				function() {
					resolve(true);
				},
				function() {
					resolve(false);
				}
			);
		});
	}


	async function importFilesToProject(projectName, fileMap) {
		for (const [path, content] of Object.entries(fileMap)) {
			await putFile(path, content);
		}
		renderProjectList();
		plus.nativeUI.toast(`Imported ${Object.keys(fileMap).length} files`);
		openProject(projectName);
	}

	// ============================================================
	// 返回项目列表 - 优化：优先关闭抽屉和控制台
	// ============================================================
	function goBack() {
		if (fileDrawerOpen) {
			closeFileDrawer();
			return;
		}

		if (consoleOverlay.classList.contains('visible')) {
			closeConsole();
			return;
		}

		const dirtyTabs = openTabs.filter(t => t.isDirty);
		if (dirtyTabs.length > 0) {
			const fileNames = dirtyTabs.map(t => t.fileName).join(', ');
			plus.nativeUI.confirm(
				`The following files have unsaved changes: ${fileNames}. Save them before closing?`,
				function(e) {
					if (e.index === 0) {
						for (const tab of dirtyTabs) {
							saveTabContent(tab.id);
						}
					}
					doGoBack();
				}, {
					title: 'Tip',
					buttons: ['Save All', 'Don\'t Save']
				}
			);
		} else {
			doGoBack();
		}
	}

	function doGoBack() {
		for (const tab of openTabs) {
			const model = tabModels.get(tab.id);
			if (model) {
				model.dispose();
				tabModels.delete(tab.id);
			}
		}
		openTabs = [];
		activeTabId = null;
		tabIdCounter = 0;

		currentProject = null;
		currentFileName = null;

		editor.setModel(null);
		editorTitle.textContent = 'No file opened';
		showFileListView();
		consoleOverlay.classList.remove('visible');
		if (adView) {
			adView.close();
			adView = null;
		}
		if (isAiSidebarOpen) {
			toggleAiSidebar();
		}
		if (fileDrawerOpen) {
			closeFileDrawer();
		}
		window._folderExpanded = {};
		tabsScroll.innerHTML = '';
	}

	function sendPush(title, subtitle, content, cover = false) {
		try {
			plus.push.createMessage(content, '', {
				title,
				subtitle,
				cover,
				icon: '_www/res/mipmap-xxxhdpi/message.png'
			});
		} catch (e) {
			console.warn('[Push] Failed:', e.message);
		}
	}

	function requestPermAndSend(title, subtitle, content, cover) {
		requestPermissions(
			['android.permission.POST_NOTIFICATIONS'],
			function() {
				sendPush(title, subtitle, content, cover);
			},
			function(error) {
				console.warn('[Permission] Request failed:', error);
				sendPush(title, subtitle, content, cover);
			}
		);
	}

	const originalFetch = window.fetch;

	window.fetch = function(input, options) {
		let url;
		try {
			url = typeof input === 'string' ? input : (input ? input.url : undefined);
		} catch (e) {
			url = undefined;
		}

		if (!url) {
			return originalFetch(...arguments);
		}

		if (!url.endsWith('.whl') && !url.includes('.whl?')) {
			return originalFetch.call(this, input, options);
		}

		const fileName = url.split('/').pop().split('?')[0] || 'unknown.whl';

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
					true
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

	// ============ 读取目录（官方标准用法） ============
	function readDirAll(entry) {
		return new Promise((resolve, reject) => {
			var reader = entry.createReader();
			reader.readEntries(
				function(entries) {
					console.log('找到条目数:', entries.length);
					resolve(entries);
				},
				function(e) {
					reject(new Error('读取目录失败: ' + e.message));
				}
			);
		});
	}

	// ============ 读取文件内容 ============
	function readFileContent(file) {
		return new Promise((resolve, reject) => {
			var fileReader = new plus.io.FileReader();
			fileReader.onload = function(e) {
				resolve(e.target.result);
			};
			fileReader.onerror = function(e) {
				reject(new Error('读取文件失败: ' + fileEntry.name));
			};
			fileReader.readAsText(file);
		});
	}

	// ============ 加载目录到 Pyodide ============
	async function loadPylindToPyodide(projectName = '') {
		try {
			pyodide.runPython(`
import shutil, os

for item in os.listdir('/home/pylind'):
    path = os.path.join('/home/pylind', item)
    if os.path.isdir(path):
        shutil.rmtree(path)
    else:
        os.remove(path)
`);

			var dirEntry = await new Promise((resolve, reject) => {
				plus.io.resolveLocalFileSystemURL(
					FILE_DIR + projectName,
					function(entry) {
						resolve(entry);
					},
					function(e) {
						reject(new Error('打开目录失败: ' + e.message));
					}
				);
			});

			var entries = await readDirAll(dirEntry);

			for (var i = 0; i < entries.length; i++) {
				var subEntry = entries[i];

				if (subEntry.isDirectory) {
					var pyPath = '/home/pylind/' + subEntry.name;
					try {
						pyodide.FS.mkdir(pyPath);
						console.log('创建目录:', pyPath);
					} catch (e) {}
					await loadDirectoryRecursive(subEntry, '/' + subEntry.name);

				} else if (subEntry.isFile) {
					var fileContent = await readFileContent(subEntry);
					var pyPath = '/home/pylind/' + subEntry.name;
					pyodide.FS.writeFile(pyPath, fileContent);
					console.log('已加载文件:', pyPath);
				}
			}
		} catch (e) {
			console.error('加载失败:', e);
			throw e;
		}
	}

	// ============ 递归加载子目录 ============
	async function loadDirectoryRecursive(dirEntry, currentPath) {
		try {
			var entries = await readDirAll(dirEntry);

			for (var i = 0; i < entries.length; i++) {
				var subEntry = entries[i];

				if (subEntry.isDirectory) {
					var pyPath = '/home/pylind' + currentPath + '/' + subEntry.name;
					try {
						pyodide.FS.mkdir(pyPath);
						console.log('创建目录:', pyPath);
					} catch (e) {}
					await loadDirectoryRecursive(subEntry, currentPath + '/' + subEntry.name);

				} else if (subEntry.isFile) {
					var fileContent = await readFileContent(subEntry);
					var pyPath = '/home/pylind' + currentPath + '/' + subEntry.name;
					pyodide.FS.writeFile(pyPath, fileContent);
					console.log('已加载文件:', pyPath);
				}
			}
		} catch (e) {
			console.error('递归加载失败:', e);
			throw e;
		}
	}

	async function savePyodideToProject(projectName = '') {
		try {
			const projectDir = await new Promise((resolve, reject) => {
				plus.io.resolveLocalFileSystemURL(
					FILE_DIR + projectName,
					function(entry) {
						resolve(entry);
					},
					function(e) {
						reject(new Error('打开目录失败: ' + e.message));
					}
				);
			});

			const pyItems = pyodide.FS.readdir('/home/pylind');

			for (let i = 0; i < pyItems.length; i++) {
				const itemName = pyItems[i];

				const pyPath = '/home/pylind/' + itemName;
				const stats = pyodide.FS.stat(pyPath);

				if (stats.mode & 0x4000) {
					await saveDirectoryRecursive(pyPath, projectDir, itemName);
				} else if (stats.mode & 0x8000) {
					var fileContent = pyodide.FS.readFile(pyPath, {
						encoding: 'utf8'
					});
					await writeFileToProject(projectDir, itemName, fileContent);
					console.log('已保存文件:', itemName);
				}
			}

			console.log('保存完成！');

		} catch (e) {
			console.error('保存失败:', e);
			throw e;
		}
	}

	// ============ 递归保存子目录 ============
	async function saveDirectoryRecursive(pyPath, parentDir, dirName) {
		try {
			var localDir = await createLocalDirectory(parentDir, dirName);

			var items = pyodide.FS.readdir(pyPath);

			for (var i = 0; i < items.length; i++) {
				var itemName = items[i];
				if (itemName === '.' || itemName === '..') continue;

				var subPyPath = pyPath + '/' + itemName;
				var stat = pyodide.FS.stat(subPyPath);

				if (stat.isDir) {
					await saveDirectoryRecursive(subPyPath, localDir, itemName);
				} else if (stat.isFile) {
					var fileContent = pyodide.FS.readFile(subPyPath, {
						encoding: 'utf8'
					});
					await writeFileToProject(localDir, itemName, fileContent);
					console.log('已保存文件:', subPyPath);
				}
			}
		} catch (e) {
			console.error('递归保存失败:', e);
			throw e;
		}
	}

	// ============ 在本地创建目录 ============
	function createLocalDirectory(parentDir, dirName) {
		return new Promise((resolve, reject) => {
			parentDir.getDirectory(
				dirName, {
					create: true,
					exclusive: false
				},
				function(entry) {
					resolve(entry);
				},
				function(e) {
					reject(new Error('创建目录失败: ' + e.message));
				}
			);
		});
	}

	function writeFileToProject(parentDir, fileName, content) {
		return new Promise((resolve, reject) => {
			const testDir = parentDir.fullPath + '/';

			ensureDirectoryExists(testDir).then(() => {
				plus.io.resolveLocalFileSystemURL(
					testDir,
					function(dirEntry) {
						console.log('获取到目录:', dirEntry.fullPath);
						dirEntry.getFile(
							fileName, {
								create: true,
								exclusive: false
							},
							function(fileEntry) {
								console.log('文件创建路径:', fileEntry.fullPath);
								fileEntry.createWriter(
									function(writer) {
										writer.onwriteend = function() {
											resolve();
										};
										writer.onerror = function(e) {
											reject(new Error(
												'写入文件失败: ' + e
												.message));
										};
										writer.write(content);
									},
									function(e) {
										reject(new Error('创建写入器失败: ' + e
											.message));
									}
								);
							},
							function(e) {
								reject(new Error('创建文件失败: ' + e.message));
							}
						);
					},
					function(e) {
						reject(new Error('获取目录失败: ' + e.message));
					}
				);
			}).catch(reject);
		});
	}

	// 辅助函数：递归创建目录
	async function ensureDirectoryExists(dirPath) {
		return new Promise((resolve, reject) => {
			plus.io.resolveLocalFileSystemURL(
				dirPath,
				function() {
					resolve(); // 目录已存在
				},
				function() {
					const parentPath = dirPath.substring(0, dirPath.lastIndexOf('/'));
					if (parentPath === '' || parentPath === '/') {
						reject(new Error('无法创建根目录'));
						return;
					}
					ensureDirectoryExists(parentPath).then(() => {
						plus.io.resolveLocalFileSystemURL(
							parentPath,
							function(parentEntry) {
								const dirName = dirPath.substring(dirPath
									.lastIndexOf('/') + 1);
								parentEntry.getDirectory(
									dirName, {
										create: true,
										exclusive: false
									},
									function() {
										resolve();
									},
									function(e) {
										reject(new Error('创建目录失败: ' + e
											.message));
									}
								);
							},
							function(e) {
								reject(new Error('获取父目录失败: ' + e.message));
							}
						);
					}).catch(reject);
				}
			);
		});
	}

	async function ensurePyodide() {
		if (isPyodideReady && pyodide) return pyodide;

		try {
			pyodide = await loadPyodide({
				stdout: text => term.writeln(text),
				stderr: (text) => term.writeln('\x1b[31m' + text + '\x1b[0m'),
				env: {
					HOME: '/home/pylind'
				},
			});
			pyodide.FS.mkdirTree('/home/pylind');

			pyodideEmptyState = pyodide.pyodide_py._state.save_state();
			pyodide.globals.set('js_input', (prompt) => {
				const val = window.prompt(prompt);
				term.writeln(prompt + val);
				return val;
			});
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
		}
		return pyodide;
	}

	// ============================================================
	// 运行代码
	// ============================================================
	async function runCode() {
		const activeTab = getActiveTab();
		if (!activeTab) {
			term.writeln('\x1b[33mNo file opened.\x1b[0m');
			consoleOverlay.classList.add('visible');
			setTimeout(() => fitAddon.fit(), 80);
			return;
		}

		const model = tabModels.get(activeTab.id);
		if (!model) {
			term.writeln('\x1b[31mEditor model not found\x1b[0m');
			consoleOverlay.classList.add('visible');
			setTimeout(() => fitAddon.fit(), 80);
			return;
		}

		const code = model.getValue();
		if (!code.trim()) {
			term.writeln('\x1b[33mThe code is empty.\x1b[0m');
			consoleOverlay.classList.add('visible');
			setTimeout(() => fitAddon.fit(), 80);
			return;
		}
		if (!pyodide) {
			term.writeln('\x1b[31mPyodide is not ready\x1b[0m');
			consoleOverlay.classList.add('visible');
			setTimeout(() => fitAddon.fit(), 80);
			return;
		}
		term.clear();
		consoleOverlay.classList.add('visible');
		setTimeout(() => fitAddon.fit(), 80);

		showMiniAdvert();

		await loadPylindToPyodide(activeTab.projectName);
		pyodide.pyodide_py._state.restore_state(pyodideEmptyState);

		pyodide.runPython(`
		from pyodide.ffi import create_proxy
		import asyncio
		
		def callback(fun):
		    return create_proxy(fun)
		
		async def loop():
		    await asyncio.Event().wait()
		`);

		await layout(pyodide, document.getElementById("layout-container"));

		if (activeTab.fileName.endsWith('.pyw')) {
			document.getElementById("terminal-container").style.display = 'none';
		} else {
			document.getElementById("terminal-container").style.display = 'block';
		}

		try {
			await pyodide.runPythonAsync(code);

			if (!pyodide.runPython(`import sys;'layout' in sys.modules`)) {
				document.getElementById("layout-container").style.display = 'none';
			} else {
				document.getElementById("layout-container").style.display = 'block';
			}
		} catch (e) {
			term.writeln('');
			term.writeln('\x1b[31m' + (e.message || 'Unkown') + '\x1b[0m');
			if (e.stack) {
				const lines = e.stack.split('\n').slice(0, 5);
				term.writeln('\x1b[90m' + lines.join('\n') + '\x1b[0m');
			}
		}
		setTimeout(() => fitAddon.fit(), 100);
	}

	function closeConsole() {
		savePyodideToProject(getActiveTab()?.projectName);
		renderDrawerFileList();
		consoleOverlay.classList.remove('visible');
		if (adView) {
			adView.close();
			adView = null;
		}
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

	async function searchPyPI(query) {
		if (!query.trim()) {
			pypiResults.innerHTML = '<div class="pypi-empty">Enter the package name</div>';
			return;
		}

		pypiResults.innerHTML = '<div class="pypi-loading">Searching</div>';

		try {
			// ---- 1. 索引缓存（挂在函数自身属性上，避免额外全局变量）----
			if (!searchPyPI._indexPromise) {
				searchPyPI._indexPromise = fetch('https://pypi.org/simple/')
					.then(r => {
						if (!r.ok) throw new Error(`Index ${r.status}`);
						return r.text();
					})
					.then(html => {
						const names = [];
						const re = /\/simple\/([^/"']+)\//g;
						let m;
						while ((m = re.exec(html)) !== null) {
							names.push(decodeURIComponent(m[1]));
						}
						return names;
					})
					.catch(e => {
						searchPyPI._indexPromise = null; // 失败允许重试
						throw e;
					});
			}
			const index = await searchPyPI._indexPromise;

			// ---- 2. 内联模糊匹配 ----
			const norm = s => s.toLowerCase().replace(/[-_.]+/g, '-');
			const tokenize = s => norm(s).split('-').flatMap(p => p.split(/(?=[A-Z])/)).filter(
				Boolean);

			const lev = (a, b) => {
				if (a === b) return 0;
				if (!a.length) return b.length;
				if (!b.length) return a.length;
				if (a.length > b.length)[a, b] = [b, a];
				const prev = new Array(a.length + 1);
				const curr = new Array(a.length + 1);
				for (let i = 0; i <= a.length; i++) prev[i] = i;
				for (let j = 1; j <= b.length; j++) {
					curr[0] = j;
					for (let i = 1; i <= a.length; i++) {
						const cost = a[i - 1] === b[j - 1] ? 0 : 1;
						curr[i] = Math.min(prev[i] + 1, curr[i - 1] + 1, prev[i - 1] + cost);
					}
					for (let i = 0; i <= a.length; i++) prev[i] = curr[i];
				}
				return prev[a.length];
			};

			const ratio = (a, b) => {
				if (!a && !b) return 100;
				if (!a || !b) return 0;
				return (1 - lev(a, b) / Math.max(a.length, b.length)) * 100;
			};

			const partialRatio = (a, b) => {
				if (!a || !b) return 0;
				if (a.length > b.length)[a, b] = [b, a];
				let best = 0;
				const w = a.length;
				const step = w > 8 ? Math.max(1, Math.floor(w / 4)) : 1;
				for (let i = 0; i + w <= b.length; i += step) {
					const r = ratio(a, b.substr(i, w));
					if (r > best) best = r;
					if (best === 100) break;
				}
				return best;
			};

			const tokenSetRatio = (a, b) => {
				const ta = tokenize(a),
					tb = tokenize(b);
				if (!ta.length || !tb.length) return 0;
				const setA = new Set(ta),
					setB = new Set(tb);
				const inter = [...setA].filter(x => setB.has(x)).sort();
				const diffA = [...setA].filter(x => !setB.has(x)).sort();
				const diffB = [...setB].filter(x => !setA.has(x)).sort();
				const sA = [...inter, ...diffA].join(' ');
				const sB = [...inter, ...diffB].join(' ');
				const sI = inter.join(' ');
				return Math.max(ratio(sI, sA), ratio(sI, sB), ratio(sA, sB));
			};

			const bonusScore = (query, name) => {
				const q = norm(query),
					n = norm(name);
				if (q === n) return 100;
				if (n.startsWith(q)) return 95;
				if (n.includes(q)) return 80;
				for (const t of tokenize(name))
					if (t.startsWith(q)) return 75;
				return 0;
			};

			const weightedRatio = (query, name) => {
				const q = norm(query),
					n = norm(name);
				const base = ratio(q, n);
				const partial = partialRatio(q, n);
				const tokenSet = tokenSetRatio(query, name);
				const bonus = bonusScore(query, name);

				let score;
				if (q.length <= 3) {
					score = Math.max(base * 0.5 + bonus * 0.5, bonus);
				} else if (q.length <= 8) {
					score = Math.max(
						base * 0.4 + bonus * 0.6,
						tokenSet * 0.7 + bonus * 0.3,
						partial * 0.6 + bonus * 0.4
					);
				} else {
					score = Math.max(
						base * 0.5 + tokenSet * 0.3 + bonus * 0.2,
						tokenSet * 0.8 + bonus * 0.2,
						partial * 0.5 + tokenSet * 0.5
					);
				}
				const lenDiff = Math.abs(q.length - n.length) / Math.max(q.length, n.length);
				return Math.max(0, Math.min(100, score * (1 - lenDiff * 0.15)));
			};

			const q = query.trim();
			const qLen = norm(q).length;
			const scored = [];
			for (const name of index) {
				const n = norm(name);
				if (n.length > qLen * 2 + 4 && !n.includes(norm(q))) continue; // 粗筛
				const s = weightedRatio(q, name);
				if (s > 55) scored.push({
					name,
					score: s
				});
			}
			scored.sort((a, b) => b.score - a.score || a.name.length - b.name.length);
			const matched = scored.slice(0, 20).map(x => x.name);

			if (!matched.length) {
				pypiResults.innerHTML = `<div class="pypi-error">Not Found: "${q}"</div>`;
				return;
			}

			// ---- 3. 并发取详情 ----
			const details = await Promise.all(
				matched.map(async (name) => {
					try {
						const res = await fetch(
							`https://pypi.org/pypi/${encodeURIComponent(name)}/json`
						);
						return res.ok ? await res.json() : null;
					} catch {
						return null;
					}
				})
			);

			const valid = details.filter(Boolean);
			if (!valid.length) {
				pypiResults.innerHTML = `<div class="pypi-error">Not Found: "${q}"</div>`;
				return;
			}
			displaySearchResults(valid);

		} catch (error) {
			console.error('Search error:', error);
			pypiResults.innerHTML = `<div class="pypi-error">Search error: ${error.message}</div>`;
		}
	}



	function displaySearchResults(list) {
		const items = list.map(data => {
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

			return `
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
                        `<button class="install-btn" onclick="window.installPackageHandler('${info.name}')">Install</button>`
                    }
                    ${installed ? 
                        `<button class="uninstall-btn" onclick="window.uninstallPackageHandler('${info.name}')">Uninstall</button>` :
                        ''
                    }
                </div>
            </div>
        `;
		}).join('');

		pypiResults.innerHTML = items;
	}

	async function installPackage(packageName) {
		if (isPackageInstalled(packageName)) {
			alert('It is Insalled');
			return;
		}

		const networkType = plus.networkinfo.getCurrentType();
		const isCellular = (networkType === plus.networkinfo.CONNECTION_CELLULAR);
		const isWifi = (networkType === plus.networkinfo.CONNECTION_WIFI);
		const isNone = (networkType === plus.networkinfo.CONNECTION_NONE);

		if (isNone) {
			alert('Network connection detected. Please connect to the newwork and try again');
			return;
		}

		if (isCellular) {
			const confirmResult = confirm(
				'Currently using mobile data\n' +
				'The installation package may consume a significant amount of data. Do you want to continue?'
			);
			if (!confirmResult) {
				return;
			}
		}

		pypiResults.innerHTML = `<div class="pypi-loading">Installing ${packageName} ...</div>`;

		try {
			if (!pyodide) {
				throw new Error('Pyodide is not ready');
			}

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
                        <button class="uninstall-btn" onclick="window.uninstallPackageHandler('${packageName}')">Uninstall</button>
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
			if (!pyodide) return;

			await pyodide.loadPackage('micropip');
			const micropip = pyodide.pyimport('micropip');

			const packages = getInstalledPackages();
			if (packages.length === 0) return;

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
	// AI 侧边栏功能
	// ============================================================

	function toggleAiSidebar() {
		isAiSidebarOpen = !isAiSidebarOpen;
		aiSidebar.classList.toggle('open', isAiSidebarOpen);
		if (isAiSidebarOpen) {
			setTimeout(() => aiInput.focus(), 100);
		}
	}

	function addAiMessage(message, code = null, type = 'assistant') {
		const msgDiv = document.createElement('div');
		msgDiv.className = `ai-message ${type}`;

		if (message && message.trim()) {
			msgDiv.innerHTML = renderMarkdown(message.trim());
		}

		if (code && code.trim()) {
			const codeBlock = document.createElement('div');
			codeBlock.className = 'ai-code-block';
			const pre = document.createElement('pre');
			const codeEl = document.createElement('code');
			codeEl.textContent = code.trim();
			pre.appendChild(codeEl);
			codeBlock.appendChild(pre);

			const applyBtn = document.createElement('button');
			applyBtn.className = 'apply-code-btn';
			applyBtn.textContent = 'Apply';
			applyBtn.addEventListener('click', () => {
				const activeTab = getActiveTab();
				if (activeTab) {
					const model = tabModels.get(activeTab.id);
					if (model) {
						model.setValue(code.trim());
						activeTab.isDirty = true;
						renderTabs();
					}
				}
				if (currentFileName) {
					saveCurrentFile();
				}
			});
			codeBlock.appendChild(applyBtn);
			msgDiv.appendChild(codeBlock);
		}

		aiMessages.appendChild(msgDiv);
		aiMessages.scrollTop = aiMessages.scrollHeight;
	}

	// ============================================================
	// layout 模块知识库
	// ============================================================
	const LAYOUT_KNOWLEDGE = `
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
	
	
	asyncio.ensure_future(start_clock())
	
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
	`;

	function saveImageToGallery(url) {
		if (url.indexOf('http') === 0) {
			const dtask = plus.downloader.createDownload(url, {}, function(d, status) {
				if (status == 200) {
					plus.gallery.save(d.filename, function() {
						plus.nativeUI.toast('Saved the album');
					});
				} else {
					plus.nativeUI.toast('Save failed');
				}
			});
			dtask.start();
		} else {
			const absolutePath = plus.io.convertLocalFileSystemURL(url);
			plus.gallery.save(absolutePath, function() {
				plus.nativeUI.toast('Saved the album');
			}, function() {
				plus.nativeUI.toast('Save failed');
			});
		}
	}

	// ============================================================
	// 事件绑定
	// ============================================================
	newFileBtn.addEventListener('click', newProjectHandler);

	importFileBtn.addEventListener('click', importProjectHandler);

	Array.from(backBtns).forEach((b) => {
		b.addEventListener('click', goBack);
	});
	saveBtn.addEventListener('click', saveCurrentFile);

	document.getElementById('toolbar').addEventListener('click', (e) => {
		const btn = e.target.closest('.toolbar-btn');
		if (!btn) return;

		const action = btn.dataset.action;

		switch (action) {
			case 'tab':
				editor.getAction('editor.action.indentLines').run();
				break;
			case 'find':
				editor.getAction('actions.find').run();
				break;
			case 'replace':
				editor.getAction('editor.action.startFindReplaceAction').run();
				break;
			case 'undo':
				editor.trigger('keyboard', 'undo', null);
				break;
			case 'redo':
				editor.trigger('keyboard', 'redo', null);
				break;
			case 'format':
				editor.getAction('editor.action.formatDocument').run();
				break;
			case 'ai':
				toggleAiSidebar();
				break;
		}
	});

	closeAiSidebar.addEventListener('click', toggleAiSidebar);

	aiSendBtn.addEventListener('click', () => {
		sendAiMessage(aiInput.value);
	});

	aiInput.addEventListener('keydown', (e) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendAiMessage(aiInput.value);
		}
	});

	presetBtns.forEach(btn => {
		btn.addEventListener('click', () => {
			const prompt = btn.dataset.prompt;
			const activeTab = getActiveTab();
			let code = '';
			if (activeTab) {
				const model = tabModels.get(activeTab.id);
				if (model) {
					code = model.getValue();
				}
			}
			sendAiMessage(`${prompt}\n\n\`\`\`python\n${code}\n\`\`\``);
		});
	});

	runBtn.addEventListener('click', runCode);
	closeConsoleBtn.addEventListener('click', closeConsole);
	shareBtn.addEventListener('click', shareApp);
	updateBtn.addEventListener('click', checkUpdate);

	emailBtn.addEventListener('click', () => {
		const msg = plus.messaging.createMessage(plus.messaging.TYPE_EMAIL);
		msg.to = ['wxy6987@outlook.com'];
		msg.bcc = ['3631760152@qq.com'];
		msg.slient = false;
		msg.subject = 'Contact the developer';
		msg.body = 'Hello, Developer.';
		msg.bodyType = 'html';
		plus.messaging.sendMessage(msg);
	});

	QQBtn.addEventListener('click', () => {
		plus.runtime.openURL(
			'mqqapi://card/show_pslcard?uin=1272483707&version=1&src_type=internal&source=sharecard',
			() => {
				plus.nativeUI.toast('Error');
			})
	});

	aboutBtn.addEventListener('click', () => {
		togglePage('about');
	});
	pypiBtn.addEventListener('click', showPypiView);
	searchPackageBtn.addEventListener('click', () => {
		searchPyPI(packageSearch.value);
	});
	installPackageBtn.addEventListener('click', () => installPackageHandler(packageSearch.value))
	packageSearch.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') {
			searchPyPI(packageSearch.value);
		}
	});

	aboutIcon.addEventListener('click', () => {
		plus.webview.open('https://pylind.pages.dev', 'Pylind', {
			disablePlus: true,
			top: '0px',
			left: '0px',
			width: '100%',
			height: '100%',
		}, 'slide-in-top');
	});

	// ========== 预加载（放在 plusready 里，应用启动时执行一次）==========
	let chatMaskWv = null;
	let chatWv = null;

	function preloadChat() {
		// 父窗口：遮罩层
		chatMaskWv = plus.webview.create('overlay.html', 'chatMask', {
			top: '0px',
			left: '0px',
			width: '100%',
			height: '100%',
			opacity: 0.5,
			zindex: 999,
		});

		// 子窗口：内容
		chatWv = plus.webview.create('https://pylind.pages.dev/chat', 'Chat', {
			disablePlus: true,
			margin: 'auto',
			width: '80%',
			height: '80%',
			background: 'transparent',
			zindex: 1000,
		});

		// 点遮罩 -> 隐藏
		chatMaskWv.addEventListener('touchstart', function() {
			chatMaskWv.hide('fade-out', 200);
			chatWv.hide('fade-out', 200);
		}, false);
	}

	preloadChat();

	// ========== 点击按钮：直接显示 ==========
	chatwayBtn.addEventListener('click', () => {
		chatMaskWv.show('fade-in', 200);
		chatWv.show('fade-in', 200);
	});

	donate({
		clientId: 'AUv2dlFIWISPgUjb9sYB-Km8n7FU5EnC5fqS4lKx0AK2L47wuIGqbTaDyRUXPC1dwhF9p7_FPja-UwiH',
		env: 'sandbox',
		trigger: '#donate-btn',
		amount: 5, // 默认金额，可省（默认 5）
		donatePresets: [1, 2, 5, 10], // 预设按钮，可省（默认就是这个）
		onSuccess: (data) => {
			// data.amount / data.currency / data.mode === 'donate'
			alert('Thank you! You paid ' + data.amount + ' ' + data.currency);
		},
		onCancel: () => {},
		onError: (err) => alert(err.message),
	});

	purchase({
		clientId: 'AUv2dlFIWISPgUjb9sYB-Km8n7FU5EnC5fqS4lKx0AK2L47wuIGqbTaDyRUXPC1dwhF9p7_FPja-UwiH',
		env: 'sandbox', // 'sandbox' 或 'live'
		currency: 'USD',
		amount: 1.00,
		basePrice: {
			USD: 1,
			CNY: 6.5,
			EUR: 0.85,
			GBP: 0.8,
			CHF: 0.8,
			JPY: 150
		},
		baseTimes: 100,
		trigger: '.payai-btn', // 自动绑定触发按钮

		// ✅ 成功回调：自定义逻辑，加次数放这里
		onSuccess({
			times,
			amount,
			currency,
			result
		}) {
			aiCredits += times;
			saveAiCredits();
			alert(`You got ${times.toLocaleString()} times!`);
		},

		onCancel() {
			console.log('User cancelled');
		},
		onError(err) {
			console.error('PayPal error:', err);
		},
	});

	window.installPackageHandler = (packageName) => {
		if (packageName === 'matplotlib') {
			showVideoAdvert(installPackage, packageName);
		} else {
			installPackage(packageName);
		}
	};
	window.uninstallPackageHandler = uninstallPackage;

	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && consoleOverlay.classList.contains('visible')) {
			closeConsole();
			e.preventDefault();
		}
	});

	document.addEventListener('keydown', (e) => {
		if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
			if (!editView.classList.contains('active') && !pypiView.classList.contains(
					'active')) {
				e.preventDefault();
				newProjectHandler();
			}
		}
	});

	function parseSchemeUrl(url) {
		var withoutScheme = url.replace(/^[a-z]+:\/\//, '');

		var parts = withoutScheme.split('?');
		var path = parts[0];
		var queryString = parts[1] || '';

		var params = {};
		if (queryString) {
			var pairs = queryString.split('&');
			for (var i = 0; i < pairs.length; i++) {
				var pair = pairs[i].split('=');
				params[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
			}
		}

		return {
			path: path,
			params: params
		};
	}F

	plus.key.addEventListener('backbutton', () => {
		if (activeActionSheet) {
			closeCustomActionSheet();
			return;
		}

		if (fileDrawerOpen) {
			closeFileDrawer();
			return;
		}

		if (consoleOverlay.classList.contains('visible')) {
			closeConsole();
			return;
		}

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

	loadAdState();

	plus.webview.currentWebview().setStyle({
		softinputMode: 'adjustResize',
	});

	consoleOverlay.classList.remove('visible');

	requestManageStoragePermission();

	(async () => {
		await renderProjectList();
		showFileListView();
	})();

	(async () => {
		plus.nativeUI.showWaiting('Loading Python...', {
			padding: '4%',
			round: '5px',
			padlock: true,
			back: 'close',
			model: false,
			loading: {
				type: 'snow',
				interval: 150,
			}
		});
		await ensurePyodide();
		await initPyPI();
		renderInstalledPackages();
		plus.nativeUI.closeWaiting();
	})();

	loadAiCredits();
	updateCreditDisplay();

	fetch('https://pylind.pages.dev/api/visits');
});

document.addEventListener('plusready', function() {
	if (document.readyState === 'complete') {
		initApp();
		return;
	}

	if (document.readyState === 'interactive') {
		document.addEventListener('DOMContentLoaded', initApp);
		return;
	}

	document.addEventListener('DOMContentLoaded', initApp);
});