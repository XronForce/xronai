<div align="center">
  <a href="https://www.xron.ai/">
    <img src="examples/images/xronai-banner.png" alt="XronAI Banner">
  </a>
</div>

<p align="center">
  <a href="https://www.xron.ai/">
    <img src="https://img.shields.io/badge/website-xron.ai-blue.svg" alt="Website">
  </a>
  <a href="https://pypi.org/project/xronai/">
    <img src="https://img.shields.io/pypi/v/xronai.svg" alt="PyPI Version">
  </a>
  <a href="https://docs.xron.ai/">
    <img src="https://img.shields.io/badge/docs-view-brightgreen.svg" alt="Documentation">
  </a>
  <a href="https://opensource.org/licenses/MIT">
    <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License">
</p>

<div align="center">
  <h3>The Python SDK for building, orchestrating, and deploying powerful, agentic AI chatbots.</h3>
</div>

---

**XronAI** provides a robust, hierarchical framework to design and deploy complex AI systems. Define specialized AI **Agents** managed by intelligent **Supervisors/Orchestrator** to create sophisticated workflows. Whether you prefer building in Python, defining your system declaratively in YAML, or using a powerful no-code UI, XronAI provides the tools to bring your multi-agent vision to life.

## Key Features

*   **XronAI Studio:** A powerful web-based UI to visually design, test, and export complex agentic workflows without writing a single line of code.
*   **Hierarchical Architecture:** Go beyond single-agent setups. Design sophisticated workflows with Supervisors that delegate tasks to specialized Agents, enabling a clear separation of concerns.
*   **Declarative YAML Workflows:** Define your entire agentic workforce in clean, human-readable YAML files. This makes your systems easy to version control, share, and modify.
*   **One-Command Deployment:** Use the `xronai serve` command to instantly deploy your workflow as a API server, complete with an optional chat interface and session management.
*   **Extensible Tool System:** Equip your Agents with custom Python functions or pre-built capabilities.
*   **MCP Integration:** Seamlessly connect your agents to remote tools and services using the Model Context Protocol (MCP), enabling distributed and scalable systems.
*   **Persistent History & Memory:** Conversations are automatically logged and managed per session, providing your agents with a persistent memory of past interactions.

## Installation

You can install the core XronAI framework directly from PyPI:

```bash
pip install xronai
```

To include the powerful **XronAI Studio** and its dependencies, install the `studio` extra:

```bash
pip install xronai[studio]
```

## Quick Start: Your First Workflow

Before you begin, XronAI needs to know which LLM to use. Create a `.env` file in your project's root directory and add your credentials.

```env
LLM_MODEL="your-model-name"         # e.g., gpt-5-mini
LLM_API_KEY="your-api-key"
LLM_BASE_URL="your-api-base-url"    # e.g., https://api.openai.com/v1
```

Now, you are ready to build your first agentic workflow!

## Explore the Examples

The best way to learn XronAI is by diving into the hands-on examples provided in the repository. Each script is a self-contained demonstration of a specific feature.

#### Core Concepts

*   **Standalone Agent with History:** [`examples/agent_history_basic.py`](examples/agent_history_basic.py)  
    See the simplest use case: a single agent that remembers your conversation.
*   **Hierarchical Structure:** [`examples/hierarchical_structure.py`](examples/hierarchical_structure.py)  
    Learn how to nest Supervisors to create complex organizational charts for your agents.
*   **Loading Persistent History:** [`examples/history_loading.py`](examples/history_loading.py)  
    Understand how to stop and resume a conversation with a workflow.

#### Tool Usage

*   **Agent with Multiple Tools:** [`examples/agent_tool_usage_benchmark.py`](examples/agent_tool_usage_benchmark.py)  
    A demonstration of how a supervisor can delegate to multiple agents, each with multiple tools, in a single turn.
*   **Connecting to Remote Tools (MCP):** [`examples/agent_with_mcp_tools.py`](examples/agent_with_mcp_tools.py)  
    Learn how an agent can discover and use tools from a remote server using MCP.

#### YAML Configuration

*   **Task Management System from YAML:** [`examples/task_management_with_yaml/`](examples/task_management_with_yaml/)  
    A complete example showing how to define a complex, multi-agent workflow entirely in a `config.yaml` file.

---

## XronAI Studio

The easiest and most powerful way to get started with XronAI is by using the Studio. It's a web-based, drag-and-drop interface where you can visually design, configure, and test your agentic systems in real-time.

Launch the Studio with a simple command:

```bash
xronai studio
```

