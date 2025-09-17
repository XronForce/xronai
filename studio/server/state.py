import os
import logging
from typing import Optional, Union, Dict, Any
from dotenv import load_dotenv

from xronai.core import Supervisor, Agent

load_dotenv()
logger = logging.getLogger(__name__)


class StateManager:
    """
    Manages the in-memory state of the XronAI workflow for the studio server.
    Follows a "Compile on Demand" model where the entire workflow is rebuilt
    from a frontend graph snapshot.
    """

    def __init__(self):
        self.chat_entry_point: Optional[Union[Supervisor, Agent]] = None
        self.llm_config: Dict[str, str] = {
            "model": os.getenv("LLM_MODEL", "default-model"),
            "api_key": os.getenv("LLM_API_KEY", "default-key"),
            "base_url": os.getenv("LLM_BASE_URL", "default-url"),
        }
        self.workflow_id: str = "studio-session"

    def get_root_node(self) -> Optional[Union[Supervisor, Agent]]:
        """Returns the current, compiled entry point for chat."""
        return self.chat_entry_point

    def find_node_by_id(self, node_id: str) -> Optional[Union[Supervisor, Agent]]:
        """Finds any node within the compiled workflow, used for inspection."""
        if not self.chat_entry_point:
            return None

        q = [self.chat_entry_point]
        visited = {self.chat_entry_point.name}

        while q:
            current = q.pop(0)
            if current.name == node_id:
                return current
            if isinstance(current, Supervisor):
                for child in current.registered_agents:
                    if child.name not in visited:
                        visited.add(child.name)
                        q.append(child)
        return None

    def compile_workflow_from_json(self, drawflow_export: Dict[str, Any]) -> None:
        """
        Builds a new, runnable workflow from a Drawflow JSON export.
        This is the core "compilation" step.
        """
        self.chat_entry_point = None
        all_nodes: Dict[str, Union[Supervisor, Agent]] = {}

        drawflow_data = drawflow_export.get("drawflow", {}).get("Home", {}).get("data", {})
        if not drawflow_data:
            raise ValueError("Invalid or empty Drawflow export data.")

        # 1. Instantiate all nodes from the graph
        for node_id, node_info in drawflow_data.items():
            name = node_info["name"]
            node_type = node_info["class"]
            # The system message is stored inside the node's data object
            system_message = node_info.get("data", {}).get("system_message", f"You are {name}.")

            if name in all_nodes or name == 'user-entry':
                continue

            if node_type == "agent":
                new_node = Agent(name=name, llm_config=self.llm_config, system_message=system_message)
                new_node.set_workflow_id(self.workflow_id)
                all_nodes[name] = new_node
            elif node_type == "supervisor":
                new_node = Supervisor(name=name,
                                      llm_config=self.llm_config,
                                      is_assistant=True,
                                      system_message=system_message)
                new_node.set_workflow_id(self.workflow_id)
                all_nodes[name] = new_node

        # 2. Find the entry point and build the hierarchy from connections
        user_node_id = next((nid for nid, n in drawflow_data.items() if n["name"] == "user-entry"), None)
        if not user_node_id:
            raise ValueError("Workflow must have a User node as an entry point.")

        # *** THIS IS THE FIX ***
        # Explicitly get the user node's data and check its connections.
        user_node_info = drawflow_data.get(user_node_id)
        if not user_node_info:
            raise ValueError("Could not find user node data in the export.")

        entry_point_node_name = None
        user_outputs = user_node_info.get("outputs", {}).get("output_1", {}).get("connections", [])

        if user_outputs:
            first_connection = user_outputs[0]
            connected_node_id = first_connection["node"]
            connected_node_info = drawflow_data.get(connected_node_id)
            if connected_node_info:
                entry_point_node_name = connected_node_info["name"]

        if not entry_point_node_name:
            raise ValueError("User node is not connected to any agent or supervisor.")

        self.chat_entry_point = all_nodes.get(entry_point_node_name)
        if not self.chat_entry_point:
            raise ValueError(f"Entry point node '{entry_point_node_name}' could not be found.")

        # Make the root supervisor a main supervisor
        if isinstance(self.chat_entry_point, Supervisor):
            self.chat_entry_point.is_assistant = False

        # 3. Register agents based on all other connections
        for node_id, node_info in drawflow_data.items():
            source_name = node_info["name"]
            source_node = all_nodes.get(source_name)
            if not isinstance(source_node, Supervisor):
                continue

            for conn in node_info.get("outputs", {}).get("output_1", {}).get("connections", []):
                target_node_info = drawflow_data.get(conn["node"])
                if target_node_info:
                    target_name = target_node_info["name"]
                    target_node = all_nodes.get(target_name)
                    if target_node:
                        source_node.register_agent(target_node)
                        logger.info(f"Successfully registered '{target_name}' to supervisor '{source_name}'.")

        logger.info(f"Workflow compiled successfully. Entry point is '{self.chat_entry_point.name}'.")
