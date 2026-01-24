/**
 * ComfyUI Music Player Node Extension
 * 内嵌式音乐播放器节点 -- yicheng/亦诚制作
 */

import { app } from "../../scripts/app.js";
import { ComfyWidgets } from "../../scripts/widgets.js";

// ==================== 节点内播放器类 ====================
class NodeMusicPlayer {
    constructor(node) {
        this.node = node;
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
        this.container.className = 'node-music-player';
        this.container.style.cssText = `
            width: 100%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 12px;
            padding: 15px;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        // 创建 HTML 结构
        this.container.innerHTML = `
            <!-- 显示区域 -->
            <div class="player-display" style="
                height: 120px;
                background: rgba(0, 0, 0, 0.2);
                border-radius: 8px;
                margin-bottom: 12px;
                position: relative;
                overflow: hidden;
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
                    padding: 10px;
                    text-align: center;
                    background: rgba(0, 0, 0, 0.2);
                ">
                    <div class="lyrics-content"></div>
                </div>
            </div>
            
            <!-- 曲目信息 -->
            <div class="track-info" style="
                text-align: center;
                margin-bottom: 10px;
            ">
                <div class="track-title" style="
                    font-size: 14px;
                    font-weight: 600;
                    margin-bottom: 4px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                ">未加载音频</div>
                <div class="track-time" style="
                    font-size: 11px;
                    opacity: 0.8;
                ">00:00 / 00:00</div>
            </div>
            
            <!-- 进度条 -->
            <input type="range" class="progress-bar" min="0" max="100" value="0" style="
                width: 100%;
                height: 4px;
                margin-bottom: 10px;
                border-radius: 2px;
                background: rgba(255, 255, 255, 0.3);
                outline: none;
                -webkit-appearance: none;
                cursor: pointer;
            ">
            
            <!-- 控制按钮 -->
            <div style="
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 10px;
                margin-bottom: 10px;
            ">
                <button class="btn-play" style="
                    background: rgba(255, 255, 255, 0.2);
                    border: none;
                    color: white;
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 16px;
                    transition: all 0.2s;
                ">▶</button>
            </div>
            
            <!-- 音量控制 -->
            <div style="
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 10px;
            ">
                <span style="font-size: 14px;">🔊</span>
                <input type="range" class="volume-bar" min="0" max="100" value="80" style="
                    flex: 1;
                    height: 3px;
                    border-radius: 2px;
                    background: rgba(255, 255, 255, 0.3);
                    outline: none;
                    -webkit-appearance: none;
                    cursor: pointer;
                ">
                <span class="volume-text" style="
                    font-size: 10px;
                    min-width: 30px;
                    text-align: right;
                ">80%</span>
            </div>
            
            <!-- 功能按钮 -->
            <div style="
                display: flex;
                justify-content: center;
                gap: 8px;
            ">
                <button class="btn-visualizer" style="
                    background: rgba(255, 255, 255, 0.3);
                    border: none;
                    color: white;
                    padding: 6px 12px;
                    border-radius: 12px;
                    cursor: pointer;
                    font-size: 11px;
                    transition: all 0.2s;
                ">🎨 可视化</button>
                <button class="btn-lyrics" style="
                    background: rgba(255, 255, 255, 0.2);
                    border: none;
                    color: white;
                    padding: 6px 12px;
                    border-radius: 12px;
                    cursor: pointer;
                    font-size: 11px;
                    transition: all 0.2s;
                ">📝 歌词</button>
            </div>
        `;
        
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
     * 调整画布尺寸
     */
    resizeCanvas() {
        const display = this.container.querySelector('.player-display');
        if (!display) return;
        
        // 强制设置画布宽度为 500px，确保填满显示区域
        this.canvas.width = 500;
        this.canvas.height = 120;
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
        
        // 音量
        const volumeBar = this.container.querySelector('.volume-bar');
        volumeBar.addEventListener('input', (e) => {
            const volume = e.target.value / 100;
            this.setVolume(volume);
        });
        
        // 可视化按钮
        const btnVisualizer = this.container.querySelector('.btn-visualizer');
        btnVisualizer.addEventListener('click', () => this.toggleVisualizer());
        
        // 歌词按钮
        const btnLyrics = this.container.querySelector('.btn-lyrics');
        btnLyrics.addEventListener('click', () => this.toggleLyrics());
        
        // 音频事件
        this.audio.addEventListener('loadedmetadata', () => {
            this.state.duration = this.audio.duration;
            this.updateTimeDisplay();
        });
        
        this.audio.addEventListener('timeupdate', () => {
            this.state.currentTime = this.audio.currentTime;
            this.updateProgress();
            this.updateTimeDisplay();
            this.updateLyrics();
        });
        
        this.audio.addEventListener('play', () => {
            this.state.isPlaying = true;
            this.updatePlayButton();
            if (this.state.showVisualizer) {
                this.startVisualization();
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
        
        // 添加错误处理
        this.audio.addEventListener('error', (e) => {
            console.error('[NodeMusicPlayer] ❌ 音频加载失败!');
            console.error('  错误事件:', e);
            console.error('  错误代码:', this.audio.error?.code);
            console.error('  错误消息:', this.audio.error?.message);
            console.error('  音频 URL:', this.audio.src);
            
            // 显示错误信息
            const titleEl = this.container.querySelector('.track-title');
            titleEl.textContent = '❌ 音频加载失败';
            titleEl.style.color = '#ff6b6b';
        }, { once: true });
        
        // 添加成功加载的监听
        this.audio.addEventListener('loadeddata', () => {
            console.log('[NodeMusicPlayer] ✅ 音频加载成功!');
            console.log('  时长:', this.audio.duration, '秒');
            console.log('  就绪状态:', this.audio.readyState);
        }, { once: true });
        
        this.audio.src = url;
        
        // 更新标题
        const titleEl = this.container.querySelector('.track-title');
        titleEl.textContent = title;
        titleEl.style.color = 'white';
        
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
            // 如果已经初始化过，不需要重新创建
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
            
            // 创建 MediaElementSource（注意：每个 audio 元素只能创建一次）
            // 检查是否已经为这个 audio 元素创建过 source
            if (!this.audio._musicPlayerSource) {
                this.source = this.audioContext.createMediaElementSource(this.audio);
                this.audio._musicPlayerSource = this.source;
            } else {
                // 重用已存在的 source
                this.source = this.audio._musicPlayerSource;
            }
            
            // 连接音频链：source → analyser → destination
            // 这样音频既能被分析（用于可视化），又能输出到扬声器
            try {
                this.source.disconnect();
            } catch (e) {
                // 忽略断开连接的错误
            }
            
            this.source.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);
            
            // 确保 AudioContext 处于运行状态
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume().then(() => {
                    console.log('[NodeMusicPlayer] AudioContext resumed');
                }).catch(err => {
                    console.error('[NodeMusicPlayer] Failed to resume AudioContext:', err);
                });
            }
            
            console.log('[NodeMusicPlayer] Web Audio API initialized');
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
        const volumeText = this.container.querySelector('.volume-text');
        volumeText.textContent = Math.round(this.state.volume * 100) + '%';
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
            if (i === index) {
                line.style.opacity = '1';
                line.style.fontSize = '14px';
                line.style.fontWeight = '600';
                line.style.background = 'rgba(255, 255, 255, 0.1)';
                line.style.color = '#ffffff';
                // 确保滚动到视图中心
                line.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center',
                    inline: 'nearest'
                });
            } else if (i < index) {
                line.style.opacity = '0.3';
                line.style.fontSize = '12px';
                line.style.fontWeight = 'normal';
                line.style.background = 'transparent';
                line.style.color = '#cccccc';
            } else {
                line.style.opacity = '0.5';
                line.style.fontSize = '12px';
                line.style.fontWeight = 'normal';
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
            return;
        }
        
        // 停止之前的动画
        this.stopVisualization();
        
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
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
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        this.ctx.fillRect(0, 0, width, height);
        
        // 保持 60 根柱子
        const barCount = 60;  
        const barWidth = width / barCount;  
        
        // --- 核心修改开始 ---
        // 不要使用整个 bufferLength (对应 0-22kHz)
        // 截取前 65% 的频率数据 (对应约 0-14kHz)，这部分是人耳听感最明显且有数据的区域
        // 参考代码 audio_visualizer.js 实际上只显示了前 40% (1/2.5)
        const effectiveBufferLength = Math.floor(bufferLength * 0.65);
        // --- 核心修改结束 ---

        for (let i = 0; i < barCount; i++) {
            // 从有效频率范围内采样，而不是整个数组
            const dataIndex = Math.floor(i * effectiveBufferLength / barCount);
            
            // 为了防止数组越界（虽然上面的逻辑应该不会），加一个保护
            const safeIndex = Math.min(dataIndex, bufferLength - 1);
            const value = dataArray[safeIndex];

            // 稍微增加一点增益，因为高频通常声音较小，如果不需要可以去掉 * 1.1
            const barHeight = (Math.min(255, value * 1) / 255) * height;
            
            // 计算颜色（彩虹渐变）
            const hue = (i / barCount) * 360;
            this.ctx.fillStyle = `hsla(${hue}, 80%, 60%, 0.8)`;
            
            // 绘制柱状图（从底部向上）
            const x = i * barWidth;
            const y = height - barHeight;
            
            // 绘制
            this.ctx.fillRect(x, y, barWidth - 2, barHeight);
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
            .node-music-player input[type="range"]::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: white;
                cursor: pointer;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            }
            
            .node-music-player input[type="range"]::-moz-range-thumb {
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: white;
                cursor: pointer;
                border: none;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            }
            
            .node-music-player button:hover {
                background: rgba(255, 255, 255, 0.3) !important;
                transform: scale(1.05);
            }
            
            .node-music-player button:active {
                transform: scale(0.95);
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
        if (this.audio) {
            this.audio.pause();
            this.audio.src = '';
        }
        
        this.stopVisualization();
        
        if (this.audioContext) {
            this.audioContext.close();
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
                        
                        const title = audioData.filename.split('/').pop();
                        
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
    }
});

