"""
Example: Standalone Agent with working persistent history.jsonl
"""
import os
import sys
from dotenv import load_dotenv

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from src.xronai.core import Agent

load_dotenv()

llm_config = {
    "model": os.getenv('LLM_MODEL'),
    "api_key": os.getenv('LLM_API_KEY'),
    "base_url": os.getenv('LLM_BASE_URL')
}

WORKFLOW_ID = "agent_history_demo_new" # Use a new ID for a clean test
system_message = "You are a friendly assistant who remembers our conversation history."

def main():
    print(f"\n--- Standalone Agent with AUTOMATIC Persistent History ---")
    print(f"Workflow ID: {WORKFLOW_ID}\n")

    # The Agent now handles all history setup internally!
    agent = Agent(
        name="SoloAgent",
        llm_config=llm_config,
        workflow_id=WORKFLOW_ID,
        system_message=system_message,
        keep_history=True
    )

    if len(agent.chat_history) > 1:
        print("[Info] Previous history loaded for SoloAgent.\n")

    print('Type your messages! "show" displays chat history, "exit" to quit.')

    while True:
        msg = input("\nYou: ").strip()
        if msg.lower() == "exit":
            print("Session ended.")
            break
        elif msg.lower() == "show":
            print("=== Agent Chat History ===")
            for m in agent.chat_history:
                print(f"{m['role']}: {m['content']}")
            continue
        try:
            answer = agent.chat(msg)
            print("Agent:", answer)
        except Exception as e:
            print("Error:", e)

    print(f"\nHistory is now saved in xronai_logs/{WORKFLOW_ID}/history.jsonl")

if __name__ == "__main__":
    main()