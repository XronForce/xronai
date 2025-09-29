import uuid
import json
import yaml
from typing import Dict, Any, List
from collections import defaultdict
from xronai.tools import TOOL_REGISTRY

X_SPACING = 350
Y_SPACING = 150
BASE_X = 100
BASE_Y = 500


def get_node_html(base_name: str, subtitle: str) -> str:
    """Generates the valid HTML structure for a Drawflow node's content."""
    return f"""
<div class="node-content-wrapper">
    <div class="node-icon-container"></div>
    <div class="node-text-container">
        <div class="node-title">{base_name}</div>
        <div class="node-subtitle">{subtitle}</div>
    </div>
</div>
"""


def convert_yaml_to_drawflow(config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Converts a loaded YAML configuration dictionary into a Drawflow-compatible
    JSON object for visual rendering.
    """
    drawflow_nodes = {}
    node_name_to_df_id = {}
    next_id = 1

    node_positions = {}
    level_counts = defaultdict(int)

    def discover_nodes(node_config: Dict, level: int):
        name = node_config['name']
        if name in node_positions:
            return

        level_counts[level] += 1
        node_positions[name] = {'level': level, 'y_index': level_counts[level] - 1}

        for child in node_config.get('children', []):
            discover_nodes(child, level + 1)

        if node_config.get('type') == 'agent':
            tool_level = level + 1
            for tool in node_config.get('tools', []):
                tool_name = f"tool_{name}_{tool['name']}"
                level_counts[tool_level] += 1
                node_positions[tool_name] = {'level': tool_level, 'y_index': level_counts[tool_level] - 1}
            for i, mcp in enumerate(node_config.get('mcp_servers', [])):
                mcp_name = f"mcp_{name}_{i}"
                level_counts[tool_level] += 1
                node_positions[mcp_name] = {'level': tool_level, 'y_index': level_counts[tool_level] - 1}

    if 'supervisor' in config:
        root_node_config = config['supervisor']
    elif 'agent' in config:
        root_node_config = config['agent']
    else:
        raise ValueError("Invalid YAML: Configuration must contain a root 'supervisor' or 'agent' key.")

    discover_nodes(root_node_config, 0)

    def build_node(node_config: Dict):
        nonlocal next_id
        name = node_config['name']
        if name in node_name_to_df_id:
            return

        df_id = str(next_id)
        node_name_to_df_id[name] = df_id
        next_id += 1

        node_type = node_config['type']
        pos = node_positions[name]
        total_in_level = level_counts[pos['level']]
        start_y = BASE_Y - ((total_in_level - 1) * Y_SPACING / 2)
        pos_x = BASE_X + pos['level'] * X_SPACING
        pos_y = start_y + pos['y_index'] * Y_SPACING

        output_schema_val = node_config.get('output_schema', '')
        output_schema_str = yaml.dump(output_schema_val, indent=2) if output_schema_val else ""

        node_data = {
            "uuid": str(uuid.uuid4()),
            "name": name,
            "system_message": node_config.get('system_message', ''),
            "keep_history": node_config.get('keep_history', True),
            "output_schema": output_schema_str,
            "strict": node_config.get('strict', False),
            "use_agents": node_config.get('is_assistant', True)
        }
        subtitle = "Supervisor" if node_type == "supervisor" else "Agent"

        drawflow_nodes[df_id] = {
            "id": int(df_id),
            "name": name,
            "data": node_data,
            "class": node_type,
            "html": get_node_html(name, subtitle),
            "typenode": False,
            "inputs": {
                "input_1": {
                    "connections": []
                }
            },
            "outputs": {
                "output_1": {
                    "connections": []
                }
            },
            "pos_x": pos_x,
            "pos_y": pos_y,
        }

        for child in node_config.get('children', []):
            build_node(child)

        if node_type == 'agent':
            for tool in node_config.get('tools', []):
                tool_name_key = f"tool_{name}_{tool['name']}"
                tool_df_id = str(next_id)
                node_name_to_df_id[tool_name_key] = tool_df_id
                next_id += 1

                tool_pos = node_positions[tool_name_key]
                total_in_tool_level = level_counts[tool_pos['level']]
                start_y_tool = BASE_Y - ((total_in_tool_level - 1) * Y_SPACING / 2)

                tool_registry_key = None
                tool_class_name = tool.get('python_path', '').split('.')[-1]
                for key, ToolClass in TOOL_REGISTRY.items():
                    if ToolClass.__name__ == tool_class_name:
                        tool_registry_key = key
                        break

                tool_data = {
                    "uuid": str(uuid.uuid4()),
                    "name": tool['name'],
                    "tool_type": tool_registry_key,
                    "config": tool.get('config', {})
                }
                drawflow_nodes[tool_df_id] = {
                    "id": int(tool_df_id),
                    "name": tool['name'],
                    "data": tool_data,
                    "class": 'tool',
                    "html": get_node_html(tool['name'], "Tool"),
                    "typenode": False,
                    "inputs": {
                        "input_1": {
                            "connections": []
                        }
                    },
                    "outputs": {},
                    "pos_x": BASE_X + tool_pos['level'] * X_SPACING,
                    "pos_y": start_y_tool + tool_pos['y_index'] * Y_SPACING,
                }

            for i, mcp in enumerate(node_config.get('mcp_servers', [])):
                mcp_name_key = f"mcp_{name}_{i}"
                mcp_df_id = str(next_id)
                node_name_to_df_id[mcp_name_key] = mcp_df_id
                next_id += 1

                mcp_pos = node_positions[mcp_name_key]
                total_in_mcp_level = level_counts[mcp_pos['level']]
                start_y_mcp = BASE_Y - ((total_in_mcp_level - 1) * Y_SPACING / 2)

                mcp_data = {"uuid": str(uuid.uuid4()), "name": f"MCP {i+1}", **mcp}
                mcp_title = mcp.get('url') or mcp.get('script_path', 'MCP Server')

                drawflow_nodes[mcp_df_id] = {
                    "id": int(mcp_df_id),
                    "name": mcp_title,
                    "data": mcp_data,
                    "class": 'mcp',
                    "html": get_node_html(mcp_title, f"MCP ({mcp.get('type')})"),
                    "typenode": False,
                    "inputs": {
                        "input_1": {
                            "connections": []
                        }
                    },
                    "outputs": {},
                    "pos_x": BASE_X + mcp_pos['level'] * X_SPACING,
                    "pos_y": start_y_mcp + mcp_pos['y_index'] * Y_SPACING
                }

    build_node(root_node_config)

    def build_connections(node_config: Dict):
        source_name = node_config['name']
        source_id = node_name_to_df_id.get(source_name)
        if not source_id:
            return

        for child_config in node_config.get('children', []):
            target_id = node_name_to_df_id.get(child_config['name'])
            if target_id:
                drawflow_nodes[source_id]['outputs']['output_1']['connections'].append({
                    "node": target_id,
                    "output": "input_1"
                })
                drawflow_nodes[target_id]['inputs']['input_1']['connections'].append({
                    "node": source_id,
                    "input": "output_1"
                })
            build_connections(child_config)

        if node_config.get('type') == 'agent':
            for tool in node_config.get('tools', []):
                tool_name_key = f"tool_{source_name}_{tool['name']}"
                target_id = node_name_to_df_id.get(tool_name_key)
                if target_id:
                    drawflow_nodes[source_id]['outputs']['output_1']['connections'].append({
                        "node": target_id,
                        "output": "input_1"
                    })
                    drawflow_nodes[target_id]['inputs']['input_1']['connections'].append({
                        "node": source_id,
                        "input": "output_1"
                    })
            for i, mcp in enumerate(node_config.get('mcp_servers', [])):
                mcp_name_key = f"mcp_{source_name}_{i}"
                target_id = node_name_to_df_id.get(mcp_name_key)
                if target_id:
                    drawflow_nodes[source_id]['outputs']['output_1']['connections'].append({
                        "node": target_id,
                        "output": "input_1"
                    })
                    drawflow_nodes[target_id]['inputs']['input_1']['connections'].append({
                        "node": source_id,
                        "input": "output_1"
                    })

    build_connections(root_node_config)

    user_id = str(next_id)
    root_df_id = node_name_to_df_id[root_node_config['name']]
    drawflow_nodes[user_id] = {
        "id": int(user_id),
        "name": 'User',
        "data": {
            "uuid": "user-node-uuid",
            "name": "User"
        },
        "class": 'user',
        "html": get_node_html("User", "Workflow Entry Point"),
        "typenode": False,
        "inputs": {},
        "outputs": {
            "output_1": {
                "connections": [{
                    "node": root_df_id,
                    "output": "input_1"
                }]
            }
        },
        "pos_x": BASE_X - X_SPACING,
        "pos_y": BASE_Y,
    }
    drawflow_nodes[root_df_id]['inputs']['input_1']['connections'].append({"node": user_id, "input": "output_1"})

    return {"drawflow": {"Home": {"data": drawflow_nodes}}}
