#!/bin/bash
# Stitch single continuous video with concatenated narration audio.
# Adds 1.5s silence between each narration segment for scene transitions.

set -e

BASEDIR="$(cd "$(dirname "$0")/.." && pwd)"
VDIR="$BASEDIR/docs/video_recordings"
ADIR="$BASEDIR/docs/video_audio"
TMPDIR="$(mktemp -d)"
FINAL="$BASEDIR/docs/stdn_explorer_walkthrough.mp4"

VIDEO="$VDIR/full_walkthrough.webm"

# Audio segments in order
SEGMENTS=(
  00_intro
  01_material_network
  02_technology_network
  03_concentration
  04_dominance
  05_overlap
  06_supply_disruption
  07_trade_disruption
  08_analyst
  09_gemini
  10_closing
)

# Generate 1.5s silence file
ffmpeg -y -hide_banner -loglevel warning \
  -f lavfi -i anullsrc=r=44100:cl=mono -t 1.5 \
  -c:a mp3 "$TMPDIR/silence.mp3"

# Build concat list: segment, silence, segment, silence, ...
CONCAT_LIST="$TMPDIR/audio_concat.txt"
> "$CONCAT_LIST"

for i in "${!SEGMENTS[@]}"; do
  seg="${SEGMENTS[$i]}"
  echo "file '$ADIR/${seg}.mp3'" >> "$CONCAT_LIST"
  # Add silence gap after each segment except the last
  if [ "$i" -lt $((${#SEGMENTS[@]} - 1)) ]; then
    echo "file '$TMPDIR/silence.mp3'" >> "$CONCAT_LIST"
  fi
done

echo "Concatenating audio segments..."
ffmpeg -y -hide_banner -loglevel warning \
  -f concat -safe 0 -i "$CONCAT_LIST" \
  -c:a mp3 "$TMPDIR/full_narration.mp3"

AUDIO_DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$TMPDIR/full_narration.mp3")
VIDEO_DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$VIDEO")
echo "Audio duration: ${AUDIO_DUR}s"
echo "Video duration: ${VIDEO_DUR}s"

echo "Combining video + audio..."
# If audio is longer than video, hold the last video frame to match.
# tpad=stop_mode=clone:stop_duration=60 repeats the last frame for up to 60s.
ffmpeg -y -hide_banner -loglevel warning \
  -i "$VIDEO" \
  -i "$TMPDIR/full_narration.mp3" \
  -filter_complex "[0:v]tpad=stop_mode=clone:stop_duration=60[v]" \
  -map "[v]" -map 1:a:0 \
  -c:v libx264 -preset fast -crf 23 \
  -c:a aac -b:a 192k \
  -t "$AUDIO_DUR" \
  "$FINAL"

DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$FINAL")
SIZE=$(du -h "$FINAL" | cut -f1)
echo ""
echo "Done! Final video: $FINAL"
echo "Duration: ${DUR}s ($(echo "scale=1; $DUR / 60" | bc)m)  Size: ${SIZE}"

rm -rf "$TMPDIR"
