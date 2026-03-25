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
}
