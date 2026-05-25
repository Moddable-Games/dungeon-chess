#!/bin/bash
set -e

FILE="version.txt"
if [ ! -f "$FILE" ]; then
  echo "version.txt not found" >&2
  exit 1
fi

OLD=$(cat "$FILE" | tr -d '[:space:]')
IFS='.' read -r MAJOR MINOR PATCH <<< "$OLD"

PART="${1:-patch}"
case "$PART" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
  *) echo "Usage: ./bump.sh [major|minor|patch]" >&2; exit 1 ;;
esac

NEW="$MAJOR.$MINOR.$PATCH"
echo "$NEW" > "$FILE"

sed -i '' "s/\?v=$OLD/?v=$NEW/g" index.html
sed -i '' "s/>v$OLD</>v$NEW</g" index.html

echo "Bumped $OLD → $NEW"
