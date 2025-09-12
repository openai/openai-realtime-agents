const { createApp } = Vue

/**
 * این تابع یک اتصال WebRTC به OpenAI Realtime API برقرار می‌کند.
 * این کد از شاخه 'without-agents-sdk' مخزن اصلی اقتباس شده است.
 * @param {string} EPHEMERAL_KEY - کلید موقت جلسه.
 * @param {HTMLAudioElement} audioElement - عنصر صوتی برای پخش صدای دستیار.
 * @returns {Promise<{pc: RTCPeerConnection, dc: RTCDataChannel}>}
 */
async function createRealtimeConnection(EPHEMERAL_KEY, audioElement) {
    const pc = new RTCPeerConnection();

    pc.ontrack = (e) => {
        if (audioElement) {
            audioElement.srcObject = e.streams[0];
        }
    };

    const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
    pc.addTrack(ms.getTracks()[0]);

    const dc = pc.createDataChannel("oai-events");

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const baseUrl = "https://api.openai.com/v1/realtime";
    const model = "gpt-4o-realtime-preview-2024-12-17";

    const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
            "Authorization": `Bearer ${EPHEMERAL_KEY}`,
            "Content-Type": "application/sdp",
        },
    });

    const answerSdp = await sdpResponse.text();
    const answer = {
        type: "answer",
        sdp: answerSdp,
    };

    await pc.setRemoteDescription(answer);

    return { pc, dc };
}


