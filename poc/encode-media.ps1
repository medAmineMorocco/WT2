$ErrorActionPreference = 'Stop'

$pocRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$artifactDir = Join-Path $pocRoot 'artifacts'
$frames = Join-Path $artifactDir 'frames\frame-%05d.jpg'
$ffmpeg = Join-Path $pocRoot 'vendor\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe'

if (-not (Test-Path -LiteralPath $ffmpeg)) {
  throw "FFmpeg is missing at $ffmpeg"
}

# The CDP screencast is event-driven. Normalize its frames to a concise 10 fps
# source recording, then derive the delivery MP4 and palette-optimized GIF.
$normalize = 'scale=1440:900:force_original_aspect_ratio=decrease,pad=1440:900:(ow-iw)/2:(oh-ih)/2:black,setsar=1'
& $ffmpeg -y -framerate 10 -i $frames -vf $normalize -c:v libvpx-vp9 -crf 24 -b:v 0 -pix_fmt yuv420p (Join-Path $artifactDir 'create-worktree-source.webm')
if ($LASTEXITCODE -ne 0) { throw 'Unable to encode source WebM' }
& $ffmpeg -y -framerate 10 -i $frames -vf $normalize -c:v libx264 -preset medium -crf 21 -pix_fmt yuv420p -movflags +faststart (Join-Path $artifactDir 'create-worktree-demo.mp4')
if ($LASTEXITCODE -ne 0) { throw 'Unable to encode MP4' }
& $ffmpeg -y -framerate 10 -i $frames -vf "$normalize,fps=10,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=192[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3" -loop 0 (Join-Path $artifactDir 'create-worktree-demo.gif')
if ($LASTEXITCODE -ne 0) { throw 'Unable to encode GIF' }
