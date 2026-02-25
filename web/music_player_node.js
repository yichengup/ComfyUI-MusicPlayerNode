/**
 * ComfyUI Music Player Node Extension
 * 内嵌式音乐播放器节点 --yicheng/亦诚制作
 */

import { app } from "../../scripts/app.js";
import { ComfyWidgets } from "../../scripts/widgets.js";

// ==================== 节点内播放器类 ====================
class NodeMusicPlayer {
    constructor(node, type = "full") {
        this.node = node;
        this.type = type; // "full" 为完整播放器, "compact" 为紧凑型上传预览
        this.audio = null;
        this.audioContext = null;
        this.analyser = null;
        this.source = null;
        this.container = null;
        this.canvas = null;
        this.ctx = null;
        
        this.state = {
            isPlaying: false,
            currentTime: 0,
            duration: 0,
            volume: 0.8,
            showVisualizer: true,
            showLyrics: false,
            lyrics: []
        };
        
        this.animationId = null;
        this.currentLyricIndex = -1;
    }
    
    /**
     * 创建播放器 UI
     */
    createUI() {
        // 创建音频元素
        this.audio = new Audio();
        this.audio.volume = this.state.volume;
        this.audio.crossOrigin = "anonymous";
        
        // 创建容器
        this.container = document.createElement('div');
        this.container.className = `node-music-player player-type-${this.type}`;
        
        // 根据类型渲染不同的 UI
        if (this.type === "compact") {
            this.renderCompactUI();
        } else {
            this.renderFullUI();
        }
        
        // 获取元素引用
        this.canvas = this.container.querySelector('.visualizer-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // 设置画布尺寸（延迟执行以确保 DOM 已渲染）
        setTimeout(() => {
            this.resizeCanvas();
            // 绘制初始提示
            if (this.ctx) {
                this.drawPlaceholder();
            }
        }, 100);
        
        // 绑定事件
        this.bindEvents();
        
        // 添加样式
        this.addStyles();
        
        return this.container;
    }
    
    /**
     * 渲染紧凑型 UI（用于上传节点）
     */
    renderCompactUI() {
        this.container.style.cssText = `
            width: 100%;
            background: rgba(15, 15, 15, 0.85);
            border-radius: 10px;
            padding: 10px;
            color: #ececec;
            font-family: 'Segoe UI', system-ui, sans-serif;
            border: 1px solid rgba(255,255,255,0.1);
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            display: flex;
            flex-direction: column;
            gap: 8px;
            position: relative;
        `;

        this.container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <button class="btn-play" style="
                    width: 32px; height: 32px; border-radius: 50%; border: none;
                    background: #4a90e2; color: white; cursor: pointer; flex-shrink: 0;
                    display: flex; align-items: center; justify-content: center; font-size: 12px;
                    transition: all 0.2s;
                ">▶</button>
                <div style="flex: 1; overflow: hidden;">
                    <div class="track-title" style="font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500;">未选择音频</div>
                    <div class="track-time" style="font-size: 10px; opacity: 0.6;">00:00 / 00:00</div>
                </div>
                <button class="btn-volume" style="
                    width: 28px; height: 28px; border-radius: 50%; border: none;
                    background: rgba(255,255,255,0.1); color: white; cursor: pointer; flex-shrink: 0;
                    display: flex; align-items: center; justify-content: center; font-size: 14px;
                    transition: all 0.2s;
                " title="音量控制">🔊</button>
                <button class="btn-menu" style="
                    width: 28px; height: 28px; border-radius: 50%; border: none;
                    background: rgba(255,255,255,0.1); color: white; cursor: pointer; flex-shrink: 0;
                    display: flex; align-items: center; justify-content: center; font-size: 14px;
                    transition: all 0.2s; position: relative;
                " title="更多选项">⋮</button>
            </div>
            
            <div style="position: relative; height: 40px; background: rgba(0,0,0,0.3); border-radius: 4px; overflow: hidden;">
                <canvas class="visualizer-canvas" style="width: 100%; height: 100%;"></canvas>
                <input type="range" class="progress-bar" min="0" max="100" value="0" style="
                    position: absolute; bottom: 0; left: 0; width: 100%; height: 100%;
                    margin: 0; -webkit-appearance: none; background: transparent; cursor: pointer; z-index: 2;
                ">
            </div>
        `;
        
        // 创建音量弹窗（添加到 body，而不是容器内）
        this.createVolumePopup();
        
        // 创建菜单弹窗（添加到 body，而不是容器内）
        this.createMenuPopup();
    }
    
    /**
     * 创建音量弹窗
     */
    createVolumePopup() {
        // 如果已存在，先移除
        const existingPopup = document.getElementById(`volume-popup-${this.node.id}`);
        if (existingPopup) {
            existingPopup.remove();
        }
        
        const popup = document.createElement('div');
        popup.id = `volume-popup-${this.node.id}`;
        popup.className = 'audio-control-popup';
        popup.style.cssText = `
            position: fixed;
            display: none;
            background: rgba(20, 20, 20, 0.95);
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 8px;
            padding: 12px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.5);
            z-index: 10000;
            min-width: 200px;
        `;
        
        popup.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; color: white;">
                <span style="font-size: 16px;">🔊</span>
                <input type="range" class="volume-bar" min="0" max="100" value="80" style="
                    flex: 1;
                    height: 4px;
                    border-radius: 2px;
                    background: rgba(255, 255, 255, 0.3);
                    outline: none;
                    -webkit-appearance: none;
                    cursor: pointer;
                ">
                <span class="volume-text" style="
                    font-size: 12px;
                    min-width: 35px;
                    text-align: right;
                    font-weight: 500;
                ">80%</span>
            </div>
        `;
        
        document.body.appendChild(popup);
        this.volumePopup = popup;
    }
    
