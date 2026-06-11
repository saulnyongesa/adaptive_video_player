# Django Adaptive Video Player

A modern, reusable HLS adaptive video player for Django projects. It ships as a small Django app with static CSS/JS, a template tag, and a standalone vanilla JavaScript demo.

The player expects an HLS master playlist (`.m3u8`). HLS is the best practical default for Django because the chunks are ordinary static/media files and the browser can request them over normal HTTP.

This repository also includes a runnable Django demo project so you can test the player before installing it into another app.

## Features

- HLS playback with `hls.js` and native Safari fallback.
- Automatic adaptive bitrate switching chunk by chunk.
- Manual quality selector with `Auto` mode.
- Download speed telemetry from loaded media fragments.
- Modern controls: play, seek, mute, volume, quality, picture-in-picture, fullscreen.
- Reusable Django inclusion tag.
- Vanilla JavaScript API for non-Django pages.
- Demo support for YouTube links through YouTube's official iframe embed player.

## Install

```bash
pip install django-adaptive-video-player
```

For local development from this repository:

```bash
pip install -e .
```

Add the app to `INSTALLED_APPS`:

```python
INSTALLED_APPS = [
    # ...
    "adaptive_video_player",
]
```

Make sure Django static files are configured. In development, `runserver` will serve app static files when `django.contrib.staticfiles` is installed.

## Run The Django Demo Project

These steps work on a fresh machine with Python 3.9+ and Git installed.

### macOS or Linux

```bash
git clone https://github.com/saulnyongesa/adaptive_video_player.git
cd adaptive_video_player

python3 -m venv .venv
source .venv/bin/activate

python -m pip install --upgrade pip
python -m pip install -e .

python manage.py migrate
python manage.py runserver
```

Open:

```text
http://127.0.0.1:8000/
```

### Windows PowerShell

```powershell
git clone https://github.com/saulnyongesa/adaptive_video_player.git
cd adaptive_video_player

py -m venv .venv
.\.venv\Scripts\Activate.ps1

python -m pip install --upgrade pip
python -m pip install -e .

python manage.py migrate
python manage.py runserver
```

Open:

```text
http://127.0.0.1:8000/
```

If PowerShell blocks virtual environment activation, run:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Then activate the virtual environment again.

The demo uses public HLS test streams, so you do not need to generate video files before testing. To test your own stream, edit `demo/views.py` and replace `default_stream` with the URL to your `.m3u8` master playlist.

### Add Test Streams To The Demo

For a quick test, open the demo page and paste any public HLS playlist URL into the stream input:

```text
https://example.com/path/to/master.m3u8
```

The same input also accepts YouTube links such as:

```text
https://www.youtube.com/watch?v=M7lc1UVf-VE
https://youtu.be/M7lc1UVf-VE
https://www.youtube.com/shorts/VIDEO_ID
```

For permanent sample buttons, edit `demo/views.py` and add entries to `sample_streams`:

```python
"sample_streams": [
    {
        "name": "My test stream",
        "url": "https://example.com/video/master.m3u8",
    },
    {
        "name": "YouTube sample",
        "url": "https://www.youtube.com/watch?v=M7lc1UVf-VE",
    },
]
```

Restart the Django server after changing Python files:

```bash
python manage.py runserver
```

### Test With An Uploaded File

The demo page includes an upload form for normal video files such as `.mp4`, `.webm`, `.mov`, `.m4v`, and `.ogg`.

Uploaded files are saved to:

```text
media/uploads/
```

This upload path tests the player controls with a direct video file. It is not adaptive bitrate playback yet. For real adaptive playback, convert the video to HLS with FFmpeg and load the generated `master.m3u8`.

### YouTube Links

YouTube videos cannot be loaded directly into the custom HTML `<video>` HLS player as raw media files. YouTube does not expose normal cross-origin MP4/HLS URLs for arbitrary public videos in the way this player expects.

