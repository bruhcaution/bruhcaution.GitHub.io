document.addEventListener('DOMContentLoaded', () => {
    const audio = document.getElementById('audio-element');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const seekBar = document.getElementById('seek-bar');
    const volumeSlider = document.getElementById('volume-slider');
    const trackName = document.getElementById('track-name');
    const artistName = document.getElementById('artist-name');
    const albumArt = document.getElementById('album-art-container');
    const artPlaceholder = document.getElementById('art-placeholder');
    const eqSliders = document.getElementById('eq-sliders');

    let audioCtx, source, filters = [];
    let queue = [];
    let currentIndex = 0;
    let isShuffle = false;

    // 10-Band Frequencies
    const freqs = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

    function initAudioEngine() {
        if (audioCtx) return;
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        source = audioCtx.createMediaElementSource(audio);
        let lastNode = source;

        freqs.forEach((f, i) => {
            const filter = audioCtx.createBiquadFilter();
            filter.type = "peaking";
            filter.frequency.value = f;
            filter.gain.value = 0;
            lastNode.connect(filter);
            lastNode = filter;
            filters.push(filter);

            // Create UI
            const band = document.createElement('div');
            band.className = 'eq-band';
            band.innerHTML = `<input type="range" min="-12" max="12" value="0" step="0.5" data-index="${i}">
                             <span class="eq-label">${f >= 1000 ? f/1000+'k' : f}</span>`;
            eqSliders.appendChild(band);
            band.querySelector('input').addEventListener('input', e => {
                filters[e.target.dataset.index].gain.value = e.target.value;
            });
        });
        lastNode.connect(audioCtx.destination);
    }

    async function loadTrack(index) {
        if (index < 0 || index >= queue.length) return;
        currentIndex = index;
        const file = queue[currentIndex];
        audio.src = URL.createObjectURL(file);
        
        // UI Defaults
        trackName.textContent = file.name.replace(/\.[^/.]+$/, "");
        artistName.textContent = "Loading metadata...";
        albumArt.style.backgroundImage = 'none';
        artPlaceholder.style.display = 'block';

        // Metadata Extraction
        window.jsmediatags.read(file, {
            onSuccess: (tag) => {
                const { title, artist, picture } = tag.tags;
                if (title) trackName.textContent = title;
                if (artist) artistName.textContent = artist;
                if (picture) {
                    const base64String = picture.data.reduce((acc, cur) => acc + String.fromCharCode(cur), "");
                    albumArt.style.backgroundImage = `url(data:${picture.format};base64,${btoa(base64String)})`;
                    artPlaceholder.style.display = 'none';
                }
                updateMediaSession(trackName.textContent, artistName.textContent);
            }
        });

        audio.play();
        playPauseBtn.textContent = '⏸';
    }

    function updateMediaSession(t, a) {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({ title: t, artist: a, album: 'Aural' });
        }
    }

    // Controls
    playPauseBtn.addEventListener('click', () => {
        initAudioEngine();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        if (audio.paused) { audio.play(); playPauseBtn.textContent = '⏸'; }
        else { audio.pause(); playPauseBtn.textContent = '▶'; }
    });

    document.getElementById('next-btn').addEventListener('click', () => {
        let next = isShuffle ? Math.floor(Math.random() * queue.length) : currentIndex + 1;
        loadTrack(next % queue.length);
    });

    document.getElementById('prev-btn').addEventListener('click', () => {
        loadTrack(currentIndex > 0 ? currentIndex - 1 : queue.length - 1);
    });

    audio.addEventListener('timeupdate', () => {
        if (!isNaN(audio.duration)) {
            seekBar.value = (audio.currentTime / audio.duration) * 100;
            document.getElementById('current-time').textContent = formatTime(audio.currentTime);
            document.getElementById('duration').textContent = formatTime(audio.duration);
        }
    });

    seekBar.addEventListener('input', () => audio.currentTime = (seekBar.value / 100) * audio.duration);
    volumeSlider.addEventListener('input', e => audio.volume = e.target.value);
    audio.addEventListener('ended', () => document.getElementById('next-btn').click());

    document.getElementById('audio-upload').addEventListener('change', e => {
        queue = Array.from(e.target.files);
        if (queue.length > 0) loadTrack(0);
    });

    // Modal
    document.getElementById('settings-toggle').addEventListener('click', () => document.getElementById('settings-modal').style.display = 'block');
    document.getElementById('close-settings').addEventListener('click', () => document.getElementById('settings-modal').style.display = 'none');

    function formatTime(s) {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec < 10 ? '0' : ''}${sec}`;
    }
});
