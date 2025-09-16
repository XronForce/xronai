import logging
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles

from studio.server.state import StateManager
from studio.server.graph_utils import build_graph_from_workflow, GRAPH_MARGIN_X, GRAPH_MARGIN_Y, X_SPACING

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

state_manager = StateManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan event handler. This is the professional way to
    run code on application startup and shutdown.
    """

    logger.info("Server is starting up...")
    await state_manager.load_workflow()
    yield

    logger.info("Server is shutting down...")


app = FastAPI(title="XronAI Studio Server",
              description="Backend server for the XronAI Studio.",
              version="0.1.0",
              lifespan=lifespan)


@app.get("/api/v1/status")
async def get_status():
    """
    Simple endpoint to check if the server is running.
    """
    root_node = state_manager.get_root_node()
    workflow_status = "loaded" if root_node else "not_loaded"
    root_node_name = root_node.name if root_node else "None"

    return {"status": "ok", "workflow_status": workflow_status, "root_node": root_node_name}


@app.get("/api/v1/workflow")
async def get_workflow_graph():
    """
    Returns a JSON representation of the currently loaded workflow graph.
    """
    root_node = state_manager.get_root_node()
    if not root_node:
        return {"nodes": [], "edges": []}

    user_node = {
        "id": "user-entry",
        "type": "user",
        "pos_x": GRAPH_MARGIN_X,
        "pos_y": GRAPH_MARGIN_Y + 150,
        "data": {
            "title": "User",
            "subtitle": "Workflow entry point"
        }
    }

    if state_manager.is_default_workflow():
        agent_node = {
            "id": root_node.name,
            "type": "agent",
            "pos_x": GRAPH_MARGIN_X + X_SPACING,
            "pos_y": GRAPH_MARGIN_Y + 150,
            "data": {
                "title": root_node.name,
                "subtitle": "Performs tasks"
            }
        }
        return {"nodes": [user_node, agent_node], "edges": [{"source": "user-entry", "target": root_node.name}]}

    graph = build_graph_from_workflow(root_node)

    for node in graph["nodes"]:
        node["pos_x"] += X_SPACING

    graph["nodes"].insert(0, user_node)
    graph["edges"].insert(0, {"source": "user-entry", "target": root_node.name})

    return graph


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    The main WebSocket endpoint for real-time communication with the UI.
    """
    await websocket.accept()
    logger.info("WebSocket connection established.")

    chat_entry_point = state_manager.get_root_node()
    loop = asyncio.get_running_loop()

    if not chat_entry_point:
        logger.error("No workflow loaded. Cannot handle chat.")
        return

    def on_event_sync(event: dict):
        """
        This function is called by the XronAI core from a worker thread.
        It safely schedules the async `send_json` to run on the main event loop.
        """
        asyncio.run_coroutine_threadsafe(websocket.send_json(event), loop)

    try:
        while True:
            user_query = await websocket.receive_text()
            logger.info(f"Received user query: {user_query}")

            asyncio.create_task(asyncio.to_thread(chat_entry_point.chat, query=user_query, on_event=on_event_sync))

    except WebSocketDisconnect:
        logger.info("WebSocket connection closed.")
    except Exception as e:
        logger.error(f"An unexpected error occurred in the WebSocket: {e}", exc_info=True)
    finally:
        if not websocket.client_state.DISCONNECTED:
            await websocket.close()
        logger.info("WebSocket connection cleaned up.")


app.mount("/", StaticFiles(directory="studio/ui", html=True), name="ui")
