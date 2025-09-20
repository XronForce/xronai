"""
Example demonstrating complete configuration capabilities including:
- Output schemas
- MCP servers
- Strict mode
- Hierarchical structure
"""

import os, sys
import asyncio
from pathlib import Path
from dotenv import load_dotenv

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from src.xronai.config import load_yaml_config, AgentFactory

# Load environment variables
load_dotenv()


def print_json_response(response: str, title: str = None):
    """Helper function to pretty print JSON responses"""
    import json
    from pprint import pprint

    if title:
        print(f"\n=== {title} ===")
    try:
        parsed = json.loads(response)
        print("\nFormatted Response:")
        pprint(parsed, indent=2, width=80)
    except json.JSONDecodeError:
        print("\nPlain Response:")
        print(response)
    print("\n" + "=" * 50)


def ensure_workflow_directory(workflow_id: str):
    """Ensure workflow directory exists"""
    workflow_path = Path("xronai_logs") / workflow_id
    workflow_path.mkdir(parents=True, exist_ok=True)
    history_file = workflow_path / "history.jsonl"
    if not history_file.exists():
        history_file.touch()


async def main():
    # Load configuration
    config = load_yaml_config('examples/config_mcp_schema/config.yaml')

    # Ensure workflow directory exists
    workflow_id = config.get('workflow_id', 'complete_workflow_example')
    ensure_workflow_directory(workflow_id)

    # Create supervisor and agents using asyncio.run()
    supervisor = await AgentFactory.create_from_config(config)

    print("\n=== Complete Configuration Example ===")
    print("This example demonstrates all configuration capabilities")
    print("\nWorkflow Structure:")
    supervisor.display_agent_graph()

    # We will run the chat calls in a thread to avoid blocking
    def blocking_chat(query):
        return supervisor.chat(query)

    # Test CodeWriter with schema
    print("\nTesting CodeWriter (with schema):")
    query = "Write a function to calculate the fibonacci sequence"
    print(f"Query: {query}")
    response = await asyncio.to_thread(blocking_chat, query)
    print_json_response(response)

    # Test WeatherAgent with MCP
    print("\nTesting WeatherAgent (with MCP):")
    query = "What's the weather forecast for New York?"
    print(f"Query: {query}")
    response = await asyncio.to_thread(blocking_chat, query)
    print_json_response(response)

    # Test DataAnalyst with schema
    print("\nTesting DataAnalyst (with schema):")
    query = "Analyze the trends in recent stock market data"
    print(f"Query: {query}")
    response = await asyncio.to_thread(blocking_chat, query)
    print_json_response(response)


if __name__ == "__main__":
    # Run the async main function
    asyncio.run(main())
