document.addEventListener("DOMContentLoaded", async () => {
    let availableToolSchemas = {};

    const studioContainer = document.querySelector(".studio-container");
    const editWorkflowBtn = document.getElementById("edit-workflow-btn");
    const startChatBtn = document.getElementById("start-chat-btn");
    const log = document.getElementById("log");
    const form = document.getElementById("form");
    const input = document.getElementById("input");
    const configurationView = document.querySelector('.configuration-view');
    const originalPlaceholder = configurationView.innerHTML;
    
    const canvasElement = document.getElementById('drawflow');
    const editor = new Drawflow(canvasElement);
    editor.reroute = true;
    editor.reroute_fix_curvature = true;
    editor.force_first_input = false;
    editor.start();

    const addToolModal = document.getElementById('add-tool-modal');
    const toolListContainer = document.getElementById('tool-list');
    const addToolBtn = document.getElementById('add-tool-btn');
    const closeModalBtn = document.getElementById('close-tool-modal-btn');

    const uuidv4 = () => ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));

    function addLogEntry(className, content) {
        const entry = document.createElement("div");
        entry.className = `log-entry ${className}`;
        entry.innerHTML = content;
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
            addLogEntry("event-ERROR", "Could not load available built-in tools from the server.");
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
        addLogEntry("event-SYSTEM", "Compiling workflow...");
        const workflowData = editor.export();
        console.log("Exported workflow for compilation:", workflowData);

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

            addLogEntry("event-SYSTEM", "Compilation successful. Starting chat mode.");
            studioContainer.classList.add('chat-mode');
            startChatBtn.classList.add('active');
            editWorkflowBtn.classList.remove('active');
            editor.editor_mode = 'fixed';
            connectWebSocket();

        } catch (error) {
            console.error("Compilation failed:", error);
            addLogEntry("event-ERROR", `<b>Compilation Failed:</b> ${error.message}`);
            alert(`Could not start chat. Please fix the workflow.\n\nError: ${error.message}`);
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
        ws.onopen = () => addLogEntry("event-SYSTEM", "Connection established. Ready to chat.");
        ws.onclose = (event) => { if (studioContainer.classList.contains('chat-mode')) { addLogEntry("event-ERROR", `Connection closed unexpectedly. Reason: ${event.reason || "Unknown"}`); } ws = null; };
        ws.onerror = () => addLogEntry("event-ERROR", `WebSocket Error: Could not connect.`);
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            let content = '';
            switch (data.type) {
                case "WORKFLOW_START": content = `<strong>USER QUERY</strong><p>${data.data.user_query}</p>`; addLogEntry("event-USER", content); break;
                case "SUPERVISOR_DELEGATE": content = `<strong>DELEGATING</strong> [${data.data.source.name} → ${data.data.target.name}]<p><strong>Reasoning:</strong> ${data.data.reasoning}</p><p><strong>Query:</strong> ${data.data.query_for_agent}</p>`; addLogEntry("event-SUPERVISOR_DELEGATE", content); break;
                case "AGENT_TOOL_CALL": content = `<strong>TOOL CALL</strong> [${data.data.source.name}]<p><strong>Tool:</strong> ${data.data.tool_name}</p><p><strong>Arguments:</strong><pre>${JSON.stringify(data.data.arguments, null, 2)}</pre></p>`; addLogEntry("event-AGENT_TOOL_CALL", content); break;
                case "AGENT_TOOL_RESPONSE": content = `<strong>TOOL RESPONSE</strong> [${data.data.source.name}]<p><strong>Result:</strong><pre>${JSON.stringify(data.data.result, null, 2)}</pre></p>`; addLogEntry("event-AGENT_TOOL_RESPONSE", content); break;
                case "AGENT_RESPONSE": content = `<strong>AGENT RESPONSE</strong> [${data.data.source.name}]<p>${data.data.content}</p>`; addLogEntry("event-AGENT_RESPONSE", content); break;
                case "FINAL_RESPONSE": content = `<strong>FINAL RESPONSE</strong> [${data.data.source.name}]<p>${data.data.content}</p>`; addLogEntry("event-FINAL_RESPONSE", content); break;
                case "ERROR": content = `<strong>ERROR</strong> [${data.data.source.name}]<p>${data.data.error_message}</p>`; addLogEntry("event-ERROR", content); break;
                default: content = `<strong>${data.type}</strong><pre>${JSON.stringify(data.data, null, 2)}</pre>`; addLogEntry("event-SYSTEM", content);
            }
        };
    }
    function disconnectWebSocket() { if (ws) { ws.close(); addLogEntry("event-SYSTEM", "Disconnected. Entering Design Mode."); } }
    form.addEventListener("submit", e => { e.preventDefault(); if (input.value && ws && ws.readyState === WebSocket.OPEN) { ws.send(input.value); input.value = ''; } });
    
    await fetchToolSchemas();
    
    editWorkflowBtn.addEventListener('click', () => setMode('design'));
    startChatBtn.addEventListener('click', () => setMode('chat'));
    document.getElementById('add-supervisor-btn').addEventListener('click', () => addNode('supervisor', 'Supervisor'));
    document.getElementById('add-agent-btn').addEventListener('click', () => addNode('agent', 'Agent'));
    document.getElementById('add-user-btn').addEventListener('click', () => addNode('user', 'User'));
    addToolBtn.addEventListener('click', () => addToolModal.style.display = 'flex');
    closeModalBtn.addEventListener('click', () => addToolModal.style.display = 'none');
    document.getElementById('add-mcp-btn').addEventListener('click', () => addNode('mcp', 'MCP Server'));
    
    setMode('design');
    loadDefaultWorkflow();
    addLogEntry("event-SYSTEM", "Welcome to XronAI Studio.");
});