document.addEventListener("DOMContentLoaded", async () => {
    // --- SVG Icon Definitions ---
    const ICONS = {
        USER: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clip-rule="evenodd" /></svg>`,
        AGENT: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M11.484 2.17a.75.75 0 011.032 0 11.209 11.209 0 014.328 4.673c.244.592.232 1.28.034 1.847.226.34.428.712.593 1.103.197.47.221.99.069 1.472.196.48.318 1 .353 1.531.038.562-.016 1.122-.153 1.655a.75.75 0 01-1.485-.221c.119-.46.163-.93.132-1.395-.034-.523-.153-1.015-.35-1.467a3.001 3.001 0 00-1.84-1.84c-.452-.2-.944-.316-1.468-.35a2.25 2.25 0 01-1.395.132.75.75 0 01-.22-1.485c.533-.137 1.093-.192 1.655-.153.53.036 1.05.158 1.53.354.48.196 1.052.22 1.472.068.583-.21 1.19-.222 1.847.034a11.209 11.209 0 014.673 4.328.75.75 0 010 1.032 11.209 11.209 0 01-4.673 4.328c-.592.244-1.28.232-1.847.034-.34-.226-.712-.428-1.103-.593-.47-.197-.99-.221-1.472-.069-.48-.196-1-.318-1.531-.353-.562-.038-1.122.016-1.655.153a.75.75 0 01-.221 1.485c.46-.119.93-.163 1.395-.132.523.034 1.015.153 1.467.35a3.001 3.001 0 001.84 1.84c.199.453.316.944.35 1.468.032.465-.013.935-.132 1.395a.75.75 0 01-1.485.22c.137-.533.191-1.093.153-1.655-.036-.53-.158-1.05-.354-1.53a3.001 3.001 0 00-.068-1.472c-.21-.583-.222-1.19-.034-1.847a11.209 11.209 0 01-4.328-4.673.75.75 0 010-1.032A11.209 11.209 0 0111.484 2.17z" clip-rule="evenodd" /></svg>`,
        DELEGATE: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M15.75 9.75a.75.75 0 01.75.75v5.42l1.63-1.916a.75.75 0 111.14 1.01l-3.25 3.81a.75.75 0 01-1.139-.001l-3.25-3.81a.75.75 0 111.14-1.01L15 15.92V10.5a.75.75 0 01.75-.75z" /><path fill-rule="evenodd" d="M5 4.5a.75.75 0 01.75.75v10.5a.75.75 0 01-1.5 0V5.25A.75.75 0 015 4.5zm4.5.75A.75.75 0 008.75 6v10.5a.75.75 0 001.5 0V6a.75.75 0 00-.75-.75z" clip-rule="evenodd" /></svg>`,
        TOOL_CALL: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M12 6.75a5.25 5.25 0 015.25 5.25c0 1.254-.438 2.404-1.192 3.352l-.16.213-.11.148-1.924 2.565a.75.75 0 11-1.12-1.002l1.924-2.565.11-.148.16-.213a3.75 3.75 0 00.862-2.352 3.75 3.75 0 00-7.5 0c0 .92.336 1.763.863 2.352l.16.213.11.148 1.923 2.565a.75.75 0 01-1.12 1.002L7.33 15.352l.11-.148.16-.213A5.25 5.25 0 0112 6.75zM11.25 21a.75.75 0 01.75-.75h.008a.75.75 0 01.75.75v.008a.75.75 0 01-.75.75h-.008a.75.75 0 01-.75-.75V21z" clip-rule="evenodd" /><path d="M4.125 10.125a.75.75 0 01.75-.75H6a.75.75 0 01.75.75v.008a.75.75 0 01-.75.75H4.875a.75.75 0 01-.75-.75V10.125zM17.25 10.125a.75.75 0 01.75-.75h1.125a.75.75 0 01.75.75v.008a.75.75 0 01-.75.75H18a.75.75 0 01-.75-.75V10.125zM12 2.25a.75.75 0 01.75.75v.008a.75.75 0 01-.75.75h-.008a.75.75 0 01-.75-.75V3a.75.75 0 01.75-.75z" /></svg>`,
        TOOL_RESPONSE: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M11.666 4.038a.75.75 0 01.668 0l7.5 4.5a.75.75 0 010 1.324l-7.5 4.5a.75.75 0 01-.668 0l-7.5-4.5a.75.75 0 010-1.324l7.5-4.5zM12 16.121l7.5-4.5-7.5-4.5-7.5 4.5 7.5 4.5z" clip-rule="evenodd" /><path d="M3.693 12.617a.75.75 0 01.668 0l7.5 4.5a.75.75 0 010 1.324l-7.5 4.5a.75.75 0 01-1.02-.662V13.28a.75.75 0 01.352-.662z" /><path d="M20.307 12.617a.75.75 0 00-.668 0l-7.5 4.5a.75.75 0 000 1.324l7.5 4.5a.75.75 0 001.02-.662V13.28a.75.75 0 00-.352-.662z" /></svg>`,
        FINAL_RESPONSE: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M12.97 3.97a.75.75 0 011.06 0l7.5 7.5a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 11-1.06-1.06l6.22-6.22H3a.75.75 0 010-1.5h16.19l-6.22-6.22a.75.75 0 010-1.06z" clip-rule="evenodd" /></svg>`,
        ERROR: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clip-rule="evenodd" /></svg>`
    };

    // --- THEME MANAGEMENT ---
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

    // --- EXISTING VARIABLES ---
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

    // --- Loading Overlay Elements ---
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingMessage = document.getElementById('loading-message');

    editor.reroute = true;
    editor.reroute_fix_curvature = true;
    editor.force_first_input = false;
    editor.start();

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
        editor.clear();
        const userData = { uuid: 'user-entry-uuid', name: 'User' };
        const agentData = { uuid: uuidv4(), name: 'DefaultAgent', system_message: 'You are a helpful assistant.', keep_history: true };
        const userNodeId = editor.addNode('User', 0, 1, 200, 200, 'user', userData, 'User');
        const agentNodeId = editor.addNode('DefaultAgent', 1, 1, 500, 200, 'agent', agentData, 'DefaultAgent');
        editor.addConnection(userNodeId, agentNodeId, "output_1", "input_1");
    }

    function addNode(type, typeOrTitle) {
        let baseName = `${typeOrTitle}_${Math.floor(Math.random() * 1000)}`;
        let nodeData = { uuid: uuidv4(), name: baseName };
        let inputs = 1;
        let outputs = 1;

        switch (type) {
            case 'supervisor':
                nodeData.system_message = `You are the ${baseName} supervisor.`;
                nodeData.use_agents = true;
                break;
            case 'agent':
                nodeData.system_message = `You are the ${baseName} agent.`;
                nodeData.keep_history = true;
                nodeData.output_schema = "";
                nodeData.strict = false;
                break;
            case 'user':
                inputs = 0;
                break;
            case 'mcp':
                nodeData.type = 'sse';
                nodeData.url = 'http://localhost:8000/sse';
                nodeData.script_path = 'path/to/your/server.py';
                nodeData.auth_token = '';
                outputs = 0;
                break;
            case 'tool':
                nodeData.tool_type = typeOrTitle;
                nodeData.config = {};
                outputs = 0;
                break;
        }
        editor.addNode(baseName, inputs, outputs, 300, 150, type, nodeData, typeOrTitle);
    }
    
    editor.on('nodeSelected', id => {
        const node = editor.getNodeFromId(id);
        const nodeData = node.data;

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
                editor.drawflow.drawflow.Home.data[id].name = newName;
                editor.updateNodeValue(id, toolType);
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
                    uuid: nodeData.uuid, name: newName,
                    type: document.getElementById('mcp-type-select').value,
                    url: document.getElementById('mcp-url-input').value,
                    auth_token: document.getElementById('mcp-token-input').value,
                    script_path: document.getElementById('mcp-script-path-input').value,
                };
                editor.updateNodeDataFromId(id, updatedData);
                editor.drawflow.drawflow.Home.data[id].name = newName; 
                editor.updateNodeValue(id, newName);
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
            panelHtml += `<div class="config-section toggle-section"><label for="use-agents-toggle">Can Respond Directly</label><input type="checkbox" id="use-agents-toggle" class="toggle-switch" ${nodeData.use_agents ? 'checked' : ''}></div>`;
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
            const updatedData = {
                uuid: nodeData.uuid, name: newName,
                system_message: document.getElementById('system-message-input').value,
            };
            if (node.class === 'supervisor') { updatedData.use_agents = document.getElementById('use-agents-toggle').checked; }
            if (node.class === 'agent') {
                updatedData.keep_history = document.getElementById('keep-history-toggle').checked;
                updatedData.output_schema = document.getElementById('output-schema-input').value;
                updatedData.strict = document.getElementById('strict-mode-toggle').checked;
            }
            editor.updateNodeDataFromId(id, updatedData);
            editor.drawflow.drawflow.Home.data[id].name = newName;
            editor.updateNodeValue(id, newName);
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

    await fetchToolSchemas();
    
    editWorkflowBtn.addEventListener('click', () => setMode('design'));
    startChatBtn.addEventListener('click', () => setMode('chat'));
    exportWorkflowBtn.addEventListener('click', handleExport);
    document.getElementById('add-supervisor-btn').addEventListener('click', () => addNode('supervisor', 'Supervisor'));
    document.getElementById('add-agent-btn').addEventListener('click', () => addNode('agent', 'Agent'));
    document.getElementById('add-user-btn').addEventListener('click', () => addNode('user', 'User'));
    addToolBtn.addEventListener('click', () => addToolModal.style.display = 'flex');
    closeModalBtn.addEventListener('click', () => addToolModal.style.display = 'none');
    document.getElementById('add-mcp-btn').addEventListener('click', () => addNode('mcp', 'MCP Server'));
    
    setMode('design');
    loadDefaultWorkflow();

    // --- NEW: PANEL RESIZING LOGIC ---
    const resizer = document.querySelector('.resizer');
    const contextualPanel = document.querySelector('.contextual-panel');
    let isResizing = false;

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        // Prevent text selection while dragging
        document.body.style.userSelect = 'none';
        document.body.style.pointerEvents = 'none'; // Improves performance

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', stopResizing);
    });

    function handleMouseMove(e) {
        if (!isResizing) return;
        // Calculate the new width from the right edge of the screen
        const newWidth = window.innerWidth - e.clientX;
        // Apply boundaries to prevent panel from becoming too small or large
        if (newWidth > 400 && newWidth < window.innerWidth - 400) {
            contextualPanel.style.width = `${newWidth}px`;
        }
    }

    function stopResizing() {
        isResizing = false;
        // Re-enable text selection and pointer events
        document.body.style.userSelect = '';
        document.body.style.pointerEvents = '';
        
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', stopResizing);
    }
});