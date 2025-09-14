document.addEventListener("DOMContentLoaded", () => {
    const log = document.getElementById("log");
    const form = document.getElementById("form");
    const input = document.getElementById("input");

    // Establish WebSocket connection
    const ws = new WebSocket(`ws://${window.location.host}/ws`);

    function addLogEntry(className, content) {
        const entry = document.createElement("div");
        entry.className = `log-entry ${className}`;
        entry.innerHTML = content; // Using innerHTML to render bold tags
        log.appendChild(entry);
        // Auto-scroll to the bottom
        log.scrollTop = log.scrollHeight;
    }

    ws.onopen = () => {
        addLogEntry("event-SYSTEM", "Connection established. Ready to chat.");
    };

    ws.onclose = () => {
        addLogEntry("event-ERROR", "Connection closed. Please refresh the page.");
    };

    ws.onerror = (error) => {
        addLogEntry("event-ERROR", `WebSocket Error: ${error.message || 'Unknown error'}`);
    };

    // Listen for messages from the server
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        let content = '';

        // Format the log message based on the event type
        switch (data.type) {
            case "WORKFLOW_START":
                content = `<strong>USER QUERY</strong><p>${data.data.user_query}</p>`;
                addLogEntry("event-USER", content);
                break;
            case "SUPERVISOR_DELEGATE":
                content = `<strong>DELEGATING</strong> [${data.data.source.name} -> ${data.data.target.name}]
                           <p><strong>Reasoning:</strong> ${data.data.reasoning}</p>
                           <p><strong>Query:</strong> ${data.data.query_for_agent}</p>`;
                addLogEntry("event-SUPERVISOR_DELEGATE", content);
                break;
            case "AGENT_TOOL_CALL":
                content = `<strong>TOOL CALL</strong> [${data.data.source.name}]
                           <p><strong>Tool:</strong> ${data.data.tool_name}</p>
                           <p><strong>Arguments:</strong><pre>${JSON.stringify(data.data.arguments, null, 2)}</pre></p>`;
                addLogEntry("event-AGENT_TOOL_CALL", content);
                break;
            case "AGENT_TOOL_RESPONSE":
                content = `<strong>TOOL RESPONSE</strong> [${data.data.source.name}]
                           <p><strong>Result:</strong><pre>${data.data.result}</pre></p>`;
                addLogEntry("event-AGENT_TOOL_RESPONSE", content);
                break;
            case "AGENT_RESPONSE":
                content = `<strong>AGENT RESPONSE</strong> [${data.data.source.name}]
                           <p>${data.data.content}</p>`;
                addLogEntry("event-AGENT_RESPONSE", content);
                break;
            case "FINAL_RESPONSE":
                content = `<strong>FINAL RESPONSE</strong> [${data.data.source.name}]
                           <p>${data.data.content}</p>`;
                addLogEntry("event-FINAL_RESPONSE", content);
                break;
            case "ERROR":
                content = `<strong>ERROR</strong> [${data.data.source.name}]
                           <p>${data.data.error_message}</p>`;
                addLogEntry("event-ERROR", content);
                break;
            default:
                content = `<strong>${data.type}</strong><pre>${JSON.stringify(data.data, null, 2)}</pre>`;
                addLogEntry("event-SYSTEM", content);
        }
    };

    // Send a message when the form is submitted
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const message = input.value;
        if (message) {
            ws.send(message);
            input.value = '';
        }
    });
});