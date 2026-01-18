#!/usr/bin/env bash

set -euo pipefail

SERVICES_DIR="./services"
TARGET_DIR="$(dirname "$SERVICES_DIR")"

find "$SERVICES_DIR" -type f \( -name "*.yml" -o -name "*.yaml" \) | while read -r file; do
  base="$(basename "$file")"
  new_name="app-$base"
  target="$TARGET_DIR/$new_name"

  if [[ -e "$target" ]]; then
    echo "ERROR: $target already exists. Skipping $file"
    continue
  fi

  echo "Moving: $file → $target"
#  echo mv "$file" "$target"
  mv "$file" "$target"
done

