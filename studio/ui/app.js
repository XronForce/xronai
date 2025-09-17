// FILE: studio/ui/app.js

document.addEventListener("DOMContentLoaded", () => {
    // --- Initial Setup ---
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

    // Helper to generate a simple UUID
    const uuidv4 = () => ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));

    function addLogEntry(className, content) {
        const entry = document.createElement("div");
        entry.className = `log-entry ${className}`;
        entry.innerHTML = content;
        log.appendChild(entry);
        log.scrollTop = log.scrollHeight;
    }

    // =========================================================================
    // Core Logic: The "Compile on Demand" model
    // =========================================================================
    function setMode(mode) {
        if (mode === 'chat') {
            compileAndStartChat();
        } else { // 'design' mode
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

    // =========================================================================
    // Node Management and Full Configuration Panel
    // =========================================================================
    function loadDefaultWorkflow() {
        editor.clear();
        // The name is now part of the data object
        const userData = { uuid: 'user-entry-uuid', name: 'User' };
        const agentData = { uuid: uuidv4(), name: 'DefaultAgent', system_message: 'You are a helpful assistant.', keep_history: true };

        const userNodeId = editor.addNode('User', 0, 1, 200, 200, 'user', userData, 'User');
        const agentNodeId = editor.addNode('DefaultAgent', 1, 1, 500, 200, 'agent', agentData, 'DefaultAgent');
        
        editor.addConnection(userNodeId, agentNodeId, "output_1", "input_1");
    }

    function addNode(type, title) {
        const baseName = `${title}_${Math.floor(Math.random() * 1000)}`;
        const nodeData = {
            uuid: uuidv4(),
            name: baseName,
            system_message: `You are the ${baseName} ${type}.`,
            // Set sensible defaults
            use_agents: true,
            keep_history: true,
            output_schema: "",
            strict: false,
        };
        const inputs = (type === 'user') ? 0 : 1;
        const outputs = (type === 'tool' || type === 'mcp') ? 0 : 1;
        editor.addNode(baseName, inputs, outputs, 300, 150, type, nodeData, title);
    }
    
    editor.on('nodeSelected', id => {
        const node = editor.getNodeFromId(id);
        const nodeData = node.data;

        if (node.class === 'user') {
            configurationView.innerHTML = `<div class="config-content"><div class="config-header"><span class="node-type-badge user">User</span><h2>User</h2></div><p>This is the entry point for the user's chat message.</p></div>`;
            return;
        }

        // Build the configuration panel HTML dynamically
        let panelHtml = `
            <div class="config-content">
                <div class="config-header">
                    <span class="node-type-badge ${node.class}">${node.class}</span>
                </div>
                <div class="config-section">
                    <h3>Name</h3>
                    <input type="text" id="node-name-input" class="config-input" value="${nodeData.name || ''}">
                </div>
                <div class="config-section">
                    <h3>System Message</h3>
                    <textarea id="system-message-input" class="config-textarea">${nodeData.system_message || ''}</textarea>
                </div>
        `;

        if (node.class === 'supervisor') {
            panelHtml += `
                <div class="config-section toggle-section">
                    <label for="use-agents-toggle">Can Respond Directly</label>
                    <input type="checkbox" id="use-agents-toggle" class="toggle-switch" ${nodeData.use_agents ? 'checked' : ''}>
                </div>
            `;
        }

        if (node.class === 'agent') {
            panelHtml += `
                <div class="config-section toggle-section">
                    <label for="keep-history-toggle">Remember History</label>
                    <input type="checkbox" id="keep-history-toggle" class="toggle-switch" ${nodeData.keep_history ? 'checked' : ''}>
                </div>
                <div class="config-section">
                    <h3>Enforce Output Schema (JSON)</h3>
                    <textarea id="output-schema-input" class="config-textarea" placeholder='e.g., {"type": "object", "properties": ...}'>${nodeData.output_schema || ''}</textarea>
                </div>
                <div class="config-section toggle-section" id="strict-mode-container" style="display: ${nodeData.output_schema ? 'flex' : 'none'};">
                     <label for="strict-mode-toggle">Strict Mode</label>
                     <input type="checkbox" id="strict-mode-toggle" class="toggle-switch" ${nodeData.strict ? 'checked' : ''}>
                </div>
            `;
        }

        panelHtml += `
                <div class="config-actions">
                     <button id="save-node-btn" class="action-btn save">Save Changes</button>
                     <button id="delete-node-btn" class="action-btn delete">Delete Node</button>
                </div>
            </div>
        `;
        
        configurationView.innerHTML = panelHtml;

        // Add event listeners
        const saveBtn = document.getElementById('save-node-btn');
        const deleteBtn = document.getElementById('delete-node-btn');
        const schemaInput = document.getElementById('output-schema-input');
        const strictContainer = document.getElementById('strict-mode-container');

        if (schemaInput) {
            schemaInput.addEventListener('input', () => {
                strictContainer.style.display = schemaInput.value.trim() ? 'flex' : 'none';
            });
        }
        
        saveBtn.addEventListener('click', () => {
            const newName = document.getElementById('node-name-input').value;
            if (!newName.trim()) {
                alert("Node name cannot be empty.");
                return;
            }

            // Collect all data from the form
            const updatedData = {
                uuid: nodeData.uuid, // Preserve the UUID
                name: newName,
                system_message: document.getElementById('system-message-input').value,
            };

            if (node.class === 'supervisor') {
                updatedData.use_agents = document.getElementById('use-agents-toggle').checked;
            }
            if (node.class === 'agent') {
                updatedData.keep_history = document.getElementById('keep-history-toggle').checked;
                updatedData.output_schema = document.getElementById('output-schema-input').value;
                updatedData.strict = document.getElementById('strict-mode-toggle').checked;
            }
            
            // Update the node's name (label) and its internal data
            editor.updateNodeDataFromId(id, updatedData);
            editor.updateNodeValue(id, newName); // Updates the title bar of the node
            
            alert('Node data updated locally. Compile to apply changes.');
        });
        
        deleteBtn.addEventListener('click', () => {
            if (confirm(`Delete node "${nodeData.name}"?`)) {
                editor.removeNodeId(`node-${id}`);
                resetConfigPanel();
            }
        });
    });

    function resetConfigPanel() { configurationView.innerHTML = originalPlaceholder; }
    editor.on('nodeUnselected', resetConfigPanel);

    // =========================================================================
    // WebSocket Chat, Initialization, etc. (Mostly Unchanged)
    // =========================================================================
    let ws = null;
    function connectWebSocket() { /* ... same as before ... */ }
    function disconnectWebSocket() { /* ... same as before ... */ }
    
    // ... Paste the full WebSocket and form submission logic here from the previous version ...
    // The WebSocket logic remains the same.
    function connectWebSocket() {
        if (ws && ws.readyState === WebSocket.OPEN) return;
        ws = new WebSocket(`ws://${window.location.host}/ws`);
        ws.onopen = () => addLogEntry("event-SYSTEM", "Connection established. Ready to chat.");
        ws.onclose = (event) => {
            if (studioContainer.classList.contains('chat-mode')) {
                addLogEntry("event-ERROR", `Connection closed unexpectedly. Reason: ${event.reason || "Unknown"}`);
            }
            ws = null;
        };
        ws.onerror = () => addLogEntry("event-ERROR", `WebSocket Error: Could not connect.`);
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            let content = '';
            switch (data.type) {
                case "WORKFLOW_START": content = `<strong>USER QUERY</strong><p>${data.data.user_query}</p>`; addLogEntry("event-USER", content); break;
                case "SUPERVISOR_DELEGATE": content = `<strong>DELEGATING</strong> [${data.data.source.name} → ${data.data.target.name}]<p><strong>Reasoning:</strong> ${data.data.reasoning}</p><p><strong>Query:</strong> ${data.data.query_for_agent}</p>`; addLogEntry("event-SUPERVISOR_DELEGATE", content); break;
                case "AGENT_TOOL_CALL": content = `<strong>TOOL CALL</strong> [${data.data.source.name}]<p><strong>Tool:</strong> ${data.data.tool_name}</p><p><strong>Arguments:</strong><pre>${JSON.stringify(data.data.arguments, null, 2)}</pre></p>`; addLogEntry("event-AGENT_TOOL_CALL", content); break;
                case "AGENT_TOOL_RESPONSE": content = `<strong>TOOL RESPONSE</strong> [${data.data.source.name}]<p><strong>Result:</strong><pre>${data.data.result}</pre></p>`; addLogEntry("event-AGENT_TOOL_RESPONSE", content); break;
                case "AGENT_RESPONSE": content = `<strong>AGENT RESPONSE</strong> [${data.data.source.name}]<p>${data.data.content}</p>`; addLogEntry("event-AGENT_RESPONSE", content); break;
                case "FINAL_RESPONSE": content = `<strong>FINAL RESPONSE</strong> [${data.data.source.name}]<p>${data.data.content}</p>`; addLogEntry("event-FINAL_RESPONSE", content); break;
                case "ERROR": content = `<strong>ERROR</strong> [${data.data.source.name}]<p>${data.data.error_message}</p>`; addLogEntry("event-ERROR", content); break;
                default: content = `<strong>${data.type}</strong><pre>${JSON.stringify(data.data, null, 2)}</pre>`; addLogEntry("event-SYSTEM", content);
            }
        };
    }
    function disconnectWebSocket() { if (ws) { ws.close(); addLogEntry("event-SYSTEM", "Disconnected. Entering Design Mode."); } }
    form.addEventListener("submit", e => {
        e.preventDefault();
        if (input.value && ws && ws.readyState === WebSocket.OPEN) { ws.send(input.value); input.value = ''; }
    });

    // --- Initialization ---
    editWorkflowBtn.addEventListener('click', () => setMode('design'));
    startChatBtn.addEventListener('click', () => setMode('chat'));
    document.getElementById('add-supervisor-btn').addEventListener('click', () => addNode('supervisor', 'Supervisor'));
    document.getElementById('add-agent-btn').addEventListener('click', () => addNode('agent', 'Agent'));
    
    setMode('design');
    loadDefaultWorkflow();
    addLogEntry("event-SYSTEM", "Welcome to XronAI Studio. Design your workflow, then switch to Chat Mode.");
});