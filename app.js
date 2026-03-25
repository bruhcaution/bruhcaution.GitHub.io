// app.js - Aural Music Player

// ============================== 
// Service Worker Registration (Offline & Background Support)
// ============================== 
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
        navigator.serviceWorker.register('./sw.js').then(function (registration) {
            console.log('Service Worker registered with scope:', registration.scope);
        }).catch(function (error) {
            console.error('Service Worker registration failed:', error);
        });
    });
}

// ============================== 
// Audio Context & Nodes Setup
// ============================== 
let audioContext;
let sourceNode;
let analyser;
let eqFilters = [];

// Initialize audio context
function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

// ============================== 
// DOM Elements
// ============================== 
const audioElement = document.getElementById('audio-element');
const playPauseBtn = document.getElementById('play-pause-btn');
const nextBtn = document.getElementById('next-btn');
const prevBtn = document.getElementById('prev-btn');
const shuffleBtn = document.getElementById('shuffle-btn');
const repeatBtn = document.getElementById('repeat-btn');
const volumeSlider = document.getElementById('volume-slider');
const seekBar = document.getElementById('seek-bar');
const currentTimeDisplay = document.getElementById('current-time');
const durationDisplay = document.getElementById('duration');
const trackNameDisplay = document.getElementById('track-name');
const artistNameDisplay = document.getElementById('artist-name');
const albumArtContainer = document.getElementById('album-art-container');
const artPlaceholder = document.getElementById('art-placeholder');
const eqSlidersContainer = document.getElementById('eq-sliders');
const settingsToggle = document.getElementById('settings-toggle');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings');
const audioUpload = document.getElementById('audio-upload');

// ============================== 
// Player State
// ============================== 
let playlist = [];
let currentTrackIndex = 0;
let isPlaying = false;
let isShuffle = false;
let repeatMode = 0; // 0 = off, 1 = all, 2 = one

// ============================== 
// Equalizer Setup (10-Band)
// ============================== 
const EQ_BANDS = [
    { freq: 60, label: '60Hz' },
    { freq: 150, label: '150Hz' },
    { freq: 250, label: '250Hz' },
    { freq: 500, label: '500Hz' },
    { freq: 1000, label: '1kHz' },
    { freq: 2000, label: '2kHz' },
    { freq: 4000, label: '4kHz' },
    { freq: 8000, label: '8kHz' },
    { freq: 12000, label: '12kHz' },
    { freq: 16000, label: '16kHz' }
];

function setupEqualizer() {
    initAudioContext();
    
    // Clear existing filters
    eqFilters = [];
    
    // Create 10 peaking filters
    EQ_BANDS.forEach((band, index) => {
        const filter = audioContext.createBiquadFilter();
        filter.type = 'peaking';
        filter.frequency.value = band.freq;
        filter.Q.value = 1;
        filter.gain.value = 0;
        
        if (index === 0) {
            audioElement.addEventListener('play', () => {
                if (!sourceNode) {
                    sourceNode = audioContext.createMediaElementAudioSource(audioElement);
                }
                sourceNode.connect(filter);
            });
        } else {
            eqFilters[index - 1].connect(filter);
        }
        
        eqFilters.push(filter);
    });
    
    // Connect last filter to destination
    eqFilters[eqFilters.length - 1].connect(audioContext.destination);
    
    // Create UI sliders (constrained within viewport)
    createEQSliders();
}

function createEQSliders() {
    eqSlidersContainer.innerHTML = '';
    
    EQ_BANDS.forEach((band, index) => {
        const bandContainer = document.createElement('div');
        bandContainer.className = 'eq-band';
        
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '-12';
        slider.max = '12';
        slider.value = '0';
        slider.step = '0.1';
        
        slider.addEventListener('input', (e) => {
            eqFilters[index].gain.value = parseFloat(e.target.value);
        });
        
        const label = document.createElement('label');
        label.textContent = band.label;
        label.style.fontSize = '0.75rem';
        label.style.marginTop = '8px';
        
        bandContainer.appendChild(slider);
        bandContainer.appendChild(label);
        eqSlidersContainer.appendChild(bandContainer);
    });
}