createApp({
    data() {
        return {
            // وضعیت کلی
            sessionStatus: 'DISCONNECTED', // 'DISCONNECTED', 'CONNECTING', 'CONNECTED'
            transcript: [], // لیست پیام‌های مکالمه
            events: [], // لیست رویدادهای سرور و کلاینت

            // وضعیت UI
            userText: '',
            isAudioPlaybackEnabled: true,

            // متغیرهای اتصال
            peerConnection: null,
            dataChannel: null,
            audioElement: null,
        }
    },
    methods: {
        // --- مدیریت اتصال ---
        async connectToRealtime() {
            if (this.sessionStatus !== 'DISCONNECTED') return;
            this.sessionStatus = 'CONNECTING';
            this.logEvent('کلاینت', 'در حال اتصال...');

            try {
                // ۱. دریافت توکن جلسه از بک‌اند جنگو
                const tokenResponse = await fetch("/api/session/");
                const data = await tokenResponse.json();
                const ephemeralKey = data.client_secret?.value;

                if (!ephemeralKey) {
                    throw new Error("کلید موقت جلسه دریافت نشد.");
                }
                this.logEvent('کلاینت', 'توکن جلسه دریافت شد.');

                // ۲. ایجاد عنصر صوتی
                this.audioElement = document.createElement("audio");
                this.audioElement.autoplay = this.isAudioPlaybackEnabled;

                // ۳. ایجاد اتصال WebRTC
                const { pc, dc } = await createRealtimeConnection(ephemeralKey, this.audioElement);
                this.peerConnection = pc;
                this.dataChannel = dc;

                // ۴. افزودن شنوندگان رویداد
                dc.onopen = () => {
                    this.sessionStatus = 'CONNECTED';
                    this.logEvent('کلاینت', 'اتصال برقرار شد. ارسال پیام اولیه...');
                    this.updateSession(true); // ارسال پیام اولیه برای شروع مکالمه
                };
                dc.onmessage = (event) => this.handleServerEvent(JSON.parse(event.data));
                dc.onclose = () => this.disconnect();
                dc.onerror = (err) => this.logEvent('خطا', err);

            } catch (err) {
                console.error("خطا در اتصال بی‌درنگ:", err);
                this.logEvent('خطا', `خطا در اتصال: ${err.message}`);
                this.disconnect();
            }
        },
        disconnect() {
            if (this.peerConnection) {
                this.peerConnection.close();
                this.peerConnection = null;
            }
            if (this.dataChannel) {
                this.dataChannel.close();
                this.dataChannel = null;
            }
            this.sessionStatus = 'DISCONNECTED';
            this.logEvent('کلاینت', 'اتصال قطع شد.');
        },

        // --- ارسال و دریافت رویداد ---
        sendClientEvent(eventObj, eventNameSuffix = "") {
            if (this.dataChannel && this.dataChannel.readyState === "open") {
                this.logEvent('کلاینت', eventObj, eventNameSuffix);
                this.dataChannel.send(JSON.stringify(eventObj));
            } else {
                console.error("خطا در ارسال پیام - کانال داده باز نیست.");
            }
        },
        handleServerEvent(event) {
            this.logEvent('سرور', event);
            switch (event.type) {
                case 'conversation.item.create':
                    // فرض می‌کنیم event.item حاوی ساختار پیام است
                    this.addTranscriptMessage(event.item);
                    break;
                case 'conversation.item.update':
                    this.updateTranscriptMessage(event.item);
                    break;
                 // TODO: سایر رویدادها را مدیریت کن
            }
        },
        updateSession(shouldTriggerResponse = false) {
            const sessionUpdateEvent = {
                type: "session.update",
                session: {
                    modalities: ["text", "audio"],
                    // TODO: دستورالعمل‌ها و ابزارها باید از ایجنت انتخاب شده بارگیری شوند
                    instructions: "شما یک دستیار مفید هستید.",
                    voice: "sage",
                    input_audio_transcription: { model: "whisper-1" },
                    turn_detection: { // VAD
                        type: 'server_vad',
                        threshold: 0.9,
                        prefix_padding_ms: 300,
                        silence_duration_ms: 500,
                        create_response: true,
                    },
                    tools: [],
                },
            };
            this.sendClientEvent(sessionUpdateEvent);

            if (shouldTriggerResponse) {
                this.sendClientEvent({
                    type: "conversation.item.create",
                    item: { type: "message", role: "user", content: [{ type: "input_text", text: "سلام" }] },
                });
                this.sendClientEvent({ type: "response.create" });
            }
        },

        // --- مدیریت رونوشت و رویدادها ---
        addTranscriptMessage(item) {
            // یک پیام کامل جدید اضافه می‌کند
            this.transcript.push({
                id: item.id || `id-${Date.now()}`,
                role: item.role,
                content: item.content[0].text,
                status: 'DONE'
            });
        },
        updateTranscriptMessage(item) {
            // یک پیام در حال پیشرفت را به‌روز می‌کند
            const existingMessage = this.transcript.find(m => m.id === item.id);
            if (existingMessage) {
                existingMessage.content += item.content[0].text.delta;
            } else {
                // اگر وجود نداشت، به عنوان پیام جدید اضافه کن
                this.transcript.push({
                    id: item.id,
                    role: item.role,
                    content: item.content[0].text.delta,
                    status: 'IN_PROGRESS'
                });
            }
        },
        logEvent(source, data, suffix = "") {
            this.events.unshift({
                id: `evt-${Date.now()}`,
                source,
                data: JSON.stringify(data, null, 2),
                suffix,
                timestamp: new Date().toLocaleTimeString(),
            });
        },

        // --- تعاملات کاربر ---
        handleSendTextMessage() {
            if (!this.userText.trim()) return;

            this.sendClientEvent({
                type: "conversation.item.create",
                item: {
                    type: "message",
                    role: "user",
                    content: [{ type: "input_text", text: this.userText.trim() }],
                },
            });
            this.sendClientEvent({ type: "response.create" });
            this.userText = "";
        },
        toggleConnection() {
            if (this.sessionStatus === 'CONNECTED') {
                this.disconnect();
            } else {
                this.connectToRealtime();
            }
        },
    },
    mounted() {
        this.logEvent('سیستم', 'برنامه Vue بارگذاری شد.');
        // می‌توانید اتصال را به صورت خودکار در اینجا شروع کنید
        // this.connectToRealtime();
    }
}).mount('#app')
