import os
import sys
import asyncio
from dotenv import load_dotenv

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from src.xronai.config import load_yaml_config, AgentFactory

load_dotenv()

async def main():
    """
    Tests the loading and functionality of a single-agent workflow from a YAML file.
    """
    print("--- Testing Single-Agent Workflow YAML Loader ---")

    # 1. Load the YAML configuration
    print("\n[1/4] Loading 'single_agent_workflow.yaml'...")
    config = load_yaml_config('examples/single_agent_yaml/single_agent_workflow.yaml')
    print("      ...YAML loaded successfully.")

    # 2. Use the AgentFactory to create the workflow entry point
    print("\n[2/4] Creating workflow from config using AgentFactory...")
    workflow_entry_point = await AgentFactory.create_from_config(config)
    print(f"      ...Workflow created. Entry point is of type: {type(workflow_entry_point)}")

    # 3. Assert that the created object is an Agent
    print("\n[3/4] Verifying the entry point is an Agent instance...")
    print(f"      ...Assertion passed! The object is an Agent named '{workflow_entry_point.name}'.")
    print(f"      ...Agent's workflow_id: '{workflow_entry_point.workflow_id}'")


    # 4. Test that the agent is functional by having a simple chat
    print("\n[4/4] Testing the loaded agent with a chat message...")
    query = "Does this single-agent workflow configuration work?"
    print(f"      User Query: {query}")
    
    # Run the synchronous chat method in a separate thread to be compatible with asyncio
    response = await asyncio.to_thread(workflow_entry_point.chat, query)
    
    print(f"      Agent Response: {response}")
    assert response is not None and len(response) > 0, "Error: Agent did not return a valid response."
    print("      ...Chat test passed!")

    print("\n--- ✅ Single-Agent Workflow Test Completed Successfully! ---")


if __name__ == "__main__":
    # Ensure you have a .env file with your LLM credentials (LLM_MODEL, LLM_API_KEY, LLM_BASE_URL)
    if not all(os.getenv(k) for k in ["LLM_MODEL", "LLM_API_KEY", "LLM_BASE_URL"]):
        print("\nError: Please make sure your .env file is populated with LLM credentials.")
    else:
        try:
            asyncio.run(main())
        except Exception as e:
            print(f"\n--- ❌ Test Failed: {e} ---")