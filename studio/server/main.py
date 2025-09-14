import logging
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles

from studio.server.state import StateManager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create a single instance of our StateManager
state_manager = StateManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan event handler. This is the professional way to
    run code on application startup and shutdown.
    """
    # --- Startup ---
    logger.info("Server is starting up...")
    await state_manager.load_workflow()
    yield
    # --- Shutdown ---
    logger.info("Server is shutting down...")


# Create the FastAPI application with the lifespan handler
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
        # ... (error handling code is the same)
        return

    # --- THIS IS THE CORRECTED LOGIC ---
    # Create a SYNCHRONOUS callback function to pass to the worker thread.
    def on_event_sync(event: dict):
        """
        This function is called by the XronAI core from a worker thread.
        It safely schedules the async `send_json` to run on the main event loop.
        """
        asyncio.run_coroutine_threadsafe(websocket.send_json(event), loop)

    # ------------------------------------

    try:
        while True:
            user_query = await websocket.receive_text()
            logger.info(f"Received user query: {user_query}")

            # Run the synchronous, blocking `chat` function in a separate thread.
            # We pass our new THREAD-SAFE, SYNCHRONOUS callback.
            asyncio.create_task(
                asyncio.to_thread(
                    chat_entry_point.chat,
                    query=user_query,
                    on_event=on_event_sync  # <-- Pass the thread-safe function
                ))

    except WebSocketDisconnect:
        logger.info("WebSocket connection closed.")
    except Exception as e:
        logger.error(f"An unexpected error occurred in the WebSocket: {e}", exc_info=True)
    finally:
        if not websocket.client_state.DISCONNECTED:
            await websocket.close()
        logger.info("WebSocket connection cleaned up.")


# Define the catch-all static file route last
app.mount("/", StaticFiles(directory="studio/ui", html=True), name="ui")
