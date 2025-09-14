import os
import typer
import uvicorn
import webbrowser
from typing_extensions import Annotated
from typing import Optional

app = typer.Typer(name="xronai", help="The command-line interface for the XronAI SDK.", add_completion=False)


@app.callback(invoke_without_command=True)
def main(ctx: typer.Context):
    if ctx.invoked_subcommand is None:
        print("Welcome to XronAI CLI. Please specify a command, e.g., 'studio'.")
        print(ctx.get_help())


@app.command()
def studio(config: Annotated[Optional[str],
                             typer.Option(help="Path to a workflow YAML configuration file to load.")] = None,
           host: Annotated[str, typer.Option(help="The host address to run the server on.")] = "127.0.0.1",
           port: Annotated[int, typer.Option(help="The port number to run the server on.")] = 8000,
           no_browser: Annotated[bool,
                                 typer.Option("--no-browser", help="Do not automatically open a web browser.")] = False,
           reload: Annotated[bool, typer.Option("--reload", help="Enable auto-reloading for development.")] = False):
    """
    Launches the XronAI Studio, a web-based UI for building and managing agentic workflows.
    """
    # --- THIS IS THE KEY CHANGE ---
    # Set the config path as an environment variable so the FastAPI server can access it.
    if config:
        os.environ["XRONAI_CONFIG_PATH"] = config
        print(f"INFO:     Will load configuration from: {config}")
    else:
        # Ensure the variable is not set from a previous run
        if "XRONAI_CONFIG_PATH" in os.environ:
            del os.environ["XRONAI_CONFIG_PATH"]

    print(f"INFO:     Starting XronAI Studio server...")
    base_url = f"http://{host}:{port}"
    print(f"INFO:     Studio will be available at {base_url}")

    if not no_browser and not reload:
        webbrowser.open_new_tab(base_url)

    uvicorn.run("studio.server.main:app", host=host, port=port, reload=reload, log_level="info")


if __name__ == "__main__":
    app()
