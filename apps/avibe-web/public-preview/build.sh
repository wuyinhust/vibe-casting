#!/bin/sh
set -eu
cd "$(dirname "$0")"
mkdir -p dist
cp index.html preview.css preview.js dist/
