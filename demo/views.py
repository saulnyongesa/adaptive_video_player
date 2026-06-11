from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.shortcuts import render


ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov", ".m4v", ".ogg"}


def index(request):
    uploaded_video_url = ""
    upload_error = ""

    if request.method == "POST":
        uploaded_file = request.FILES.get("video_file")
        if not uploaded_file:
            upload_error = "Choose a video file first."
        else:
            extension = Path(uploaded_file.name).suffix.lower()
            if extension not in ALLOWED_VIDEO_EXTENSIONS:
                upload_error = "Upload an MP4, WebM, MOV, M4V, or OGG video file."
            else:
                storage = FileSystemStorage(
                    location=settings.MEDIA_ROOT / "uploads",
                    base_url=f"{settings.MEDIA_URL}uploads/",
                )
                filename = storage.save(f"{uuid4().hex}{extension}", uploaded_file)
                uploaded_video_url = storage.url(filename)

    context = {
        "default_stream": "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
        "uploaded_video_url": uploaded_video_url,
        "upload_error": upload_error,
        "sample_streams": [
            {
                "name": "Mux test stream",
                "url": "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
            },
            {
                "name": "Apple bip-bop",
                "url": "https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_16x9/bipbop_16x9_variant.m3u8",
            },
            {
                "name": "Sintel trailer",
                "url": "https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8",
            },
            {
                "name": "YouTube iframe sample",
                "url": "https://www.youtube.com/watch?v=M7lc1UVf-VE",
            },
        ],
    }
    return render(request, "demo/index.html", context)
