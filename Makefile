.PHONY: all build build-go build-js build-all-platforms package package-platforms package-main install-browser deps clean clean-bin clean-js clean-packages clean-cache clean-all serve test test-cli test-js test-mcp test-mindmap test-gridprobe mindmap gridprobe double-tap help

# Default target
all: build

# Build everything (Go + JS)
build: build-go build-js

# Build clicker binary
build-go: deps
	cd clicker && go build -o bin/clicker ./cmd/clicker

# Build JS client
build-js: deps
	cd clients/javascript && npm run build

# Cross-compile clicker for all platforms (static binaries)
# Output: clicker/bin/clicker-{os}-{arch}[.exe]
build-all-platforms:
	@echo "Cross-compiling clicker for all platforms..."
	cd clicker && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o bin/clicker-linux-amd64 ./cmd/clicker
	cd clicker && CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -ldflags="-s -w" -o bin/clicker-linux-arm64 ./cmd/clicker
	cd clicker && CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 go build -ldflags="-s -w" -o bin/clicker-darwin-amd64 ./cmd/clicker
	cd clicker && CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -ldflags="-s -w" -o bin/clicker-darwin-arm64 ./cmd/clicker
	cd clicker && CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o bin/clicker-windows-amd64.exe ./cmd/clicker
	@echo "Done. Built binaries:"
	@ls -lh clicker/bin/clicker-*