    /**
     * 创建菜单弹窗
     */
    createMenuPopup() {
        // 如果已存在，先移除
        const existingPopup = document.getElementById(`menu-popup-${this.node.id}`);
        if (existingPopup) {
            existingPopup.remove();
        }
        
        const popup = document.createElement('div');
        popup.id = `menu-popup-${this.node.id}`;
        popup.className = 'audio-control-popup';
        popup.style.cssText = `
            position: fixed;
            display: none;
            background: rgba(20, 20, 20, 0.95);
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 8px;
            padding: 12px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.5);
            z-index: 10000;
            min-width: 180px;
        `;
        
        popup.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 10px; color: white;">
                <div style="display: flex; align-items: center; gap: 10px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <span style="font-size: 12px; flex: 1; font-weight: 500;">播放速度</span>
                    <select class="playback-rate" style="
                        background: rgba(30, 30, 30, 0.9);
                        border: 1px solid rgba(74, 144, 226, 0.4);
                        color: white;
                        padding: 6px 10px;
                        border-radius: 4px;
                        font-size: 12px;
                        cursor: pointer;
                        outline: none;
                        font-weight: 500;
                    ">
                        <option value="0.5">0.5x</option>
                        <option value="0.75">0.75x</option>
                        <option value="1" selected>1.0x</option>
                        <option value="1.25">1.25x</option>
                        <option value="1.5">1.5x</option>
                        <option value="2">2.0x</option>
                    </select>
                </div>
                <button class="btn-download" style="
                    background: rgba(74, 144, 226, 0.3);
                    border: 1px solid rgba(74, 144, 226, 0.5);
                    color: white;
                    padding: 8px 12px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 12px;
                    transition: all 0.2s;
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                ">
                    <span>📥</span>
                    <span>下载音频</span>
                </button>
            </div>
        `;
        
        document.body.appendChild(popup);
        this.menuPopup = popup;
    }
    
    /**
     * 渲染完整 UI（用于播放器节点）
     */
    renderFullUI() {
        this.container.style.cssText = `
            width: 100%;
            background: radial-gradient(circle at center, rgba(40, 50, 70, 0.95) 0%, rgba(25, 25, 25, 0.9) 70%);
            backdrop-filter: blur(15px);
            -webkit-backdrop-filter: blur(15px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 20px;
            color: #fff;
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5), inset 0 0 60px rgba(100,150,255,0.05);
        `;
        
        // 创建 HTML 结构
        this.container.innerHTML = `
            <!-- 可视化展示区 -->
            <div class="player-display" style="
                height: 140px;
                background: rgba(0, 0, 0, 0.3);
                border-radius: 12px;
                margin-bottom: 20px;
                position: relative;
                overflow: hidden;
                border: 1px solid rgba(255,255,255,0.05);
            ">
                <!-- 可视化画布 -->
                <canvas class="visualizer-canvas" style="
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    display: block;
                "></canvas>
                
                <!-- 歌词容器 -->
                <div class="lyrics-container" style="
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    display: none;
                    overflow-y: auto;
                    padding: 15px;
                    text-align: center;
                    background: rgba(0, 0, 0, 0.4);
                ">
                    <div class="lyrics-content"></div>
                </div>
            </div>
            
            <!-- 歌曲信息区 -->
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px;">
                <div style="flex: 1; overflow: hidden; margin-right: 10px;">
                    <div class="track-title" style="
                        font-size: 16px;
                        font-weight: 700;
                        color: #fff;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        letter-spacing: 0.5px;
                    ">未加载音频</div>
                    <div style="font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 2px;">Now Playing</div>
                </div>
                <div class="track-time" style="
                    font-size: 11px;
                    font-family: monospace;
                    color: rgba(255,255,255,0.6);
                    background: rgba(255,255,255,0.1);
                    padding: 4px 10px;
                    border-radius: 10px;
                ">00:00 / 00:00</div>
            </div>
            
            <!-- 进度条区 -->
            <div style="position: relative; margin-bottom: 20px;">
                <input type="range" class="progress-bar" min="0" max="100" value="0" style="
                    width: 100%;
                    height: 4px;
                    border-radius: 2px;
                    background: rgba(255,255,255,0.1);
                    outline: none;
                    -webkit-appearance: none;
                    cursor: pointer;
                ">
            </div>
            
            <!-- 主控制区 -->
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; gap: 12px;">
                    <button class="btn-visualizer btn-icon-mode" title="切换可视化" style="
                        background: rgba(255, 255, 255, 0.3);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        color: #fff;
                        width: 36px;
                        height: 36px;
                        border-radius: 10px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: all 0.2s;
                        font-size: 16px;
                    ">🎨</button>
                    <button class="btn-lyrics btn-icon-mode" title="切换歌词" style="
                        background: rgba(255, 255, 255, 0.1);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        color: #fff;
                        width: 36px;
                        height: 36px;
                        border-radius: 10px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: all 0.2s;
                        font-size: 16px;
                    ">📝</button>
                </div>
                
                <button class="btn-play" style="
                    background: #fff;
                    color: #000;
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    border: none;
                    cursor: pointer;
                    font-size: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    box-shadow: 0 4px 15px rgba(255,255,255,0.2);
                ">▶</button>
                
                <div style="display: flex; align-items: center; gap: 8px; min-width: 120px;">
                    <span style="font-size: 12px; opacity: 0.6;">Vol</span>
                    <input type="range" class="volume-bar" min="0" max="100" value="80" style="
                        flex: 1;
                        height: 3px;
                        cursor: pointer;
                        border-radius: 2px;
                        background: rgba(255, 255, 255, 0.2);
                        outline: none;
                        -webkit-appearance: none;
                    ">
                    <span class="volume-text" style="
                        font-size: 10px;
                        min-width: 30px;
                        text-align: right;
                        opacity: 0.8;
                    ">80%</span>
                </div>
            </div>
        `;
    }
    
    /**
     * 调整画布尺寸
     */
    resizeCanvas() {
        if (!this.canvas) return;
        
        if (this.type === "compact") {
            // 紧凑型：固定尺寸
            const rect = this.canvas.getBoundingClientRect();
            this.canvas.width = rect.width || 400;
            this.canvas.height = 40;
        } else {
            // 完整型：原有逻辑
            const display = this.container.querySelector('.player-display');
            if (!display) return;
            
            this.canvas.width = 500;
            this.canvas.height = 120;
        }
        
        console.log('[NodeMusicPlayer] Canvas resized:', this.canvas.width, 'x', this.canvas.height);
    }
    
    /**
     * 绑定事件
     */
    bindEvents() {
        // 播放/暂停
        const btnPlay = this.container.querySelector('.btn-play');
        btnPlay.addEventListener('click', () => this.togglePlay());
        
        // 进度条
        const progressBar = this.container.querySelector('.progress-bar');
        progressBar.addEventListener('input', (e) => {
            if (this.audio && this.state.duration) {
                const time = (e.target.value / 100) * this.state.duration;
                this.audio.currentTime = time;
            }
        });
        
        // 音量按钮（紧凑版）
        const btnVolume = this.container.querySelector('.btn-volume');
        if (btnVolume) {
            btnVolume.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleVolumePopup(e);
            });
        }
        
        // 菜单按钮（紧凑版）
        const btnMenu = this.container.querySelector('.btn-menu');
        if (btnMenu) {
            btnMenu.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleMenuPopup(e);
            });
        }
        
        // 音量条事件绑定
        const bindVolumeBar = (volumeBar) => {
            if (volumeBar) {
                volumeBar.addEventListener('input', (e) => {
                    const volume = e.target.value / 100;
                    this.setVolume(volume);
                });
            }
        };
        
        // 绑定紧凑版音量条
        if (this.type === "compact" && this.volumePopup) {
            bindVolumeBar(this.volumePopup.querySelector('.volume-bar'));
        } else {
            // 绑定完整版音量条
            bindVolumeBar(this.container.querySelector('.volume-bar'));
        }
        
        // 播放速度（紧凑版）
        if (this.type === "compact" && this.menuPopup) {
            const playbackRate = this.menuPopup.querySelector('.playback-rate');
            if (playbackRate) {
                playbackRate.addEventListener('change', (e) => {
                    this.audio.playbackRate = parseFloat(e.target.value);
                    console.log('[NodeMusicPlayer] 播放速度设置为:', e.target.value);
                });
            }
            
            // 下载按钮
            const btnDownload = this.menuPopup.querySelector('.btn-download');
            if (btnDownload) {
                btnDownload.addEventListener('click', () => {
                    this.downloadAudio();
                    this.hideAllPopups();
                });
            }
        }
        
        // 可视化按钮（仅完整版有）
        const btnVisualizer = this.container.querySelector('.btn-visualizer');
        if (btnVisualizer) {
            btnVisualizer.addEventListener('click', () => this.toggleVisualizer());
        }
        
        // 歌词按钮（仅完整版有）
        const btnLyrics = this.container.querySelector('.btn-lyrics');
        if (btnLyrics) {
            btnLyrics.addEventListener('click', () => this.toggleLyrics());
        }
        
        // 音频事件
        this.audio.addEventListener('loadedmetadata', () => {
            this.state.duration = this.audio.duration;
            this.updateTimeDisplay();
        });
        
        this.audio.addEventListener('timeupdate', () => {
            this.state.currentTime = this.audio.currentTime;
            this.updateProgress();
            this.updateTimeDisplay();
            if (this.type === "full") {
                this.updateLyrics();
            }
        });
        
        this.audio.addEventListener('play', () => {
            this.state.isPlaying = true;
            this.updatePlayButton();
            
            // 确保 AudioContext 已经初始化和resume
            if (this.state.showVisualizer) {
                // 如果AudioContext还没初始化，先初始化
                if (!this.audioContext) {
                    this.initAudioContext();
                }
                
                // 确保AudioContext处于运行状态
                if (this.audioContext && this.audioContext.state === 'suspended') {
                    this.audioContext.resume().then(() => {
                        console.log('[NodeMusicPlayer] AudioContext resumed on play');
                        // Resume后立即启动可视化
                        this.startVisualization();
                    }).catch(err => {
                        console.error('[NodeMusicPlayer] Failed to resume AudioContext on play:', err);
                    });
                } else {
                    // AudioContext已经就绪，直接启动可视化
                    this.startVisualization();
                }
            }
        });
        
        this.audio.addEventListener('pause', () => {
            this.state.isPlaying = false;
            this.updatePlayButton();
            this.stopVisualization();
        });
        
        this.audio.addEventListener('ended', () => {
            this.state.isPlaying = false;
            this.updatePlayButton();
            this.stopVisualization();
        });
    }
    
    /**
     * 加载音频
     */
    loadAudio(url, title = '未知曲目') {
        console.log('[NodeMusicPlayer] Loading audio:', url, title);
        
        // 清理之前的事件监听器（如果有）
        if (this._errorHandler) {
            this.audio.removeEventListener('error', this._errorHandler);
        }
        if (this._loadedDataHandler) {
            this.audio.removeEventListener('loadeddata', this._loadedDataHandler);
        }
        
        // 添加错误处理
        this._errorHandler = (e) => {
            console.error('[NodeMusicPlayer] ❌ 音频加载失败!');
            console.error('  错误事件:', e);
            console.error('  错误代码:', this.audio.error?.code);
            console.error('  错误消息:', this.audio.error?.message);
            console.error('  音频 URL:', this.audio.src);
            
            // 显示错误信息
            const titleEl = this.container.querySelector('.track-title');
            if (titleEl) {
                titleEl.textContent = '❌ 音频加载失败';
                titleEl.style.color = '#ff6b6b';
            }
        };
        this.audio.addEventListener('error', this._errorHandler, { once: true });
        
        // 添加成功加载的监听
        this._loadedDataHandler = () => {
            console.log('[NodeMusicPlayer] ✅ 音频加载成功!');
            console.log('  时长:', this.audio.duration, '秒');
            console.log('  就绪状态:', this.audio.readyState);
        };
        this.audio.addEventListener('loadeddata', this._loadedDataHandler, { once: true });
        
        this.audio.src = url;
        
        // 更新标题
        const titleEl = this.container.querySelector('.track-title');
        if (titleEl) {
            titleEl.textContent = title;
            titleEl.style.color = 'white';
        }
        
        // 重新调整画布尺寸
        setTimeout(() => {
            this.resizeCanvas();
        }, 100);
        
        // 等待音频加载完成后初始化 Web Audio API
        const onLoadedData = () => {
            console.log('[NodeMusicPlayer] Audio loaded, initializing AudioContext');
            this.initAudioContext();
            
            // 如果可视化已开启，绘制占位符
            if (this.state.showVisualizer) {
                this.drawPlaceholder('🎵 点击播放按钮开始');
            }
        };
        
        // 如果音频已经加载，立即初始化
        if (this.audio.readyState >= 2) {
            onLoadedData();
        } else {
            // 否则等待加载完成
            this.audio.addEventListener('loadeddata', onLoadedData, { once: true });
        }
    }
    
    /**
     * 初始化 Web Audio API
     */
    initAudioContext() {
        if (this.audioContext) {
            // 如果已经初始化过，检查是否需要resume
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume().then(() => {
                    console.log('[NodeMusicPlayer] AudioContext resumed');
                }).catch(err => {
                    console.error('[NodeMusicPlayer] Failed to resume AudioContext:', err);
                });
            }
            return;
        }
        
        try {
            // 创建 AudioContext
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContextClass();
            
            // 创建 AnalyserNode
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.85;
            
            // 为每个播放器实例创建独立的 source
            // 使用唯一的标识符来避免多个实例之间的冲突
            const sourceKey = `_musicPlayerSource_${this.node.id}`;
            
            if (!this.audio[sourceKey]) {
                this.source = this.audioContext.createMediaElementSource(this.audio);
                this.audio[sourceKey] = this.source;
                console.log('[NodeMusicPlayer] Created new MediaElementSource for node:', this.node.id);
            } else {
                // 重用已存在的 source
                this.source = this.audio[sourceKey];
                console.log('[NodeMusicPlayer] Reusing existing MediaElementSource for node:', this.node.id);
            }
            
            // 连接音频链：source → analyser → destination
            // 这样音频既能被分析（用于可视化），又能输出到扬声器
            try {
                this.source.disconnect();
            } catch (e) {
                // 忽略断开连接的错误（首次连接时会抛出）
            }
            
            this.source.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);
            
            // 确保 AudioContext 处于运行状态
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume().then(() => {
                    console.log('[NodeMusicPlayer] AudioContext resumed during init');
                }).catch(err => {
                    console.error('[NodeMusicPlayer] Failed to resume AudioContext during init:', err);
                });
            }
            
            console.log('[NodeMusicPlayer] Web Audio API initialized successfully');
        } catch (err) {
            console.error('[NodeMusicPlayer] Failed to initialize Web Audio API:', err);
            this.audioContext = null;
            this.analyser = null;
            this.source = null;
        }
    }
    
    /**
     * 播放/暂停
     */
    togglePlay() {
        if (!this.audio.src) {
            console.warn('[NodeMusicPlayer] 未加载音频');
            return;
        }
        
        if (this.state.isPlaying) {
            this.audio.pause();
        } else {
            this.audio.play().catch(err => {
                console.error('[NodeMusicPlayer] 播放失败:', err);
            });
        }
    }
    
    /**
     * 设置音量
     */
    setVolume(volume) {
        this.state.volume = Math.max(0, Math.min(1, volume));
        this.audio.volume = this.state.volume;
        
        // 更新所有音量显示
        const volumeTexts = [
            this.container.querySelector('.volume-text'),
            this.volumePopup?.querySelector('.volume-text')
        ];
        
        volumeTexts.forEach(el => {
            if (el) {
                el.textContent = Math.round(this.state.volume * 100) + '%';
            }
        });
        
        // 同步所有音量滑块
        const volumeBars = [
            this.container.querySelector('.volume-bar'),
            this.volumePopup?.querySelector('.volume-bar')
        ];
        
        volumeBars.forEach(el => {
            if (el) {
                el.value = Math.round(this.state.volume * 100);
            }
        });
    }
    
    /**
     * 更新进度条
     */
    updateProgress() {
        if (this.state.duration) {
            const progress = (this.state.currentTime / this.state.duration) * 100;
            const progressBar = this.container.querySelector('.progress-bar');
            progressBar.value = progress;
        }
    }
    
    /**
     * 更新时间显示
     */
    updateTimeDisplay() {
        const current = this.formatTime(this.state.currentTime);
        const total = this.formatTime(this.state.duration);
        const timeEl = this.container.querySelector('.track-time');
        timeEl.textContent = `${current} / ${total}`;
    }
    
    /**
     * 更新播放按钮
     */
    updatePlayButton() {
        const btn = this.container.querySelector('.btn-play');
        btn.textContent = this.state.isPlaying ? '⏸' : '▶';
    }
    
    /**
     * 格式化时间
     */
    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '00:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    /**
     * 切换音量弹窗
     */
    toggleVolumePopup(event) {
        if (!this.volumePopup) return;
        
        const isVisible = this.volumePopup.style.display === 'block';
        
        // 隐藏所有弹窗
        this.hideAllPopups();
        
        if (!isVisible) {
            // 显示音量弹窗
            this.volumePopup.style.display = 'block';
            
            // 定位弹窗（在按钮下方）
            const btnRect = event.target.getBoundingClientRect();
            this.volumePopup.style.left = `${btnRect.left - 80}px`;
            this.volumePopup.style.top = `${btnRect.bottom + 5}px`;
            
            // 点击外部关闭
            setTimeout(() => {
                document.addEventListener('click', this.handleClickOutside.bind(this), { once: true });
            }, 0);
        }
    }
    
    /**
     * 切换菜单弹窗
     */
    toggleMenuPopup(event) {
        if (!this.menuPopup) return;
        
        const isVisible = this.menuPopup.style.display === 'block';
        
        // 隐藏所有弹窗
        this.hideAllPopups();
        
        if (!isVisible) {
            // 显示菜单弹窗
            this.menuPopup.style.display = 'block';
            
            // 定位弹窗（在按钮下方）
            const btnRect = event.target.getBoundingClientRect();
            this.menuPopup.style.left = `${btnRect.right - 180}px`;
            this.menuPopup.style.top = `${btnRect.bottom + 5}px`;
            
            // 点击外部关闭
            setTimeout(() => {
                document.addEventListener('click', this.handleClickOutside.bind(this), { once: true });
            }, 0);
        }
    }
    
    /**
     * 隐藏所有弹窗
     */
    hideAllPopups() {
        if (this.volumePopup) {
            this.volumePopup.style.display = 'none';
        }
        if (this.menuPopup) {
            this.menuPopup.style.display = 'none';
        }
    }
    
    /**
     * 处理点击外部关闭弹窗
     */
    handleClickOutside(event) {
        const isClickInsideVolume = this.volumePopup && this.volumePopup.contains(event.target);
        const isClickInsideMenu = this.menuPopup && this.menuPopup.contains(event.target);
        const isClickInsideContainer = this.container && this.container.contains(event.target);
        
        if (!isClickInsideVolume && !isClickInsideMenu && !isClickInsideContainer) {
            this.hideAllPopups();
        }
    }
    

    /**
     * 下载音频
     */
    downloadAudio() {
        if (!this.audio.src) {
            console.warn('[NodeMusicPlayer] 没有可下载的音频');
            return;
        }
        
        const titleEl = this.container.querySelector('.track-title');
        const filename = titleEl ? titleEl.textContent : 'audio';
        
        // 创建一个临时的 a 标签来触发下载
        const a = document.createElement('a');
        a.href = this.audio.src;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        console.log('[NodeMusicPlayer] 开始下载音频:', filename);
    }
    
    /**
     * 切换可视化
     */
    toggleVisualizer() {
        this.state.showVisualizer = !this.state.showVisualizer;
        this.state.showLyrics = false;
        
        const canvas = this.container.querySelector('.visualizer-canvas');
        const lyricsContainer = this.container.querySelector('.lyrics-container');
        const btnVisualizer = this.container.querySelector('.btn-visualizer');
        const btnLyrics = this.container.querySelector('.btn-lyrics');
        
        // 显示/隐藏画布和歌词
        canvas.style.display = this.state.showVisualizer ? 'block' : 'none';
        lyricsContainer.style.display = 'none';
        
        // 更新按钮样式
        btnVisualizer.style.background = this.state.showVisualizer ? 
            'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.2)';
        btnLyrics.style.background = 'rgba(255, 255, 255, 0.2)';
        
        console.log('[NodeMusicPlayer] Visualizer toggled:', this.state.showVisualizer);
        
        if (this.state.showVisualizer) {
            // 重新调整画布尺寸
            setTimeout(() => {
                this.resizeCanvas();
            }, 50);
            
            if (this.state.isPlaying) {
                // 如果正在播放，启动可视化
                this.startVisualization();
            } else {
                // 否则显示占位符
                this.drawPlaceholder('🎵 点击播放按钮开始');
            }
        } else {
            // 停止可视化
            this.stopVisualization();
        }
    }
    
    /**
     * 切换歌词（可以传入参数强制设置状态）
     */
    toggleLyrics(forceShow = null) {
        // 如果传入了 forceShow 参数，使用该值；否则切换状态
        if (forceShow !== null) {
            this.state.showLyrics = forceShow;
        } else {
            this.state.showLyrics = !this.state.showLyrics;
        }
        
        this.state.showVisualizer = false;
        
        const canvas = this.container.querySelector('.visualizer-canvas');
        const lyricsContainer = this.container.querySelector('.lyrics-container');
        const btnVisualizer = this.container.querySelector('.btn-visualizer');
        const btnLyrics = this.container.querySelector('.btn-lyrics');
        
        console.log('[NodeMusicPlayer] 切换歌词显示:', this.state.showLyrics);
        console.log('[NodeMusicPlayer] 歌词容器:', lyricsContainer);
        console.log('[NodeMusicPlayer] 歌词数量:', this.state.lyrics.length);
        
        // 停止可视化
        this.stopVisualization();
        
        // 显示/隐藏元素
        if (canvas) {
            canvas.style.display = this.state.showLyrics ? 'none' : 'block';
        }
        
        if (lyricsContainer) {
            lyricsContainer.style.display = this.state.showLyrics ? 'block' : 'none';
            console.log('[NodeMusicPlayer] 歌词容器 display 设置为:', lyricsContainer.style.display);
            
            // 强制重新渲染歌词内容
            if (this.state.showLyrics && this.state.lyrics.length > 0) {
                console.log('[NodeMusicPlayer] 强制重新渲染歌词');
                this.renderLyrics();
            }
        }
        
        // 更新按钮样式
        if (btnVisualizer) {
            btnVisualizer.style.background = this.state.showLyrics ? 
                'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.4)';
        }
        if (btnLyrics) {
            btnLyrics.style.background = this.state.showLyrics ? 
                'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.2)';
        }
    }
    
    /**
     * 加载歌词
     */
    loadLyrics(lrcText) {
        // 1. 数据清洗：处理 ComfyUI 可能传入的数组形式
        if (Array.isArray(lrcText)) {
            lrcText = lrcText.length > 0 ? lrcText.join('\n') : '';
        }
        
        // 2. 确保是字符串
        if (typeof lrcText !== 'string') {
            lrcText = String(lrcText || '');
        }
        
        if (!lrcText.trim()) {
            this.state.lyrics = [];
            this.renderLyrics();
            return;
        }

        // 3. 格式检测与解析
        let parsedLyrics = [];
        if (lrcText.includes('-->') && !lrcText.includes('[00:')) {
            // SRT 格式
            parsedLyrics = this.parseSRT(lrcText);
        } else if (lrcText.includes('[') && lrcText.includes(']')) {
            // LRC 格式
            parsedLyrics = this.parseLRC(lrcText);
        }
        
        // 如果解析失败或结果为空，就直接显示原文
        if (parsedLyrics.length === 0) {
            // 将文本按行分割，每行作为一个歌词条目
            const lines = lrcText.split(/\r?\n/).filter(line => line.trim());
            parsedLyrics = lines.map((line, index) => ({
                time: index * 3, // 每3秒一行
                text: line.trim()
            }));
            
            // 如果还是没有内容，就把整个文本作为一行
            if (parsedLyrics.length === 0) {
                parsedLyrics = [{
                    time: 0,
                    text: lrcText.trim()
                }];
            }
        }
        
        this.state.lyrics = parsedLyrics;
        
        // 4. 渲染
        this.renderLyrics();
    }
    
    /**
     * 解析 LRC 歌词
     */
    parseLRC(content) {
        if (!content) return [];
        
        const lyrics = [];
        
        // 检查是否是单行格式（所有歌词在一行中）
        const isSingleLine = !content.includes('\n') && content.includes('][');
        
        if (isSingleLine) {
            // 单行格式：[00:00.13]歌词1[00:02.93]歌词2...
            // 使用全局正则匹配所有时间戳和歌词
            const globalRegex = /\[(\d{1,2}):(\d{1,2})[.:](\d{1,3})\]([^\[]*)/g;
            
            let match;
            while ((match = globalRegex.exec(content)) !== null) {
                const minutes = parseInt(match[1]);
                const seconds = parseInt(match[2]);
                // 处理毫秒：如果是2位(如.13)算130ms，如果是3位(如.130)也是130ms
                let msStr = match[3];
                // 补齐毫秒位数以便计算 (例如 .1 -> 100, .13 -> 130)
                if (msStr.length === 1) msStr += "00";
                if (msStr.length === 2) msStr += "0";
                const milliseconds = parseInt(msStr);
                
                const time = minutes * 60 + seconds + milliseconds / 1000;
                const text = match[4].trim(); // 移除歌词前后的空格
                
                if (text) {
                    lyrics.push({ time, text });
                }
            }
        } else {
            // 多行格式：按行分割，兼容各种换行符
            const lines = content.split(/\r?\n/);
            const timeRegex = /^\s*\[(\d{1,2}):(\d{1,2})[.:](\d{1,3})\](.*)/;

            lines.forEach((line) => {
                const match = timeRegex.exec(line);
                if (match) {
                    const minutes = parseInt(match[1]);
                    const seconds = parseInt(match[2]);
                    // 处理毫秒：如果是2位(如.13)算130ms，如果是3位(如.130)也是130ms
                    let msStr = match[3];
                    // 补齐毫秒位数以便计算 (例如 .1 -> 100, .13 -> 130)
                    if (msStr.length === 1) msStr += "00";
                    if (msStr.length === 2) msStr += "0";
                    const milliseconds = parseInt(msStr);
                    
                    const time = minutes * 60 + seconds + milliseconds / 1000;
                    const text = match[4].trim(); // 移除歌词前后的空格
                    
                    // 只有当歌词文本不为空，或者只有时间戳的空行也保留(作为占位)时
                    if (text || text === "") {
                        lyrics.push({ time, text });
                    }
                }
            });
        }
        
        return lyrics.sort((a, b) => a.time - b.time);
    }
    
    /**
     * 解析 SRT 字幕
     */
    parseSRT(content) {
        const lyrics = [];
        const blocks = content.split(/\n\s*\n/); // 按空行分割
        
        blocks.forEach(block => {
            const lines = block.trim().split('\n');
            if (lines.length < 3) return;
            
            // 第二行是时间戳：00:00:12,000 --> 00:00:15,500
            const timeLine = lines[1];
            const timeMatch = timeLine.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
            
            if (!timeMatch) return;
            
            // 解析开始时间
            const hours = parseInt(timeMatch[1]);
            const minutes = parseInt(timeMatch[2]);
            const seconds = parseInt(timeMatch[3]);
            const milliseconds = parseInt(timeMatch[4]);
            const time = hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
            
            // 第三行及之后是字幕文本
            const text = lines.slice(2).join(' ').trim();
            if (!text) return;
            
            lyrics.push({ time, text });
        });
        
        return lyrics.sort((a, b) => a.time - b.time);
    }
    
    /**
     * 渲染歌词
     */
    renderLyrics() {
        const content = this.container.querySelector('.lyrics-content');
        
        if (!content) {
            // 尝试强制创建容器
            const lyricsContainer = this.container.querySelector('.lyrics-container');
            if (lyricsContainer && !lyricsContainer.querySelector('.lyrics-content')) {
                const newContent = document.createElement('div');
                newContent.className = 'lyrics-content';
                lyricsContainer.appendChild(newContent);
            }
            return;
        }
        
        // 清空内容
        content.innerHTML = '';
        
        if (this.state.lyrics.length === 0) {
            const noLyrics = document.createElement('div');
            noLyrics.style.cssText = `
                padding: 20px;
                opacity: 0.6;
                font-size: 12px;
                color: white;
                text-align: center;
            `;
            noLyrics.textContent = '暂无歌词';
            content.appendChild(noLyrics);
        } else {
            this.state.lyrics.forEach((lyric, index) => {
                const line = document.createElement('div');
                line.className = 'lyric-line';
                line.dataset.index = index;
                line.textContent = lyric.text || `[空歌词 ${index}]`;
                line.style.cssText = `
                    font-size: 12px;
                    line-height: 1.6;
                    opacity: 0.5;
                    transition: all 0.3s ease;
                    padding: 4px 8px;
                    border-radius: 6px;
                    color: white;
                    margin: 2px 0;
                `;
                content.appendChild(line);
            });
        }
        
        // 强制显示和重绘
        content.style.display = 'block';
        content.style.visibility = 'visible';
        content.offsetHeight; // 强制重排
        
        // 确保父容器也可见
        const lyricsContainer = this.container.querySelector('.lyrics-container');
        if (lyricsContainer) {
            lyricsContainer.style.display = 'block';
            lyricsContainer.style.visibility = 'visible';
        }
    }
    
    /**
     * 更新歌词高亮
     */
    updateLyrics() {
        if (!this.state.showLyrics || this.state.lyrics.length === 0) return;
        
        let newIndex = -1;
        for (let i = 0; i < this.state.lyrics.length; i++) {
            if (this.state.currentTime >= this.state.lyrics[i].time) {
                newIndex = i;
            } else {
                break;
            }
        }
        
        if (newIndex !== this.currentLyricIndex) {
            this.currentLyricIndex = newIndex;
            this.highlightLyric(newIndex);
        }
    }
    
    /**
     * 高亮歌词
     */
    highlightLyric(index) {
        const lines = this.container.querySelectorAll('.lyric-line');
        
        lines.forEach((line, i) => {
            // 移除所有active类
            line.classList.remove('active');
            
            if (i === index) {
                // 使用CSS类来应用样式，利用CSS中定义的过渡效果
                line.classList.add('active');
                line.style.opacity = '1';
                line.style.background = 'rgba(255, 255, 255, 0.1)';
                // 确保滚动到视图中心
                line.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center',
                    inline: 'nearest'
                });
            } else if (i < index) {
                line.style.opacity = '0.3';
                line.style.background = 'transparent';
                line.style.color = '#cccccc';
            } else {
                line.style.opacity = '0.5';
                line.style.background = 'transparent';
                line.style.color = '#ffffff';
            }
        });
    }
    
    /**
     * 开始可视化
     */
    startVisualization() {
        if (!this.analyser || !this.ctx) {
            console.warn('[NodeMusicPlayer] Cannot start visualization: analyser or ctx not ready');
            console.warn('  analyser:', this.analyser);
            console.warn('  ctx:', this.ctx);
            console.warn('  audioContext:', this.audioContext);
            console.warn('  audioContext.state:', this.audioContext?.state);
            return;
        }
        
        // 停止之前的动画
        this.stopVisualization();
        
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        console.log('[NodeMusicPlayer] Starting visualization with bufferLength:', bufferLength);
        
        const draw = () => {
            if (!this.state.showVisualizer || !this.state.isPlaying) {
                return;
            }
            
            this.animationId = requestAnimationFrame(draw);
            
            // 获取频率数据
            this.analyser.getByteFrequencyData(dataArray);
            
            // 绘制频谱柱状图
            this.drawBars(dataArray, bufferLength);
        };
        
        draw();
        console.log('[NodeMusicPlayer] Visualization started');
    }
    
    /**
     * 停止可视化
     */
    stopVisualization() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        // 清空画布
        if (this.ctx && this.canvas) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }
    
    /**
     * 绘制频谱柱状图
     */
    drawBars(dataArray, bufferLength) {
        const { width, height } = this.canvas;
        
        // 清空画布并绘制背景
        if (this.type === "compact") {
            this.ctx.clearRect(0, 0, width, height);
        } else {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            this.ctx.fillRect(0, 0, width, height);
        }
        
        // 缓存计算结果以提高性能
        if (!this._cachedDrawParams || this._cachedDrawParams.width !== width) {
            const barCount = this.type === "compact" ? 40 : 60;
            const barWidth = width / barCount;
            const effectiveBufferLength = Math.floor(bufferLength * 0.65);
            const barGap = this.type === "compact" ? 1 : 2;
            
            this._cachedDrawParams = {
                width,
                barCount,
                barWidth,
                effectiveBufferLength,
                barGap
            };
        }
        
        const { barCount, barWidth, effectiveBufferLength, barGap } = this._cachedDrawParams;

        for (let i = 0; i < barCount; i++) {
            // 从有效频率范围内采样
            const dataIndex = Math.floor(i * effectiveBufferLength / barCount);
            const safeIndex = Math.min(dataIndex, bufferLength - 1);
            const value = dataArray[safeIndex];
            const barHeight = (Math.min(255, value) / 255) * height;
            
            // 根据类型设置颜色
            if (this.type === "compact") {
                this.ctx.fillStyle = `rgba(74, 144, 226, ${value/255 + 0.2})`;
                this.ctx.fillRect(i * barWidth, height - barHeight, barWidth - barGap, barHeight);
            } else {
                const hue = (i / barCount) * 360;
                this.ctx.fillStyle = `hsla(${hue}, 80%, 60%, 0.8)`;
                this.ctx.fillRect(i * barWidth, height - barHeight, barWidth - barGap, barHeight);
            }
        }
    }
    /**
     * 绘制占位符
     */
    drawPlaceholder(text = '🎵 等待音频加载...') {
        if (!this.ctx || !this.canvas) return;
        
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // 清空画布
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        this.ctx.fillRect(0, 0, width, height);
        
        // 绘制提示文字
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(text, width / 2, height / 2);
    }
    
    /**
     * 添加样式
     */
    addStyles() {
        if (document.getElementById('node-music-player-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'node-music-player-styles';
        style.textContent = `
            /* 进度条美化 - 完整版 */
            .node-music-player input[type="range"] {
                background: rgba(255,255,255,0.1);
                border-radius: 10px;
                height: 4px;
                -webkit-appearance: none;
            }
            
            .node-music-player input[type="range"]::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: white;
                cursor: pointer;
                box-shadow: 0 0 10px rgba(255,255,255,0.5);
                transition: transform 0.1s;
            }
            
