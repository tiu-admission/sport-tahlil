// static/js/app.js - Enhanced with typing animation and audio playback for SportTahlil
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements - ИСПРАВЛЕННЫЕ СЕЛЕКТОРЫ
    const chatMessages = document.getElementById('chat-messages');
    const textForm = document.getElementById('chat-form'); // ИСПРАВЛЕНО: было 'text-form'
    const messageInput = document.getElementById('message-input');
    const toggleAudioBtn = document.getElementById('voice-toggle'); // ИСПРАВЛЕНО: было 'toggle-audio'
    const audioRecorder = document.querySelector('.audio-recorder');
    const recordButton = document.getElementById('record-btn'); // ИСПРАВЛЕНО: было 'record-button'
    const stopButton = document.getElementById('stop-btn'); // ИСПРАВЛЕНО: было 'stop-button'
    const cancelAudioBtn = document.getElementById('cancel-btn'); // ИСПРАВЛЕНО: было 'cancel-audio'
    const recordingPulse = document.querySelector('.recording-pulse');
    const recordingStatus = document.getElementById('recording-status');
    
    // Variables for audio recording
    let mediaRecorder;
    let audioChunks = [];
    let recordingStartTime;
    let recordingTimer;
    let conversationId = null;
    
    // Store recorded audio for playback
    let audioMessages = {};

    initializeIOSSupport();
    setupAudioRecording();

    // WebSocket connection
    const clientId = generateUUID();
    let ws = null;
    let wsReconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    // Initialize WebSocket connection
    function initializeWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/${clientId}`;
        
        ws = new WebSocket(wsUrl);
        
        ws.onopen = function() {
            console.log('WebSocket connection established');
            wsReconnectAttempts = 0;
            
            // Setup ping interval to keep connection alive
            setInterval(function() {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'ping'
                    }));
                }
            }, 30000); // Send ping every 30 seconds
        };
        
        ws.onmessage = function(event) {
            const message = JSON.parse(event.data);
            
            switch (message.type) {
                case 'pong':
                    // Connection is alive, do nothing
                    break;
                    
                case 'processing':
                    // Show typing indicator
                    addTypingIndicator();
                    break;
                    
                case 'chat_response':
                    removeTypingIndicator();
                    addAnimatedMessage('assistant', message.data.answer);
                    conversationId = message.data.conversation_id;
                    scrollToBottom();
                    isGenerating = false;
                    break;

                case 'error':
                    removeTypingIndicator();
                    console.error('WebSocket error:', message.data.message);
                    addErrorMessage(message.data.message);
                    isGenerating = false;
                    break;
            }
        };
        
        ws.onclose = function() {
            console.log('WebSocket connection closed');
            
            // Attempt to reconnect if not exceeding max attempts
            if (wsReconnectAttempts < maxReconnectAttempts) {
                wsReconnectAttempts++;
                setTimeout(initializeWebSocket, 3000 * wsReconnectAttempts); // Exponential backoff
            } else {
                console.error('Maximum WebSocket reconnection attempts reached');
            }
        };
        
        ws.onerror = function(error) {
            console.error('WebSocket error:', error);
        };
    }

    // Initialize WebSocket
    initializeWebSocket();

    // Stop button: replaces send button during generation
    function showStopButton() {
        var submitBtn = document.querySelector('#chat-form button[type="submit"]');
        if (!submitBtn) return;
        submitBtn.dataset.originalHtml = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fa-solid fa-stop"></i>';
        submitBtn.style.background = '#1a1a2e';
        submitBtn.type = 'button';
        submitBtn.onclick = function() {
            typingStopped = true;
            isGenerating = false;
        };
    }

    function hideStopButton() {
        var submitBtn = document.querySelector('#chat-form button[type="button"][style*="1a1a2e"]');
        if (!submitBtn && document.querySelector('#chat-form button[type="button"]')) {
            // try finding it differently
            var btns = document.querySelectorAll('#chat-form button');
            btns.forEach(function(b) { if (b.dataset.originalHtml) submitBtn = b; });
        }
        if (!submitBtn) return;
        submitBtn.innerHTML = submitBtn.dataset.originalHtml || '<i class="fa-solid fa-arrow-right"></i>';
        submitBtn.style.background = 'linear-gradient(135deg, #6366f1, #8b5cf6)';
        submitBtn.type = 'submit';
        submitBtn.onclick = null;
    }

    // Enter to send, Shift+Enter for new line
    if (messageInput) {
        messageInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                textForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            }
        });
    }

    // Handle text form submission
    if (textForm) {
        textForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const message = messageInput.value.trim();
            if (!message) return;
            if (isGenerating) return;
            isGenerating = true;

            // Add user message to chat
            addMessage('user', message);

            // Clear input
            messageInput.value = '';
            
            // Scroll to bottom
            scrollToBottom();
            
            // Check if WebSocket is available
            if (ws && ws.readyState === WebSocket.OPEN) {
                // Send message via WebSocket
                ws.send(JSON.stringify({
                    type: 'chat_message',
                    data: {
                        message: message,
                        conversation_id: conversationId
                    }
                }));
                
                // Add typing indicator
                addTypingIndicator();
            } else {
                // Fallback to REST API if WebSocket is not available
                try {
                    // Show loading state
                    addTypingIndicator();
                    
                    // Send message via REST API
                    const response = await fetch('/api/chat', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            message: message,
                            conversation_id: conversationId
                        })
                    });
                    
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    
                    const data = await response.json();
                    
                    // Remove typing indicator
                    removeTypingIndicator();
                    
                    // Add assistant's response to chat with typing animation
                    addAnimatedMessage('assistant', data.answer);
                    
                    // Save conversation ID
                    conversationId = data.conversation_id;

                    // Scroll to bottom
                    scrollToBottom();
                    isGenerating = false;
                } catch (error) {
                    console.error('Error sending message:', error);

                    // Remove typing indicator
                    removeTypingIndicator();

                    // Show error message
                    addErrorMessage('Failed to send message. Please try again.');
                    isGenerating = false;
                }
            }
        });
    }

    // Document upload handling
    const docUploadBtn = document.getElementById('doc-upload-btn');
    const docFileInput = document.getElementById('doc-file-input');

    if (docUploadBtn && docFileInput) {
        docUploadBtn.addEventListener('click', function() {
            docFileInput.click();
        });

        docFileInput.addEventListener('change', async function() {
            const file = docFileInput.files[0];
            if (!file) return;

            // Validate size (10MB)
            if (file.size > 10 * 1024 * 1024) {
                addErrorMessage('File too large. Maximum size is 10MB.');
                docFileInput.value = '';
                return;
            }

            // Show uploaded file in chat
            const userQuestion = messageInput.value.trim();
            const displayText = userQuestion
                ? `📄 Uploaded: ${file.name}\n${userQuestion}`
                : `📄 Uploaded: ${file.name}\nPlease analyze this document.`;
            addMessage('user', displayText);
            messageInput.value = '';

            // Show typing indicator
            addTypingIndicator();
            scrollToBottom();

            try {
                const formData = new FormData();
                formData.append('document', file);
                if (userQuestion) {
                    formData.append('message', userQuestion);
                }
                if (conversationId) {
                    formData.append('conversation_id', conversationId);
                }

                const response = await fetch('/api/document-question', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(errData.detail || 'Failed to process document');
                }

                const data = await response.json();
                removeTypingIndicator();
                addAnimatedMessage('assistant', data.answer);
                conversationId = data.conversation_id;
                scrollToBottom();
            } catch (error) {
                console.error('Error uploading document:', error);
                removeTypingIndicator();
                addErrorMessage(error.message || 'Failed to process document. Please try again.');
            }

            // Reset file input
            docFileInput.value = '';
        });
    }

    // Audio recorder - ChatGPT style
    var audioTextForm = document.getElementById('chat-form');
    var audioWaveform = document.getElementById('audio-waveform');
    var waveformInterval = null;
    var audioAnalyser = null;
    var audioStream = null;

    function showAudioRecorder() {
        if (audioTextForm) audioTextForm.style.display = 'none';
        if (audioRecorder) audioRecorder.style.display = 'block';
    }

    function hideAudioRecorder() {
        if (audioTextForm) audioTextForm.style.display = 'flex';
        if (audioRecorder) audioRecorder.style.display = 'none';
        stopWaveform();
    }

    function startWaveform(stream) {
        var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        audioAnalyser = audioCtx.createAnalyser();
        var source = audioCtx.createMediaStreamSource(stream);
        source.connect(audioAnalyser);
        audioAnalyser.fftSize = 64;
        var bufferLength = audioAnalyser.frequencyBinCount;
        var dataArray = new Uint8Array(bufferLength);

        // Create waveform bars
        if (audioWaveform) {
            audioWaveform.innerHTML = '';
            for (var i = 0; i < 40; i++) {
                var bar = document.createElement('div');
                bar.className = 'wave-bar';
                bar.style.cssText = 'width:2px; background:#fff; border-radius:1px; transition:height 0.05s; min-height:2px;';
                audioWaveform.appendChild(bar);
            }
        }

        waveformInterval = setInterval(function() {
            audioAnalyser.getByteFrequencyData(dataArray);
            var bars = audioWaveform ? audioWaveform.querySelectorAll('.wave-bar') : [];
            for (var i = 0; i < bars.length; i++) {
                var val = dataArray[i % bufferLength] || 0;
                var h = Math.max(2, (val / 255) * 28);
                bars[i].style.height = h + 'px';
            }
        }, 50);
    }

    function stopWaveform() {
        if (waveformInterval) { clearInterval(waveformInterval); waveformInterval = null; }
        if (audioWaveform) audioWaveform.innerHTML = '';
    }

    // Toggle audio recorder
    if (toggleAudioBtn) {
        toggleAudioBtn.addEventListener('click', async function() {
            showAudioRecorder();
            try {
                audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                startRecording(audioStream);
                startWaveform(audioStream);
                recordingStartTime = Date.now();
                updateRecordingTimer();
                var sendBtn = document.getElementById('send-audio-btn');
                if (sendBtn) sendBtn.disabled = false;
                var pulse = document.getElementById('recording-pulse');
                if (pulse) pulse.classList.add('active');
            } catch (err) {
                console.error('Microphone access denied:', err);
                hideAudioRecorder();
            }
        });
    }

    // Cancel recording
    var cancelBtn = document.getElementById('cancel-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
            }
            if (audioStream) { audioStream.getTracks().forEach(function(t) { t.stop(); }); }
            resetAudioRecorder();
            hideAudioRecorder();
        });
    }

    // Send audio
    var sendAudioButton = document.getElementById('send-audio-btn');
    if (sendAudioButton) {
        sendAudioButton.addEventListener('click', async function() {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
            }
            if (audioStream) { audioStream.getTracks().forEach(function(t) { t.stop(); }); }

            // Wait for chunks
            await new Promise(function(r) { setTimeout(r, 300); });

            if (audioChunks.length === 0) { hideAudioRecorder(); return; }

            var audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            var audioId = generateUUID();
            audioMessages[audioId] = audioBlob;
            addAudioMessage('user', audioId);

            var formData = new FormData();
            formData.append('audio_file', audioBlob, 'recording.webm');
            if (conversationId) formData.append('conversation_id', conversationId);

            resetAudioRecorder();
            hideAudioRecorder();
            addTypingIndicator();

            try {
                var response = await fetch('/api/audio-question', { method: 'POST', body: formData });
                if (!response.ok) throw new Error('Network error');
                var data = await response.json();
                removeTypingIndicator();
                if (data.transcribed_text) addTranscriptionToAudioMessage(audioId, data.transcribed_text);
                addAnimatedMessage('assistant', data.answer);
                conversationId = data.conversation_id;
                scrollToBottom();
            } catch (err) {
                console.error('Error sending audio:', err);
                removeTypingIndicator();
                addErrorMessage('Failed to send audio. Please try again.');
            }
        });
    }

    // Start recording function
    function startRecording(stream) {
        audioChunks = [];
        
        let mimeType = 'audio/webm';
        
        if (isIOS()) {
            if (MediaRecorder.isTypeSupported('audio/mp4')) {
                mimeType = 'audio/mp4';
            } else if (MediaRecorder.isTypeSupported('audio/aac')) {
                mimeType = 'audio/aac';
            } else if (MediaRecorder.isTypeSupported('audio/mp3')) {
                mimeType = 'audio/mp3';
            }
        } else {
            const formats = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/ogg;codecs=opus',
                'audio/mp3',
                'audio/aac'
            ];
            
            for (const format of formats) {
                if (MediaRecorder.isTypeSupported(format)) {
                    mimeType = format;
                    break;
                }
            }
        }
        
        const options = {
            audioBitsPerSecond: 128000
        };
        
        try {
            if (mimeType && MediaRecorder.isTypeSupported(mimeType)) {
                options.mimeType = mimeType;
            }
            
            mediaRecorder = new MediaRecorder(stream, options);
            console.log(`Using recording format: ${mediaRecorder.mimeType}`);
        } catch (e) {
            console.warn('Requested format not supported, using default format', e);
            mediaRecorder = new MediaRecorder(stream);
        }
        
        mediaRecorder.onerror = function(event) {
            console.error('MediaRecorder error:', event.error);
            
            const recordingStatus = document.getElementById('recording-text');
            if (recordingStatus) {
                recordingStatus.textContent = 'Recording error. Please try again.';
            }
            
            resetAudioRecorder();
        };
        
        mediaRecorder.ondataavailable = function(e) {
            if (e.data.size > 0) {
                audioChunks.push(e.data);
            }
        };
        
        mediaRecorder.onstop = function() {
            stream.getTracks().forEach(track => track.stop());
        };
        
        const timeSlice = isIOS() ? 100 : 200;
        mediaRecorder.start(timeSlice);
    }

    // Update recording timer function
    function updateRecordingTimer() {
        if (!recordingStartTime) return;
        
        const elapsedTime = Math.floor((Date.now() - recordingStartTime) / 1000);
        const minutes = Math.floor(elapsedTime / 60);
        const seconds = elapsedTime % 60;
        
        const timerElement = document.getElementById('recording-timer');
        if (timerElement) {
            timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
        
        recordingTimer = setTimeout(updateRecordingTimer, 1000);
    }

    // Reset audio recorder UI
    function resetAudioRecorder() {
        const recordButton = document.getElementById('record-btn');
        const stopButton = document.getElementById('stop-btn');
        const sendAudioButton = document.getElementById('send-audio-btn');
        const recordingStatus = document.getElementById('recording-text');
        const recordingPulse = document.querySelector('.recording-pulse');
        const recordingTimer = document.getElementById('recording-timer');
        
        // Reset buttons
        if (recordButton) recordButton.disabled = false;
        if (stopButton) stopButton.disabled = true;
        if (sendAudioButton) sendAudioButton.disabled = true;
        
        // Reset status and UI
        if (recordingStatus) {
            recordingStatus.textContent = 'Tap to start recording';
        }
        if (recordingPulse) recordingPulse.classList.remove('active');
        if (recordingTimer) {
            recordingTimer.style.display = 'none';
            recordingTimer.textContent = '00:00';
        }
        
        // Stop media recorder if active
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        
        // Clear timer
        clearTimeout(recordingTimer);
        recordingStartTime = null;
        
        // Clear audio chunks
        audioChunks = [];
    }

    function addSimpleAudioMessage(role, audioId) {
        const messageContainer = document.createElement('div');
        messageContainer.className = `message-wrapper ${role}`; // ИСПРАВЛЕНО: использует новую структуру классов
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message audio-message';
        
        // Create simple audio player
        const audioPlayer = document.createElement('div');
        audioPlayer.className = 'audio-player';
        
        // Play button
        const playButton = document.createElement('button');
        playButton.className = 'audio-play-button';
        playButton.innerHTML = '<i class="fas fa-play"></i>';
        
        // Audio element with iOS-compatible settings
        const audio = document.createElement('audio');
        audio.id = `audio-${audioId}`;
        audio.preload = "metadata";
        
        // Set source from blob or file
        try {
            const audioSource = audioMessages[audioId];
            if (audioSource) {
                if (audioSource instanceof Blob) {
                    audio.src = URL.createObjectURL(audioSource);
                } else if (audioSource instanceof File) {
                    audio.src = URL.createObjectURL(audioSource);
                }
            }
        } catch (e) {
            console.error("Error creating audio URL:", e);
        }
        
        // Add to DOM
        audioPlayer.appendChild(playButton);
        
        const audioLabel = document.createElement('span');
        audioLabel.className = 'audio-label';
        audioLabel.textContent = 'Audio message';
        audioPlayer.appendChild(audioLabel);
        
        messageDiv.appendChild(audioPlayer);
        messageDiv.appendChild(audio);
        
        // Add transcription container
        const transcription = document.createElement('div');
        transcription.className = 'audio-transcription';
        transcription.id = `transcription-${audioId}`;
        messageDiv.appendChild(transcription);
        
        // Add timestamp
        const timestamp = document.createElement('div');
        timestamp.className = 'timestamp';
        timestamp.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        messageContainer.appendChild(messageDiv);
        messageContainer.appendChild(timestamp);
        
        chatMessages.appendChild(messageContainer);
        scrollToBottom();
        
        // Play button handler with iOS-specific error handling
        playButton.addEventListener('click', function() {
            const audioElement = document.getElementById(`audio-${audioId}`);
            if (!audioElement) return;
            
            try {
                if (audioElement.paused) {
                    // Stop other audio first (important for iOS)
                    document.querySelectorAll('audio').forEach(a => {
                        if (a.id !== `audio-${audioId}` && !a.paused) {
                            a.pause();
                            const otherButton = a.parentElement.querySelector('.audio-play-button');
                            if (otherButton) {
                                otherButton.innerHTML = '<i class="fas fa-play"></i>';
                            }
                        }
                    });
                    
                    // Play this audio with proper error handling
                    const playPromise = audioElement.play();
                    if (playPromise !== undefined) {
                        playPromise.then(() => {
                            playButton.innerHTML = '<i class="fas fa-pause"></i>';
                        }).catch(e => {
                            console.error("Play error:", e);
                        });
                    }
                } else {
                    audioElement.pause();
                    playButton.innerHTML = '<i class="fas fa-play"></i>';
                }
            } catch (e) {
                console.error("Audio playback error:", e);
            }
        });
        
        // Handle audio ended
        audio.addEventListener('ended', function() {
            playButton.innerHTML = '<i class="fas fa-play"></i>';
        });
    }

    // Fixed audio message player function to prevent "Infinity:NaN" display
    function addAudioMessage(role, audioId) {
        const messageContainer = document.createElement('div');
        messageContainer.className = `message-wrapper ${role}`; // ИСПРАВЛЕНО: использует новую структуру классов
        messageContainer.setAttribute('data-audio-id', audioId);
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message audio-message';
        
        // Create audio player container
        const audioPlayer = document.createElement('div');
        audioPlayer.className = 'audio-player';
        
        // Create audio element with preload attribute to ensure metadata loads
        const audio = document.createElement('audio');
        audio.id = `audio-${audioId}`;
        audio.controls = false; // Using custom controls
        audio.preload = "metadata"; // Important: preload metadata to avoid Infinity:NaN
        
        // Create play button
        const playButton = document.createElement('button');
        playButton.className = 'audio-play-button';
        playButton.innerHTML = '<i class="fas fa-play"></i>';
        playButton.setAttribute('aria-label', 'Play audio');
        
        // Create audio duration display with default value
        const audioDuration = document.createElement('div');
        audioDuration.className = 'audio-duration';
        audioDuration.textContent = '0:00'; // Default value until loaded
        
        // Create waveform visualization
        const waveform = document.createElement('div');
        waveform.className = 'audio-waveform';
        for (let i = 0; i < 20; i++) {
            const bar = document.createElement('div');
            bar.className = 'waveform-bar';
            bar.style.height = `${Math.random() * 15 + 5}px`;
            waveform.appendChild(bar);
        }
        
        // Set audio source
        const audioBlob = audioMessages[audioId];
        const audioUrl = URL.createObjectURL(audioBlob);
        audio.src = audioUrl;
        
        // Add all elements to audio player
        audioPlayer.appendChild(playButton);
        audioPlayer.appendChild(waveform);
        audioPlayer.appendChild(audioDuration);
        audioPlayer.appendChild(audio);
        
        // Add transcription container (will be filled later)
        const transcription = document.createElement('div');
        transcription.className = 'audio-transcription';
        transcription.id = `transcription-${audioId}`;
        
        // Add audio player to message
        messageDiv.appendChild(audioPlayer);
        messageDiv.appendChild(transcription);
        
        // Add timestamp
        const timestamp = document.createElement('div');
        timestamp.className = 'timestamp';
        timestamp.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Add everything to message container
        messageContainer.appendChild(messageDiv);
        messageContainer.appendChild(timestamp);
        
        // Add to chat
        chatMessages.appendChild(messageContainer);
        scrollToBottom();
        
        // Add event listeners for play button
        playButton.addEventListener('click', function() {
            const audioElement = document.getElementById(`audio-${audioId}`);
            
            if (audioElement.paused) {
                // Stop all other playing audio first
                document.querySelectorAll('audio').forEach(a => {
                    if (a.id !== `audio-${audioId}` && !a.paused) {
                        a.pause();
                        const otherPlayButton = a.parentElement.querySelector('.audio-play-button');
                        if (otherPlayButton) {
                            otherPlayButton.innerHTML = '<i class="fas fa-play"></i>';
                        }
                    }
                });
                
                // Play this audio
                audioElement.play();
                playButton.innerHTML = '<i class="fas fa-pause"></i>';
                
                // Animate waveform
                waveform.classList.add('playing');
            } else {
                // Pause this audio
                audioElement.pause();
                playButton.innerHTML = '<i class="fas fa-play"></i>';
                
                // Stop waveform animation
                waveform.classList.remove('playing');
            }
        });
        
        // Handle audio duration - FIX FOR INFINITY:NAN
        audio.addEventListener('loadedmetadata', function() {
            // Only update if duration is valid (fixes the Infinity:NaN issue)
            if (isFinite(audio.duration) && audio.duration > 0) {
                const duration = Math.floor(audio.duration);
                const minutes = Math.floor(duration / 60);
                const seconds = duration % 60;
                audioDuration.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            } else {
                // Keep default duration if we can't get a valid value
                audioDuration.textContent = '0:00';
            }
        });
        
        // Handle audio loading error
        audio.addEventListener('error', function(e) {
            console.error('Audio loading error:', e);
            // Don't show "Error" text, keep default time
            audioDuration.textContent = '0:00';
            
            // We'll still disable the play button
            playButton.disabled = true;
            
            // Add a subtle visual indicator that something's wrong
            playButton.style.opacity = '0.5';
        })
        
        // Handle audio ended
        audio.addEventListener('ended', function() {
            playButton.innerHTML = '<i class="fas fa-play"></i>';
            waveform.classList.remove('playing');
        });
        
        // Handle audio time update for waveform animation - FIX FOR INFINITY:NAN
        audio.addEventListener('timeupdate', function() {
            // Check if duration is valid before calculating progress
            if (isFinite(audio.duration) && audio.duration > 0) {
                const progress = (audio.currentTime / audio.duration) * 100;
                // Only update if progress is a valid number
                if (isFinite(progress)) {
                    waveform.style.setProperty('--progress', `${progress}%`);
                }
            }
        });
    }

    // Flag to prevent sending while generating
    var isGenerating = false;
    var typingStopped = false;
    var currentTypingCallback = null;

    // Add transcription to audio message
    function addTranscriptionToAudioMessage(audioId, transcription) {
        const transcriptionDiv = document.getElementById(`transcription-${audioId}`);
        if (transcriptionDiv) {
            transcriptionDiv.textContent = `"${transcription}"`;
            transcriptionDiv.style.display = 'block';
        }
    }

    function addAnimatedMessage(role, content) {
        var welcome = document.getElementById('chat-welcome');
        if (welcome && welcome.style.display !== 'none') {
            welcome.style.display = 'none';
            if (typeof setChatWelcomeMode === 'function') setChatWelcomeMode(false);
        }

        var messageContainer = document.createElement('div');
        messageContainer.className = 'message-wrapper ' + role;

        var messageDiv = document.createElement('div');
        messageDiv.className = 'message typing ' + role + '-message';

        var typingSpan = document.createElement('span');
        typingSpan.className = 'typing-text';
        messageDiv.appendChild(typingSpan);

        messageContainer.appendChild(messageDiv);

        // Actions: copy + try again (hidden until typing done)
        var actions = document.createElement('div');
        actions.className = 'msg-actions ai-actions';
        actions.style.display = 'none';
        actions.innerHTML = '<button class="msg-action-btn" title="Copy"><i class="fa-regular fa-copy"></i></button><button class="msg-action-btn" title="Try again"><i class="fa-solid fa-rotate-right"></i></button>';
        messageContainer.appendChild(actions);

        // Copy
        actions.querySelector('[title="Copy"]').addEventListener('click', function() {
            navigator.clipboard.writeText(typingSpan.innerText);
            this.innerHTML = '<i class="fa-solid fa-check"></i>';
            var btn = this;
            setTimeout(function() { btn.innerHTML = '<i class="fa-regular fa-copy"></i>'; }, 1500);
        });
        // Try again - remove this response and regenerate
        actions.querySelector('[title="Try again"]').addEventListener('click', function() {
            if (isGenerating) return;
            var userMsgs = chatMessages.querySelectorAll('.message-wrapper.user .message');
            if (userMsgs.length > 0) {
                var lastMsg = userMsgs[userMsgs.length - 1].textContent.trim();
                messageContainer.remove();
                isGenerating = true;
                addTypingIndicator();
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'chat_message', data: { message: lastMsg, conversation_id: conversationId, regenerate: true } }));
                } else {
                    fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: lastMsg, conversation_id: conversationId, regenerate: true }) })
                    .then(function(r) { return r.json(); })
                    .then(function(data) { removeTypingIndicator(); addAnimatedMessage('assistant', data.answer); conversationId = data.conversation_id; isGenerating = false; })
                    .catch(function() { removeTypingIndicator(); addErrorMessage('Failed. Please try again.'); isGenerating = false; });
                }
            }
        });

        chatMessages.appendChild(messageContainer);

        var formattedContent = formatMessage(content);
        typingStopped = false;
        showStopButton();
        animateTyping(typingSpan, formattedContent, 0, 30, function() {
            actions.style.display = 'flex';
            isGenerating = false;
            hideStopButton();
        });
    }
    
    function addTypingCursorStyle() {
        const style = document.createElement('style');
        style.textContent = `
            .typing-cursor::after {
                content: '|';
                display: inline-block;
                animation: cursor-blink 1s step-end infinite;
            }
            
            @keyframes cursor-blink {
                0%, 100% { opacity: 1; }
                50% { opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Animate typing effect
    function animateTyping(element, html, index, speed, onComplete) {
        var formatTextInRealTime = function(text, currentIndex) {
            var formattedText = text.substring(0, currentIndex)
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>');
            formattedText = formattedText.replace(/\n/g, '<br>');
            return formattedText;
        };

        var temp = document.createElement('div');
        temp.innerHTML = html;
        var text = temp.textContent;

        if (typingStopped) {
            // Stop: show what's typed so far
            element.innerHTML = formatTextInRealTime(html, index);
            element.parentElement.classList.remove('typing');
            typingStopped = false;
            hideStopButton();
            if (onComplete) onComplete();
            return;
        }

        if (index < text.length) {
            element.innerHTML = formatTextInRealTime(html, index);

            var cursorSpan = document.createElement('span');
            cursorSpan.className = 'typing-cursor';
            element.appendChild(cursorSpan);

            setTimeout(function() {
                animateTyping(element, html, index + 1, speed, onComplete);
            }, speed);
        } else {
            element.innerHTML = html;
            element.parentElement.classList.remove('typing');
            hideStopButton();
            if (onComplete) onComplete();
        }
    }
    

    // Standard message adding (without animation)
    function addMessage(role, content) {
        var welcome = document.getElementById('chat-welcome');
        if (welcome && welcome.style.display !== 'none') {
            welcome.style.display = 'none';
            if (typeof setChatWelcomeMode === 'function') setChatWelcomeMode(false);
        }
        var messageContainer = document.createElement('div');
        messageContainer.className = 'message-wrapper ' + role;

        var messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        messageDiv.innerHTML = formatMessage(content);

        messageContainer.appendChild(messageDiv);

        // User message: copy + edit (hover only)
        if (role === 'user') {
            var actions = document.createElement('div');
            actions.className = 'msg-actions user-actions';
            actions.innerHTML = '<button class="msg-action-btn" title="Copy"><i class="fa-regular fa-copy"></i></button><button class="msg-action-btn" title="Edit"><i class="fa-regular fa-pen-to-square"></i></button>';
            messageContainer.appendChild(actions);

            // Copy
            actions.querySelector('[title="Copy"]').addEventListener('click', function() {
                navigator.clipboard.writeText(content);
                this.innerHTML = '<i class="fa-solid fa-check"></i>';
                var btn = this;
                setTimeout(function() { btn.innerHTML = '<i class="fa-regular fa-copy"></i>'; }, 1500);
            });
            // Edit - put text in input for editing, remove old message + its response
            actions.querySelector('[title="Edit"]').addEventListener('click', function() {
                messageInput.value = content;
                messageInput.focus();
                // Remove the AI response after this user message
                var nextSibling = messageContainer.nextElementSibling;
                if (nextSibling && nextSibling.classList.contains('message-wrapper') && !nextSibling.classList.contains('user')) {
                    nextSibling.remove();
                }
                messageContainer.remove();
            });
        }

        chatMessages.appendChild(messageContainer);
        scrollToBottom();
    }

    function addErrorMessage(content) {
        const messageContainer = document.createElement('div');
        messageContainer.className = 'message-wrapper system'; // ИСПРАВЛЕНО: использует новую структуру классов
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message error';
        messageDiv.textContent = content;
        
        messageContainer.appendChild(messageDiv);
        chatMessages.appendChild(messageContainer);
        scrollToBottom();
    }

    function addTypingIndicator() {
        // Remove existing indicator if any
        removeTypingIndicator();
        window._typingStartTime = Date.now();

        const typingContainer = document.createElement('div');
        typingContainer.className = 'message-wrapper system';
        typingContainer.id = 'typing-indicator';

        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-indicator';
        typingDiv.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div><span style="margin-left:8px;color:#888;font-size:13px;">Typing...</span>';

        typingContainer.appendChild(typingDiv);
        chatMessages.appendChild(typingContainer);
        scrollToBottom();
    }

    function removeTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    function formatMessage(content) {
        // Handle markdown-like syntax
        let formattedContent = content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
            .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
            .replace(/\n/g, '<br>'); // Line breaks
        
        return formattedContent;
    }

    function scrollToBottom() {
        if (!chatMessages) return;
        
        // Use requestAnimationFrame for smoother scrolling
        requestAnimationFrame(() => {
            // Smoothly scroll to bottom with offset for better visibility
            chatMessages.scrollTop = chatMessages.scrollHeight;
        });
    }
    
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // Cookie consent functionality

    
    // Show cookie consent on page load


    // Helper functions for audio support
    function getSupportedMimeType() {
        const types = [
            'audio/webm', 
            'audio/mp4', 
            'audio/ogg;codecs=opus', 
            'audio/mpeg',
            'audio/aac'
        ];
        
        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }
        
        return '';
    }

    function isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    function initAudioContext() {
        if (!window.AudioContext && !window.webkitAudioContext) {
            console.log("AudioContext not supported in this browser");
            return;
        }
        
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!window._audioContext) {
            window._audioContext = new AudioContext();
        }
        
        // Resume context on user interaction - critical for iOS
        document.addEventListener('touchstart', function resumeAudioContext() {
            if (window._audioContext && window._audioContext.state === 'suspended') {
                window._audioContext.resume();
                console.log("AudioContext resumed on user interaction");
            }
            // Only need to do this once
            document.removeEventListener('touchstart', resumeAudioContext);
        }, { once: true });
    }

    function isIOS() {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        return (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) || 
               (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    function setupAudioRecording() {
        const toggleAudioBtn = document.getElementById('voice-toggle'); // ИСПРАВЛЕНО: обновленный селектор
        
        if (toggleAudioBtn) {
            toggleAudioBtn.addEventListener('click', function() {
                if (isIOS()) {
                    // For iOS, use a dedicated implementation
                    setupIOSAudioRecording();
                }
            });
        }
    }

    function setupIOSAudioRecording() {
        // Remove existing UI
        const existingUI = document.querySelector('.ios-audio-recorder');
        if (existingUI) {
            existingUI.remove();
        }
        
        // Create iOS-specific UI with better styling and more accessible buttons
        const iOSAudioUI = document.createElement('div');
        iOSAudioUI.className = 'ios-audio-recorder';
        iOSAudioUI.innerHTML = `
          <div class="ios-recording-info">
            <p>iOS requires using your device's built-in recording app</p>
            <div class="ios-action-buttons">
              <label for="ios-audio-input" class="ios-record-button">
                <i class="fas fa-microphone"></i> 
                <span>Select audio file</span>
              </label>
              <input type="file" id="ios-audio-input" accept="audio/*" capture="microphone" style="display: none;">
              <button class="ios-cancel-button" id="ios-cancel-button">
                <i class="fas fa-times"></i>
                <span>Cancel</span>
              </button>
            </div>
          </div>
        `;
        
        // Add to the page
        document.body.appendChild(iOSAudioUI);
        
        // Set up event handlers
        const fileInput = document.getElementById('ios-audio-input');
        const cancelButton = document.getElementById('ios-cancel-button');
        
        fileInput.addEventListener('change', async function(e) {
            if (this.files && this.files.length > 0) {
                const file = this.files[0];
                console.log("iOS selected file:", file.name, file.type, file.size);
                
                // Show clear processing indicator
                showProcessingIndicator();
                
                // Hide the recorder UI
                iOSAudioUI.style.display = 'none';
                
                // Create FormData for file upload
                const formData = new FormData();
                formData.append('audio_file', file);
                
                if (conversationId) {
                    formData.append('conversation_id', conversationId);
                }
                
                try {
                    // Set a longer timeout for iOS
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 sec timeout for iOS
                    
                    // Send to the server
                    const response = await fetch('/api/audio-question', {
                        method: 'POST',
                        body: formData,
                        signal: controller.signal
                    });
                    
                    clearTimeout(timeoutId);
                    
                    if (!response.ok) {
                        throw new Error(`Server error: ${response.status}`);
                    }
                    
                    const data = await response.json();
                    
                    // Remove processing indicator
                    removeProcessingIndicator();
                    
                    // Create audio element in chat
                    const audioId = generateUUID();
                    
                    // Store the audio for playback
                    audioMessages[audioId] = file;
                    
                    // Add to chat
                    addSimpleAudioMessage('user', audioId);
                    
                    // Add transcription if available
                    if (data.transcribed_text) {
                        addTranscriptionToAudioMessage(audioId, data.transcribed_text);
                    }
                    
                    // Add assistant's response
                    addAnimatedMessage('assistant', data.answer);
                    
                    // Save conversation ID
                    conversationId = data.conversation_id;
                    
                    // Scroll to bottom
                    scrollToBottom();
                    
                    // Reset input for next recording
                    fileInput.value = '';
                    
                } catch (error) {
                    console.error('Error sending iOS audio:', error);
                    
                    // Remove processing indicator
                    removeProcessingIndicator();
                    
                    // Show error message
                    const errorMessage = 'Failed to send audio message. Please try using text instead.';
                    
                    addErrorMessage(errorMessage);
                    
                    // Reset input
                    fileInput.value = '';
                }
            }
        });
        
        // Cancel button handler
        cancelButton.addEventListener('click', function() {
            iOSAudioUI.remove();
        });
    }

    function showProcessingIndicator() {
        removeProcessingIndicator(); // Remove any existing indicator
        
        const loadingMessage = 'Processing audio...';
        
        const processingDiv = document.createElement('div');
        processingDiv.className = 'message-wrapper system'; // ИСПРАВЛЕНО: использует новую структуру классов
        processingDiv.id = 'audio-processing';
        processingDiv.innerHTML = `
          <div class="message">
            <div class="audio-loading"></div>
            <span>${loadingMessage}</span>
          </div>
        `;
        chatMessages.appendChild(processingDiv);
        scrollToBottom();
    }
      
    function removeProcessingIndicator() {
        const processingIndicator = document.getElementById('audio-processing');
        if (processingIndicator) {
            processingIndicator.remove();
        }
    }

    // CSS styles for iOS interface
    function addIOSStyles() {
        const styleElement = document.createElement('style');
        styleElement.textContent = `
          .ios-audio-recorder {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background-color: rgba(240, 244, 248, 0.95);
            padding: 20px 25px;
            border-top: 1px solid #e1e8ed;
            display: flex;
            flex-direction: column;
            animation: slideUpFast 0.3s ease-out;
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            z-index: 1000;
          }
      
          .ios-recording-info {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 15px;
          }
      
          .ios-recording-info p {
            color: #555;
            font-size: 0.9rem;
            text-align: center;
          }
      
          .ios-action-buttons {
            display: flex;
            gap: 15px;
            width: 100%;
          }
      
          .ios-record-button {
            flex: 1;
            background: var(--accent-gradient, linear-gradient(135deg, #e74c3c, #c0392b));
            color: white;
            border: none;
            border-radius: 12px;
            padding: 12px 15px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            cursor: pointer;
            font-size: 0.9rem;
            font-weight: 500;
            box-shadow: 0 4px 10px rgba(231, 76, 60, 0.3);
          }
      
          .ios-cancel-button {
            background-color: #7f8c8d;
            color: white;
            border: none;
            border-radius: 12px;
            padding: 12px 15px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            cursor: pointer;
            font-size: 0.9rem;
            font-weight: 500;
          }
      
          .ios-record-button:active, .ios-cancel-button:active {
            transform: scale(0.97);
          }
      
          /* Larger touch targets for iOS */
          @supports (-webkit-touch-callout: none) {
            .ios-record-button, .ios-cancel-button {
              padding: 15px 20px;
              min-height: 50px;
            }
          }
        `;
        document.head.appendChild(styleElement);
    }

    // Initialize iOS support
    function initializeIOSSupport() {
        if (isIOS()) {
            console.log("iOS device detected, initializing iOS-specific audio handling");
            addIOSStyles();
        }
    }

    // Initialize typing cursor styles and iOS support
    addTypingCursorStyle();
});

// For immediate execution if DOM is already loaded
if (document.readyState !== 'loading') {
    initializeIOSSupport();
}