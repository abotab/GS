/**
 * نظام التايم لاين - Timeline System
 * لإدارة Keyframes والرسوم المتحركة
 */

interface Keyframe {
    id: string;
    frame: number;
    boneId: string;
    properties: {
        x?: number;
        y?: number;
        rotation?: number;
        scaleX?: number;
        scaleY?: number;
    };
    easing: string;
}

interface Track {
    id: string;
    name: string;
    boneId: string;
    keyframes: Keyframe[];
    isVisible: boolean;
    isLocked: boolean;
}

class TimelineSystem {
    private tracks: Map<string, Track> = new Map();
    private currentFrame: number = 1;
    private totalFrames: number = 300;
    private fps: number = 24;
    private isPlaying: boolean = false;
    private playInterval: number | null = null;
    private onionSkin: boolean = false;
    
    // عناصر DOM
    private tracksContainer: HTMLElement;
    private rulerContainer: HTMLElement;
    private playhead: HTMLElement | null = null;

    constructor() {
        this.tracksContainer = document.getElementById('timelineTracks') as HTMLElement;
        this.rulerContainer = document.getElementById('timelineRuler') as HTMLElement;
        
        this.setupUI();
        this.setupEvents();
        this.createPlayhead();
    }

    private setupUI(): void {
        // إنشاء المسطرة
        this.updateRuler();
    }

    private setupEvents(): void {
        // أزرار التحكم
        document.getElementById('playPause')?.addEventListener('click', () => this.togglePlay());
        document.getElementById('goToStart')?.addEventListener('click', () => this.goToFrame(1));
        document.getElementById('goToEnd')?.addEventListener('click', () => this.goToFrame(this.totalFrames));
        
        document.getElementById('currentFrame')?.addEventListener('change', (e) => {
            const frame = parseInt((e.target as HTMLInputElement).value);
            this.goToFrame(frame);
        });

        document.getElementById('fps')?.addEventListener('change', (e) => {
            this.fps = parseInt((e.target as HTMLInputElement).value);
            if (this.isPlaying) {
                this.stop();
                this.play();
            }
        });

        document.getElementById('onionSkin')?.addEventListener('change', (e) => {
            this.onionSkin = (e.target as HTMLInputElement).checked;
            this.updateOnionSkin();
        });
    }

    private createPlayhead(): void {
        this.playhead = document.createElement('div');
        this.playhead.className = 'playhead';
        this.playhead.style.left = '0px';
        this.tracksContainer.appendChild(this.playhead);
    }

    private updateRuler(): void {
        if (!this.rulerContainer) return;
        
        this.rulerContainer.innerHTML = '';
        const frameWidth = 20; // عرض كل فريم
        
        for (let i = 0; i <= this.totalFrames; i += 5) {
            const mark = document.createElement('div');
            mark.style.position = 'absolute';
            mark.style.left = (i * frameWidth) + 'px';
            mark.style.top = '0';
            mark.style.height = i % 10 === 0 ? '100%' : '50%';
            mark.style.width = '1px';
            mark.style.background = i % 10 === 0 ? '#666' : '#444';
            
            if (i % 10 === 0) {
                const label = document.createElement('span');
                label.textContent = i.toString();
                label.style.position = 'absolute';
                label.style.left = '2px';
                label.style.top = '2px';
                label.style.fontSize = '10px';
                label.style.color = '#999';
                mark.appendChild(label);
            }
            
            this.rulerContainer.appendChild(mark);
        }
    }

    // إنشاء مسار جديد
    public createTrack(name: string, boneId: string): Track {
        const id = 'track_' + Date.now();
        const track: Track = {
            id,
            name,
            boneId,
            keyframes: [],
            isVisible: true,
            isLocked: false
        };

        this.tracks.set(id, track);
        this.renderTrack(track);
        return track;
    }

