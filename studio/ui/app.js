document.addEventListener("DOMContentLoaded", () => {
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
    // Node Management and Configuration
    // =========================================================================
    
    // Add a default workflow for a better starting experience
    function loadDefaultWorkflow() {
        editor.clear();
        const userNode = { name: "user-entry", class: "user", data: {}, html: "User", typenode: false, inputs: {}, outputs: {"output_1":{"connections":[]}}, pos_x: 200, pos_y: 200};
        const agentNode = { name: "DefaultAgent", class: "agent", data: { system_message: "You are a helpful assistant." }, html: "DefaultAgent", typenode: false, inputs: {"input_1":{"connections":[]}}, outputs: {"output_1":{"connections":[]}}, pos_x: 500, pos_y: 200};
        
        const userNodeId = editor.addNode(userNode.name, 0, 1, userNode.pos_x, userNode.pos_y, userNode.class, userNode.data, userNode.html);
        const agentNodeId = editor.addNode(agentNode.name, 1, 1, agentNode.pos_x, agentNode.pos_y, agentNode.class, agentNode.data, agentNode.html);
        
        editor.addConnection(userNodeId, agentNodeId, "output_1", "input_1");
    }

    function addNode(type, title) {
        const nodeName = `${title}_${Math.floor(Math.random() * 1000)}`;
        const system_message = `You are the ${nodeName} ${type}.`;
        
        // Inputs/outputs based on type
        const inputs = (type === 'user') ? 0 : 1;
        const outputs = (type === 'tool' || type === 'mcp') ? 0 : 1;

        editor.addNode(nodeName, inputs, outputs, 300, 150, type, { system_message }, title);
    }
    
    editor.on('nodeSelected', id => {
        const node = editor.getNodeFromId(id);
        if (node.name === 'user-entry') {
            configurationView.innerHTML = `<div class="config-content"><div class="config-header"><span class="node-type-badge user">User</span><h2>User</h2></div><p>This is the entry point for the user's chat message.</p></div>`;
            return;
        }

        const systemMessage = node.data.system_message || `You are ${node.name}.`;
        configurationView.innerHTML = `
            <div class="config-content">
                <div class="config-header"><span class="node-type-badge ${node.class}">${node.class}</span><h2>${node.name}</h2></div>
                <div class="config-section"><h3>System Message</h3><textarea id="system-message-input" class="config-textarea">${systemMessage}</textarea></div>
                <div class="config-actions">
                     <button id="save-node-btn" class="action-btn save">Save Changes</button>
                     <button id="delete-node-btn" class="action-btn delete">Delete Node</button>
                </div>
            </div>`;
        
        document.getElementById('save-node-btn').addEventListener('click', () => {
            const newSystemMessage = document.getElementById('system-message-input').value;
            editor.updateNodeDataFromId(id, { system_message: newSystemMessage });
            alert('Node data updated locally. Compile to apply changes.');
        });
        document.getElementById('delete-node-btn').addEventListener('click', () => {
            if (confirm(`Delete node "${node.name}"?`)) {
                editor.removeNodeId(`node-${id}`);
                resetConfigPanel();
            }
        });
    });

    function resetConfigPanel() { configurationView.innerHTML = originalPlaceholder; }
    editor.on('nodeUnselected', resetConfigPanel);
    document.addEventListener('keydown', e => {
        if (e.key === 'Delete' && editor.selected_nodes.length > 0) {
            editor.removeNodeId(`node-${editor.selected_nodes[0]}`);
            resetConfigPanel();
        }
    });

    // =========================================================================
    // WebSocket Chat Logic
    // =========================================================================
    let ws = null;
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
            // Same message handling logic as before...
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

    // =========================================================================
    // Initialization
    // =========================================================================
    editWorkflowBtn.addEventListener('click', () => setMode('design'));
    startChatBtn.addEventListener('click', () => setMode('chat'));
    document.getElementById('add-supervisor-btn').addEventListener('click', () => addNode('supervisor', 'Supervisor'));
    document.getElementById('add-agent-btn').addEventListener('click', () => addNode('agent', 'Agent'));
    
    setMode('design');
    loadDefaultWorkflow();
    addLogEntry("event-SYSTEM", "Welcome to XronAI Studio. Design your workflow, then switch to Chat Mode.");
});