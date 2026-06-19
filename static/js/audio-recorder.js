// static/js/audio-recorder.js
class AudioRecorderManager {
    constructor() {
        // DOM elements
        this.toggleBtn = document.getElementById('toggle-audio');
        this.audioContainer = document.getElementById('audio-recorder');
        this.textForm = document.getElementById('text-form');
        this.messageInput = document.getElementById('message-input');

        // State variables
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.stream = null;
        this.recordingStartTime = null;
        this.recordingTimer = null;
        this.analyser = null;
        this.audioContext = null;
        this.audioData = null;
        this.dragStartY = 0;
        this.currentY = 0;
        this.isDragging = false;
        this.sendOnRelease = true;

        // Bind methods to maintain 'this' context
        this.initializeAudioRecorder = this.initializeAudioRecorder.bind(this);
        this.startRecording = this.startRecording.bind(this);
        this.stopRecording = this.stopRecording.bind(this);
        this.cancelRecording = this.cancelRecording.bind(this);
        this.updateTimer = this.updateTimer.bind(this);
        this.drawWaveform = this.drawWaveform.bind(this);
        this.handleVisualFeedback = this.handleVisualFeedback.bind(this);
        this.handleDragStart = this.handleDragStart.bind(this);
        this.handleDrag = this.handleDrag.bind(this);
        this.handleDragEnd = this.handleDragEnd.bind(this);

        // Init
        this.initializeAudioRecorder();
    }

