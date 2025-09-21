document.addEventListener("DOMContentLoaded", () => {
    const sessionList = document.getElementById("session-list");
    const log = document.getElementById("log");
    const form = document.getElementById("form");
    const input = document.getElementById("input");
    const submitBtn = form.querySelector("button");
    const newChatBtn = document.getElementById("new-chat-btn");
    const deleteChatBtn = document.getElementById("delete-chat-btn");
    const sessionTitle = document.getElementById("session-title");

    let activeSessionId = null;
    let ws = null;

    // --- Core API Functions ---

    async function fetchSessions() {
        try {
            const response = await fetch("/api/v1/sessions");
            if (!response.ok) throw new Error("Failed to fetch sessions.");
            const data = await response.json();
            return data.sessions || [];
        } catch (error) {
            addSystemLogEntry("error", `Could not load session list: ${error.message}`);
            return [];
        }
    }

    async function createNewSession() {
        try {
            const response = await fetch("/api/v1/sessions", { method: "POST" });
            if (!response.ok) throw new Error("Failed to create a new session.");
            const data = await response.json();
            return data.session_id;
        } catch (error) {
            addSystemLogEntry("error", `Could not create new session: ${error.message}`);
            return null;
        }
    }

    async function fetchHistory(sessionId) {
        try {
            const response = await fetch(`/api/v1/sessions/${sessionId}/history`);
            if (!response.ok) throw new Error("Failed to fetch history.");
            const data = await response.json();
            return data;
        } catch (error) {
            addSystemLogEntry("error", `Could not load history for session ${sessionId}: ${error.message}`);
            return [];
        }
    }

    async function deleteSession(sessionId) {
        try {
            const response = await fetch(`/api/v1/sessions/${sessionId}`, { method: "DELETE" });
            if (!response.ok) throw new Error("Failed to delete session.");
            return true;
        } catch (error) {
            addSystemLogEntry("error", `Could not delete session ${sessionId}: ${error.message}`);
            return false;
        }
    }
    
    // --- UI Update Functions ---

    function addSystemLogEntry(type, content) {
        const entry = document.createElement("div");
        entry.className = `log-entry ${type}`;
        entry.innerHTML = `<p>${content}</p>`;
        log.appendChild(entry);
        log.scrollTop = log.scrollHeight;
    }
    
    // --- NEW: Richer log entry function ---
    function addMessageLogEntry(msg) {
        // Ignore system messages in the main log
        if (msg.role === 'system') return;

        let content = msg.content || "";
        let roleClass = msg.sender_type === 'user' ? 'user' : 'agent';
        let entryHTML = "";

        // Handle supervisor delegations and tool calls
        if (msg.role === 'assistant' && msg.tool_calls) {
            const toolCall = msg.tool_calls[0].function;
            const args = JSON.parse(toolCall.arguments);
            if (toolCall.name.startsWith("delegate_to_")) {
                const target = toolCall.name.replace("delegate_to_", "");
                entryHTML = `
                    <div class="message-bubble event">
                        <strong>DELEGATING</strong>
                        <p>From: <strong>${msg.sender_name}</strong> &rarr; <strong>${target}</strong></p>
                        <p class="reasoning"><em>"${args.reasoning}"</em></p>
                    </div>`;
            } else {
                 entryHTML = `
                    <div class="message-bubble event">
                        <strong>TOOL CALL</strong>
                        <p>Agent <strong>${msg.sender_name}</strong> is calling <strong>${toolCall.name}</strong></p>
                        <pre>${JSON.stringify(args, null, 2)}</pre>
                    </div>`;
            }
        } 
        // Handle direct user/agent messages
        else if (content) {
            entryHTML = `<div class="message-bubble">${content.replace(/\n/g, '<br>')}</div>`;
        }
        
        // Handle tool responses (which are a separate message)
        else if (msg.role === 'tool') {
             entryHTML = `
                <div class="message-bubble event">
                    <strong>TOOL RESPONSE</strong>
                    <p>From: <strong>${msg.sender_name}</strong></p>
                    <pre>${msg.content}</pre>
                </div>`;
        }

        if (!entryHTML) return; // Don't render empty entries

        const entry = document.createElement("div");
        entry.className = `log-entry ${roleClass}`;
        entry.innerHTML = entryHTML;
        
        if (msg.timestamp) {
            const time = document.createElement("div");
            time.className = "message-timestamp";
            time.textContent = new Date(msg.timestamp).toLocaleTimeString();
            entry.appendChild(time);
        }

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
            if (sessionId === currentId) {
                item.classList.add("active");
            }
            sessionList.appendChild(item);
        });
    }

    function clearChatView() {
        log.innerHTML = "";
    }
    
    // --- WebSocket Management ---

    function connectWebSocket(sessionId) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.close();
        }
        
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${protocol}//${window.location.host}/ws/sessions/${sessionId}`);

        ws.onopen = () => {
            addSystemLogEntry("system", "Connected to session.");
            input.disabled = false;
            submitBtn.disabled = false;
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.error) {
                addSystemLogEntry("error", data.error);
                return;
            }
            // The final response is just a plain agent/supervisor message
            const finalMessage = {
                role: 'assistant',
                sender_type: 'agent', // Generic fallback
                content: data.response,
                timestamp: data.timestamp
            };
            addMessageLogEntry(finalMessage);
        };

        ws.onclose = () => {
            addSystemLogEntry("system", "Connection closed.");
            input.disabled = true;
            submitBtn.disabled = true;
        };

        ws.onerror = (error) => {
            addSystemLogEntry("error", "WebSocket error. See console for details.");
            console.error("WebSocket Error:", error);
        };
    }

    // --- Event Handlers ---
    
    async function handleNewChat() {
        const newSessionId = await createNewSession();
        if (newSessionId) {
            await switchSession(newSessionId);
            const sessions = await fetchSessions();
            renderSessionList(sessions, newSessionId);
        }
    }

    async function switchSession(sessionId) {
        if (activeSessionId === sessionId) return;

        activeSessionId = sessionId;
        localStorage.setItem("xronai_active_session", sessionId);
        
        clearChatView();
        
        sessionTitle.textContent = `Session: ${sessionId.substring(0, 8)}`;
        deleteChatBtn.style.display = 'block';

        const history = await fetchHistory(sessionId);
        history.forEach(msg => addMessageLogEntry(msg));

        connectWebSocket(sessionId);
        const allSessions = await fetchSessions();
        renderSessionList(allSessions, sessionId);
    }
    
    async function handleDeleteChat() {
        if (!activeSessionId || !confirm("Are you sure you want to delete this entire chat session?")) {
            return;
        }
        const success = await deleteSession(activeSessionId);
        if (success) {
            addSystemLogEntry("system", `Session ${activeSessionId.substring(0,8)} deleted.`);
            activeSessionId = null;
            localStorage.removeItem("xronai_active_session");
            await initialize();
        }
    }

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const query = input.value.trim();
        if (query && ws && ws.readyState === WebSocket.OPEN) {
            const userMessage = {
                role: 'user',
                sender_type: 'user',
                content: query,
                timestamp: new Date().toISOString()
            };
            addMessageLogEntry(userMessage);
            ws.send(JSON.stringify({ query }));
            input.value = "";
        }
    });

    sessionList.addEventListener("click", (e) => {
        const item = e.target.closest(".session-item");
        if (item && item.dataset.sessionId) {
            switchSession(item.dataset.sessionId);
        }
    });
    
    newChatBtn.addEventListener("click", handleNewChat);
    deleteChatBtn.addEventListener("click", handleDeleteChat);

    // --- Initialization ---

    async function initialize() {
        const sessions = await fetchSessions();
        let lastSessionId = localStorage.getItem("xronai_active_session");

        if (lastSessionId && sessions.includes(lastSessionId)) {
            await switchSession(lastSessionId);
        } else if (sessions.length > 0) {
            await switchSession(sessions[0]);
        } else {
            renderSessionList([]);
            clearChatView();
            addSystemLogEntry("system", "Start a new conversation to begin.");
            sessionTitle.textContent = "No Active Session";
            deleteChatBtn.style.display = 'none';
            input.disabled = true;
            submitBtn.disabled = true;
        }
    }

    initialize();
});