            .node-music-player input[type="range"]::-webkit-slider-thumb:hover {
                transform: scale(1.3);
            }
            
            .node-music-player input[type="range"]::-moz-range-thumb {
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: white;
                cursor: pointer;
                border: none;
                box-shadow: 0 0 10px rgba(255,255,255,0.5);
                transition: transform 0.1s;
            }
            
            .node-music-player input[type="range"]::-moz-range-thumb:hover {
                transform: scale(1.3);
            }
            
            /* 紧凑型进度条样式 */
            .player-type-compact input[type="range"].progress-bar::-webkit-slider-thumb {
                width: 4px;
                height: 40px;
                border-radius: 0;
                background: rgba(255,255,255,0.5);
            }
            
            .player-type-compact input[type="range"].progress-bar::-moz-range-thumb {
                width: 4px;
                height: 40px;
                border-radius: 0;
                background: rgba(255,255,255,0.5);
            }
            
            /* 紧凑型音量条样式 */
            .player-type-compact .volume-bar::-webkit-slider-thumb {
                width: 10px;
                height: 10px;
                border-radius: 50%;
                background: white;
            }
            
            .player-type-compact .volume-bar::-moz-range-thumb {
                width: 10px;
                height: 10px;
                border-radius: 50%;
                background: white;
            }
            