    initializeAudioRecorder() {
        // Create enhanced Telegram-style audio recorder UI
        this.createAudioRecorderUI();

        // Add event listeners
        this.toggleBtn.addEventListener('click', () => {
            this.textForm.classList.toggle('hidden');
            this.audioContainer.classList.toggle('hidden');

            if (!this.audioContainer.classList.contains('hidden')) {
                this.audioContainer.style.opacity = '0';
                this.audioContainer.style.transform = 'translateY(-10px)';

                setTimeout(() => {
                    this.audioContainer.style.opacity = '1';
                    this.audioContainer.style.transform = 'translateY(0)';
                }, 50);
            }
        });

        // Get DOM elements from the UI we just created
        this.recordButton = document.getElementById('record-button');
        this.cancelButton = document.getElementById('cancel-button');
        this.timerElement = document.getElementById('recording-timer');
        this.waveformCanvas = document.getElementById('waveform-canvas');
        this.canvasCtx = this.waveformCanvas.getContext('2d');
        this.recordHint = document.getElementById('record-hint');
        this.releaseHint = document.getElementById('release-hint');
        this.cancelHint = document.getElementById('cancel-hint');

        // Add event listeners for Telegram-style hold-to-record
        this.recordButton.addEventListener('mousedown', this.handleDragStart);
        this.recordButton.addEventListener('touchstart', this.handleDragStart, { passive: false });

        document.addEventListener('mousemove', this.handleDrag);
        document.addEventListener('touchmove', this.handleDrag, { passive: false });

        document.addEventListener('mouseup', this.handleDragEnd);
        document.addEventListener('touchend', this.handleDragEnd);

        this.cancelButton.addEventListener('click', () => {
            this.textForm.classList.remove('hidden');
            this.audioContainer.classList.add('hidden');
        });

        // Resize canvas to match container
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    createAudioRecorderUI() {
        this.audioContainer.innerHTML = `
            <div class="telegram-audio-recorder">
                <div class="audio-recorder-header">
                    <div id="recording-timer">0:00</div>
                    <button id="cancel-button" class="cancel-button" aria-label="Cancel recording">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="waveform-container">
                    <canvas id="waveform-canvas"></canvas>
                </div>
                
                <div class="audio-recorder-controls">
                    <div id="record-hint" class="record-hint visible">
                        <i class="fas fa-microphone"></i>
                        Press and hold to record
                    </div>
                    
                    <div id="release-hint" class="record-hint">
                        <i class="fas fa-paper-plane"></i>
                        Release to send
                    </div>
                    
                    <div id="cancel-hint" class="record-hint">
                        <i class="fas fa-ban"></i>
                        Slide up to cancel
                    </div>
                    
                    <button id="record-button" class="record-button" aria-label="Hold to record">
                        <i class="fas fa-microphone"></i>
                    </button>
                </div>
            </div>
        `;
    }

    resizeCanvas() {
        if (this.waveformCanvas) {
            const container = this.waveformCanvas.parentElement;
            this.waveformCanvas.width = container.clientWidth;
            this.waveformCanvas.height = container.clientHeight;
        }
    }

    handleDragStart(e) {
        e.preventDefault();

        // Get Y position
        this.dragStartY = e.type === 'touchstart'
            ? e.touches[0].clientY
            : e.clientY;

        this.currentY = this.dragStartY;
        this.isDragging = true;
        this.sendOnRelease = true;

        // Request microphone access and start recording
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                this.startRecording(stream);
            })
            .catch(error => {
                console.error('Error accessing microphone:', error);
                this.showError('Error accessing microphone. Please check permissions.');
            });
    }

    handleDrag(e) {
        if (!this.isDragging || !this.isRecording) return;

        e.preventDefault();

        // Get current Y position
        const y = e.type === 'touchmove'
            ? e.touches[0].clientY
            : e.clientY;

        this.currentY = y;

        // Calculate how far we've dragged upward
        const dragDistance = this.dragStartY - y;

        // If dragged up more than 50px, show cancel hint
        if (dragDistance > 70) {
            this.sendOnRelease = false;
            this.releaseHint.classList.remove('visible');
            this.cancelHint.classList.add('visible');

            // Visual feedback
            this.recordButton.classList.add('cancel-mode');
        } else {
            this.sendOnRelease = true;
            this.cancelHint.classList.remove('visible');
            this.releaseHint.classList.add('visible');

            // Remove cancel mode
            this.recordButton.classList.remove('cancel-mode');
        }

        // Animate record button based on drag
        this.handleVisualFeedback();
    }

    handleDragEnd(e) {
        if (!this.isDragging || !this.isRecording) return;

        this.isDragging = false;

        // If in cancel mode, cancel the recording
        if (!this.sendOnRelease) {
            this.cancelRecording();
        } else {
            // Otherwise stop and send
            this.stopRecording();
        }

        // Reset visual state
        this.recordButton.classList.remove('cancel-mode');
        this.recordButton.style.transform = 'scale(1)';
        this.releaseHint.classList.remove('visible');
        this.cancelHint.classList.remove('visible');
        this.record-hint.classList.add('visible');
    }

    handleVisualFeedback() {
        if (!this.isDragging) return;

        // Scale record button based on drag distance
        const dragDistance = this.dragStartY - this.currentY;
        let scale = 1;

        if (dragDistance > 0) {
            // Scale down as user drags up (for cancel)
            scale = Math.max(0.7, 1 - (dragDistance / 200));
        }

        this.recordButton.style.transform = `scale(${scale})`;
    }

    startRecording(stream) {
        this.stream = stream;
        this.audioChunks = [];
        const options = { mimeType: 'audio/webm' };

        try {
            this.mediaRecorder = new MediaRecorder(stream, options);
        } catch (e) {
            console.error('MediaRecorder error:', e);
            return;
        }

        // Set up audio visualization
        this.setupAudioVisualization(stream);

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.audioChunks.push(event.data);
            }
        };

        this.mediaRecorder.start();
        this.isRecording = true;

        // Update UI
        this.recordingStartTime = Date.now();
        this.recordingTimer = setInterval(this.updateTimer, 1000);

        // Hide record hint, show release hint
        this.record-hint.classList.remove('visible');
        this.releaseHint.classList.add('visible');

        // Add recording active state
        this.recordButton.classList.add('recording');
    }

    stopRecording() {
        if (!this.isRecording) return;

        clearInterval(this.recordingTimer);

        this.mediaRecorder.stop();
        this.stream.getTracks().forEach(track => track.stop());

        // Clean up audio context
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        this.isRecording = false;
        this.recordButton.classList.remove('recording');

        // Process recording and send
        this.processRecording();
    }

    cancelRecording() {
        if (!this.isRecording) return;

        clearInterval(this.recordingTimer);

        this.mediaRecorder.stop();
        this.stream.getTracks().forEach(track => track.stop());

        // Clean up audio context
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        this.isRecording = false;
        this.recordButton.classList.remove('recording');

        // Update timer back to 0:00
        this.timerElement.textContent = '0:00';

        // Don't send, just reset UI
        this.textForm.classList.remove('hidden');
        this.audioContainer.classList.add('hidden');

        // Show record hint again
        this.record-hint.classList.add('visible');
        this.releaseHint.classList.remove('visible');
        this.cancelHint.classList.remove('visible');
    }

    updateTimer() {
        const seconds = Math.floor((Date.now() - this.recordingStartTime) / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;

        this.timerElement.textContent = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    setupAudioVisualization(stream) {
        // Set up audio context and analyser
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;

        const source = this.audioContext.createMediaStreamSource(stream);
        source.connect(this.analyser);

        this.audioData = new Uint8Array(this.analyser.frequencyBinCount);

        // Start drawing waveform
        this.drawWaveform();
    }

    drawWaveform() {
        if (!this.isRecording || !this.analyser) return;

        // Clear canvas
        this.canvasCtx.clearRect(0, 0, this.waveformCanvas.width, this.waveformCanvas.height);

        // Get audio data
        this.analyser.getByteFrequencyData(this.audioData);

        const width = this.waveformCanvas.width;
        const height = this.waveformCanvas.height;

        // Draw waveform bars - Telegram style (multiple discrete bars)
        const barCount = 40;
        const barWidth = width / barCount - 2;

        // Draw waveform
        this.canvasCtx.fillStyle = '#3498db';

        for (let i = 0; i < barCount; i++) {
            // Use audio data to determine bar height
            const dataIndex = Math.floor(i / barCount * this.audioData.length);

            // Apply some smoothing and scaling
            const rawValue = this.audioData[dataIndex];
            const barHeight = (rawValue / 255.0) * height * 0.8; // Scale to 80% of canvas height

            // Add slight randomness for a more natural look
            const jitter = Math.random() * 5;
            const finalHeight = Math.max(5, barHeight + jitter);

            // Draw the bar
            const x = i * (barWidth + 2);
            const y = (height - finalHeight) / 2;

            // Rounded bars
            this.canvasCtx.beginPath();
            this.canvasCtx.roundRect(x, y, barWidth, finalHeight, 3);
            this.canvasCtx.fill();
        }

        // Continue animation
        requestAnimationFrame(this.drawWaveform);
    }

    async processRecording() {
        if (this.audioChunks.length === 0) return;

        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });

        // Show sending indicator
        const loadingMessage = this.showTemporaryMessage('Sending audio message...');

        try {
            // Calls main app's sendAudioQuestion or an equivalent function
            if (typeof window.sendAudioQuestion === 'function') {
                const response = await window.sendAudioQuestion(audioBlob);

                // Update UI to show the transcribed text and response
                window.removeTemporaryMessage(loadingMessage);

                if (response.transcribed_text) {
                    window.addMessage('user', response.transcribed_text);
                }

                window.simulateTypingResponse(response.answer);
                window.updateConversationId(response.conversation_id);
            } else {
                console.error('sendAudioQuestion function not found');
                this.showError('Unable to send audio message.');
            }
        } catch (error) {
            console.error('Error processing audio:', error);
            this.showError('Failed to process audio. Please try again.');
        }

        // Reset UI
        this.textForm.classList.remove('hidden');
        this.audioContainer.classList.add('hidden');

        // Reset timer
        this.timerElement.textContent = '0:00';
    }

    showTemporaryMessage(message) {
        // Defer to main app's loading indicator if available
        if (typeof window.showTypingIndicator === 'function') {
            window.showTypingIndicator();
            return { type: 'typing-indicator' };
        }

        // Fallback loading message
        const messageElement = document.createElement('div');
        messageElement.className = 'temp-message';
        messageElement.textContent = message;

        document.body.appendChild(messageElement);
        return messageElement;
    }

    showError(errorMessage) {
        // Use main app's error handler if available
        if (typeof window.addErrorMessage === 'function') {
            window.addErrorMessage(errorMessage);
        } else {
            alert(errorMessage);
        }
    }
}

// Initialize once DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Expose necessary functions to window to allow integration with main app.js
    window.audioRecorderManager = new AudioRecorderManager();

    // Export needed functions for external use
    window.startAudioRecording = window.audioRecorderManager.startRecording;
    window.stopAudioRecording = window.audioRecorderManager.stopRecording;
    window.cancelAudioRecording = window.audioRecorderManager.cancelRecording;
});