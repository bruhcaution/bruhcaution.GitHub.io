document.addEventListener('DOMContentLoaded', () => {
    // --- PWA Service Worker Registration ---
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(() => console.log('Aural is ready for offline use.'))
            .catch(err => console.error('Service Worker failed:', err));
    }

    const audioInput = document.getElementById('audio-upload');
    const audioElement = document.getElementById('audio-element');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const trackName = document.getElementById('track-name');
    const artistName = document.getElementById('artist-name');
    const albumArtContainer = document.getElementById('album-art-container');
    const artPlaceholder = document.getElementById('art-placeholder');
    const volumeSlider = document.getElementById('volume-slider');
    const eqContainer = document.getElementById('eq-sliders');

    let audioContext;
    let isPlaying = false;
    let queue = [];
    
    const frequencies = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
    const filters = [];

    function initAudio() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const sourceNode = audioContext.createMediaElementSource(audioElement);
            let prevNode = sourceNode;

            frequencies.forEach((freq, index) => {
                let filter = audioContext.createBiquadFilter();
                filter.type = 'peaking';
                filter.frequency.value = freq;
                filter.Q.value = 1;
                filter.gain.value = 0;

                prevNode.connect(filter);
                prevNode = filter;
                filters.push(filter);

                const bandDiv = document.createElement('div');
                bandDiv.className = 'eq-band';
                bandDiv.innerHTML = `
                    <input type="range" min="-12" max="12" step="0.1" value="0" data-index="${index}">
                    <span class="eq-label">${freq >= 1000 ? freq/1000 + 'k' : freq}</span>
                `;
                eqContainer.appendChild(bandDiv);

                bandDiv.querySelector('input').addEventListener('input', (e) => {
                    filters[e.target.dataset.index].gain.value = e.target.value;
                });
            });

            prevNode.connect(audioContext.destination);
        }
    }

    audioInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            queue = files;
            loadTrack(queue[0]);
        }
    });

    function loadTrack(file) {
        initAudio();
        const objectUrl = URL.createObjectURL(file);
        audioElement.src = objectUrl;
        
        // Default to filename if metadata fails
        trackName.textContent = file.name.replace(/\.[^/.]+$/, "");
        artistName.textContent = "Unknown Artist";
        resetAlbumArt();

        // Extract Metadata (Album Art & Info)
        const jsmediatags = window.jsmediatags;
        jsmediatags.read(file, {
            onSuccess: function(tag) {
                const tags = tag.tags;
                if (tags.title) trackName.textContent = tags.title;
                if (tags.artist) artistName.textContent = tags.artist;

                if (tags.picture) {
                    const data = tags.picture.data;
                    const format = tags.picture.format;
                    const uint8Array = new Uint8Array(data);
                    const blob = new Blob([uint8Array], { type: format });
                    const url = URL.createObjectURL(blob);
                    
                    albumArtContainer.style.backgroundImage = `url(${url})`;
                    albumArtContainer.style.backgroundSize = 'cover';
                    albumArtContainer.style.backgroundPosition = 'center';
                    artPlaceholder.style.display = 'none';
                }
            },
            onError: function(error) {
                console.log('Metadata not found or unreadable.', error);
            }
        });
        
        audioElement.play();
        isPlaying = true;
        playPauseBtn.textContent = '⏸';
        
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
    }

    function resetAlbumArt() {
        albumArtContainer.style.backgroundImage = 'linear-gradient(135deg, #2b2b2b, #1a1a1a)';
        artPlaceholder.style.display = 'block';
    }

    playPauseBtn.addEventListener('click', () => {
        if (!audioElement.src) return;
        if (audioContext && audioContext.state === 'suspended') audioContext.resume();

        if (isPlaying) {
            audioElement.pause();
            playPauseBtn.textContent = '▶';
        } else {
            audioElement.play();
            playPauseBtn.textContent = '⏸';
        }
        isPlaying = !isPlaying;
    });

    volumeSlider.addEventListener('input', (e) => {
        audioElement.volume = e.target.value;
    });
});
