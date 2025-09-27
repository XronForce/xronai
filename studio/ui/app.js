document.addEventListener("DOMContentLoaded", async () => {
    
    const { icons } = await import('./icons.js');
    
    const NODE_ICONS = {
        USER: icons.USER,
        SUPERVISOR: icons.SUPERVISOR,
        AGENT: icons.AGENT,
        TOOL: icons.TOOL,
        MCP: icons.MCP,
    };
    
    const ICONS = {
        USER: icons.USER,
        AGENT: icons.AGENT,
        DELEGATE: icons.DELEGATE,
        TOOL_CALL: icons.TOOL_CALL,
        TOOL_RESPONSE: icons.TOOL,
        FINAL_RESPONSE: icons.FINAL_RESPONSE,
        ERROR: icons.ERROR,
    };

    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const sunIcon = document.getElementById('theme-icon-sun');
    const moonIcon = document.getElementById('theme-icon-moon');

    const applyTheme = (theme) => {
        if (theme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
            sunIcon.style.display = 'none';
            moonIcon.style.display = 'block';
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            sunIcon.style.display = 'block';
            moonIcon.style.display = 'none';
        }
    };

    themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('xronai-theme', newTheme);
        applyTheme(newTheme);
    });

    const savedTheme = localStorage.getItem('xronai-theme') || 'dark';
    applyTheme(savedTheme);

    let availableToolSchemas = {};
    const studioContainer = document.querySelector(".studio-container");
    const editWorkflowBtn = document.getElementById("edit-workflow-btn");
    const startChatBtn = document.getElementById("start-chat-btn");
    const exportWorkflowBtn = document.getElementById("export-workflow-btn");
    const log = document.getElementById("log");
    const form = document.getElementById("form");
    const input = document.getElementById("input");
    const configurationView = document.querySelector('.configuration-view');
    const originalPlaceholder = configurationView.innerHTML;
    const canvasElement = document.getElementById('drawflow');
    const editor = new Drawflow(canvasElement);
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingMessage = document.getElementById('loading-message');

    editor.reroute = true;
    editor.reroute_fix_curvature = true;
    editor.force_first_input = false;
    editor.start();

    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const centerViewBtn = document.getElementById('center-view-btn');
    const lockCanvasBtn = document.getElementById('lock-canvas-btn');
    const lockIcon = lockCanvasBtn.querySelector('.lock-icon-locked');
    const unlockIcon = lockCanvasBtn.querySelector('.lock-icon-unlocked');

    zoomInBtn.addEventListener('click', () => editor.zoom_in());
    zoomOutBtn.addEventListener('click', () => editor.zoom_out());
    centerViewBtn.addEventListener('click', () => editor.zoom_reset());

    lockCanvasBtn.addEventListener('click', () => {
        const isLocked = editor.editor_mode === 'fixed';
        if (isLocked) {
            editor.editor_mode = 'edit';
            lockCanvasBtn.classList.remove('locked');
            lockCanvasBtn.title = 'Lock Canvas';
            lockIcon.style.display = 'none';
            unlockIcon.style.display = 'block';
        } else {
            editor.editor_mode = 'fixed';
            lockCanvasBtn.classList.add('locked');
            lockCanvasBtn.title = 'Unlock Canvas';
            lockIcon.style.display = 'block';
            unlockIcon.style.display = 'none';
        }
    });

    editor.on('nodeCreated', updateAddUserButtonState);
    editor.on('nodeRemoved', updateAddUserButtonState);

    const addToolModal = document.getElementById('add-tool-modal');
    const toolListContainer = document.getElementById('tool-list');
    const addToolBtn = document.getElementById('add-tool-btn');
    const closeModalBtn = document.getElementById('close-tool-modal-btn');

    const uuidv4 = () => ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));

    function showLoadingOverlay(message) {
        loadingMessage.textContent = message;
        loadingOverlay.style.display = 'flex';
    }

    function hideLoadingOverlay() {
        loadingOverlay.style.display = 'none';
    }

    function populateToolbarIcons() {
        document.getElementById('add-user-btn').innerHTML = NODE_ICONS.USER;
        document.getElementById('add-supervisor-btn').innerHTML = NODE_ICONS.SUPERVISOR;
        document.getElementById('add-agent-btn').innerHTML = NODE_ICONS.AGENT;
        document.getElementById('add-tool-btn').innerHTML = NODE_ICONS.TOOL;
        document.getElementById('add-mcp-btn').innerHTML = NODE_ICONS.MCP;
    }

    function updateImportedNodeIcons() {
        const workflowData = editor.export();
        if (!workflowData.drawflow?.Home?.data) return;

        for (const nodeId in workflowData.drawflow.Home.data) {
            const nodeInfo = workflowData.drawflow.Home.data[nodeId];
            const nodeElement = document.getElementById(`node-${nodeId}`);
            if (nodeElement) {
                const iconContainer = nodeElement.querySelector('.node-icon-container');
                const nodeClass = nodeInfo.class.toUpperCase();
                if (iconContainer && NODE_ICONS[nodeClass]) {
                    iconContainer.innerHTML = NODE_ICONS[nodeClass];
                }
            }
        }
    }

    function addMessage(type, title, content, source, isCollapsible = false) {
        const entry = document.createElement("div");
        entry.className = `log-entry event-${type}`;

        const sourceName = source ? `<span class="source-name">${source.name}</span>` : '';
        const iconSvg = ICONS[type] || ICONS.AGENT;

        let formattedContent = marked.parse(content || '');

        let entryHTML;
        if (isCollapsible) {
            entryHTML = `
                <details>
                    <summary>
                        <div class="log-header">
                            <span class="log-icon">${iconSvg}</span>
                            <strong class="log-title">${title}</strong>
                            ${sourceName}
                        </div>
                    </summary>
                    <div class="log-content collapsible-content">${formattedContent}</div>
                </details>
            `;
        } else {
            entryHTML = `
                <div class="log-header">
                    <span class="log-icon">${iconSvg}</span>
                    <strong class="log-title">${title}</strong>
                    ${sourceName}
                </div>
                <div class="log-content">${formattedContent}</div>
            `;
        }

        entry.innerHTML = entryHTML;
        log.appendChild(entry);
        log.scrollTop = log.scrollHeight;
    }

    function updateAddUserButtonState() {
        const addUserBtn = document.getElementById('add-user-btn');
        const workflowData = editor.export();
        let userNodeExists = false;
    
        if (workflowData.drawflow && workflowData.drawflow.Home && workflowData.drawflow.Home.data) {
            for (const nodeId in workflowData.drawflow.Home.data) {
                if (workflowData.drawflow.Home.data[nodeId].class === 'user') {
                    userNodeExists = true;
                    break;
                }
            }
        }
    
        if (userNodeExists) {
            addUserBtn.disabled = true;
            addUserBtn.title = 'Only one User node is allowed';
        } else {
            addUserBtn.disabled = false;
            addUserBtn.title = 'Add User (Entry Point)';
        }
    }

    async function fetchToolSchemas() {
        try {
            const response = await fetch('/api/v1/tools/schemas');
            if (!response.ok) throw new Error('Failed to fetch tool schemas');
            availableToolSchemas = await response.json();
            populateToolModal();
        } catch (error) {
            console.error("Error fetching tool schemas:", error);
        }
    }

    function populateToolModal() {
        toolListContainer.innerHTML = '';
        for (const toolName in availableToolSchemas) {
            const btn = document.createElement('button');
            btn.textContent = toolName.charAt(0).toUpperCase() + toolName.slice(1);
            btn.onclick = () => {
                addNode('tool', toolName);
                addToolModal.style.display = 'none';
            };
            toolListContainer.appendChild(btn);
        }
    }

    function setMode(mode) {
        if (mode === 'chat') {
            compileAndStartChat();
        } else {
            studioContainer.classList.remove('chat-mode');
            editWorkflowBtn.classList.add('active');
            startChatBtn.classList.remove('active');
            editor.editor_mode = 'edit';
            disconnectWebSocket();
        }
    }

    async function compileAndStartChat() {
        showLoadingOverlay("Compiling workflow...");
        const workflowData = editor.export();

        try {
            const response = await fetch('/api/v1/workflow/compile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(workflowData),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || "Unknown compilation error.");
            }
            
            log.innerHTML = '';
            studioContainer.classList.add('chat-mode');
            startChatBtn.classList.add('active');
            editWorkflowBtn.classList.remove('active');
            editor.editor_mode = 'fixed';
            connectWebSocket();

        } catch (error) {
            console.error("Compilation failed:", error);
            alert(`Could not start chat. Please fix the workflow.\n\nError: ${error.message}`);
        } finally {
            hideLoadingOverlay();
        }
    }

    function loadDefaultWorkflow() {
        console.log("Loading default empty workflow.");
        editor.clear();
        addNode('user', 'User Input');
        updateAddUserButtonState();
    }

    function addNode(type, typeOrTitle) {
        let baseName = typeOrTitle;
        let subtitle = `${type.charAt(0).toUpperCase() + type.slice(1)} Node`;
        let nodeData = {};
        let inputs = 1;
        let outputs = 1;
        let iconSvg = NODE_ICONS[type.toUpperCase()];
        let nodeClass = type;

        switch (type) {
            case 'supervisor':
                nodeData = { system_message: `You are a supervisor.`, use_agents: true };
                break;
            case 'agent':
                nodeData = { system_message: `You are a agent.`, keep_history: true, output_schema: "", strict: false };
                break;
            case 'user':
                inputs = 0;
                subtitle = "Workflow Entry Point";
                break;
            case 'mcp':
                nodeData = { type: 'sse', url: 'http://localhost:8000/sse', script_path: 'path/to/server.py', auth_token: '' };
                outputs = 0;
                subtitle = "Multi-Compute Process";
                break;
            case 'tool':
                baseName = typeOrTitle;
                nodeClass = 'tool';
                nodeData = { tool_type: typeOrTitle, config: {} };
                subtitle = `Tool: ${typeOrTitle}`;
                outputs = 0;
                break;
        }

        nodeData.uuid = uuidv4();
        nodeData.name = baseName;

        const nodeHtml = `
            <div class="node-content-wrapper">
                <div class="node-icon-container">
                    ${iconSvg}
                </div>
                <div class="node-text-container">
                    <div class="node-title">${baseName}</div>
                    <div class="node-subtitle">${subtitle}</div>
                </div>
            </div>
        `;
        
        const nodeId = editor.addNode(baseName, inputs, outputs, 100, 250, nodeClass, nodeData, nodeHtml);
        return nodeId;
    }
    
    editor.on('nodeSelected', id => {
        const node = editor.getNodeFromId(id);
        const nodeData = node.data;

        const updateNodeVisuals = (newNodeData) => {
            const nodeElement = document.querySelector(`#node-${id}`);
            if (!nodeElement) return;
            const titleElement = nodeElement.querySelector('.node-title');
            if (titleElement) titleElement.textContent = newNodeData.name;
        };

        if (node.class === 'user') {
            configurationView.innerHTML = `<div class="config-content"><div class="config-header"><span class="node-type-badge user">User</span><h2>User</h2></div><p>This is the entry point for the user's chat message.</p></div>`;
            return;
        }

        if (node.class === 'tool') {
            const toolType = nodeData.tool_type;
            const schema = availableToolSchemas[toolType];
            if (!schema) {
                configurationView.innerHTML = `<div class="panel-placeholder">Error: Tool schema for '${toolType}' not found.</div>`;
                return;
            }

            let formFieldsHtml = '';
            if (schema.properties && Object.keys(schema.properties).length > 0) {
                 for (const key in schema.properties) {
                    const prop = schema.properties[key];
                    const currentValue = nodeData.config[key] || '';
                    formFieldsHtml += `
                        <div class="config-section">
                            <label for="tool-config-${key}" class="config-label">${prop.title || key}</label>
                            <input type="text" id="tool-config-${key}" data-key="${key}" class="config-input tool-config-input" value="${currentValue}" placeholder="${prop.description || ''}">
                        </div>
                    `;
                }
            } else {
                formFieldsHtml = `<p class="config-section">This tool requires no configuration.</p>`;
            }

            let panelHtml = `
            <div class="config-content">
                <div class="config-header">
                    <span class="node-type-badge tool">${toolType}</span>
                </div>
                <div class="config-section">
                    <h3>Name (Instance)</h3>
                    <input type="text" id="node-name-input" class="config-input" value="${nodeData.name || ''}">
                </div>
                ${formFieldsHtml}
                <div class="config-actions">
                     <button id="save-node-btn" class="action-btn save">Save Changes</button>
                     <button id="delete-node-btn" class="action-btn delete">Delete Node</button>
                </div>
            </div>`;
            configurationView.innerHTML = panelHtml;

            document.getElementById('save-node-btn').addEventListener('click', () => {
                const newName = document.getElementById('node-name-input').value;
                if (!newName.trim()) { alert("Node name cannot be empty."); return; }

                const updatedConfig = {};
                document.querySelectorAll('.tool-config-input').forEach(input => {
                    updatedConfig[input.dataset.key] = input.value;
                });

                const updatedData = { ...nodeData, name: newName, config: updatedConfig };
                
                editor.updateNodeDataFromId(id, updatedData);
                updateNodeVisuals(updatedData);
                alert('Tool configuration saved. Re-compile to apply.');
            });

            document.getElementById('delete-node-btn').addEventListener('click', () => {
                if (confirm(`Delete node "${nodeData.name}"?`)) {
                    editor.removeNodeId(`node-${id}`);
                    resetConfigPanel();
                }
            });
            return;
        }

        if (node.class === 'mcp') {
            let panelHtml = `
            <div class="config-content">
                <div class="config-header">
                    <span class="node-type-badge mcp">MCP Server</span>
                </div>
                <div class="config-section">
                    <h3>Name</h3>
                    <input type="text" id="node-name-input" class="config-input" value="${nodeData.name || ''}">
                </div>
                <div class="config-section">
                    <h3>Server Type</h3>
                    <select id="mcp-type-select" class="config-input">
                        <option value="sse" ${nodeData.type === 'sse' ? 'selected' : ''}>Remote (SSE)</option>
                        <option value="stdio" ${nodeData.type === 'stdio' ? 'selected' : ''}>Local (stdio)</option>
                    </select>
                </div>
                <div id="mcp-sse-fields" class="config-section" style="display: ${nodeData.type === 'sse' ? 'block' : 'none'};">
                    <h3>Server URL</h3>
                    <input type="text" id="mcp-url-input" class="config-input" value="${nodeData.url || ''}" placeholder="http://localhost:8000/sse">
                    <h3 style="margin-top: 1.5rem;">Auth Token (Optional)</h3>
                    <input type="text" id="mcp-token-input" class="config-input" value="${nodeData.auth_token || ''}" placeholder="Bearer token if required">
                </div>
                <div id="mcp-stdio-fields" class="config-section" style="display: ${nodeData.type === 'stdio' ? 'block' : 'none'};">
                    <h3>Script Path</h3>
                    <input type="text" id="mcp-script-path-input" class="config-input" value="${nodeData.script_path || ''}" placeholder="e.g., examples/supervisor_multi_mcp/weather_server.py">
                </div>
                <div class="config-actions">
                     <button id="save-node-btn" class="action-btn save">Save Changes</button>
                     <button id="delete-node-btn" class="action-btn delete">Delete Node</button>
                </div>
            </div>`;
            configurationView.innerHTML = panelHtml;

            const mcpTypeSelect = document.getElementById('mcp-type-select');
            const sseFields = document.getElementById('mcp-sse-fields');
            const stdioFields = document.getElementById('mcp-stdio-fields');
            mcpTypeSelect.addEventListener('change', (e) => {
                const isSSE = e.target.value === 'sse';
                sseFields.style.display = isSSE ? 'block' : 'none';
                stdioFields.style.display = isSSE ? 'none' : 'block';
            });
            
            document.getElementById('save-node-btn').addEventListener('click', () => {
                 const newName = document.getElementById('node-name-input').value;
                 if (!newName.trim()) { alert("Node name cannot be empty."); return; }
                 const updatedData = {
                    ...nodeData, name: newName, type: document.getElementById('mcp-type-select').value,
                    url: document.getElementById('mcp-url-input').value,
                    auth_token: document.getElementById('mcp-token-input').value,
                    script_path: document.getElementById('mcp-script-path-input').value,
                };
                editor.updateNodeDataFromId(id, updatedData);
                updateNodeVisuals(updatedData);
                alert('MCP node updated. Re-compile to apply changes.');
            });

            document.getElementById('delete-node-btn').addEventListener('click', () => {
                if (confirm(`Delete node "${nodeData.name}"?`)) { editor.removeNodeId(`node-${id}`); resetConfigPanel(); }
            });
            return;
        }

        let panelHtml = `
            <div class="config-content">
                <div class="config-header"><span class="node-type-badge ${node.class}">${node.class}</span></div>
                <div class="config-section"><h3>Name</h3><input type="text" id="node-name-input" class="config-input" value="${nodeData.name || ''}"></div>
                <div class="config-section"><h3>System Message</h3><textarea id="system-message-input" class="config-textarea">${nodeData.system_message || ''}</textarea></div>`;

        if (node.class === 'supervisor') {
            panelHtml += `<div class="config-section toggle-section"><label for="use-agents-toggle">Use Agents</label><input type="checkbox" id="use-agents-toggle" class="toggle-switch" ${nodeData.use_agents ? 'checked' : ''}></div>`;
        }
        if (node.class === 'agent') {
            panelHtml += `<div class="config-section toggle-section"><label for="keep-history-toggle">Remember History</label><input type="checkbox" id="keep-history-toggle" class="toggle-switch" ${nodeData.keep_history ? 'checked' : ''}></div>
                <div class="config-section"><h3>Enforce Output Schema (JSON)</h3><textarea id="output-schema-input" class="config-textarea" placeholder='e.g., {"type": "object", "properties": ...}'>${nodeData.output_schema || ''}</textarea></div>
                <div class="config-section toggle-section" id="strict-mode-container" style="display: ${nodeData.output_schema && nodeData.output_schema.trim() ? 'flex' : 'none'};"><label for="strict-mode-toggle">Strict Mode</label><input type="checkbox" id="strict-mode-toggle" class="toggle-switch" ${nodeData.strict ? 'checked' : ''}></div>`;
        }
        panelHtml += `<div class="config-actions"><button id="save-node-btn" class="action-btn save">Save Changes</button><button id="delete-node-btn" class="action-btn delete">Delete Node</button></div></div>`;
        configurationView.innerHTML = panelHtml;

        const saveBtn = document.getElementById('save-node-btn');
        const deleteBtn = document.getElementById('delete-node-btn');
        const schemaInput = document.getElementById('output-schema-input');
        const strictContainer = document.getElementById('strict-mode-container');

        if (schemaInput) {
            schemaInput.addEventListener('input', () => { strictContainer.style.display = schemaInput.value.trim() ? 'flex' : 'none'; });
        }
        
        saveBtn.addEventListener('click', () => {
            const newName = document.getElementById('node-name-input').value;
            if (!newName.trim()) { alert("Node name cannot be empty."); return; }
            
            const updatedData = { ...nodeData, name: newName, system_message: document.getElementById('system-message-input').value };
            
            if (node.class === 'supervisor') { updatedData.use_agents = document.getElementById('use-agents-toggle').checked; }
            if (node.class === 'agent') {
                updatedData.keep_history = document.getElementById('keep-history-toggle').checked;
                updatedData.output_schema = document.getElementById('output-schema-input').value;
                updatedData.strict = document.getElementById('strict-mode-toggle').checked;
            }

            editor.updateNodeDataFromId(id, updatedData);
            updateNodeVisuals(updatedData);
            alert('Node data updated locally. Compile to apply changes.');
        });
        
        deleteBtn.addEventListener('click', () => {
            if (confirm(`Delete node "${nodeData.name}"?`)) { editor.removeNodeId(`node-${id}`); resetConfigPanel(); }
        });
    });

    function resetConfigPanel() { configurationView.innerHTML = originalPlaceholder; }
    editor.on('nodeUnselected', resetConfigPanel);

    let ws = null;
    function connectWebSocket() {
        if (ws && ws.readyState === WebSocket.OPEN) return;
        ws = new WebSocket(`ws://${window.location.host}/ws`);
        ws.onopen = () => {};
        ws.onclose = (event) => { if (studioContainer.classList.contains('chat-mode')) { console.log(`Connection closed: ${event.reason || "Unknown"}`); } ws = null; };
        ws.onerror = () => addMessage("ERROR", "Connection Error", "Could not connect to the workflow server.", null);
        ws.onmessage = (event) => {
            document.getElementById('thinking-indicator')?.remove();
            input.classList.remove('processing');

            const data = JSON.parse(event.data);
            
            if (data.type === 'WORKFLOW_END') return;

            let content;
            switch (data.type) {
                case "WORKFLOW_START":
                    const userQuery = data.data.user_query.replace(/\n/g, '<br>');
                    addMessage("USER", "You", userQuery, null);
                    break;
                case "SUPERVISOR_DELEGATE":
                    content = `**Reasoning:** ${data.data.reasoning}\n\n**Query for Agent:** ${data.data.query_for_agent}`;
                    addMessage("DELEGATE", `Delegate to ${data.data.target.name}`, content, data.data.source, true);
                    break;
                case "AGENT_TOOL_CALL":
                    content = `**Tool:** \`${data.data.tool_name}\`\n\n**Arguments:**\n\`\`\`json\n${JSON.stringify(data.data.arguments, null, 2)}\n\`\`\``;
                    addMessage("TOOL_CALL", "Tool Call", content, data.data.source, true);
                    break;
                case "AGENT_TOOL_RESPONSE":
                    content = `\`\`\`json\n${JSON.stringify(data.data.result, null, 2)}\n\`\`\``;
                    addMessage("TOOL_RESPONSE", "Tool Response", content, data.data.source, true);
                    break;
                case "AGENT_RESPONSE":
                    addMessage("AGENT_RESPONSE", "Agent Response", data.data.content, data.data.source);
                    break;
                case "FINAL_RESPONSE":
                    addMessage("FINAL_RESPONSE", "Final Response", data.data.content, data.data.source);
                    break;
                case "ERROR":
                    addMessage("ERROR", "Error", data.data.error_message, data.data.source);
                    break;
                default:
                    content = `\`\`\`json\n${JSON.stringify(data.data, null, 2)}\n\`\`\``;
                    addMessage("SYSTEM", data.type, content, { name: "System" }, true);
            }
        };
    }

    function disconnectWebSocket() { if (ws) { ws.close(); } }
    
    form.addEventListener("submit", e => {
        e.preventDefault();
        const message = input.value.trim();
        if (message && ws && ws.readyState === WebSocket.OPEN) {
            ws.send(message);
            input.value = '';
            input.style.height = 'auto';
            input.classList.add('processing');
            
            const thinkingEntry = document.createElement("div");
            thinkingEntry.id = "thinking-indicator";
            thinkingEntry.className = "log-entry event-thinking";
            thinkingEntry.innerHTML = `
                <div class="log-header">
                    <span class="log-icon">${ICONS.AGENT}</span>
                </div>
                <div class="log-content">
                    <div class="typing-indicator">
                        <span></span><span></span><span></span>
                    </div>
                </div>
            `;
            log.appendChild(thinkingEntry);
            log.scrollTop = log.scrollHeight;
        }
    });

    input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = `${input.scrollHeight}px`;
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            form.dispatchEvent(new Event('submit'));
        }
    });
    
    function downloadFile(filename, content, mimeType) {
        const element = document.createElement('a');
        const blob = new Blob([content], { type: mimeType });
        element.href = URL.createObjectURL(blob);
        element.download = filename;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    }

    async function handleExport() {
        exportWorkflowBtn.textContent = 'Exporting...';
        exportWorkflowBtn.disabled = true;
        try {
            const workflowData = editor.export();
            const response = await fetch('/api/v1/workflow/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ drawflow: workflowData, format: 'yaml' }),
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Unknown export error');
            }
            const data = await response.json();
            downloadFile('workflow.yaml', data.content, 'application/x-yaml');
        } catch (error) {
            console.error('Export failed:', error);
            alert(`Could not export workflow.\n\nError: ${error.message}`);
        } finally {
            exportWorkflowBtn.textContent = 'Export as YAML';
            exportWorkflowBtn.disabled = false;
        }
    }
    
    editWorkflowBtn.addEventListener('click', () => setMode('design'));
    startChatBtn.addEventListener('click', () => setMode('chat'));
    exportWorkflowBtn.addEventListener('click', handleExport);
    document.getElementById('add-supervisor-btn').addEventListener('click', () => addNode('supervisor', 'Supervisor'));
    document.getElementById('add-agent-btn').addEventListener('click', () => addNode('agent', 'Agent'));
    document.getElementById('add-user-btn').addEventListener('click', () => addNode('user', 'User'));
    addToolBtn.addEventListener('click', () => addToolModal.style.display = 'flex');
    closeModalBtn.addEventListener('click', () => addToolModal.style.display = 'none');
    document.getElementById('add-mcp-btn').addEventListener('click', () => addNode('mcp', 'MCP Server'));
    
    async function initialize() {
        showLoadingOverlay("Initializing Studio...");
        try {
            const response = await fetch('/api/v1/workflow/graph');
            if (!response.ok) {
                throw new Error(`Server returned status ${response.status}`);
            }
            const graphData = await response.json();

            if (graphData && graphData.drawflow && Object.keys(graphData.drawflow.Home.data).length > 0) {
                console.log("Found pre-loaded workflow. Importing.");
                editor.import(graphData);
                
                // MODIFIED: Call the new function to add icons after importing
                setTimeout(() => {
                    updateImportedNodeIcons();
                    updateAddUserButtonState();
                }, 100); // Small delay for rendering
            } else {
                console.log("No pre-loaded workflow found. Creating a default one.");
                loadDefaultWorkflow();
            }
        } catch (error) {
            console.error("Failed to initialize workflow from backend:", error);
            alert("Could not load initial workflow from the server. Starting with a blank canvas.");
            loadDefaultWorkflow();
        } finally {
            hideLoadingOverlay();
        }

        await fetchToolSchemas();
        setMode('design');
        populateToolbarIcons();

        const resizer = document.querySelector('.resizer');
        const contextualPanel = document.querySelector('.contextual-panel');
        let isResizing = false;

        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.body.style.userSelect = 'none';
            document.body.style.pointerEvents = 'none';
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', stopResizing);
        });

        function handleMouseMove(e) {
            if (!isResizing) return;
            const newWidth = window.innerWidth - e.clientX;
            if (newWidth > 400 && newWidth < window.innerWidth - 400) {
                contextualPanel.style.width = `${newWidth}px`;
            }
        }

        function stopResizing() {
            isResizing = false;
            document.body.style.userSelect = '';
            document.body.style.pointerEvents = '';
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', stopResizing);
        }
    }

    initialize();
});