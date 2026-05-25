#!/bin/bash
# Pull latest MCE engine files from sibling moddable-chess repo
SRC="../moddable-chess/js"
DEST="lib/mce"

cp "$SRC/chess-engine.js" "$DEST/"
cp "$SRC/chess-moves.js" "$DEST/"
cp "$SRC/chess-play.js" "$DEST/"

echo "MCE updated from $SRC"
