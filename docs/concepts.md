# Core Concepts

Understanding the design philosophy of XronAI is key to leveraging its full potential. The framework is built on a few core concepts that enable the creation of complex and robust agentic systems.

## The Hierarchy: Agents and Supervisors

The fundamental principle of XronAI is the separation of concerns, achieved through a hierarchical structure of two primary entity types: Agents and Supervisors.

### Agent

An **Agent** is the primary worker in the XronAI ecosystem. It is a specialized AI entity designed to perform a specific set of tasks.

-   **Specialized:** An Agent should be given a clear and focused role (e.g., "You are a professional Python programmer," "You are an expert at analyzing financial data").
-   **Tool-Enabled:** Agents are the only entities that can directly use **Tools** (like the `TerminalTool` or custom functions) to interact with the outside world.
-   **Executors:** They receive direct instructions (a `query` and `context`) from a Supervisor and are expected to execute them to the best of their ability.

### Supervisor

A **Supervisor** is a manager. It does not perform tasks itself but instead orchestrates other Agents and even other Supervisors.

-   **Orchestrator:** A Supervisor's main role is to analyze an incoming request and delegate it to the most appropriate subordinate.
-   **Context Provider:** It is responsible for gathering and providing all the necessary context for an Agent to successfully complete its task.
-   **Decision Maker:** Based on the results from its Agents, a Supervisor can decide the next step, delegate to another agent, or synthesize a final answer.

This hierarchical model allows you to build AI systems that mirror real-world teams, leading to more modular, maintainable, and scalable solutions.

## Declarative First

Whenever possible, XronAI encourages defining workflows declaratively in **YAML**. This approach separates the "what" (the structure and logic of your agent team) from the "how" (the underlying Python code), making your systems easier to understand and iterate on.

## The Power of XronAI Studio

**XronAI Studio** is the ultimate expression of this philosophy. It is a visual layer on top of the declarative YAML structure, allowing you to build, test, and export complex agentic systems without writing a single line of code, bridging the gap between idea and implementation.