"""The API routes, grouped by topic. `all_routers` is what the app includes."""

from backend.routes import conversion, data, linter, system, watcher

all_routers = [system.router, conversion.router, data.router, watcher.router, linter.router]
