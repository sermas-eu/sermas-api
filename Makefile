
TEST_FILTER?=

dev:
	docker compose kill || true
	docker compose rm || true
	docker rm -f sermas-toolkit-api-api-1 || true
	docker compose up -d
	docker restart sermas-toolkit-api-proxy-1 || true
	docker compose logs -f

test: test/watch

test/watch:
	cd ../../ && \
	make start/api && \
	docker compose kill api || true && docker compose rm -f api || true && \
	docker compose run -p 9229:9229 --rm --entrypoint npm api run test:debug -- ${TEST_FILTER}

dataset/clean:
	rm data/dataset -rf
	mkdir -p data/dataset

updates/check:
	npx npm-check-updates

updates/update:
	npx npm-check-updates -u
	npm i