If you have an existing `workflow.yaml` file you'd like to edit, you can load it directly:

```bash
xronai studio --config path/to/your/workflow.yaml
```

### Design Mode

In Design Mode, you build the structure of your AI team. Drag nodes from the toolbar, configure their system messages and capabilities in the right-hand panel, and connect them to define the hierarchy of delegation.

![XronAI Studio Canvas](examples/images/xronai-studio-canvas.png)

### Chat Mode

Once you've designed your workflow, click the "Chat" button to compile it and interact with it immediately. Test your logic, see how the Supervisor delegates tasks, and debug your system in a live environment by switching between design and chat.

![XronAI Studio Chat](examples/images/xronai-studio-chat.png)

---

## XronAI Serve

After you've built and tested your workflow in the Studio and exported it as a YAML file, you can deploy it as a server with a single command.

```bash
xronai serve path/to/your/workflow.yaml
```

This starts a FastAPI server that exposes your workflow via API endpoints.

You can also serve it with a simple web-based chat UI and specify a directory to store all conversation histories:

```bash
xronai serve workflow.yaml --ui --history-dir my-chats
```

This makes it incredibly easy to integrate your XronAI system into any application or to provide a direct interface for users.

![XronAI Serve UI](examples/images/xronai-serve.png)

---

## Using the Python SDK

For those who prefer a code-first approach, the Python SDK offers full control and flexibility.

### Quick Start in Python

Here’s how to create a simple Supervisor-Agent hierarchy programmatically.

```python
import os
from dotenv import load_dotenv
from xronai import Supervisor, Agent

load_dotenv()

# LLM Configuration
llm_config = {
    "model": os.getenv("LLM_MODEL"),
    "api_key": os.getenv("LLM_API_KEY"),
    "base_url": os.getenv("LLM_BASE_URL"),
}

# Create a specialized agent
coder_agent = Agent(
    name="Coder",
    llm_config=llm_config,
    system_message="You are an expert Python programmer."
)

# Create a supervisor to manage the agent
supervisor = Supervisor(
    name="ProjectManager",
    llm_config=llm_config,
    system_message="You are a project manager. Delegate coding tasks to the Coder agent."
)

# Register the agent with the supervisor
supervisor.register_agent(coder_agent)

# Start chatting with your workflow
if __name__ == "__main__":
    supervisor.display_agent_graph()
    supervisor.start_interactive_session()

```

### YAML Configuration

You can also load a declarative YAML file directly into your Python application using the `AgentFactory`.

```python
import asyncio
from xronai.config import load_yaml_config, AgentFactory
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

async def main():
    # Load the workflow structure from the YAML file
    config = load_yaml_config("path/to/your/workflow.yaml")

    # The factory constructs the entire agent hierarchy
    supervisor = await AgentFactory.create_from_config(config)

    # Start chatting
    response = supervisor.chat("Write a Python function to add two numbers.")
    print(response)

if __name__ == "__main__":
    asyncio.run(main())
```

### History and Logging

XronAI automatically stores persistent chat history for each session (identified by a `workflow_id`). All interactions—from user queries to agent tool calls—are logged in a structured `history.jsonl` file within the session directory (by default, in `xronai_logs/`). This enables stateful conversations and provides excellent traceability.

### Loading Persistent Chat History

You can resume any previous conversation by manually loading the history into your re-instantiated workflow.

After setting up your Supervisor and Agent objects, use the `HistoryManager` with the session's `workflow_id` to load the chat history for each entity by its name.

```python
from xronai.history import HistoryManager

# Assume you have the ID of the session you want to resume
workflow_id = "your-existing-session-id"

# Re-create your agent and supervisor objects first
# ... (supervisor and agent setup code) ...

# Load the history for each entity
manager = HistoryManager(workflow_id)
supervisor.chat_history = manager.load_chat_history("SupervisorName")
agent.chat_history = manager.load_chat_history("AgentName")

# The workflow is now restored and ready to continue the conversation.
```

### Advanced Usage:

Go beyond basic workflows by equipping agents with tools, enforcing structured outputs, and building multi-level supervisor hierarchies.

#### Agents with Tools

Create specialized agents by giving them tools—Python functions they can call to perform actions.

