import os
import json
import logging
import asyncio
from typing import Optional, Union, Dict, Any
from dotenv import load_dotenv

from xronai.core import Supervisor, Agent
from xronai.tools import TOOL_REGISTRY

load_dotenv()
logger = logging.getLogger(__name__)


class StateManager:
    """
    Manages the in-memory state of the XronAI workflow for the studio server.
    The workflow is only compiled into live objects when the user initiates a chat session.
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

    async def compile_workflow_from_json(self, drawflow_export: Dict[str, Any]) -> None:
        """
        Receives a Drawflow graph and compiles it into live, runnable Agent and Supervisor objects.
        """
        self.chat_entry_point = None
        nodes_by_uuid: Dict[str, Union[Supervisor, Agent]] = {}
        node_data_by_drawflow_id: Dict[str, Dict] = {}
        all_names = set()

        drawflow_data = drawflow_export.get("drawflow", {}).get("Home", {}).get("data", {})
        if not drawflow_data:
            raise ValueError("Invalid or empty Drawflow export data.")

        for df_id, node_info in drawflow_data.items():
            node_data = node_info.get("data", {})
            uuid = node_data.get("uuid")
            name = node_data.get("name")

            if not uuid or not name:
                logger.warning(f"Skipping node with missing uuid/name in data: {node_info}")
                continue

            node_data_by_drawflow_id[df_id] = node_info

            if node_info.get("class") in ['agent', 'supervisor']:
                if name in all_names:
                    raise ValueError(f"Duplicate node name found: '{name}'. All names must be unique.")
                all_names.add(name)

            node_type = node_info.get("class")

            if node_type == "agent":
                output_schema_str = node_data.get("output_schema", "null")
                try:
                    output_schema = json.loads(
                        output_schema_str) if output_schema_str and output_schema_str.strip() else None
                except json.JSONDecodeError:
                    logger.warning(f"Invalid JSON in output_schema for agent {name}. Setting to null.")
                    output_schema = None

                new_node = Agent(name=name,
                                 llm_config=self.llm_config,
                                 system_message=node_data.get("system_message", f"You are {name}."),
                                 keep_history=node_data.get("keep_history", True),
                                 output_schema=output_schema,
                                 strict=node_data.get("strict", False),
                                 mcp_servers=[],
                                 tools=[],
                                 use_tools=False)
                new_node.set_workflow_id(self.workflow_id)
                nodes_by_uuid[uuid] = new_node

            elif node_type == "supervisor":
                new_node = Supervisor(name=name,
                                      llm_config=self.llm_config,
                                      is_assistant=True,
                                      system_message=node_data.get("system_message", f"You are {name}."),
                                      use_agents=node_data.get("use_agents", True))
                new_node.set_workflow_id(self.workflow_id)
                nodes_by_uuid[uuid] = new_node

        user_node_info = next((n for n in node_data_by_drawflow_id.values() if n.get("class") == "user"), None)
        if not user_node_info:
            raise ValueError("Workflow must have a User node.")

        user_outputs = user_node_info.get("outputs", {}).get("output_1", {}).get("connections", [])
        if not user_outputs:
            raise ValueError("User node must be connected to an Agent or Supervisor.")

        entry_point_df_id = user_outputs[0]["node"]
        entry_point_uuid = node_data_by_drawflow_id.get(entry_point_df_id, {}).get("data", {}).get("uuid")

        self.chat_entry_point = nodes_by_uuid.get(entry_point_uuid)
        if not self.chat_entry_point:
            raise ValueError(f"Entry point node with UUID '{entry_point_uuid}' not found.")

        if isinstance(self.chat_entry_point, Supervisor):
            self.chat_entry_point.is_assistant = False

        for df_id, node_info in node_data_by_drawflow_id.items():
            source_uuid = node_info.get("data", {}).get("uuid")
            source_node = nodes_by_uuid.get(source_uuid)

            if not source_node:
                continue

            for conn in node_info.get("outputs", {}).get("output_1", {}).get("connections", []):
                target_df_id = conn["node"]
                target_node_info = node_data_by_drawflow_id.get(target_df_id, {})
                target_class = target_node_info.get("class")
                target_data = target_node_info.get("data", {})

                if isinstance(source_node, Supervisor):
                    target_node = nodes_by_uuid.get(target_data.get("uuid"))
                    if target_node:
                        source_node.register_agent(target_node)
                        logger.info(f"Registered '{target_node.name}' to '{source_node.name}'.")

                elif isinstance(source_node, Agent):
                    if target_class == "mcp":
                        mcp_config = {
                            k: v
                            for k, v in target_data.items()
                            if k in ['type', 'url', 'auth_token', 'script_path'] and v
                        }
                        source_node.mcp_servers.append(mcp_config)
                        source_node.use_tools = True
                        logger.info(f"Connecting Agent '{source_node.name}' to MCP server '{target_data.get('name')}'.")

                    elif target_class == "tool":
                        tool_type = target_data.get("tool_type")
                        tool_config = target_data.get("config", {})
                        ToolClass = TOOL_REGISTRY.get(tool_type)
                        if ToolClass:
                            try:
                                tool_instance = ToolClass(**tool_config)
                                source_node.tools.append(tool_instance.as_agent_tool())
                                source_node.use_tools = True
                                logger.info(f"Attached configured tool '{tool_type}' to Agent '{source_node.name}'.")
                            except Exception as e:
                                logger.error(f"Failed to instantiate tool '{tool_type}': {e}")
                        else:
                            logger.warning(f"Tool type '{tool_type}' not in registry.")

        for node in nodes_by_uuid.values():
            if isinstance(node, Agent) and node.mcp_servers:
                await node._load_mcp_tools()
                logger.info(f"Loaded MCP tools for Agent '{node.name}'.")

        logger.info(f"Workflow compiled successfully. Entry point: '{self.chat_entry_point.name}'.")