    // رسم المسار
    private renderTrack(track: Track): void {
        const trackEl = document.createElement('div');
        trackEl.className = 'track';
        trackEl.dataset.trackId = track.id;

        // اسم المسار
        const nameEl = document.createElement('div');
        nameEl.className = 'track-name';
        nameEl.textContent = track.name;
        trackEl.appendChild(nameEl);

        // منطقة الـ Keyframes
        const keyframesEl = document.createElement('div');
        keyframesEl.className = 'track-keyframes';
        
        // إضافة Keyframes الموجودة
        track.keyframes.forEach(kf => {
            this.renderKeyframe(kf, keyframesEl);
        });

        // النقر لإضافة Keyframe
        keyframesEl.addEventListener('click', (e) => {
            if (track.isLocked) return;
            
            const rect = keyframesEl.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const frame = Math.round(x / 20) + 1;
            
            this.addKeyframe(track.id, frame);
        });

        trackEl.appendChild(keyframesEl);
        this.tracksContainer.appendChild(trackEl);
    }

    // رسم Keyframe
    private renderKeyframe(keyframe: Keyframe, container: HTMLElement): void {
        const kfEl = document.createElement('div');
        kfEl.className = 'keyframe';
        kfEl.style.left = ((keyframe.frame - 1) * 20) + 'px';
        kfEl.title = `Frame ${keyframe.frame}`;
        
        kfEl.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectKeyframe(keyframe);
        });

        kfEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.deleteKeyframe(keyframe.id);
        });

        container.appendChild(kfEl);
    }

    // إضافة Keyframe
    public addKeyframe(trackId: string, frame: number, properties?: any): Keyframe {
        const track = this.tracks.get(trackId);
        if (!track) throw new Error('Track not found');

        // التحقق من عدم التكرار
        const existing = track.keyframes.find(kf => kf.frame === frame);
        if (existing) {
            return this.updateKeyframe(existing.id, properties);
        }

        const keyframe: Keyframe = {
            id: 'kf_' + Date.now(),
            frame,
            boneId: track.boneId,
            properties: properties || {},
            easing: 'linear'
        };

        track.keyframes.push(keyframe);
        track.keyframes.sort((a, b) => a.frame - b.frame);

        // إعادة رسم
        this.refreshTrack(trackId);
        
        // تأثير صوتي بصري
        this.pulseKeyframe(keyframe.id);

        return keyframe;
    }

    // تحديث Keyframe
    public updateKeyframe(keyframeId: string, properties: any): Keyframe {
        for (const track of this.tracks.values()) {
            const kf = track.keyframes.find(k => k.id === keyframeId);
            if (kf) {
                kf.properties = { ...kf.properties, ...properties };
                return kf;
            }
        }
        throw new Error('Keyframe not found');
    }

    // حذف Keyframe
    public deleteKeyframe(keyframeId: string): void {
        for (const track of this.tracks.values()) {
            const index = track.keyframes.findIndex(k => k.id === keyframeId);
            if (index !== -1) {
                track.keyframes.splice(index, 1);
                this.refreshTrack(track.id);
                return;
            }
        }
    }

    // اختيار Keyframe
    public selectKeyframe(keyframe: Keyframe): void {
        this.goToFrame(keyframe.frame);
        this.emit('keyframeSelected', keyframe);
    }

    // الانتقال إلى فريم محدد
    public goToFrame(frame: number): void {
        this.currentFrame = Math.max(1, Math.min(this.totalFrames, frame));
        
        const input = document.getElementById('currentFrame') as HTMLInputElement;
        if (input) input.value = this.currentFrame.toString();

        // تحريك Playhead
        if (this.playhead) {
            gsap.to(this.playhead, {
                left: ((this.currentFrame - 1) * 20) + 'px',
                duration: 0.1,
                ease: 'power2.out'
            });
        }

        this.interpolateFrame(this.currentFrame);
        this.emit('frameChanged', this.currentFrame);
    }

    // تشغيل / إيقاف
    public togglePlay(): void {
        if (this.isPlaying) {
            this.stop();
        } else {
            this.play();
        }
    }

    public play(): void {
        if (this.isPlaying) return;
        
        this.isPlaying = true;
        const btn = document.getElementById('playPause');
        if (btn) btn.textContent = '⏸️';

        const frameInterval = 1000 / this.fps;
        
        this.playInterval = window.setInterval(() => {
            if (this.currentFrame >= this.totalFrames) {
                this.goToFrame(1);
            } else {
                this.goToFrame(this.currentFrame + 1);
            }
        }, frameInterval);
    }

    public stop(): void {
        this.isPlaying = false;
        if (this.playInterval) {
            clearInterval(this.playInterval);
            this.playInterval = null;
        }
        
        const btn = document.getElementById('playPause');
        if (btn) btn.textContent = '▶️';
    }

    // الاستيفاء بين Keyframes
    private interpolateFrame(frame: number): void {
        for (const track of this.tracks.values()) {
            if (track.keyframes.length < 2) continue;

            // إيجاد الـ Keyframes المحيطة
            let prevKf = track.keyframes[0];
            let nextKf = track.keyframes[track.keyframes.length - 1];

            for (let i = 0; i < track.keyframes.length - 1; i++) {
                if (track.keyframes[i].frame <= frame && track.keyframes[i + 1].frame >= frame) {
                    prevKf = track.keyframes[i];
                    nextKf = track.keyframes[i + 1];
                    break;
                }
            }

            if (prevKf === nextKf) continue;

            // حساب النسبة
            const range = nextKf.frame - prevKf.frame;
            const progress = (frame - prevKf.frame) / range;
            const easedProgress = this.applyEasing(progress, prevKf.easing);

            // استيفاء الخصائص
            const interpolated: any = {};
            for (const key in prevKf.properties) {
                const start = prevKf.properties[key as keyof typeof prevKf.properties] || 0;
                const end = nextKf.properties[key as keyof typeof nextKf.properties] || 0;
                interpolated[key] = start + (end - start) * easedProgress;
            }

            this.emit('boneUpdate', {
                boneId: track.boneId,
                properties: interpolated
            });
        }
    }

    // تطبيق Easing
    private applyEasing(t: number, type: string): number {
        switch (type) {
            case 'easeIn': return t * t;
            case 'easeOut': return 1 - (1 - t) * (1 - t);
            case 'easeInOut': return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            default: return t;
        }
    }

    // Onion Skin
    private updateOnionSkin(): void {
        if (this.onionSkin) {
            this.showOnionSkin();
        } else {
            this.hideOnionSkin();
        }
    }

    private showOnionSkin(): void {
        // إظهار الإطارات السابقة والتالية بشفافية
        const prevFrame = this.currentFrame - 1;
        const nextFrame = this.currentFrame + 1;
        
        this.emit('onionSkin', { prev: prevFrame, next: nextFrame });
    }

    private hideOnionSkin(): void {
        this.emit('onionSkin', null);
    }

    // تحديث عرض المسار
    private refreshTrack(trackId: string): void {
        const trackEl = document.querySelector(`[data-track-id="${trackId}"]`);
        if (trackEl) {
            trackEl.remove();
            const track = this.tracks.get(trackId);
            if (track) this.renderTrack(track);
        }
    }

    // تأثير نبضة
    private pulseKeyframe(keyframeId: string): void {
        // يمكن إضافة تأثير بصري هنا
    }

    // الحصول على بيانات للحفظ
    public serialize(): object {
        return {
            tracks: Array.from(this.tracks.values()),
            currentFrame: this.currentFrame,
            totalFrames: this.totalFrames,
            fps: this.fps
        };
    }

    // تحميل البيانات
    public deserialize(data: any): void {
        this.tracks.clear();
        this.tracksContainer.innerHTML = '';
        this.createPlayhead();

        data.tracks.forEach((trackData: Track) => {
            this.tracks.set(trackData.id, trackData);
            this.renderTrack(trackData);
        });

        this.totalFrames = data.totalFrames || 300;
        this.fps = data.fps || 24;
        this.goToFrame(data.currentFrame || 1);
    }

    // إرسال أحداث
    private emit(event: string, data: any): void {
        window.dispatchEvent(new CustomEvent(event, { detail: data }));
    }

    // Getters
    public getCurrentFrame(): number { return this.currentFrame; }
    public getTotalFrames(): number { return this.totalFrames; }
    public getTracks(): Track[] { return Array.from(this.tracks.values()); }
}

// تصدير
(window as any).TimelineSystem = TimelineSystem;