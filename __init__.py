"""
yicheng/亦诚制作
ComfyUI Music Player Node
内嵌式音乐播放器节点 - 可接收 AUDIO 输入
"""

import folder_paths
import os
from comfy_api.latest import UI


class LoadLyricsFileNode:
    """
    加载歌词文件节点
    支持从下拉列表选择文件或通过按钮浏览文件
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        # 获取输入目录中的歌词文件
        input_dir = folder_paths.get_input_directory()
        lyrics_files = []
        
        # 支持的歌词文件格式
        lyrics_extensions = ['.lrc', '.srt', '.txt']
        
        if os.path.exists(input_dir):
            for file in os.listdir(input_dir):
                if any(file.lower().endswith(ext) for ext in lyrics_extensions):
                    lyrics_files.append(file)
        
        # 如果没有找到歌词文件，提供一个默认选项
        if not lyrics_files:
            lyrics_files = ["请将歌词文件放入input目录"]
        
        return {
            "required": {
                "lyrics_file": (sorted(lyrics_files), {"lyrics_upload": True}),
            }
        }
    
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("lyrics",)
    FUNCTION = "load_lyrics_file"
    CATEGORY = "🎵 Music Player"
    
    @classmethod
    def IS_CHANGED(cls, lyrics_file):
        """检查文件是否发生变化"""
        if lyrics_file == "请将歌词文件放入input目录":
            return float("NaN")
            
        input_dir = folder_paths.get_input_directory()
        file_path = os.path.join(input_dir, lyrics_file)
        
        if os.path.exists(file_path):
            return os.path.getmtime(file_path)
        return float("NaN")
    
    @classmethod
    def VALIDATE_INPUTS(cls, lyrics_file):
        """验证输入参数"""
        if lyrics_file == "请将歌词文件放入input目录":
            return True
            
        input_dir = folder_paths.get_input_directory()
        file_path = os.path.join(input_dir, lyrics_file)
        
        if not os.path.exists(file_path):
            return f"歌词文件 {lyrics_file} 不存在"
        
        # 检查文件扩展名
        lyrics_extensions = ['.lrc', '.srt', '.txt']
        if not any(lyrics_file.lower().endswith(ext) for ext in lyrics_extensions):
            return f"不支持的文件格式。支持的格式: {', '.join(lyrics_extensions)}"
        
        return True
    
    def load_lyrics_file(self, lyrics_file):
        """
        加载歌词文件内容
        """
        if lyrics_file == "请将歌词文件放入input目录":
            return ("",)
        
        input_dir = folder_paths.get_input_directory()
        file_path = os.path.join(input_dir, lyrics_file)
        
        try:
            # 尝试不同的编码格式读取文件
            encodings = ['utf-8', 'gbk', 'gb2312', 'utf-16', 'latin1']
            
            for encoding in encodings:
                try:
                    with open(file_path, 'r', encoding=encoding) as f:
                        content = f.read()
                    print(f"[LoadLyricsFileNode] 成功加载歌词文件: {lyrics_file} (编码: {encoding})")
                    print(f"[LoadLyricsFileNode] 文件大小: {len(content)} 字符")
                    return (content,)
                except UnicodeDecodeError:
                    continue
            
            # 如果所有编码都失败，返回错误信息
            error_msg = f"无法读取歌词文件 {lyrics_file}，请检查文件编码"
            print(f"[LoadLyricsFileNode] 错误: {error_msg}")
            return (error_msg,)
            
        except FileNotFoundError:
            error_msg = f"歌词文件 {lyrics_file} 不存在"
            print(f"[LoadLyricsFileNode] 错误: {error_msg}")
            return (error_msg,)
        except Exception as e:
            error_msg = f"读取歌词文件时发生错误: {str(e)}"
            print(f"[LoadLyricsFileNode] 错误: {error_msg}")
            return (error_msg,)


class SaveLyricsFileNode:
    """
    保存歌词文件节点
    将歌词内容保存到指定文件
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "lyrics": ("STRING", {"forceInput": True}),
                "filename": ("STRING", {
                    "default": "lyrics.lrc",
                    "placeholder": "输入文件名，如: song_lyrics.lrc"
                }),
            },
            "optional": {
                "file_format": (["lrc", "srt", "txt"], {"default": "lrc"}),
                "encoding": (["utf-8", "gbk", "gb2312"], {"default": "utf-8"}),
            }
        }
    
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("file_path",)
    FUNCTION = "save_lyrics_file"
    CATEGORY = "🎵 Music Player"
    OUTPUT_NODE = True
    
    def save_lyrics_file(self, lyrics, filename, file_format="lrc", encoding="utf-8"):
        """
        保存歌词到文件
        """
        # 确保文件名有正确的扩展名
        if not filename.lower().endswith(f'.{file_format}'):
            # 移除现有扩展名（如果有）
            base_name = os.path.splitext(filename)[0]
            filename = f"{base_name}.{file_format}"
        
        # 获取输出目录
        output_dir = folder_paths.get_output_directory()
        file_path = os.path.join(output_dir, filename)
        
        try:
            # 创建输出目录（如果不存在）
            os.makedirs(output_dir, exist_ok=True)
            
            # 保存文件
            with open(file_path, 'w', encoding=encoding) as f:
                f.write(lyrics)
            
            print(f"[SaveLyricsFileNode] 成功保存歌词文件: {file_path}")
            print(f"[SaveLyricsFileNode] 文件格式: {file_format}, 编码: {encoding}")
            print(f"[SaveLyricsFileNode] 内容长度: {len(lyrics)} 字符")
            
            # 返回相对路径
            return (filename,)
            
        except Exception as e:
            error_msg = f"保存歌词文件时发生错误: {str(e)}"
            print(f"[SaveLyricsFileNode] 错误: {error_msg}")
            return (error_msg,)


