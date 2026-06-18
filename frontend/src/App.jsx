import {useState, useEffect} from 'react';
import './App.css';
import {
  GetConfig,
  SaveConfig,
  ListBackups,
  RestoreBackup,
  GetConfigPath,
  ValidateConfig
} from "../wailsjs/go/main/App";

// Navigation items
const NAV_ITEMS = [
  {id: 'providers', label: '模型设置', icon: '🤖'},
  {id: 'mcp', label: 'MCP 服务器', icon: '🔌'},
  {id: 'permissions', label: '权限规则', icon: '🔒'},
  {id: 'commands', label: '自定义命令', icon: '⚡'},
  {id: 'plugins', label: '插件', icon: '🔧'},
  {id: 'backups', label: '备份管理', icon: '💾'},
];

function App() {
  const [activeTab, setActiveTab] = useState('providers');
  const [config, setConfig] = useState({});
  const [originalConfig, setOriginalConfig] = useState({});
  const [configPath, setConfigPath] = useState('');
  const [backups, setBackups] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Load config on mount
  useEffect(() => {
    loadConfig();
    loadBackups();
    loadConfigPath();
  }, []);

  // Check for changes
  useEffect(() => {
    const current = JSON.stringify(config);
    const original = JSON.stringify(originalConfig);
    setHasChanges(current !== original);
  }, [config, originalConfig]);

  const loadConfigPath = async () => {
    const path = await GetConfigPath();
    setConfigPath(path);
  };

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await GetConfig();
      setConfig(data || {});
      setOriginalConfig(data || {});
    } catch (err) {
      setError('加载配置失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadBackups = async () => {
    try {
      const list = await ListBackups();
      setBackups(list || []);
    } catch (err) {
      console.error('加载备份失败:', err);
    }
  };

  const handleSave = async () => {
    try {
      setSaveStatus('saving');
      setError('');

      // Validate before saving
      const configJSON = JSON.stringify(config);
      await ValidateConfig(configJSON);

      // Save
      await SaveConfig(configJSON);
      setOriginalConfig(config);
      setSaveStatus('saved');

      // Reload backups
      await loadBackups();

      setTimeout(() => setSaveStatus(''), 2000);
    } catch (err) {
      setError('保存失败: ' + err.message);
      setSaveStatus('');
    }
  };

  const handleRestore = async (backupPath) => {
    if (!confirm('确定要从此备份恢复吗？当前配置将被覆盖。')) return;

    try {
      await RestoreBackup(backupPath);
      await loadConfig();
      await loadBackups();
      setSaveStatus('restored');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (err) {
      setError('恢复失败: ' + err.message);
    }
  };

  const updateConfig = (section, value) => {
    setConfig(prev => ({...prev, [section]: value}));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-lg text-gray-600">加载中...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-800">OpenCode 配置</h1>
          <p className="text-xs text-gray-500 mt-1 truncate" title={configPath}>
            {configPath}
          </p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                activeTab === item.id
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleSave}
            disabled={!hasChanges || saveStatus === 'saving'}
            className={`w-full py-2 px-4 rounded-lg font-medium transition-all ${
              !hasChanges
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : saveStatus === 'saving'
                ? 'bg-blue-400 text-white cursor-wait'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {saveStatus === 'saving' ? '保存中...' : hasChanges ? '保存更改' : '已保存'}
          </button>

          {saveStatus === 'saved' && (
            <p className="text-xs text-green-600 mt-2 text-center">
              ✓ 已保存（配置修改后需重启 OpenCode）
            </p>
          )}

          {error && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
              {error}
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-8">
          {activeTab === 'providers' && (
            <ProvidersPanel config={config.provider || {}} onChange={(v) => updateConfig('provider', v)} />
          )}
          {activeTab === 'mcp' && (
            <McpPanel config={config.mcp || {}} onChange={(v) => updateConfig('mcp', v)} />
          )}
          {activeTab === 'permissions' && (
            <PermissionsPanel config={config.permission || {}} onChange={(v) => updateConfig('permission', v)} />
          )}
          {activeTab === 'commands' && (
            <CommandsPanel config={config.command || {}} onChange={(v) => updateConfig('command', v)} />
          )}
          {activeTab === 'plugins' && (
            <PluginsPanel config={config.plugin || []} onChange={(v) => updateConfig('plugin', v)} />
          )}
          {activeTab === 'backups' && (
            <BackupsPanel backups={backups} onRestore={handleRestore} />
          )}
        </div>
      </main>
    </div>
  );
}

// Providers Panel
function ProvidersPanel({config, onChange}) {
  const [expanded, setExpanded] = useState(null);

  const addProvider = () => {
    const name = prompt('输入提供商名称 (如: openai, anthropic):');
    if (!name) return;
    onChange({...config, [name]: {name: '', npm: '', options: {}, models: {}}});
  };

  const removeProvider = (name) => {
    if (!confirm(`确定删除提供商 "${name}"?`)) return;
    const {[name]: _, ...rest} = config;
    onChange(rest);
  };

  const updateProvider = (name, field, value) => {
    onChange({
      ...config,
      [name]: {...config[name], [field]: value}
    });
  };

  const addModel = (providerName) => {
    const modelName = prompt('输入模型 ID:');
    if (!modelName) return;
    const provider = config[providerName];
    onChange({
      ...config,
      [providerName]: {
        ...provider,
        models: {...provider.models, [modelName]: {name: modelName}}
      }
    });
  };

  const removeModel = (providerName, modelName) => {
    const provider = config[providerName];
    const {[modelName]: _, ...restModels} = provider.models;
    onChange({
      ...config,
      [providerName]: {...provider, models: restModels}
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">模型提供商</h2>
        <button
          onClick={addProvider}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + 添加提供商
        </button>
      </div>

      <div className="space-y-4">
        {Object.entries(config).map(([name, provider]) => (
          <div key={name} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div
              className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
              onClick={() => setExpanded(expanded === name ? null : name)}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{expanded === name ? '▼' : '▶'}</span>
                <span className="font-semibold text-gray-800">{name}</span>
                <span className="text-sm text-gray-500">{provider.name}</span>
              </div>
              <button
                onClick={(e) => {e.stopPropagation(); removeProvider(name);}}
                className="text-red-500 hover:text-red-700 text-sm"
              >
                删除
              </button>
            </div>

            {expanded === name && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">显示名称</label>
                    <input
                      type="text"
                      value={provider.name || ''}
                      onChange={(e) => updateProvider(name, 'name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="如: OpenAI"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">NPM 包名</label>
                    <input
                      type="text"
                      value={provider.npm || ''}
                      onChange={(e) => updateProvider(name, 'npm', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="如: @ai-sdk/openai"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Base URL</label>
                    <input
                      type="text"
                      value={provider.options?.baseURL || ''}
                      onChange={(e) => updateProvider(name, 'options', {...provider.options, baseURL: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="https://api.openai.com/v1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={provider.options?.apiKey || ''}
                        onChange={(e) => updateProvider(name, 'options', {...provider.options, apiKey: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="sk-..."
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">模型</label>
                    <button
                      onClick={() => addModel(name)}
                      className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      + 添加模型
                    </button>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(provider.models || {}).map(([modelId, model]) => (
                      <div key={modelId} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                        <span className="text-sm font-mono flex-1">{modelId}</span>
                        <input
                          type="text"
                          value={model.name || ''}
                          onChange={(e) => {
                            const models = {...provider.models, [modelId]: {...model, name: e.target.value}};
                            updateProvider(name, 'models', models);
                          }}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                          placeholder="显示名称"
                        />
                        <button
                          onClick={() => removeModel(name, modelId)}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          删除
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {Object.keys(config).length === 0 && (
          <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            暂无提供商，点击上方按钮添加
          </div>
        )}
      </div>
    </div>
  );
}

// MCP Panel
function McpPanel({config, onChange}) {
  const addServer = () => {
    const name = prompt('输入服务器名称:');
    if (!name) return;
    onChange({
      ...config,
      [name]: {type: 'local', enabled: true, command: ['']}
    });
  };

  const removeServer = (name) => {
    if (!confirm(`确定删除服务器 "${name}"?`)) return;
    const {[name]: _, ...rest} = config;
    onChange(rest);
  };

  const updateServer = (name, field, value) => {
    onChange({
      ...config,
      [name]: {...config[name], [field]: value}
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">MCP 服务器</h2>
        <button
          onClick={addServer}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + 添加服务器
        </button>
      </div>

      <div className="space-y-4">
        {Object.entries(config).map(([name, server]) => (
          <div key={name} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={server.enabled}
                  onChange={(e) => updateServer(name, 'enabled', e.target.checked)}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="font-semibold text-gray-800">{name}</span>
                <span className={`text-xs px-2 py-1 rounded ${
                  server.type === 'local' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  {server.type}
                </span>
              </div>
              <button
                onClick={() => removeServer(name)}
                className="text-red-500 hover:text-red-700 text-sm"
              >
                删除
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 ml-8">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">类型</label>
                <select
                  value={server.type || 'local'}
                  onChange={(e) => updateServer(name, 'type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="local">Local</option>
                  <option value="remote">Remote</option>
                </select>
              </div>

              {server.type === 'remote' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                  <input
                    type="text"
                    value={server.url || ''}
                    onChange={(e) => updateServer(name, 'url', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="https://..."
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">命令</label>
                  <input
                    type="text"
                    value={(server.command || []).join(' ')}
                    onChange={(e) => updateServer(name, 'command', e.target.value.split(' '))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="npx mcp-server"
                  />
                </div>
              )}
            </div>
          </div>
        ))}

        {Object.keys(config).length === 0 && (
          <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            暂无 MCP 服务器，点击上方按钮添加
          </div>
        )}
      </div>
    </div>
  );
}

// Permissions Panel
function PermissionsPanel({config, onChange}) {
  const permissions = [
    {key: 'bash', label: '执行 Bash 命令', desc: '允许运行 shell 命令'},
    {key: 'edit', label: '编辑文件', desc: '允许修改文件内容'},
    {key: 'glob', label: '文件匹配', desc: '允许使用 glob 模式查找文件'},
    {key: 'grep', label: '内容搜索', desc: '允许搜索文件内容'},
    {key: 'list', label: '列出目录', desc: '允许列出目录内容'},
    {key: 'patch', label: '应用补丁', desc: '允许应用代码补丁'},
    {key: 'question', label: '提问', desc: '允许向用户提问'},
    {key: 'read', label: '读取文件', desc: '允许读取文件内容'},
    {key: 'skill', label: '使用技能', desc: '允许调用技能'},
    {key: 'task', label: '创建任务', desc: '允许创建子任务'},
    {key: 'todoread', label: '读取待办', desc: '允许读取待办事项'},
    {key: 'todowrite', label: '写入待办', desc: '允许修改待办事项'},
    {key: 'webfetch', label: '获取网页', desc: '允许获取网页内容'},
    {key: 'write', label: '写入文件', desc: '允许创建或覆盖文件'},
  ];

  const togglePermission = (key) => {
    const currentValue = config[key] || 'deny';
    const newValue = currentValue === 'allow' ? 'deny' : 'allow';
    onChange({...config, [key]: newValue});
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">权限规则</h2>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {permissions.map((perm, index) => (
          <div
            key={perm.key}
            className={`flex items-center justify-between px-6 py-4 ${
              index !== permissions.length - 1 ? 'border-b border-gray-100' : ''
            }`}
          >
            <div>
              <div className="font-medium text-gray-800">{perm.label}</div>
              <div className="text-sm text-gray-500">{perm.desc}</div>
            </div>
            <button
              onClick={() => togglePermission(perm.key)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                (config[perm.key] || 'deny') === 'allow'
                  ? 'bg-green-500'
                  : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  (config[perm.key] || 'deny') === 'allow'
                    ? 'translate-x-6'
                    : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Commands Panel
function CommandsPanel({config, onChange}) {
  const [expanded, setExpanded] = useState(null);

  const addCommand = () => {
    const name = prompt('输入命令名称:');
    if (!name) return;
    onChange({
      ...config,
      [name]: {description: '', template: ''}
    });
  };

  const removeCommand = (name) => {
    if (!confirm(`确定删除命令 "${name}"?`)) return;
    const {[name]: _, ...rest} = config;
    onChange(rest);
  };

  const updateCommand = (name, field, value) => {
    onChange({
      ...config,
      [name]: {...config[name], [field]: value}
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">自定义命令</h2>
        <button
          onClick={addCommand}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + 添加命令
        </button>
      </div>

      <div className="space-y-4">
        {Object.entries(config).map(([name, cmd]) => (
          <div key={name} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div
              className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
              onClick={() => setExpanded(expanded === name ? null : name)}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{expanded === name ? '▼' : '▶'}</span>
                <span className="font-semibold text-gray-800">/{name}</span>
                <span className="text-sm text-gray-500">{cmd.description}</span>
              </div>
              <button
                onClick={(e) => {e.stopPropagation(); removeCommand(name);}}
                className="text-red-500 hover:text-red-700 text-sm"
              >
                删除
              </button>
            </div>

            {expanded === name && (
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                  <input
                    type="text"
                    value={cmd.description || ''}
                    onChange={(e) => updateCommand(name, 'description', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="命令的简短描述"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">模板</label>
                  <textarea
                    value={cmd.template || ''}
                    onChange={(e) => updateCommand(name, 'template', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    rows={10}
                    placeholder="命令模板内容..."
                  />
                </div>
              </div>
            )}
          </div>
        ))}

        {Object.keys(config).length === 0 && (
          <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            暂无自定义命令，点击上方按钮添加
          </div>
        )}
      </div>
    </div>
  );
}

// Plugins Panel
function PluginsPanel({config, onChange}) {
  const [newPlugin, setNewPlugin] = useState('');

  const addPlugin = () => {
    if (!newPlugin.trim()) return;
    onChange([...config, newPlugin.trim()]);
    setNewPlugin('');
  };

  const removePlugin = (index) => {
    onChange(config.filter((_, i) => i !== index));
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">插件</h2>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={newPlugin}
          onChange={(e) => setNewPlugin(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addPlugin()}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          placeholder="插件名称或 Git URL"
        />
        <button
          onClick={addPlugin}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          添加
        </button>
      </div>

      <div className="space-y-2">
        {config.map((plugin, index) => (
          <div key={index} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
            <code className="text-sm text-gray-800">{plugin}</code>
            <button
              onClick={() => removePlugin(index)}
              className="text-red-500 hover:text-red-700 text-sm"
            >
              删除
            </button>
          </div>
        ))}

        {config.length === 0 && (
          <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            暂无插件
          </div>
        )}
      </div>
    </div>
  );
}

// Backups Panel
function BackupsPanel({backups, onRestore}) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">备份管理</h2>

      <p className="text-sm text-gray-600 mb-4">
        系统会自动保留最近的 2 个配置备份。
      </p>

      <div className="space-y-2">
        {backups.map((backup) => (
          <div key={backup.name} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
            <div>
              <div className="font-medium text-gray-800">{backup.name}</div>
              <div className="text-sm text-gray-500">创建于: {backup.created}</div>
            </div>
            <button
              onClick={() => onRestore(backup.path)}
              className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm font-medium"
            >
              恢复此备份
            </button>
          </div>
        ))}

        {backups.length === 0 && (
          <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            暂无备份
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
