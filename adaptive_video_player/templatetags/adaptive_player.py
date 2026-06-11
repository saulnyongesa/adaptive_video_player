from django import template


register = template.Library()


@register.inclusion_tag("adaptive_video_player/player.html")
def adaptive_video_player(
    src,
    poster="",
    title="Video",
    player_id="",
    autoplay=False,
    muted=False,
    controls=True,
):
    return {
        "src": src,
        "poster": poster,
        "title": title,
        "player_id": player_id,
        "autoplay": autoplay,
        "muted": muted,
        "controls": controls,
    }