            /* 功能按钮美化 */
            .btn-icon-mode {
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.1);
                color: #fff;
                width: 36px;
                height: 36px;
                border-radius: 10px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
            }
            
            .btn-icon-mode:hover {
                background: rgba(255, 255, 255, 0.2);
                transform: translateY(-2px);
            }
            
            /* 播放按钮特殊效果 */
            .btn-play:hover {
                transform: scale(1.1);
                background: #fff;
                box-shadow: 0 0 20px rgba(255,255,255,0.4);
            }
            
            .btn-play:active {
                transform: scale(0.95);
            }
            
            .node-music-player button:active {
                transform: scale(0.95);
            }
            
            .player-type-compact button:hover {
                filter: brightness(1.2);
                transform: scale(1.05);
                transition: 0.2s;
            }
            
            .player-type-compact .btn-download:hover {
                background: rgba(74, 144, 226, 0.5) !important;
            }
            
            .player-type-compact select {
                outline: none;
            }
            
            .player-type-compact select:hover {
                background: rgba(255,255,255,0.15) !important;
            }
            
            /* Select 下拉菜单选项样式 */
            .playback-rate {
                background: rgba(30, 30, 30, 0.9) !important;
                color: white !important;
            }
            
            .playback-rate option {
                background: rgba(40, 40, 40, 0.95) !important;
                color: white !important;
                padding: 6px 8px;
            }
            
            .playback-rate option:checked {
                background: linear-gradient(rgba(74, 144, 226, 0.8), rgba(74, 144, 226, 0.8)) !important;
                color: white !important;
            }
            
            .playback-rate option:hover {
                background: rgba(74, 144, 226, 0.6) !important;
                color: white !important;
            }
            
            /* 歌词滚动美化 */
            .lyric-line {
                transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important;
                filter: blur(0.5px);
            }
            
            .lyric-line.active {
                color: #fff !important;
                font-size: 16px !important;
                font-weight: 700 !important;
                filter: blur(0px);
                text-shadow: 0 0 15px rgba(255,255,255,0.5);
            }
            
            .lyrics-container::-webkit-scrollbar {
                width: 4px;
            }
            
            .lyrics-container::-webkit-scrollbar-track {
                background: transparent;
            }
            
            .lyrics-container::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.3);
                border-radius: 2px;
            }
        `;
        document.head.appendChild(style);
    }
    
    /**
     * 销毁播放器
     */
    destroy() {
        // 清理音频事件监听器
        if (this._errorHandler) {
            this.audio.removeEventListener('error', this._errorHandler);
            this._errorHandler = null;
        }
        if (this._loadedDataHandler) {
            this.audio.removeEventListener('loadeddata', this._loadedDataHandler);
            this._loadedDataHandler = null;
        }
        
        if (this.audio) {
            this.audio.pause();
            this.audio.src = '';
            
            // 清理节点特定的 source 引用
            const sourceKey = `_musicPlayerSource_${this.node.id}`;
            if (this.audio[sourceKey]) {
                delete this.audio[sourceKey];
            }
        }
        
        this.stopVisualization();
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        // 清理缓存的绘制参数
        this._cachedDrawParams = null;
        
        // 清理弹窗
        if (this.volumePopup) {
            this.volumePopup.remove();
            this.volumePopup = null;
        }
        
        if (this.menuPopup) {
            this.menuPopup.remove();
            this.menuPopup = null;
        }
    }
}

// ==================== ComfyUI 扩展注册 ====================
app.registerExtension({
    name: "Comfy.MusicPlayerNode",
    
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        // 注册 LoadLyricsFileNode
        if (nodeData.name === "LoadLyricsFileNode") {
            const originalOnCreated = nodeType.prototype.onNodeCreated;
            
            nodeType.prototype.onNodeCreated = function() {
                const ret = originalOnCreated?.apply?.(this, arguments);
                
                // 添加文件上传按钮
                this.addWidget("button", "📁 选择歌词文件", "upload_lyrics", () => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = ".lrc,.srt,.txt";
                    input.style.display = "none";
                    document.body.appendChild(input);
                    
                    input.onchange = () => {
                        const file = input.files[0];
                        if (file) {
                            // 创建 FormData 上传文件
                            const formData = new FormData();
                            formData.append("image", file);  // ComfyUI 使用 "image" 字段名
                            formData.append("type", "input");
                            formData.append("subfolder", "");
                            
                            fetch("/upload/image", {
                                method: "POST",
                                body: formData,
                            })
                            .then(response => response.json())
                            .then(data => {
                                if (data.name) {
                                    // 更新下拉菜单选项
                                    const lyricsWidget = this.widgets.find(w => w.name === "lyrics_file");
                                    if (lyricsWidget) {
                                        // 刷新文件列表
                                        this.refreshLyricsFileList();
                                        // 设置为新上传的文件
                                        setTimeout(() => {
                                            lyricsWidget.value = data.name;
                                        }, 100);
                                    }
                                    console.log(`[LoadLyricsFileNode] 文件上传成功: ${data.name}`);
                                }
                            })
                            .catch(error => {
                                console.error("[LoadLyricsFileNode] 文件上传失败:", error);
                                alert("文件上传失败，请重试");
                            });
                        }
                        document.body.removeChild(input);
                    };
                    
                    input.click();
                });
                
                // 添加刷新按钮
                this.addWidget("button", "🔄 刷新文件列表", "refresh_lyrics_files", () => {
                    this.refreshLyricsFileList();
                });
                
                console.log('[LoadLyricsFileNode] 节点创建完成');
                return ret;
            };
            
            // 添加刷新文件列表方法
            nodeType.prototype.refreshLyricsFileList = function() {
                // 重新获取节点信息来刷新文件列表
                fetch("/object_info")
                    .then(response => response.json())
                    .then(data => {
                        const nodeInfo = data.LoadLyricsFileNode;
                        if (nodeInfo && nodeInfo.input && nodeInfo.input.required && nodeInfo.input.required.lyrics_file) {
                            const newFiles = nodeInfo.input.required.lyrics_file[0];
                            const lyricsWidget = this.widgets.find(w => w.name === "lyrics_file");
                            if (lyricsWidget) {
                                lyricsWidget.options.values = newFiles;
                                console.log('[LoadLyricsFileNode] 文件列表已刷新:', newFiles);
                                
                                // 触发界面更新
                                if (this.graph && this.graph.canvas) {
                                    this.graph.canvas.setDirty(true, true);
                                }
                            }
                        }
                    })
                    .catch(error => {
                        console.error('[LoadLyricsFileNode] 刷新文件列表失败:', error);
                    });
            };
        }
        
        // 注册 LyricsInputNode
        if (nodeData.name === "LyricsInputNode") {
            // 这个节点不需要特殊的前端处理，只是一个简单的文本输入节点
            console.log('[LyricsInputNode] 节点注册完成');
        }
        
        // 注册 MusicPlayerWithLyricsNode
        if (nodeData.name === "MusicPlayerWithLyricsNode") {
            const originalOnCreated = nodeType.prototype.onNodeCreated;
            
            nodeType.prototype.onNodeCreated = function() {
                const ret = originalOnCreated?.apply?.(this, arguments);
                
                // 创建播放器实例
                this.musicPlayer = new NodeMusicPlayer(this);
                
                // 创建播放器 UI 容器
                const playerContainer = this.musicPlayer.createUI();
                
                // 使用 addDOMWidget 添加 DOM widget
                // 创建一个包装对象，确保有正确的 element 属性
                const widgetWrapper = {
                    element: playerContainer,
                    serialize: false,
                    hideOnZoom: false
                };
                const playerWidget = this.addDOMWidget("musicplayerwithlyrics", "div", widgetWrapper.element, {
                    serialize: false,
                    hideOnZoom: false
                });
                
                const node = this;
                playerWidget.computeSize = function(width) {
                    const height = 350;
                    this.computedHeight = height + 10;
                    return [width, height];
                };
                
                // 保存引用
                this.playerWidget = playerWidget;
                
                console.log('[MusicPlayerWithLyricsNode] 节点创建完成');
                return ret;
            };
            
            // 节点执行后加载音频和歌词
            const originalOnExecuted = nodeType.prototype.onExecuted;
            nodeType.prototype.onExecuted = function(message) {
                const ret = originalOnExecuted?.apply?.(this, arguments);
                
                if (message && message.audio) {
                    const audioData = message.audio[0];
                    
                    if (audioData && audioData.filename) {
                        // 根据 type 构建正确的 URL
                        let audioUrl;
                        const fileType = audioData.type || 'output';
                        audioUrl = `/view?filename=${encodeURIComponent(audioData.filename)}&type=${fileType}`;
                        if (audioData.subfolder) {
                            audioUrl += `&subfolder=${encodeURIComponent(audioData.subfolder)}`;
                        }
                        
                        // 优先使用传入的filename参数，否则使用音频文件名
                        let title = audioData.filename.split('/').pop();
                        if (message.filename && Array.isArray(message.filename) && message.filename.length > 0) {
                            title = message.filename[0];
                        } else if (message.filename && typeof message.filename === 'string') {
                            title = message.filename;
                        }
                        
                        // 加载音频
                        this.musicPlayer.loadAudio(audioUrl, title);
                        
                        // 处理歌词数据（可选）
                        let lyricsData = '';
                        
                        // 尝试从多个字段获取
                        if (message.lyrics) lyricsData = message.lyrics;
                        else if (message.lyric) lyricsData = message.lyric;
                        else if (message.text) lyricsData = message.text;
                        
                        // 如果获取到的是数组（ComfyUI常见情况），转为字符串
                        if (Array.isArray(lyricsData)) {
                            lyricsData = lyricsData[0]; 
                        }
                        
                        // 如果有歌词数据就加载并切换到歌词视图
                        if (lyricsData && lyricsData.trim()) {
                            // 如果不是字符串，强制转换
                            if (typeof lyricsData !== 'string') {
                                lyricsData = String(lyricsData);
                            }
                            
                            this.musicPlayer.loadLyrics(lyricsData);
                            
                            // 切换到歌词视图
                            setTimeout(() => {
                                this.musicPlayer.toggleLyrics(true);
                            }, 200);
                        }
                        
                        // 自动播放
                        const autoplay = this.widgets?.find(w => w.name === 'autoplay')?.value ?? true;
                        if (autoplay) {
                            setTimeout(() => {
                                this.musicPlayer.audio.play().catch(err => {
                                    console.error('[MusicPlayerWithLyricsNode] 自动播放失败:', err);
                                });
                            }, 100);
                        }
                        
                        // 设置可视化
                        const showVisualizer = this.widgets?.find(w => w.name === 'show_visualizer')?.value ?? true;
                        if (showVisualizer && (!lyricsData || !lyricsData.trim())) {
                            // 只有在没有歌词时才默认显示可视化
                            this.musicPlayer.state.showVisualizer = true;
                        }
                    }
                }
                
                return ret;
            };
            
            // 节点移除时清理
            const originalOnRemoved = nodeType.prototype.onRemoved;
            nodeType.prototype.onRemoved = function() {
                if (this.musicPlayer) {
                    this.musicPlayer.destroy();
                }
                
                return originalOnRemoved?.apply?.(this, arguments);
            };
        }
        
        // ==================== 注册 LoadAudioWithVisualizerNode ====================
        if (nodeData.name === "LoadAudioWithVisualizerNode") {
            const originalOnCreated = nodeType.prototype.onNodeCreated;
            
            nodeType.prototype.onNodeCreated = function() {
                const ret = originalOnCreated?.apply?.(this, arguments);
                
                // 添加文件上传按钮
                this.addWidget("button", "📁 上传音频文件", "upload_audio", () => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = ".mp3,.wav,.ogg,.flac,.m4a,.aac,.wma,.opus";
                    input.style.display = "none";
                    document.body.appendChild(input);
                    
                    input.onchange = () => {
                        const file = input.files[0];
                        if (file) {
                            // 创建 FormData 上传文件
                            const formData = new FormData();
                            formData.append("image", file);  // ComfyUI 使用 "image" 字段名
                            formData.append("type", "input");
                            formData.append("subfolder", "");
                            
                            fetch("/upload/image", {
                                method: "POST",
                                body: formData,
                            })
                            .then(response => response.json())
                            .then(data => {
                                if (data.name) {
                                    console.log(`[LoadAudioWithVisualizerNode] 文件上传成功: ${data.name}`);
                                    
                                    // 更新下拉菜单选项
                                    const audioWidget = this.widgets.find(w => w.name === "audio");
                                    if (audioWidget) {
                                        // 刷新文件列表
                                        this.refreshAudioFileList();
                                        
                                        // 设置为新上传的文件
                                        setTimeout(() => {
                                            audioWidget.value = data.name;
                                            
                                            // 立即加载音频预览（不需要执行工作流）
                                            this.loadAudioPreview(data.name);
                                        }, 100);
                                    }
                                }
                            })
                            .catch(error => {
                                console.error("[LoadAudioWithVisualizerNode] 文件上传失败:", error);
                                alert("文件上传失败，请重试");
                            });
                        }
                        document.body.removeChild(input);
                    };
                    
                    input.click();
                });
                
                // 创建紧凑型播放器实例
                this.audioVisualizer = new NodeMusicPlayer(this, "compact");
                
                // 创建播放器 UI 容器
                const playerContainer = this.audioVisualizer.createUI();
                
                // 使用 addDOMWidget 添加 DOM widget
                const widgetWrapper = {
                    element: playerContainer,
                    serialize: false,
                    hideOnZoom: false
                };
                const playerWidget = this.addDOMWidget("audiovisualizer", "div", widgetWrapper.element, {
                    serialize: false,
                    hideOnZoom: false
                });
                
                playerWidget.computeSize = function(width) {
                    const height = 110; // 减小高度，因为弹窗是独立的
                    this.computedHeight = height + 10;
                    return [width, height];
                };
                
                // 保存引用
                this.playerWidget = playerWidget;
                
                // 监听音频下拉菜单的变化，自动加载预览
                const audioWidget = this.widgets.find(w => w.name === "audio");
                if (audioWidget) {
                    const node = this; // 保存节点引用
                    const originalCallback = audioWidget.callback;
                    
                    audioWidget.callback = function(value) {
                        // 调用原始回调
                        if (originalCallback) {
                            originalCallback.call(this, value);
                        }
                        
                        // 如果选择了有效的音频文件，立即加载预览
                        if (value && value !== "请上传音频文件到input目录") {
                            if (node && node.loadAudioPreview) {
                                console.log('[LoadAudioWithVisualizerNode] 下拉菜单选择变化，加载预览:', value);
                                node.loadAudioPreview(value);
                            }
                        }
                    };
                }
                
                console.log('[LoadAudioWithVisualizerNode] 节点创建完成');
                return ret;
            };
            
            // 添加刷新文件列表方法
            nodeType.prototype.refreshAudioFileList = function() {
                // 重新获取节点信息来刷新文件列表
                fetch("/object_info")
                    .then(response => response.json())
                    .then(data => {
                        const nodeInfo = data.LoadAudioWithVisualizerNode;
                        if (nodeInfo && nodeInfo.input && nodeInfo.input.required && nodeInfo.input.required.audio) {
                            const newFiles = nodeInfo.input.required.audio[0];
                            const audioWidget = this.widgets.find(w => w.name === "audio");
                            if (audioWidget) {
                                audioWidget.options.values = newFiles;
                                console.log('[LoadAudioWithVisualizerNode] 文件列表已刷新:', newFiles);
                                
                                // 触发界面更新
                                if (this.graph && this.graph.canvas) {
                                    this.graph.canvas.setDirty(true, true);
                                }
                            }
                        }
                    })
                    .catch(error => {
                        console.error('[LoadAudioWithVisualizerNode] 刷新文件列表失败:', error);
                    });
            };
            
            // 添加立即加载音频预览的方法（不需要执行工作流）
            nodeType.prototype.loadAudioPreview = function(filename) {
                console.log('[LoadAudioWithVisualizerNode] 立即加载音频预览:', filename);
                
                // 构建音频 URL
                const audioUrl = `/view?filename=${encodeURIComponent(filename)}&type=input`;
                const title = filename.split('/').pop();
                
                console.log('[LoadAudioWithVisualizerNode] 音频 URL:', audioUrl);
                
                // 加载音频到播放器
                if (this.audioVisualizer) {
                    this.audioVisualizer.loadAudio(audioUrl, title);
                    
                    // 获取配置参数
                    const autoplay = this.widgets?.find(w => w.name === 'autoplay')?.value ?? true;
                    const showVisualizer = this.widgets?.find(w => w.name === 'show_visualizer')?.value ?? true;
                    
                    // 设置可视化状态
                    if (showVisualizer) {
                        this.audioVisualizer.state.showVisualizer = true;
                    }
                    
                    // 自动播放
                    if (autoplay) {
                        setTimeout(() => {
                            this.audioVisualizer.audio.play().catch(err => {
                                console.error('[LoadAudioWithVisualizerNode] 自动播放失败:', err);
                            });
                        }, 200);
                    }
                }
            };
            
            // 节点执行后加载音频
            const originalOnExecuted = nodeType.prototype.onExecuted;
            nodeType.prototype.onExecuted = function(message) {
                const ret = originalOnExecuted?.apply?.(this, arguments);
                
                console.log('[LoadAudioWithVisualizerNode] onExecuted 触发:', message);
                
                if (message && message.audio) {
                    const audioData = message.audio[0];
                    
                    if (audioData && audioData.filename) {
                        // 根据 type 构建正确的 URL
                        let audioUrl;
                        const fileType = audioData.type || 'output';
                        audioUrl = `/view?filename=${encodeURIComponent(audioData.filename)}&type=${fileType}`;
                        if (audioData.subfolder) {
                            audioUrl += `&subfolder=${encodeURIComponent(audioData.subfolder)}`;
                        }
                        
                        // 获取文件名（优先使用后端传来的 filename，注意它是数组）
                        let title = audioData.filename.split('/').pop();
                        if (message.filename && Array.isArray(message.filename) && message.filename.length > 0) {
                            title = message.filename[0];
                        } else if (message.filename && typeof message.filename === 'string') {
                            title = message.filename;
                        }
                        
                        console.log('[LoadAudioWithVisualizerNode] 加载音频:', audioUrl, title);
                        
                        // 加载音频
                        this.audioVisualizer.loadAudio(audioUrl, title);
                        
                        // 获取配置参数（注意它们可能是数组）
                        let autoplay = true;
                        let showVisualizer = true;
                        
                        if (message.autoplay !== undefined) {
                            autoplay = Array.isArray(message.autoplay) ? message.autoplay[0] : message.autoplay;
                        } else {
                            autoplay = this.widgets?.find(w => w.name === 'autoplay')?.value ?? true;
                        }
                        
                        if (message.show_visualizer !== undefined) {
                            showVisualizer = Array.isArray(message.show_visualizer) ? message.show_visualizer[0] : message.show_visualizer;
                        } else {
                            showVisualizer = this.widgets?.find(w => w.name === 'show_visualizer')?.value ?? true;
                        }
                        
                        console.log('[LoadAudioWithVisualizerNode] 配置 - 自动播放:', autoplay, '显示可视化:', showVisualizer);
                        
                        // 设置可视化状态
                        if (showVisualizer) {
                            this.audioVisualizer.state.showVisualizer = true;
                            // 确保可视化按钮状态正确
                            const btnVisualizer = this.audioVisualizer.container.querySelector('.btn-visualizer');
                            if (btnVisualizer) {
                                btnVisualizer.style.background = 'rgba(255, 255, 255, 0.4)';
                            }
                        }
                        
                        // 自动播放
                        if (autoplay) {
                            setTimeout(() => {
                                this.audioVisualizer.audio.play().catch(err => {
                                    console.error('[LoadAudioWithVisualizerNode] 自动播放失败:', err);
                                });
                            }, 100);
                        }
                    }
                }
                
                return ret;
            };
            
            // 节点移除时清理
            const originalOnRemoved = nodeType.prototype.onRemoved;
            nodeType.prototype.onRemoved = function() {
                if (this.audioVisualizer) {
                    this.audioVisualizer.destroy();
                }
                
                return originalOnRemoved?.apply?.(this, arguments);
            };
        }
    }
});

