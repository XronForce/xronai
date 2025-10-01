# Welcome to XronAI

**XronAI is a Python SDK for building, orchestrating, and deploying powerful, agentic AI chatbots.**

It provides a robust, hierarchical framework where you can define complex workflows with specialized AI **Agents** managed by intelligent **Supervisors**. Whether you prefer defining your workflows in code, through declarative YAML, or visually in a web UI, XronAI provides the tools to bring your multi-agent systems to life.

---

## Key Features

XronAI is built with a focus on structure, scalability, and ease of use. Here are some of the cool features that make it stand out:

*   **Hierarchical Agent Architecture:** Go beyond single agents. Design complex workflows with **Supervisors** that delegate tasks to specialized **Agents**, enabling sophisticated problem-solving and a clear separation of concerns.

*   **Declarative YAML Workflows:** Define your entire agentic workforce in a clean, human-readable YAML file. This makes your workflows easy to version control, share, and modify without changing any Python code.

*   **XronAI Studio (Visual Editor):** The crown jewel of the framework. `xronai studio` launches a powerful web-based UI where you can visually design, configure, and test your workflows by dragging, dropping, and connecting nodes.

*   **Extensible Tool System:** Equip your Agents with custom capabilities. XronAI has a simple and powerful system for adding tools, such as the built-in `TerminalTool` which gives your agent persistent access to a shell environment.

*   **MCP Integration:** Seamlessly connect your agents to remote tools and services using the Model Context Protocol (MCP), allowing for distributed and scalable agentic systems.

*   **Persistent History & Memory:** All conversations are automatically logged and managed, providing your agents with a persistent memory of past interactions within a session.

*   **Built-in Serving:** Once you've designed your workflow, use the `xronai serve` command to instantly deploy it as a production-ready API server, complete with an optional chat UI.

---

## Getting Started

Ready to build? You can get your first XronAI workflow running in just a few minutes.

### 1. Installation

Ensure you have installed the framework with the `studio` and `docs` dependencies:

```bash
pip install -e .[studio,docs]
```

### 2. Configure Your LLM

Create a `.env` file in the root of your project directory and add your LLM credentials. XronAI will automatically load these variables.

```env
LLM_MODEL="your-model-name"         # e.g., gpt-4
LLM_API_KEY="your-api-key"
LLM_BASE_URL="your-api-base-url"    # e.g., https://api.openai.com/v1
```

### 3. Choose Your Path

There are two great ways to start:

*   **Visually with XronAI Studio (Recommended):** This is the easiest way to understand the framework's power. Run the command below and open your browser to `http://127.0.0.1:8000`.
*   **By Exploring the Examples:** Dive into the code in the `/examples` directory to see pre-built workflows that demonstrate core features.

---

## The Command-Line Interface (CLI)

XronAI comes with a powerful CLI to streamline your development and deployment process.

### `xronai studio`

This command launches the visual editor, a web-based interface for building and interacting with your agentic workflows.

**Usage:**

```bash
# Start the studio on the default port (8000)
xronai studio

# Start the studio and automatically load an existing workflow file
xronai studio --config path/to/your/workflow.yaml
```

From the Studio, you can:
- Drag and drop Agents, Supervisors, and Tools.
- Connect them to define the workflow hierarchy.
- Configure the system messages and parameters for each node.
- Chat with your workflow in real-time.
- Export your visual design to a `workflow.yaml` file for deployment.

### `xronai serve`

This command takes a `workflow.yaml` file and exposes it as a robust API server. This is the path to production.

**Usage:**

```bash
# Serve a workflow file on the default port (8001)
xronai serve path/to/your/workflow.yaml

# Serve the workflow and enable a simple web-based chat UI
xronai serve path/to/your/workflow.yaml --ui
```

The server provides endpoints for creating sessions and interacting with your workflow, making it easy to integrate into any application.