```python
# Define a simple tool (a Python function)
def add_numbers(a: int, b: int) -> int:
    """Adds two numbers."""
    return a + b

# Describe the tool for the agent using OpenAI's format
add_tool_metadata = {
    "type": "function",
    "function": {
        "name": "add_numbers",
        "description": "A tool to add two integers.",
        "parameters": {
            "type": "object",
            "properties": {
                "a": {"type": "integer"},
                "b": {"type": "integer"}
            },
            "required": ["a", "b"]
        }
    }
}

# Create an agent and provide the tool
math_agent = Agent(
    name="MathAgent",
    llm_config=llm_config,
    tools=[{"tool": add_numbers, "metadata": add_tool_metadata}],
    system_message="You are a calculator. Use your tools to solve math problems.",
    use_tools=True
)

supervisor.register_agent(math_agent)
```

#### Structured Agent Outputs

Ensure reliable and predictable agent responses by defining a JSON schema for their output.

```python
# Define an output schema for a code-writing agent
code_schema = {
    "type": "object",
    "properties": {
        "description": {"type": "string", "description": "An explanation of the code"},
        "code": {"type": "string", "description": "The complete code implementation"},
        "language": {"type": "string"}
    },
    "required": ["description", "code", "language"]
}

# Create an agent that must adhere to the schema
code_agent = Agent(
    name="CodeWriter",
    llm_config=llm_config,
    system_message="You are a skilled programmer who only responds in JSON.",
    output_schema=code_schema,
    strict=True  # Guarantees the output will be valid JSON
)

# The agent's response is a schema-validated JSON string
response = code_agent.chat("Write a Python function to calculate factorial")
# {
#   "description": "This function calculates the factorial of a non-negative integer.",
#   "code": "def factorial(n):\n    if n == 0:\n        return 1\n    else:\n        return n * factorial(n-1)",
#   "language": "python"
# }
```

### MCP Server Integration

Connect your agents to external tools by leveraging the **Machine Communication Protocol (MCP)**. XronAI agents can automatically discover and use tools from remote HTTP servers or local subprocesses, allowing for a scalable and sandboxed tool architecture.

Simply define your tool servers in the `mcp_servers` list when creating an Agent.

```python
from xronai import Agent

# Define connections to your external tool servers
mcp_servers_config = [
    {
        "type": "sse",  # For remote, network-accessible tools
        "url": "https://remote.mcpservers.org/fetch",
        # "auth_token": "your-token" # Optional authentication
    },
    {
        "type": "stdio", # For local tools running safely as a subprocess
        "script_path": "path/to/your/weather_server.py"
    }
]

# The agent will automatically discover and gain the ability to use all
# tools from the configured servers.
tool_agent = Agent(
    name="ToolAgent",
    llm_config=llm_config,
    mcp_servers=mcp_servers_config,
    use_tools=True
)

# The agent can now use tools from both servers
response = tool_agent.chat("What are the weather alerts for NY?")
```

**Supported Transports:**

*   **`sse`**: Connects to a remote MCP server over HTTP. Requires the `url` of the SSE endpoint.
*   **`stdio`**: Runs a local Python script as a subprocess and communicates over stdin/stdout. Requires the `script_path`.

If the tools on your MCP server change while your application is running, you can refresh the agent's capabilities by calling:

```python
await tool_agent.update_mcp_tools()
```

For a complete, working example of a Supervisor managing multiple agents with different MCP transports, see the [multi-agent MCP example](examples/supervisor_multi_mcp/README.md).

---

## Future Work

XronAI is actively evolving from its roots as an agentic chatbot SDK into a comprehensive framework for general-purpose agentic automation. Our roadmap is focused on enabling more complex, autonomous, and collaborative AI systems.

*   **Autonomous Workflows:** We are enhancing the architecture to allow workflows to run fully autonomously. This includes transforming the `User` node into a generic **Trigger** node, enabling workflows to be initiated by events, API calls, or schedules, not just manual chat input.

*   **Parallel Task Execution:** We are implementing a true parallel execution model, allowing a Supervisor to delegate tasks to multiple agents concurrently. This will dramatically reduce latency and improve efficiency in complex, multi-step workflows.

*   **Shared Agent Workspace:** A common, stateful workspace is being developed that will allow agents to share files, artifacts, and status updates. This enables more sophisticated collaboration where agents can build upon each other's work asynchronously without direct delegation.

*   **Inter-Workflow Communication:** A new node type is being developed that will allow one XronAI workflow to trigger and pass data to another. This will enable the creation of complex, interconnected systems where different agent teams can collaborate to solve larger problems.

We are excited about the future of agentic AI and welcome community feedback and contributions!

---

## Acknowledgements

XronAI builds upon concepts and incorporates code from the [Nexus framework](https://github.com/PrimisAI/nexus), by PrimisAI. We gratefully acknowledge their foundational work and their contribution to the open-source community.