The Django demo handles YouTube links by detecting the video ID and switching to a YouTube `<iframe>` embed. This follows the official YouTube embed approach documented in the [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference) and [YouTube player parameters](https://developers.google.com/youtube/player_parameters).

That means:

- HLS `.m3u8` links use the custom adaptive player.
- Uploaded `.mp4`, `.webm`, `.mov`, `.m4v`, and `.ogg` files use the custom player as direct video files.
- YouTube links use YouTube's embedded player inside the same demo page.
- The custom controls and quality selector do not control YouTube playback; YouTube owns that iframe player.

## Django Usage

```django
{% load adaptive_player %}

{% adaptive_video_player "/media/videos/my-video/master.m3u8" title="My Video" poster="/media/videos/my-video/poster.jpg" %}
```

The tag accepts:

- `src`: required HLS master playlist URL.
- `poster`: optional image URL.
- `title`: accessible title shown in the player.
- `player_id`: optional DOM id.
- `autoplay`: optional boolean.
- `muted`: optional boolean.
- `controls`: optional boolean.

## Vanilla JavaScript Demo

Open:

```text
examples/vanilla-demo/index.html
```

The demo uses a public HLS test stream by default and lets you paste another `.m3u8` URL.

To create a player manually:

```html
<link rel="stylesheet" href="/static/adaptive_video_player/player.css">

<div class="avp" data-adaptive-player data-src="/media/videos/demo/master.m3u8" data-title="Demo">
  <video class="avp__video" playsinline preload="metadata"></video>
  <!-- controls markup from adaptive_video_player/player.html -->
</div>

<script src="https://cdn.jsdelivr.net/npm/hls.js@1"></script>
<script src="https://unpkg.com/lucide@latest"></script>
<script src="/static/adaptive_video_player/player.js"></script>
```

## Create HLS Files With FFmpeg

Install FFmpeg, then convert a source file into a master playlist plus variants:

```bash
mkdir -p media/videos/demo

ffmpeg -i input.mp4 \
  -filter_complex "[0:v]split=4[v1080][v720][v480][v360];[v1080]scale=w=1920:h=1080[v1080out];[v720]scale=w=1280:h=720[v720out];[v480]scale=w=854:h=480[v480out];[v360]scale=w=640:h=360[v360out]" \
  -map "[v1080out]" -map 0:a -c:v:0 h264 -b:v:0 5000k -c:a:0 aac -b:a:0 128k \
  -map "[v720out]" -map 0:a -c:v:1 h264 -b:v:1 2800k -c:a:1 aac -b:a:1 128k \
  -map "[v480out]" -map 0:a -c:v:2 h264 -b:v:2 1400k -c:a:2 aac -b:a:2 96k \
  -map "[v360out]" -map 0:a -c:v:3 h264 -b:v:3 800k -c:a:3 aac -b:a:3 96k \
  -f hls \
  -hls_time 6 \
  -hls_playlist_type vod \
  -hls_flags independent_segments \
  -hls_segment_filename "media/videos/demo/%v/segment_%03d.ts" \
  -master_pl_name master.m3u8 \
  -var_stream_map "v:0,a:0,name:1080p v:1,a:1,name:720p v:2,a:2,name:480p v:3,a:3,name:360p" \
  "media/videos/demo/%v/playlist.m3u8"
```

Your Django `MEDIA_ROOT` would then contain:

```text
media/videos/demo/master.m3u8
media/videos/demo/1080p/playlist.m3u8
media/videos/demo/1080p/segment_000.ts
media/videos/demo/720p/playlist.m3u8
...
```

Use `/media/videos/demo/master.m3u8` as the player source.

## Production Notes

- Serve HLS files from object storage or a CDN when traffic grows.
- Configure correct content types: `.m3u8` as `application/vnd.apple.mpegurl` and `.ts` as `video/mp2t`.
- Enable byte-range and cache headers for media files.
- Keep segment duration around 4-6 seconds for normal VOD playback.
- Do not transcode user uploads inside a web request. Run FFmpeg in a background worker such as Celery, RQ, or a managed media pipeline.

## Repository Layout

```text
manage.py
demo_project/
demo/
adaptive_video_player/
  static/adaptive_video_player/player.css
  static/adaptive_video_player/player.js
  templates/adaptive_video_player/player.html
  templatetags/adaptive_player.py
examples/vanilla-demo/index.html
```

## License

MIT