// ============================== 
// Playlist & Track Management
// ============================== 
function addTracksToPlaylist(files) {
    for (let file of files) {
        if (file.type.startsWith('audio/')) {
            const fileReader = new FileReader();
            fileReader.onload = function (event) {
                audioContext.decodeAudioData(event.target.result, (buffer) => {
                    playlist.push({
                        name: file.name,
                        buffer: buffer,
                        file: file
                    });
                });
            };
            fileReader.readAsArrayBuffer(file);
        }
    }
}

function loadTrack(index) {
    if (playlist.length === 0) return;
    
    currentTrackIndex = (index + playlist.length) % playlist.length;
    const track = playlist[currentTrackIndex];
    
    // Create blob URL for audio element
    const blob = new Blob([track.file], { type: track.file.type });
    const url = URL.createObjectURL(blob);
    audioElement.src = url;
    
    // Update display
    trackNameDisplay.textContent = track.name;
    artistNameDisplay.textContent = 'Unknown Artist';
    
    seekBar.max = audioElement.duration || 100;
}

function playTrack() {
    if (playlist.length === 0) return;
    
    initAudioContext();
    audioElement.play();
    isPlaying = true;
    playPauseBtn.textContent = '⏸';
}

function pauseTrack() {
    audioElement.pause();
    isPlaying = false;
    playPauseBtn.textContent = '▶';
}

function nextTrack() {
    loadTrack(currentTrackIndex + 1);
    if (isPlaying) playTrack();
}

function prevTrack() {
    loadTrack(currentTrackIndex - 1);
    if (isPlaying) playTrack();
}

function shufflePlaylist() {
    isShuffle = !isShuffle;
    shuffleBtn.style.opacity = isShuffle ? '1' : '0.5';
    
    if (isShuffle) {
        // Shuffle algorithm
        for (let i = playlist.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [playlist[i], playlist[j]] = [playlist[j], playlist[i]];
        }
    }
}

function toggleRepeat() {
    repeatMode = (repeatMode + 1) % 3;
    const repeatIcons = ['🔁', '🔂', '🔃'];
    repeatBtn.textContent = repeatIcons[repeatMode];
    repeatBtn.style.opacity = repeatMode === 0 ? '0.5' : '1';
}

// ============================== 
// UI Event Listeners
// ============================== 
// Play/Pause
playPauseBtn.addEventListener('click', () => {
    if (playlist.length === 0) {
        alert('Please upload audio files first');
        return;
    }
    
    if (isPlaying) {
        pauseTrack();
    } else {
        if (!audioElement.src) {
            loadTrack(0);
        }
        playTrack();
    }
});

// Navigation
nextBtn.addEventListener('click', nextTrack);
prevBtn.addEventListener('click', prevTrack);

// Shuffle & Repeat
shuffleBtn.addEventListener('click', shufflePlaylist);
repeatBtn.addEventListener('click', toggleRepeat);

// Volume
volumeSlider.addEventListener('input', (e) => {
    audioElement.volume = e.target.value;
});

// Seek Bar
seekBar.addEventListener('input', (e) => {
    audioElement.currentTime = e.target.value;
});

// Time Update
audioElement.addEventListener('timeupdate', () => {
    seekBar.value = audioElement.currentTime;
    currentTimeDisplay.textContent = formatTime(audioElement.currentTime);
    durationDisplay.textContent = formatTime(audioElement.duration);
});

// Track End
audioElement.addEventListener('ended', () => {
    if (repeatMode === 2) {
        // Repeat one track
        audioElement.currentTime = 0;
        playTrack();
    } else {
        // Play next track
        nextTrack();
    }
});

// Audio Upload
audioUpload.addEventListener('change', (e) => {
    addTracksToPlaylist(e.target.files);
});

// Settings Modal
settingsToggle.addEventListener('click', () => {
    settingsModal.style.display = 'flex';
});

closeSettingsBtn.addEventListener('click', () => {
    settingsModal.style.display = 'none';
});

settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
        settingsModal.style.display = 'none';
    }
});

// ============================== 
// Utility Functions
// ============================== 
function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// ============================== 
// Initialize App
// ============================== 
window.addEventListener('DOMContentLoaded', () => {
    initAudioContext();
    setupEqualizer();
});

// Background playback support
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && audioContext.state === 'suspended') {
        audioContext.resume();
    }
});
