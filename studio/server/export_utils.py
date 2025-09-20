import yaml
from typing import Dict, Any, List
from xronai.tools import TOOL_REGISTRY


class SafeDumper(yaml.SafeDumper):

    def ignore_aliases(self, data):
        return True


def _build_node_config(node_id: str, all_nodes_map: Dict[str, Any], connections_map: Dict[str,
                                                                                          List[str]]) -> Dict[str, Any]:
    """
    Recursively builds the configuration dictionary for a single node and its children.
    """
    node_info = all_nodes_map.get(node_id)
    if not node_info:
        return {}

    node_class = node_info.get("class")
    node_data = node_info.get("data", {})

    config = {
        "name": node_data.get("name", "UnnamedNode"),
        "type": "agent" if node_class == "agent" else "supervisor",
        "llm_config": {
            "model": "${LLM_MODEL}",
            "api_key": "${LLM_API_KEY}",
            "base_url": "${LLM_BASE_URL}",
        },
        "system_message": node_data.get("system_message", "")
    }

    if node_class == "supervisor":
        config["is_assistant"] = True

        children = []
        child_node_ids = connections_map.get(node_id, [])
        for child_id in child_node_ids:
            child_config = _build_node_config(child_id, all_nodes_map, connections_map)
            if child_config:
                children.append(child_config)

        if children:
            config["children"] = children

    elif node_class == "agent":
        config["keep_history"] = node_data.get("keep_history", True)

        output_schema = node_data.get("output_schema")
        if output_schema and output_schema.strip():
            try:
                config["output_schema"] = yaml.safe_load(output_schema)
                config["strict"] = node_data.get("strict", False)
            except yaml.YAMLError:
                pass

        tools = []
        mcp_servers = []
        connected_node_ids = connections_map.get(node_id, [])

        for connected_id in connected_node_ids:
            connected_node_info = all_nodes_map.get(connected_id)
            if not connected_node_info:
                continue

            connected_class = connected_node_info.get("class")
            connected_data = connected_node_info.get("data", {})

            if connected_class == "mcp":
                mcp_config = {
                    k: v for k, v in connected_data.items() if k in ['type', 'url', 'auth_token', 'script_path'] and v
                }
                if mcp_config:
                    mcp_servers.append(mcp_config)

            elif connected_class == "tool":
                tool_type = connected_data.get("tool_type")
                tool_config_from_ui = connected_data.get("config", {})

                if tool_type and tool_type in TOOL_REGISTRY:
                    ToolClass = TOOL_REGISTRY[tool_type]

                    try:
                        tool_instance = ToolClass(**tool_config_from_ui)
                        metadata = tool_instance.get_metadata()['function']

                        tool_entry = {
                            "name": metadata.get('name'),
                            "type": "class" if isinstance(TOOL_REGISTRY[tool_type], type) else "function",
                            "python_path": f"{ToolClass.__module__}.{ToolClass.__name__}",
                            "description": metadata.get('description'),
                            "parameters": metadata.get('parameters', {}).get('properties', {}),
                            "config": tool_config_from_ui
                        }
                        tools.append(tool_entry)
                    except Exception as e:
                        print(f"Warning: Could not instantiate tool '{tool_type}' during export: {e}")

        if mcp_servers:
            config["mcp_servers"] = mcp_servers

        if tools:
            config["tools"] = tools

        if mcp_servers or tools:
            config["use_tools"] = True

    return config


def generate_yaml_config(drawflow_export: Dict[str, Any]) -> str:
    drawflow_data = drawflow_export.get("drawflow", {}).get("Home", {}).get("data", {})
    if not drawflow_data:
        raise ValueError("Invalid or empty Drawflow export data.")

    all_nodes_map = {df_id: node_info for df_id, node_info in drawflow_data.items()}

    connections_map: Dict[str, List[str]] = {}
    for df_id, node_info in all_nodes_map.items():
        connections_map[df_id] = []
        for output in node_info.get("outputs", {}).values():
            for conn in output.get("connections", []):
                connections_map[df_id].append(conn["node"])

    user_node_id = next((df_id for df_id, info in all_nodes_map.items() if info.get("class") == "user"), None)
    if not user_node_id:
        raise ValueError("Workflow must have a User node.")

    root_node_ids = connections_map.get(user_node_id, [])
    if not root_node_ids:
        raise ValueError("User node must be connected to a Supervisor or an Agent.")

    root_node_id = root_node_ids[0]

    root_config = _build_node_config(root_node_id, all_nodes_map, connections_map)

    if not root_config:
        raise ValueError("Failed to build configuration from the root node.")

    if root_config['type'] == 'supervisor':
        root_config['is_assistant'] = False

    final_config = {"workflow_id": "exported-workflow", "supervisor": root_config}

    if root_config['type'] == 'agent':
        final_config = {
            "workflow_id": "exported-workflow",
            "supervisor": {
                "name": "MainSupervisor",
                "type": "supervisor",
                "is_assistant": False,
                "llm_config": {
                    "model": "${LLM_MODEL}",
                    "api_key": "${LLM_API_KEY}",
                    "base_url": "${LLM_BASE_URL}",
                },
                "system_message": "You are the main supervisor coordinating the workflow.",
                "children": [root_config]
            }
        }

    return yaml.dump(final_config, Dumper=SafeDumper, sort_keys=False, indent=2)
