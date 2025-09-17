# FILE: studio/server/state.py

import os
import json
import logging
from typing import Optional, Union, Dict, Any, List
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
        return self.chat_entry_point

    def find_node_by_id(self, node_id: str) -> Optional[Union[Supervisor, Agent]]:
        # This function is now less critical but can be used for future inspection APIs
        if not self.chat_entry_point: return None
        q = [self.chat_entry_point]
        visited = {self.chat_entry_point.name}
        while q:
            current = q.pop(0)
            if current.name == node_id: return current
            if isinstance(current, Supervisor):
                for child in current.registered_agents:
                    if child.name not in visited:
                        visited.add(child.name)
                        q.append(child)
        return None

    def compile_workflow_from_json(self, drawflow_export: Dict[str, Any]) -> None:
        self.chat_entry_point = None
        nodes_by_uuid: Dict[str, Union[Supervisor, Agent]] = {}
        node_data_by_drawflow_id: Dict[str, Dict] = {}
        all_names = set()

        drawflow_data = drawflow_export.get("drawflow", {}).get("Home", {}).get("data", {})
        if not drawflow_data: raise ValueError("Invalid or empty Drawflow export data.")

        # 1. First pass: Instantiate all nodes and validate names
        for df_id, node_info in drawflow_data.items():
            node_data = node_info.get("data", {})
            uuid = node_data.get("uuid")
            name = node_data.get("name")
            
            if not uuid or not name:
                # This could be Drawflow's internal data, skip it
                logger.warning(f"Skipping node with missing uuid/name in data: {node_info}")
                continue

            if name in all_names: raise ValueError(f"Duplicate node name found: '{name}'. All names must be unique.")
            all_names.add(name)
            
            node_data_by_drawflow_id[df_id] = node_info
            
            node_type = node_info.get("class")
            
            # Extract full configuration from node data
            system_message = node_data.get("system_message", f"You are {name}.")
            
            if node_type == "agent":
                schema_str = node_data.get("output_schema", "").strip()
                output_schema = json.loads(schema_str) if schema_str else None
                
                new_node = Agent(
                    name=name,
                    llm_config=self.llm_config,
                    system_message=system_message,
                    keep_history=node_data.get("keep_history", True),
                    output_schema=output_schema,
                    strict=node_data.get("strict", False)
                )
                new_node.set_workflow_id(self.workflow_id)
                nodes_by_uuid[uuid] = new_node

            elif node_type == "supervisor":
                new_node = Supervisor(
                    name=name,
                    llm_config=self.llm_config,
                    is_assistant=True, # Assume all are assistants initially
                    system_message=system_message,
                    use_agents=node_data.get("use_agents", True)
                )
                new_node.set_workflow_id(self.workflow_id)
                nodes_by_uuid[uuid] = new_node

        # 2. Second pass: Find entry point and build hierarchy
        user_node_info = next((n for n in node_data_by_drawflow_id.values() if n.get("class") == "user"), None)
        if not user_node_info: raise ValueError("Workflow must have a User node.")

        entry_point_uuid = None
        user_outputs = user_node_info.get("outputs", {}).get("output_1", {}).get("connections", [])
        if user_outputs:
            target_df_id = user_outputs[0]["node"]
            target_node_info = node_data_by_drawflow_id.get(target_df_id)
            if target_node_info:
                entry_point_uuid = target_node_info.get("data", {}).get("uuid")

        if not entry_point_uuid: raise ValueError("User node must be connected to an Agent or Supervisor.")
        
        self.chat_entry_point = nodes_by_uuid.get(entry_point_uuid)
        if not self.chat_entry_point: raise ValueError(f"Entry point node with UUID '{entry_point_uuid}' not found.")
        
        # Correctly set the main supervisor
        if isinstance(self.chat_entry_point, Supervisor):
            self.chat_entry_point.is_assistant = False

        # 3. Third pass: Register agents based on connections
        for df_id, node_info in node_data_by_drawflow_id.items():
            source_uuid = node_info.get("data", {}).get("uuid")
            source_node = nodes_by_uuid.get(source_uuid)
            
            if not isinstance(source_node, Supervisor): continue

            for conn in node_info.get("outputs", {}).get("output_1", {}).get("connections", []):
                target_df_id = conn["node"]
                target_node_info = node_data_by_drawflow_id.get(target_df_id, {})
                target_uuid = target_node_info.get("data", {}).get("uuid")
                
                if target_uuid:
                    target_node = nodes_by_uuid.get(target_uuid)
                    if target_node:
                        source_node.register_agent(target_node)
                        logger.info(f"Registered '{target_node.name}' to '{source_node.name}'.")

        logger.info(f"Workflow compiled successfully. Entry point: '{self.chat_entry_point.name}'.")