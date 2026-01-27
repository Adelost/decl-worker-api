.PHONY: install build test test-ts test-py test-e2e test-all typecheck dev clean

# Install all dependencies
install:
	pnpm install
	pip install -e ".[dev]"

# Build TypeScript packages
build:
	pnpm build

# Run TypeScript unit tests
test-ts:
	pnpm test

# Run Python unit tests
test-py:
	python -m pytest shared/tasks/tests -v

# Run e2e tests
test-e2e:
	pnpm test:e2e

# Run all tests
test-all: test-ts test-py test-e2e
	@echo "All tests passed!"

# Alias for test-all
test: test-all

# Type check
typecheck:
	pnpm typecheck

# Start development server (requires Redis)
dev:
	pnpm dev

# Clean build artifacts
clean:
	rm -rf packages/*/dist
	rm -rf node_modules
	rm -rf .pytest_cache
	rm -rf shared/tasks/__pycache__
	rm -rf shared/tasks/tests/__pycache__
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

# Modal commands
modal-serve:
	cd backends/modal && modal serve app.py

modal-deploy:
	cd backends/modal && modal deploy app.py

modal-test:
	cd backends/modal && modal run app.py --task-type llm.chat --payload '{"prompt":"Hello"}'

# Ray commands
ray-start:
	ray start --head

ray-serve:
	cd backends/ray && python serve.py

# Docker Redis for development
redis:
	docker run -d --name worker-ai-dsl-redis -p 6379:6379 redis:alpine

redis-stop:
	docker stop worker-ai-dsl-redis && docker rm worker-ai-dsl-redis

# Quick smoke test
smoke:
	@echo "Running smoke tests..."
	pnpm test -- --run packages/core/tests/types.test.ts
	python -m pytest shared/tasks/tests/test_llm.py::TestChat::test_chat_basic -v
	@echo "Smoke tests passed!"
