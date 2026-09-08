# Security scope

The virtual shell does not execute arbitrary JavaScript or deploy external infrastructure.
API keys configured in this version live in tab memory, not persistent browser storage.
Keys saved by an older version must still be removed from that origin's browser storage.

The HTML CSP blocks inline JavaScript and eval. It still trusts the Tailwind and
HTMX CDN origins and permits inline CSS. It is defense in depth, not a complete
isolation boundary. Production delivery should bundle dependencies locally and
set `frame-ancestors 'none'` as an HTTP Content-Security-Policy response header;
that directive is not enforced from an HTML meta element.

Run `npm test` for functional and security regression checks. The provider failure
test uses a simulated HTTP 503 and does not contact the provider. These tests do
not establish full Bash compatibility, bound regex execution time, or certify
WebMCP interoperability. Resource quotas, a cancellable worker runtime, local
dependency bundling and broader browser regression tests remain future work.
# Tool validation and limitations

Tool invocation validates the argument types, required fields and enums declared by
the bundled tools before execution. This is a deliberately limited schema checker,
not a general JSON Schema implementation. Error and success telemetry retain at
most 50 entries; this does not impose a byte quota on each entry.

`kdd_validate_contract` checks mandatory frontmatter fields and compares the
referenced test file's SHA-256 with the contract. It does not execute tests or
certify implementation correctness (`testsExecuted: false`). A filename loads
assets from the served repository; an absolute path reads only the virtual
filesystem with its oracle under `/tests`. Sources are never silently mixed.
The parser accepts the repository's limited frontmatter syntax, not general YAML.
Static asset reads reject redirects, time out after 5 seconds and have a 1 MiB
limit each. Oracle paths are restricted to `tests/<safe-name>.js`.
The hash is declared by the contract, not a trusted signature: changing both
contract and oracle consistently is outside this integrity check's protection.
Use `npm run check` to actually run repository tests and validators.
The nine operational imperative
tools are forwarded to the existing native `document.modelContext.registerTool`
when available; `run_bash` is registered only by the browser's declarative form API.
Without native support, the local registry remains usable but does not prove
browser interoperability. Native tool errors reject instead of claiming success.

WebMCP-registered commands use a separate shell environment per invocation and
expand positional arguments after parsing instead of interpolating shell source.
Changes to their working directory and environment do not persist to the parent.
The virtual shell is not full Bash: `$@` and `$*` currently join arguments into one
string, and filesystem changes remain shared. This hardening is scoped to the
WebMCP registration path, not a claim of complete shell compatibility or isolation.
