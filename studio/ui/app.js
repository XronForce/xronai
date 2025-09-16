document.addEventListener("DOMContentLoaded", () => {
    const studioContainer = document.querySelector(".studio-container");
    const editWorkflowBtn = document.getElementById("edit-workflow-btn");
    const startChatBtn = document.getElementById("start-chat-btn");
    const resizer = document.querySelector(".resizer");
    const workspacePanel = document.querySelector(".workspace-panel");
    const contextualPanel = document.querySelector(".contextual-panel");
    const log = document.getElementById("log");
    const form = document.getElementById("form");
    const input = document.getElementById("input");
    
    addLogEntry("event-SYSTEM", "Welcome to XronAI Studio. Please switch to Chat Mode to connect.");
    
    // =========================================================================
    // 1. CANVAS/DRAWFLOW SETUP
    // =========================================================================
    console.log("[DEBUG] 1. Script start. Preparing to create Drawflow editor.");
    const canvasElement = document.getElementById('drawflow');
    const editor = new Drawflow(canvasElement);
    console.log("[DEBUG] 2. Drawflow object created:", editor);
    
    editor.reroute = true;
    editor.reroute_fix_curvature = true;
    editor.force_first_input = false;
    
    editor.start();
    console.log("[DEBUG] 3. editor.start() has been called.");

    // =========================================================================
    // 2. WORKFLOW LOADING AND RENDERING
    // =========================================================================
    async function loadAndRenderWorkflow() {
        console.log("[DEBUG] 5. loadAndRenderWorkflow() function has started.");
        try {
            const response = await fetch('/api/v1/workflow');
            if (!response.ok) {
                throw new Error(`Failed to fetch workflow: ${response.statusText}`);
            }
            const graph = await response.json();
            console.log("[DEBUG] 6. Received workflow data from backend:", graph);

            editor.clear();

            if (graph.nodes && graph.nodes.length > 0) {
                console.log("[DEBUG] 7. Starting to add nodes to canvas...");
                graph.nodes.forEach(node => {
                    const icon = node.data.title.charAt(0);
                    const content = `<div class="node-content"><div class="node-icon">${icon}</div><div class="node-text"><div class="node-title">${node.data.title}</div><div class="node-subtitle">${node.data.subtitle}</div></div></div>`;
                    let inputs = 0, outputs = 0;
                    switch (node.type) {
                        case 'supervisor': inputs = 1; outputs = 1; break;
                        case 'agent': inputs = 1; outputs = 1; break;
                        case 'user': inputs = 0; outputs = 1; break;
                        case 'tool': case 'mcp': inputs = 1; outputs = 0; break;
                    }
                    editor.addNode(node.id, inputs, outputs, node.pos_x, node.pos_y, node.type, {}, content);
                });
                console.log("[DEBUG] 8. Finished adding nodes.");

                graph.edges.forEach(edge => {
                    const sourceNode = editor.getNodeFromId(editor.getNodesFromName(edge.source)[0]);
                    const targetNode = editor.getNodeFromId(editor.getNodesFromName(edge.target)[0]);
                    if (sourceNode && targetNode) {
                        editor.addConnection(sourceNode.id, targetNode.id, 'output_1', 'input_1');
                    }
                });
                console.log("[DEBUG] 9. Finished adding connections.");
            } else {
                 console.log("[DEBUG] 7. No nodes to render.");
            }
        } catch (error) {
            console.error("Error loading workflow:", error);
            addLogEntry("event-ERROR", `Could not load workflow graph: ${error.message}`);
        }
    }

    // =========================================================================
    // 3. MODE SWITCHING LOGIC
    // =========================================================================
    function setMode(mode) {
        if (mode === 'chat') {
            studioContainer.classList.add('chat-mode');
            startChatBtn.classList.add('active');
            editWorkflowBtn.classList.remove('active');
            setCanvasLock(true);
            connectWebSocket();
        } else { // 'design' mode
            studioContainer.classList.remove('chat-mode');
            editWorkflowBtn.classList.add('active');
            startChatBtn.classList.remove('active');
            setCanvasLock(false);
            disconnectWebSocket();
        }
    }
    editWorkflowBtn.addEventListener('click', () => setMode('design'));
    startChatBtn.addEventListener('click', () => setMode('chat'));
    
    function setCanvasLock(isLocked) {
        editor.editor_mode = isLocked ? 'fixed' : 'edit';
    }

    // =========================================================================
    // 4. PANEL RESIZING LOGIC
    // =========================================================================
    let isResizing = false;
    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';
        const startX = e.clientX;
        const startWorkspaceWidth = workspacePanel.offsetWidth;
        function handleMouseMove(e) {
            if (!isResizing) return;
            const deltaX = e.clientX - startX;
            const newWorkspaceWidth = startWorkspaceWidth + deltaX;
            const totalWidth = studioContainer.offsetWidth;
            const newWorkspacePercentage = (newWorkspaceWidth / totalWidth) * 100;
            workspacePanel.style.width = `${newWorkspacePercentage}%`;
            contextualPanel.style.width = `${100 - newWorkspacePercentage}%`;
        }
        function handleMouseUp() {
            isResizing = false;
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        }
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    });

    // =========================================================================
    // 5. WEBSOCKET CHAT LOGIC
    // =========================================================================
    let ws = null;
    function connectWebSocket() {
        if (ws && ws.readyState === WebSocket.OPEN) return;
        ws = new WebSocket(`ws://${window.location.host}/ws`);
        ws.onopen = () => addLogEntry("event-SYSTEM", "Connection established. Ready to chat.");
        ws.onclose = () => {
            if (studioContainer.classList.contains('chat-mode')) {
                 addLogEntry("event-ERROR", "Connection closed. Please refresh or try re-entering Chat Mode.");
            }
            ws = null;
        };
        ws.onerror = () => addLogEntry("event-ERROR", `WebSocket Error: Could not connect to the server.`);
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
    function disconnectWebSocket() {
        if (ws) {
            ws.close();
            addLogEntry("event-SYSTEM", "Connection closed. Entering Design Mode.");
        }
    }
    function addLogEntry(className, content) {
        const entry = document.createElement("div");
        entry.className = `log-entry ${className}`;
        entry.innerHTML = content;
        log.appendChild(entry);
        log.scrollTop = log.scrollHeight;
    }
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const message = input.value;
        if (message && ws && ws.readyState === WebSocket.OPEN) {
            ws.send(message);
            input.value = '';
        } else if (!ws || ws.readyState !== WebSocket.OPEN) {
            addLogEntry("event-ERROR", "Cannot send message. Not connected.");
        }
    });

    // =========================================================================
    // 6. TOOLBAR & NODE CREATION LOGIC
    // =========================================================================
    const addSupervisorBtn = document.getElementById('add-supervisor-btn');
    const addAgentBtn = document.getElementById('add-agent-btn');
    const addUserBtn = document.getElementById('add-user-btn');
    const addToolBtn = document.getElementById('add-tool-btn');
    const addMcpBtn = document.getElementById('add-mcp-btn');
    
    let nodeCounter = 0;

    addSupervisorBtn.addEventListener('click', () => addNode('supervisor', 'Supervisor', 'Manages agents'));
    addAgentBtn.addEventListener('click', () => addNode('agent', 'Agent', 'Performs tasks'));
    addUserBtn.addEventListener('click', () => addNode('user', 'User', 'Workflow entry point'));
    addToolBtn.addEventListener('click', () => addNode('tool', 'Tool', 'Executes a function'));
    addMcpBtn.addEventListener('click', () => addNode('mcp', 'MCP Server', 'Connects to remote tools'));

    function addNode(type, title, subtitle) {
        if (editor.editor_mode === 'fixed') return;

        nodeCounter++;
        const nodeName = `${title}_${nodeCounter}`; 
        const icon = title.charAt(0);

        const content = `
            <div class="node-content">
                <div class="node-icon">${icon}</div>
                <div class="node-text">
                    <div class="node-title">${title}</div>
                    <div class="node-subtitle">${subtitle}</div>
                </div>
            </div>
        `;
        
        let inputs = 0, outputs = 0;
        switch (type) {
            case 'supervisor': inputs = 1; outputs = 1; break;
            case 'agent': inputs = 1; outputs = 1; break;
            case 'user': inputs = 0; outputs = 1; break;
            case 'tool': case 'mcp': inputs = 1; outputs = 0; break;
        }

        editor.addNode(nodeName, inputs, outputs, 150, 50, type, {}, content);
    }
    
    // =========================================================================
    // 7. INITIALIZATION
    // =========================================================================
    setMode('design');
    
    console.log("[DEBUG] 4. Calling setTimeout to queue workflow loading.");
    setTimeout(() => {
        loadAndRenderWorkflow();
    }, 0);
});