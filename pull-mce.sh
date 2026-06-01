#!/bin/bash
# Pull latest MCE engine files from sibling moddable-chess repo
SRC="../moddable-chess/js"
DEST="lib/mce"

cp "$SRC/chess-engine.js" "$DEST/"
cp "$SRC/chess-moves.js" "$DEST/"
cp "$SRC/chess-play.js" "$DEST/"
cp "$SRC/chess-variants.js" "$DEST/"
cp "$SRC/chess-ai.js" "$DEST/"
cp "$SRC/chess-units.js" "$DEST/"
cp "$SRC/board-renderer.js" "$DEST/"
cp "$SRC/game-controller-core.js" "$DEST/"
cp "$SRC/replay.js" "$DEST/"

echo "MCE updated from $SRC"
