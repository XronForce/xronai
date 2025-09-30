document.addEventListener("DOMContentLoaded", () => {
    // --- DOM Elements ---
    const sessionList = document.getElementById("session-list");
    const log = document.getElementById("log");
    const form = document.getElementById("form");
    const input = document.getElementById("input");
    const sendBtn = document.querySelector(".send-btn");
    const newChatBtn = document.getElementById("new-chat-btn");
    const deleteChatBtn = document.getElementById("delete-chat-btn");
    const sessionTitle = document.getElementById("session-title");
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const sunIcon = document.getElementById('theme-icon-sun');
    const moonIcon = document.getElementById('theme-icon-moon');
    const connectionStatus = document.getElementById('connection-status');

    // --- State ---
    let activeSessionId = null;
    let ws = null;

    // --- Theme Management ---
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

    // --- Core API Functions ---
    async function fetchAPI(url, options = {}) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) throw new Error(`API Error (${response.status})`);
            if (response.status === 204) return null;
            return response.json();
        } catch (error) {
            updateConnectionStatus('disconnected', `Network Error: ${error.message}`);
            throw error;
        }
    }

    // --- UI Update & Rendering ---
    function updateConnectionStatus(status, message) {
        connectionStatus.classList.remove('connected', 'disconnected');
        if (status === 'connected') {
            connectionStatus.classList.add('connected');
            connectionStatus.textContent = message || 'Live connection established.';
        } else if (status === 'disconnected') {
            connectionStatus.classList.add('disconnected');
            connectionStatus.textContent = message || 'Connection closed.';
        } else {
            connectionStatus.textContent = message || '';
        }
    }

    /*
    function addThinkingIndicator() {
        if (document.getElementById('thinking-indicator')) return;
        const entry = document.createElement("div");
        entry.id = "thinking-indicator";
        entry.className = "log-entry agent";
        entry.innerHTML = `<div class="message-header"><span class="message-icon">${document.getElementById('icon-agent').innerHTML}</span></div><div class="message-bubble"><div class="typing-indicator"><span></span><span></span><span></span></div></div>`;
        log.appendChild(entry);
        log.scrollTop = log.scrollHeight;
    }
    */

    function renderWorkflowEvent(event) {
        if (!event) return;
        const { type, data } = event;
        let title, content, source, icon, role = 'agent';

        switch (type) {
            case "WORKFLOW_START":
                title = "You"; content = data.user_query; icon = document.getElementById('icon-user').innerHTML; role = 'user'; break;
            case "SUPERVISOR_DELEGATE":
                title = `Delegate to ${data.target.name}`; content = `**Reasoning:** ${data.reasoning}\n\n**Query:** ${data.query_for_agent}`; source = data.source.name; icon = document.getElementById('icon-delegate').innerHTML; break;
            case "AGENT_TOOL_CALL":
                title = `Tool Call: ${data.tool_name}`; content = `**Arguments:**\n\`\`\`json\n${JSON.stringify(data.arguments, null, 2)}\n\`\`\``; source = data.source.name; icon = document.getElementById('icon-tool-call').innerHTML; break;
            case "AGENT_TOOL_RESPONSE":
                title = `Tool Response`; content = `\`\`\`\n${typeof data.result === 'object' ? JSON.stringify(data.result, null, 2) : data.result}\n\`\`\``; source = data.source.name; icon = document.getElementById('icon-tool-call').innerHTML; break;
            case "AGENT_RESPONSE":
                title = `Agent Response`; content = data.content; source = data.source.name; icon = document.getElementById('icon-agent').innerHTML; break;
            case "FINAL_RESPONSE":
                title = "Final Response"; content = data.content; source = data.source.name; icon = document.getElementById('icon-final-response').innerHTML; break;
            case "ERROR":
                title = `Error from ${data.source.name}`; content = data.error_message; icon = document.getElementById('icon-error').innerHTML; break;
            default: return;
        }
        addLogEntry({ icon, title, content, source, role });
    }

    function addLogEntry({ icon, title, content, source, role }) {
        const entry = document.createElement("div");
        entry.className = `log-entry ${role}`;
        const sourceHtml = source ? `<span class="source-name">${source}</span>` : '';
        const formattedContent = content ? marked.parse(content) : '';
        entry.innerHTML = `<div class="message-header"><span class="message-icon">${icon}</span><strong class="message-title">${title}</strong>${sourceHtml}</div><div class="message-bubble">${formattedContent}</div>`;
        log.appendChild(entry);
        log.scrollTop = log.scrollHeight;
    }

    function renderSessionList(sessions, currentId) {
        sessionList.innerHTML = "";
        sessions.forEach(sessionId => {
            const item = document.createElement("div");
            item.className = "session-item";
            item.textContent = `Session ${sessionId.substring(0, 8)}`;
            item.dataset.sessionId = sessionId;
            if (sessionId === currentId) item.classList.add("active");
            item.addEventListener('click', () => switchSession(sessionId));
            sessionList.appendChild(item);
        });
    }

    // --- WebSocket & Session Management ---
    function connectWebSocket(sessionId) {
        if (ws && ws.readyState === WebSocket.OPEN) ws.close();
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${protocol}//${window.location.host}/ws/sessions/${sessionId}`);

        ws.onopen = () => {
            updateConnectionStatus('connected');
            input.disabled = false;
            sendBtn.disabled = false;
            input.focus();
        };
        
        ws.onmessage = (event) => {
            // document.getElementById('thinking-indicator')?.remove();
            const eventData = JSON.parse(event.data);
            if (eventData.type === "WORKFLOW_START") return; // Ignore server echo of user message
            if (eventData.type === "WORKFLOW_END") return;
            renderWorkflowEvent(eventData);
        };

        ws.onclose = () => {
            updateConnectionStatus('disconnected');
            input.disabled = true;
            sendBtn.disabled = true;
        };
        ws.onerror = () => {
            updateConnectionStatus('disconnected', 'WebSocket connection error.');
        };
    }

    async function switchSession(sessionId) {
        if (activeSessionId === sessionId) return;
        activeSessionId = sessionId;
        localStorage.setItem("xronai-active_session", sessionId);
        log.innerHTML = "";
        sessionTitle.textContent = `Session: ${sessionId.substring(0, 8)}`;
        deleteChatBtn.style.display = 'block';

        const historicalEvents = await fetchAPI(`/api/v1/sessions/${sessionId}/history`);
        if (historicalEvents) historicalEvents.forEach(event => renderWorkflowEvent(event));

        connectWebSocket(sessionId);
        const allSessions = await fetchAPI("/api/v1/sessions");
        if (allSessions) renderSessionList(allSessions.sessions, sessionId);
    }

    async function handleNewChat() {
        const newSession = await fetchAPI("/api/v1/sessions", { method: "POST" });
        if (newSession) {
            await initialize(); // Re-initialize to pick up the new session and switch to it
        }
    }
    
    async function handleDeleteChat() {
        if (!activeSessionId || !confirm("Are you sure you want to delete this chat session?")) return;
        await fetchAPI(`/api/v1/sessions/${activeSessionId}`, { method: "DELETE" });
        activeSessionId = null;
        localStorage.removeItem("xronai-active_session");
        await initialize();
    }

    // --- Event Listeners & Init ---
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const query = input.value.trim();
        if (query && ws && ws.readyState === WebSocket.OPEN) {
            renderWorkflowEvent({ type: 'WORKFLOW_START', data: { user_query: query }});
            ws.send(JSON.stringify({ query }));
            input.value = "";
            input.style.height = 'auto';
            // addThinkingIndicator();
        }
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            form.dispatchEvent(new Event('submit'));
        }
    });

    input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = `${input.scrollHeight}px`;
    });
    
    newChatBtn.addEventListener("click", handleNewChat);
    deleteChatBtn.addEventListener("click", handleDeleteChat);

    async function initialize() {
        const data = await fetchAPI("/api/v1/sessions");
        const sessions = data ? data.sessions : [];
        let lastSessionId = localStorage.getItem("xronai-active_session");

        if (lastSessionId && sessions.includes(lastSessionId)) {
            await switchSession(lastSessionId);
        } else if (sessions.length > 0) {
            await switchSession(sessions[0]);
        } else {
            renderSessionList([]);
            log.innerHTML = "";
            sessionTitle.textContent = "No Active Session";
            deleteChatBtn.style.display = 'none';
            input.disabled = true;
            sendBtn.disabled = true;
            updateConnectionStatus('disconnected', "Start a new conversation to begin.");
        }
    }

    initialize();
});