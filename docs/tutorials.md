# Tutorials (from Examples)

The best way to learn XronAI is by exploring the hands-on examples provided in the repository. Each example is a self-contained script that demonstrates a specific feature of the framework.

We encourage you to read the code, run the examples, and modify them to get a deeper understanding.

### Core Concepts

*   **Standalone Agent with History:**
    [`agent_history_basic.py`](https://github.com/XronForce/xronai/blob/main/examples/agent_history_basic.py)
    <br>See the simplest use-case: a single agent that remembers your conversation.

*   **Hierarchical Structure:**
    [`hierarchical_structure.py`](https://github.com/XronForce/xronai/blob/main/examples/hierarchical_structure.py)
    <br>Learn how to nest Supervisors under a main Supervisor to create complex organizational charts.

*   **Loading History:**
    [`history_loading.py`](https://github.com/XronForce/xronai/blob/main/examples/history_loading.py)
    <br>Understand how to stop and resume a conversation with a workflow.

### Tool Usage

*   **Agent with Multiple Tools:**
    [`agent_tool_usage_benchmark.py`](https://github.com/XronForce/xronai/blob/main/examples/agent_tool_usage_benchmark.py)
    <br>A demonstration of how a supervisor can delegate to multiple agents, each with multiple tools, in a single turn.

*   **Connecting to Remote Tools (MCP):**
    [`agent_with_mcp_tools.py`](https://github.com/XronForce/xronai/blob/main/examples/agent_with_mcp_tools.py)
    <br>Learn how an agent can discover and use tools from a remote server.

### YAML Configuration

*   **Task Management System from YAML:**
    [`task_management_with_yaml/`](https://github.com/XronForce/xronai/tree/main/examples/task_management_with_yaml)
    <br>A complete example showing how to define a complex, multi-agent workflow entirely in a `config.yaml` file.