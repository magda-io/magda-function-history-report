# 2.1.0

-   Upgrade to Node.js 22: the docker image now uses `node:22-alpine` (was `node:14-alpine3.11`), and CI uses Node.js 22
-   Explicitly use `isomorphic-fetch` for all HTTP requests (Node.js 18+ ships a built-in `fetch`, so the polyfill is no longer installed globally)
-   Fix the docker image build: use the `ghcr.io/magda-io/of-watchdog:0.7.6` mirror (the `openfaas/of-watchdog` Docker Hub image is no longer available), and upgrade `@magda/docker-utils` to v2 so the build no longer rewrites that image's tag
-   Upgrade GitHub Actions (checkout, setup-node, setup-qemu & setup-buildx) to current versions

# 2.0.0

-   Upgrade nodejs to version 14
-   Upgrade other dependencies
-   Release all artifacts to GitHub Container Registry (instead of docker.io & https://charts.magda.io)
-   Upgrade magda-common chart version to v2.1.1
-   Build multi-arch docker images

# 1.1.0

-   Remove labels from metadata ( use labels in `spec` instead)
-   Release multi-arch docker images (linux/amd64, linux/arm64) from CI pipeline

# 1.0.0

-   Upgrade dependencies
-   Upgrade CI scripts
-   Related to https://github.com/magda-io/magda/issues/3229, Use magda-common for docker image related logic
