import { freshID } from "@utils/id.ts";
import type { ID } from "@utils/types.ts";
import { type Server, serve } from "bun";

type ServerId = ID;

interface ServerDoc {
  _id: ServerId;
  port: number;
  root: string;
  server: Server<undefined>;
}

/** SSE clients keyed by connection id. */
const clients = new Map<string, (data: string) => void>();

/**
 * Serving concept — expose a directory over HTTP with live-reload support.
 *
 * **purpose** serve static files over HTTP and push reloads to connected
 *   browsers when content changes
 *
 * **principle** after a server starts serving a root directory, connected
 *   browsers receive page content; when reload is called, all connected
 *   browsers refresh
 *
 * **state**
 *   a set of Servers with a port and root directory
 */
export default class ServingConcept {
  private servers = new Map<ServerId, ServerDoc>();

  /**
   * start ({ port, root }): ({ server }) | ({ error })
   *
   * **requires** `root` is an existing directory; `port` is available
   *
   * **effects** starts an HTTP server serving files from `root`. Injects a
   *   live-reload script into HTML responses. Exposes an SSE endpoint at
   *   `/_livereload` that browsers connect to for reload signals.
   */
  async start({
    port,
    root,
  }: {
    port: number;
    root: string;
  }): Promise<{ server: ServerId } | { error: string }> {
    const id = freshID();

    const reloadScript =
      '\n<script>(function(){var s=new EventSource("/_livereload");s.onmessage=function(){location.reload()};})()</script>\n';

    let bunServer: Server<undefined>;

    try {
      bunServer = serve({
        port,
        async fetch(req): Promise<Response> {
          const url = new URL(req.url);
          const filePath = decodeURIComponent(url.pathname);

          if (filePath === "/_livereload") {
            let clientId = "";
            const body = new ReadableStream({
              start(controller) {
                clientId = freshID();
                clients.set(clientId, (data: string) => {
                  controller.enqueue(`data: ${data}\n\n`);
                });
              },
              cancel() {
                clients.delete(clientId);
              },
            });
            return new Response(body, {
              headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
              },
            });
          }

          const fsPath =
            filePath === "/" ? `${root}/index.html` : `${root}${filePath}`;

          try {
            let file = Bun.file(fsPath);
            if (!(await file.exists())) {
              const indexPath = `${root}${filePath}/index.html`;
              const indexFile = Bun.file(indexPath);
              if (await indexFile.exists()) {
                file = indexFile;
              } else {
                const fallback = Bun.file(`${root}/index.html`);
                if (await fallback.exists()) {
                  const html = await fallback.text();
                  return new Response(html + reloadScript, {
                    headers: { "Content-Type": "text/html; charset=utf-8" },
                  });
                }
                return new Response("Not Found", { status: 404 });
              }
            }

            const contentType = getContentType(fsPath);
            if (contentType === "text/html") {
              const html = await file.text();
              return new Response(html + reloadScript, {
                headers: { "Content-Type": "text/html; charset=utf-8" },
              });
            }
            return new Response(file);
          } catch (err) {
            return new Response(`Server error: ${String(err)}`, {
              status: 500,
            });
          }
        },
        error() {
          return new Response("Internal error", { status: 500 });
        },
      });
    } catch (err) {
      return { error: `Failed to start server: ${String(err)}` };
    }

    this.servers.set(id, {
      _id: id,
      port: bunServer.port ?? port,
      root,
      server: bunServer,
    });

    return { server: id };
  }

  /**
   * reload (): {}
   *
   * **requires** at least one server is running
   *
   * **effects** sends a reload signal to all connected browsers across
   *   all running servers
   */
  async reload(): Promise<{ reloaded: number }> {
    const count = clients.size;
    for (const send of clients.values()) {
      send("reload");
    }
    return { reloaded: count };
  }

  /**
   * stop ({ server }): ({ server }) | ({ error })
   *
   * **requires** `server` is a running server
   *
   * **effects** stops the HTTP server and disconnects all clients
   */
  async stop({
    server: _server,
  }: {
    server: ServerId;
  }): Promise<{ server: ServerId } | { error: string }> {
    const doc = this.servers.get(_server);
    if (!doc) return { error: `Server not found: ${_server}` };
    doc.server.stop();
    clients.clear();
    this.servers.delete(_server);
    return { server: _server };
  }

  /**
   * _getServer ({ server }): ({ port, root })
   *
   * **requires** `server` is a running server
   *
   * **effects** returns the server's port and root directory
   */
  async _getServer({
    server: _server,
  }: {
    server: ServerId;
  }): Promise<{ port: number; root: string }[]> {
    const doc = this.servers.get(_server);
    if (!doc) return [];
    return [{ port: doc.port, root: doc.root }];
  }
}

function getContentType(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "html":
    case "htm":
      return "text/html";
    case "css":
      return "text/css";
    case "js":
    case "mjs":
      return "application/javascript";
    case "json":
      return "application/json";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "svg":
      return "image/svg+xml";
    case "ico":
      return "image/x-icon";
    case "woff2":
      return "font/woff2";
    default:
      return "application/octet-stream";
  }
}
