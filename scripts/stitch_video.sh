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
  intro_hook
  intro_context
  mat_intro
  mat_helium
  mat_domain
  mat_subdomain
  mat_smartphone
  tech_overview
  tech_component
  tech_helium
  tech_qatar
  conc_intro
  conc_helium
  dom_intro
  dom_qatar
  overlap_materials
  overlap_countries
  disrupt_intro
  disrupt_expand
  trade_intro
  trade_helium
  trade_subst
  analyst_report
  gemini_query
  transition
  data_origin
  closing
)

# Build ffmpeg filter to concatenate all audio with 1.5s silence gaps
echo "Concatenating audio segments..."

# Build input args and filter chain
INPUT_ARGS=""
FILTER=""
idx=0
for seg in "${SEGMENTS[@]}"; do
  INPUT_ARGS="$INPUT_ARGS -i $ADIR/${seg}.mp3"
  idx=$((idx + 1))
done

# Use concat filter with gaps by padding each segment with 1.5s silence
FILTER_PARTS=""
for i in $(seq 0 $((idx - 1))); do
  FILTER_PARTS="${FILTER_PARTS}[$i:a]apad=pad_dur=1.5[a$i];"
done
CONCAT_INPUTS=""
for i in $(seq 0 $((idx - 1))); do
  CONCAT_INPUTS="${CONCAT_INPUTS}[a$i]"
done
FILTER="${FILTER_PARTS}${CONCAT_INPUTS}concat=n=${idx}:v=0:a=1[outa]"

ffmpeg -y -hide_banner -loglevel warning \
  $INPUT_ARGS \
  -filter_complex "$FILTER" \
  -map "[outa]" \
  -c:a aac -b:a 192k \
  "$TMPDIR/full_narration.m4a"

AUDIO_DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$TMPDIR/full_narration.m4a")
VIDEO_DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$VIDEO")
echo "Audio duration: ${AUDIO_DUR}s"
echo "Video duration: ${VIDEO_DUR}s"

echo "Combining video + audio with pipeline diagram highlights..."

# Data origin segment starts at approximately 400s in the combined audio.
# The narration maps to pipeline stages as follows (offsets from data_origin start):
#   0-8s:   General intro ("not assembled by hand... pipeline of AI agents")
#   8-18s:  Stage 1 - Component Extraction ("Multiple agents... components... converge")
#   18-21s: Stage 2 - Materials Mapping ("The same process repeats for materials")
#   21-30s: Stage 3 - Country Data ("Country production data... USGS... fallbacks")
#   30-38s: Stage 4 - Normalization ("Every row carries a confidence score... provenance")
#   38-62s: Stats/scale ("A single technology takes about 30 minutes..." through end)
#
# Pipeline diagram box coordinates (from SVG at 1440x900):
#   Stage 1: x=60  y=140 w=300 h=380
#   Stage 2: x=400 y=140 w=300 h=380
#   Stage 3: x=740 y=140 w=300 h=380
#   Stage 4: x=1080 y=140 w=300 h=380
#   Output:  x=60  y=560 w=1320 h=140
#   Stats:   x=60  y=730 w=1320 h=60

DO=400  # data_origin start time in seconds

ffmpeg -y -hide_banner -loglevel warning \
  -i "$VIDEO" \
  -i "$TMPDIR/full_narration.m4a" \
  -filter_complex "
    [0:v]tpad=stop_mode=clone:stop_duration=60,
    drawbox=x=60:y=140:w=300:h=380:color=yellow@0.15:t=fill:enable='between(t,${DO}+8,${DO}+18)',
    drawbox=x=60:y=140:w=300:h=380:color=yellow@0.4:t=3:enable='between(t,${DO}+8,${DO}+18)',
    drawbox=x=400:y=140:w=300:h=380:color=yellow@0.15:t=fill:enable='between(t,${DO}+18,${DO}+21)',
    drawbox=x=400:y=140:w=300:h=380:color=yellow@0.4:t=3:enable='between(t,${DO}+18,${DO}+21)',
    drawbox=x=740:y=140:w=300:h=380:color=yellow@0.15:t=fill:enable='between(t,${DO}+21,${DO}+30)',
    drawbox=x=740:y=140:w=300:h=380:color=yellow@0.4:t=3:enable='between(t,${DO}+21,${DO}+30)',
    drawbox=x=1080:y=140:w=300:h=380:color=yellow@0.15:t=fill:enable='between(t,${DO}+30,${DO}+38)',
    drawbox=x=1080:y=140:w=300:h=380:color=yellow@0.4:t=3:enable='between(t,${DO}+30,${DO}+38)',
    drawbox=x=60:y=560:w=1320:h=140:color=yellow@0.12:t=fill:enable='between(t,${DO}+38,${DO}+43)',
    drawbox=x=60:y=560:w=1320:h=140:color=yellow@0.35:t=3:enable='between(t,${DO}+38,${DO}+43)',
    drawbox=x=60:y=730:w=1320:h=60:color=yellow@0.12:t=fill:enable='between(t,${DO}+43,${DO}+62)',
    drawbox=x=60:y=730:w=1320:h=60:color=yellow@0.35:t=3:enable='between(t,${DO}+43,${DO}+62)'
    [v]" \
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
