(function () {
  const icons = {
    play: "play",
    pause: "pause",
    mute: "volume-x",
    volume: "volume-2",
    fullscreen: "maximize",
    exitFullscreen: "minimize",
  };

  class AdaptiveVideoPlayer {
    constructor(root, options = {}) {
      this.root = root;
      this.video = root.querySelector("video");
      this.src = options.src || root.dataset.src;
      this.hls = null;
      this.levels = [];
      this.speedMbps = 0;
      this.idleTimer = null;
      this.controls = {
        play: root.querySelector("[data-avp-play]"),
        mute: root.querySelector("[data-avp-mute]"),
        volume: root.querySelector("[data-avp-volume]"),
        timeline: root.querySelector("[data-avp-timeline]"),
        current: root.querySelector("[data-avp-current]"),
        duration: root.querySelector("[data-avp-duration]"),
        quality: root.querySelector("[data-avp-quality]"),
        speed: root.querySelector("[data-avp-speed]"),
        pip: root.querySelector("[data-avp-pip]"),
        fullscreen: root.querySelector("[data-avp-fullscreen]"),
      };

      if (!this.video || !this.src) {
        throw new Error("AdaptiveVideoPlayer requires a video element and an HLS src.");
      }

      this.bindUi();
      this.load();
      this.renderIcons();
    }

    setSource(src, options = {}) {
      if (!src) return;
      this.src = src;
      this.root.dataset.src = src;
      this.levels = [];
      this.speedMbps = 0;
      this.root.dataset.level = "";
      this.video.pause();
      this.video.removeAttribute("src");
      this.video.load();
      this.load();

      if (options.title) {
        const title = this.root.querySelector(".avp__title");
        if (title) title.textContent = options.title;
        this.root.dataset.title = options.title;
      }
    }

    load() {
      this.destroyHls();
      this.populateQualityMenu([]);
      this.setSpeedLabel("-- Mbps");

      if (!this.isHlsSource(this.src)) {
        this.video.src = this.src;
        this.setSpeedLabel("Direct file");
        if (this.controls.quality) this.controls.quality.disabled = true;
        return;
      }

      if (this.controls.quality) this.controls.quality.disabled = false;

      if (this.video.canPlayType("application/vnd.apple.mpegurl")) {
        this.video.src = this.src;
        this.setSpeedLabel("Native HLS");
        return;
      }

      if (!window.Hls || !window.Hls.isSupported()) {
        this.setSpeedLabel("HLS unavailable");
        return;
      }

      this.hls = new window.Hls({
        enableWorker: true,
        lowLatencyMode: false,
        capLevelToPlayerSize: true,
      });

      this.hls.loadSource(this.src);
      this.hls.attachMedia(this.video);

      this.hls.on(window.Hls.Events.MANIFEST_PARSED, (_, data) => {
        this.levels = data.levels || [];
        this.populateQualityMenu(this.levels);
      });

      this.hls.on(window.Hls.Events.LEVEL_SWITCHED, (_, data) => {
        if (this.controls.quality && this.hls.currentLevel === -1) {
          this.controls.quality.value = "-1";
        }
        this.root.dataset.level = String(data.level);
      });

      this.hls.on(window.Hls.Events.FRAG_LOADED, (_, data) => {
        this.updateBandwidth(data);
      });

      this.hls.on(window.Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          this.recover(data.type);
        }
      });
    }

    bindUi() {
      this.controls.play?.addEventListener("click", () => this.togglePlay());
      this.video.addEventListener("click", () => this.togglePlay());
      this.video.addEventListener("play", () => this.setButtonIcon(this.controls.play, icons.pause));
      this.video.addEventListener("pause", () => this.setButtonIcon(this.controls.play, icons.play));
      this.video.addEventListener("timeupdate", () => this.updateTime());
      this.video.addEventListener("durationchange", () => this.updateTime());
      this.video.addEventListener("volumechange", () => this.updateVolumeIcon());
      this.root.addEventListener("mousemove", () => this.showControls());
      this.root.addEventListener("mouseleave", () => this.root.dataset.idle = "true");

      this.controls.timeline?.addEventListener("input", (event) => {
        if (!Number.isFinite(this.video.duration)) return;
        this.video.currentTime = (Number(event.target.value) / 1000) * this.video.duration;
      });

      this.controls.mute?.addEventListener("click", () => {
        this.video.muted = !this.video.muted;
      });

      this.controls.volume?.addEventListener("input", (event) => {
        this.video.volume = Number(event.target.value);
        this.video.muted = this.video.volume === 0;
      });

      this.controls.quality?.addEventListener("change", (event) => {
        const level = Number(event.target.value);
        if (this.hls) {
          this.hls.currentLevel = level;
        }
      });

      this.controls.pip?.addEventListener("click", () => this.togglePictureInPicture());
      this.controls.fullscreen?.addEventListener("click", () => this.toggleFullscreen());
      document.addEventListener("fullscreenchange", () => this.updateFullscreenIcon());
    }

    togglePlay() {
      if (this.video.paused) {
        this.video.play().catch(() => {});
      } else {
        this.video.pause();
      }
    }

    isHlsSource(src) {
      return /\.m3u8($|\?)/i.test(src);
    }

    populateQualityMenu(levels = this.levels) {
      if (!this.controls.quality) return;
      this.controls.quality.innerHTML = '<option value="-1">Auto</option>';
      levels.forEach((level, index) => {
        const option = document.createElement("option");
        option.value = String(index);
        option.textContent = `${level.height || "?"}p`;
        this.controls.quality.appendChild(option);
      });
    }

    updateBandwidth(data) {
      const stats = data?.frag?.stats || data?.stats;
      const loadedBytes = stats?.loaded || stats?.total;
      const start = stats?.loading?.start || stats?.trequest;
      const end = stats?.loading?.end || stats?.tload;

      if (!loadedBytes || !start || !end || end <= start) return;

      const instantMbps = (loadedBytes * 8) / ((end - start) / 1000) / 1000000;
      this.speedMbps = this.speedMbps ? this.speedMbps * 0.72 + instantMbps * 0.28 : instantMbps;
      this.setSpeedLabel(`${this.speedMbps.toFixed(1)} Mbps`);
    }

    updateTime() {
      const duration = Number.isFinite(this.video.duration) ? this.video.duration : 0;
      const current = this.video.currentTime || 0;

      if (this.controls.current) this.controls.current.textContent = this.formatTime(current);
      if (this.controls.duration) this.controls.duration.textContent = this.formatTime(duration);
      if (this.controls.timeline) {
        this.controls.timeline.value = duration ? String(Math.round((current / duration) * 1000)) : "0";
      }
    }

    updateVolumeIcon() {
      const muted = this.video.muted || this.video.volume === 0;
      this.setButtonIcon(this.controls.mute, muted ? icons.mute : icons.volume);
      if (this.controls.volume) this.controls.volume.value = String(this.video.muted ? 0 : this.video.volume);
    }

    togglePictureInPicture() {
      if (!document.pictureInPictureEnabled || !this.video.requestPictureInPicture) return;
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {});
      } else {
        this.video.requestPictureInPicture().catch(() => {});
      }
    }

    toggleFullscreen() {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      } else {
        this.root.requestFullscreen().catch(() => {});
      }
    }

    updateFullscreenIcon() {
      this.setButtonIcon(
        this.controls.fullscreen,
        document.fullscreenElement ? icons.exitFullscreen : icons.fullscreen
      );
    }

    recover(type) {
      if (!this.hls || !window.Hls) return;
      if (type === window.Hls.ErrorTypes.NETWORK_ERROR) {
        this.hls.startLoad();
      } else if (type === window.Hls.ErrorTypes.MEDIA_ERROR) {
        this.hls.recoverMediaError();
      } else {
        this.hls.destroy();
      }
    }

    showControls() {
      this.root.dataset.idle = "false";
      clearTimeout(this.idleTimer);
      if (!this.video.paused) {
        this.idleTimer = setTimeout(() => {
          this.root.dataset.idle = "true";
        }, 2400);
      }
    }

    setSpeedLabel(label) {
      if (this.controls.speed) this.controls.speed.textContent = label;
    }

    setButtonIcon(button, iconName) {
      if (!button) return;
      const icon = button.querySelector("[data-lucide]");
      if (icon) icon.setAttribute("data-lucide", iconName);
      this.renderIcons();
    }

    renderIcons() {
      if (window.lucide) {
        window.lucide.createIcons({ attrs: { "aria-hidden": "true" } });
      }
    }

    formatTime(seconds) {
      const safeSeconds = Math.max(0, Math.floor(seconds || 0));
      const minutes = Math.floor(safeSeconds / 60);
      const remainder = safeSeconds % 60;
      return `${minutes}:${String(remainder).padStart(2, "0")}`;
    }

    destroyHls() {
      if (this.hls) {
        this.hls.destroy();
        this.hls = null;
      }
    }

    destroy() {
      clearTimeout(this.idleTimer);
      this.destroyHls();
    }
  }

  window.AdaptiveVideoPlayer = AdaptiveVideoPlayer;

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-adaptive-player]").forEach((root) => {
      if (!root.dataset.avpReady) {
        root.dataset.avpReady = "true";
        root.avp = new AdaptiveVideoPlayer(root);
      }
    });
  });
})();