class LyricsInputNode:
    """
    歌词输入节点
    专门用于输入和处理歌词数据
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "lyrics_text": ("STRING", {
                    "multiline": True,
                    "default": "",
                    "placeholder": "LRC 格式歌词:\n[00:12.00]第一句歌词\n[00:17.20]第二句歌词\n\n或 SRT 格式:\n1\n00:00:12,000 --> 00:00:15,500\n第一句歌词"
                }),
            }
        }
    
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("lyrics",)
    FUNCTION = "process_lyrics"
    CATEGORY = "🎵 Music Player"
    
    def process_lyrics(self, lyrics_text):
        """
        处理歌词输入，返回格式化的歌词文本
        """
        # 简单的格式验证和清理
        cleaned_lyrics = lyrics_text.strip()
        
        return (cleaned_lyrics,)


class MusicPlayerWithLyricsNode:
    """
    音乐播放器节点（支持歌词）
    可以接收音频和可选的歌词输入
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "audio": ("AUDIO",),
            },
            "optional": {
                "lyrics": ("STRING", {"forceInput": True}),  # 可选的歌词输入
                "autoplay": ("BOOLEAN", {"default": True}),
                "show_visualizer": ("BOOLEAN", {"default": True}),
            }
        }
    
    RETURN_TYPES = ("AUDIO",)
    RETURN_NAMES = ("audio",)
    FUNCTION = "play_audio_with_lyrics"
    CATEGORY = "🎵 Music Player"
    OUTPUT_NODE = True
    
    def play_audio_with_lyrics(self, audio, autoplay=True, show_visualizer=True, lyrics=None):
        """
        处理音频和可选的歌词输入
        """
        # 使用 PreviewAudio 的方式保存音频到临时文件
        preview_audio = UI.PreviewAudio(audio, cls=None)
        
        # 获取音频数据
        ui_data = preview_audio.as_dict()
        
        # 如果有歌词，添加到 UI 数据中
        if lyrics is not None:
            # 关键：将 lyrics 字符串放入列表中，确保 ComfyUI 正确传输完整字符串
            ui_data["lyrics"] = [lyrics] 
        
        # 返回音频数据和 UI 信息
        return {
            "ui": ui_data,
            "result": (audio,)
        }


# 节点注册
NODE_CLASS_MAPPINGS = {
    "MusicPlayerWithLyricsNode": MusicPlayerWithLyricsNode,
    "LyricsInputNode": LyricsInputNode,
    "LoadLyricsFileNode": LoadLyricsFileNode,
    "SaveLyricsFileNode": SaveLyricsFileNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "MusicPlayerWithLyricsNode": "🎵 Music Player",
    "LyricsInputNode": "📝 Lyrics Input",
    "LoadLyricsFileNode": "📂 Load Lyrics File",
    "SaveLyricsFileNode": "💾 Save Lyrics File",
}

WEB_DIRECTORY = "./web"


__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS', 'WEB_DIRECTORY']
