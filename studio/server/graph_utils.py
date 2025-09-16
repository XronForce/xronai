from typing import Dict, List, Any, Union
from collections import defaultdict
from xronai.core import Supervisor, Agent

GRAPH_MARGIN_X = 50
GRAPH_MARGIN_Y = 500
X_SPACING = 350
Y_SPACING = 150


def build_graph_from_workflow(root_node: Union[Supervisor, Agent]) -> Dict[str, List[Dict[str, Any]]]:
    """
    Traverses a workflow and builds a JSON-serializable representation of the graph,
    including calculated positions for auto-layout.

    Args:
        root_node: The entry point of the workflow (a Supervisor or Agent).

    Returns:
        A dictionary containing lists of nodes and edges.
    """
    nodes = []
    edges = []
    processed_nodes = set()

    level_counts = defaultdict(int)
    node_levels = {}

    def calculate_positions(start_node: Union[Supervisor, Agent]):
        """First pass: determine the level of each node in the hierarchy."""
        q = [(start_node, 0)]
        visited = {start_node.name}

        while q:
            node, level = q.pop(0)
            node_levels[node.name] = level
            level_counts[level] += 1

            if isinstance(node, Supervisor):
                for child in node.registered_agents:
                    if child.name not in visited:
                        visited.add(child.name)
                        q.append((child, level + 1))

    def traverse_for_render(node: Union[Supervisor, Agent], current_y_offset: Dict[int, int]):
        """Second pass: build nodes and edges with calculated positions."""
        if not node or node.name in processed_nodes:
            return

        level = node_levels.get(node.name, 0)

        # Calculate position using the new margin controls
        pos_x = GRAPH_MARGIN_X + level * X_SPACING

        total_level_height = (level_counts[level] - 1) * Y_SPACING
        start_y = GRAPH_MARGIN_Y - (total_level_height / 2)
        pos_y = start_y + current_y_offset[level] * Y_SPACING

        current_y_offset[level] += 1

        node_type = 'supervisor' if isinstance(node, Supervisor) else 'agent'

        nodes.append({
            "id": node.name,
            "type": node_type,
            "pos_x": pos_x,
            "pos_y": pos_y,
            "data": {
                "title": node.name,
                "subtitle": "Manages agents" if node_type == 'supervisor' else "Performs tasks",
                "system_message": node.system_message or "Not set",
            }
        })
        processed_nodes.add(node.name)

        if isinstance(node, Supervisor):
            for child in node.registered_agents:
                edges.append({"source": node.name, "target": child.name})
                traverse_for_render(child, current_y_offset)

    calculate_positions(root_node)
    y_offsets = defaultdict(int)
    traverse_for_render(root_node, y_offsets)

    return {"nodes": nodes, "edges": edges}
