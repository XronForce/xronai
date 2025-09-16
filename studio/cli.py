import os
import typer
import uvicorn
import webbrowser
import asyncio
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
    asyncio.run(start_studio_server(config=config, host=host, port=port, no_browser=no_browser, reload=reload))


async def start_studio_server(config, host, port, no_browser, reload):
    """
    The core async function to configure and run the Uvicorn server.
    """
    if config:
        os.environ["XRONAI_CONFIG_PATH"] = config
        print(f"INFO:     Will load configuration from: {config}")
    else:
        if "XRONAI_CONFIG_PATH" in os.environ:
            del os.environ["XRONAI_CONFIG_PATH"]

    print(f"INFO:     Starting XronAI Studio server...")
    base_url = f"http://{host}:{port}"
    print(f"INFO:     Studio will be available at {base_url}")

    uv_config = uvicorn.Config("studio.server.main:app", host=host, port=port, reload=reload, log_level="info")

    server = uvicorn.Server(uv_config)

    if not no_browser and not reload:

        async def open_browser_after_delay():
            await asyncio.sleep(1)
            webbrowser.open_new_tab(base_url)

        asyncio.create_task(open_browser_after_delay())

    await server.serve()


if __name__ == "__main__":
    app()