# Copy binaries to platform packages for npm publishing
package-platforms: build-all-platforms
	@echo "Copying binaries to platform packages..."
	cp clicker/bin/clicker-linux-amd64 packages/linux-x64/bin/clicker
	cp clicker/bin/clicker-linux-arm64 packages/linux-arm64/bin/clicker
	cp clicker/bin/clicker-darwin-amd64 packages/darwin-x64/bin/clicker
	cp clicker/bin/clicker-darwin-arm64 packages/darwin-arm64/bin/clicker
	cp clicker/bin/clicker-windows-amd64.exe packages/win32-x64/bin/clicker.exe
	@echo "Done. Package binaries:"
	@ls -lh packages/*/bin/clicker*

# Build main vibium package (copy JS dist)
package-main: build-js
	@echo "Building main vibium package..."
	mkdir -p packages/vibium/dist
	cp -r clients/javascript/dist/* packages/vibium/dist/
	@echo "Done. Main package ready at packages/vibium/"

# Build all packages for npm publishing
package: package-platforms package-main
	@echo "All packages ready for publishing!"

# Install Chrome for Testing (required for tests)
install-browser: build-go
	./clicker/bin/clicker install

# Install npm dependencies (skip if node_modules exists)
deps:
	@if [ ! -d "node_modules" ]; then npm install; fi

# Start the proxy server
serve: build-go
	./clicker/bin/clicker serve

# Run all tests
test: build test-cli test-js test-mcp test-mindmap test-gridprobe test-loadpath

# Run CLI tests (tests the clicker binary directly)
# Process tests run separately with --test-concurrency=1 to avoid interference
test-cli: build-go
	@echo "━━━ CLI Tests ━━━"
	node --test tests/cli/navigation.test.js tests/cli/elements.test.js tests/cli/actionability.test.js
	@echo "━━━ CLI Process Tests (sequential) ━━━"
	node --test --test-concurrency=1 tests/cli/process.test.js

# Run JS library tests (sequential to avoid resource exhaustion)
test-js: build
	@echo "━━━ JS Library Tests ━━━"
	node --test --test-concurrency=1 tests/js/async-api.test.js tests/js/sync-api.test.js tests/js/auto-wait.test.js tests/js/browser-modes.test.js
	@echo "━━━ JS Process Tests (sequential) ━━━"
	node --test --test-concurrency=1 tests/js/process.test.js

# Run MCP server tests (sequential - browser sessions)
test-mcp: build-go
	@echo "━━━ MCP Server Tests ━━━"
	node --test --test-concurrency=1 tests/mcp/server.test.js

# Run mind map tests (pure logic, no browser or build needed)
test-mindmap:
	@echo "━━━ Mind Map Tests ━━━"
	node --test tests/mindmap/model.test.js

# Run grid probe tests (pure logic, no browser or build needed)
test-gridprobe:
	@echo "━━━ Grid Probe Tests ━━━"
	node --test tests/gridprobe/probe.test.js

# Run driver load path tests (pure logic, no browser or build needed)
test-loadpath:
	@echo "━━━ Driver Load Path Tests ━━━"
	node --test tests/loadpath/model.test.js tests/loadpath/touchpoints.test.js tests/loadpath/contacts.test.js tests/loadpath/scenarios.test.js tests/loadpath/vibration.test.js

# Print the Driver Load Path model report (headless, no browser)
loadpath-report:
	node apps/loadpath/js/m0-report.js

# Serve the Driver Load Path app on http://localhost:8081
loadpath:
	@echo "Driver Load Path: http://localhost:8081"
	cd apps/loadpath && python3 -m http.server 8081

# Serve the mind map app on http://localhost:8080
mindmap:
	@echo "Mind map: http://localhost:8080"
	cd apps/mindmap && python3 -m http.server 8080

# Serve the grid probe app on http://localhost:8081
gridprobe:
	@echo "Grid probe: http://localhost:8081"
	cd apps/gridprobe && python3 -m http.server 8081

# Kill zombie Chrome and chromedriver processes
double-tap:
	@echo "Killing zombie processes..."
	@pkill -9 -f 'Chrome for Testing' 2>/dev/null || true
	@pkill -9 -f chromedriver 2>/dev/null || true
	@sleep 1
	@echo "Done."

# Clean clicker binaries
clean-bin:
	rm -rf clicker/bin

# Clean JS dist
clean-js:
	rm -rf clients/javascript/dist

# Clean built packages
clean-packages:
	rm -f packages/*/bin/clicker packages/*/bin/clicker.exe
	rm -rf packages/vibium/dist

# Clean cached Chrome for Testing
clean-cache:
	rm -rf ~/Library/Caches/vibium/chrome-for-testing
	rm -rf ~/.cache/vibium/chrome-for-testing

# Clean everything (binaries + JS dist + packages + cache)
clean-all: clean-bin clean-js clean-packages clean-cache

# Alias for clean-bin + clean-js
clean: clean-bin clean-js

# Show available targets
help:
	@echo "Available targets:"
	@echo "  make                    - Build everything (default)"
	@echo "  make build-go           - Build clicker binary"
	@echo "  make build-js           - Build JS client"
	@echo "  make build-all-platforms - Cross-compile clicker for all platforms"
	@echo "  make package            - Build all packages for npm publishing"
	@echo "  make package-platforms  - Build platform packages only"
	@echo "  make package-main       - Build main package only"
	@echo "  make install-browser    - Install Chrome for Testing"
	@echo "  make deps               - Install npm dependencies"
	@echo "  make serve              - Start proxy server on :9515"
	@echo "  make test               - Run all tests (CLI + JS + MCP)"
	@echo "  make test-cli           - Run CLI tests only"
	@echo "  make test-js            - Run JS library tests only"
	@echo "  make test-mcp           - Run MCP server tests only"
	@echo "  make test-mindmap       - Run mind map tests only"
	@echo "  make test-gridprobe     - Run grid probe tests only"
	@echo "  make mindmap            - Serve the mind map app on :8080"
	@echo "  make gridprobe          - Serve the grid probe app on :8081"
	@echo "  make double-tap         - Kill zombie Chrome/chromedriver processes"
	@echo "  make clean              - Clean binaries and JS dist"
	@echo "  make clean-packages     - Clean built packages"
	@echo "  make clean-cache        - Clean cached Chrome for Testing"
	@echo "  make clean-all          - Clean everything"
	@echo "  make help               - Show this help"
