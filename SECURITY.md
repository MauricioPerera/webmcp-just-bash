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
