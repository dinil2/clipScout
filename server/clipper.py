import sys
import os
import json
import yt_dlp

def download_clip(video_id, start_sec, end_sec, output_path):
    video_url = f"https://www.youtube.com/watch?v={video_id}"
    dur = max(5, int(end_sec) - int(start_sec))

    # 1. Extract video metadata to validate duration and bounds
    video_dur = 0
    video_url_stream = None
    audio_url_stream = None

    try:
        ydl_opts = {
            'format': 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080]/best',
            'quiet': True,
            'no_warnings': True
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=False)
            video_dur = int(info.get('duration') or 0)
            if 'requested_formats' in info:
                for f in info['requested_formats']:
                    if f.get('vcodec') != 'none' and not video_url_stream:
                        video_url_stream = f.get('url')
                    elif f.get('acodec') != 'none' and not audio_url_stream:
                        audio_url_stream = f.get('url')
            else:
                video_url_stream = info.get('url')
    except Exception as extract_err:
        pass

    # Timestamp boundary normalization
    if video_dur > 0:
        if start_sec >= video_dur:
            start_sec = max(0, int(video_dur * 0.75))
            end_sec = min(video_dur, start_sec + dur)
        else:
            end_sec = min(video_dur, max(start_sec + 5, end_sec))
        dur = max(5, int(end_sec) - int(start_sec))

    # 2. Fast Stream Direct Seek Method via FFmpeg
    if video_url_stream:
        try:
            import subprocess
            cmd = ['ffmpeg', '-y']
            cmd.extend(['-ss', str(start_sec), '-i', video_url_stream])
            if audio_url_stream:
                cmd.extend(['-ss', str(start_sec), '-i', audio_url_stream])
            cmd.extend([
                '-t', str(dur),
                '-c:v', 'copy',
                '-c:a', 'aac',
                output_path
            ])
            p = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            if p.returncode == 0 and os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
                print(json.dumps({"success": True, "filePath": output_path, "size": os.path.getsize(output_path)}))
                return 0
            
            # If stream copy failed, try ultrafast re-encoding
            cmd_reencode = ['ffmpeg', '-y']
            cmd_reencode.extend(['-ss', str(start_sec), '-i', video_url_stream])
            if audio_url_stream:
                cmd_reencode.extend(['-ss', str(start_sec), '-i', audio_url_stream])
            cmd_reencode.extend([
                '-t', str(dur),
                '-c:v', 'libx264',
                '-preset', 'ultrafast',
                '-crf', '24',
                '-c:a', 'aac',
                output_path
            ])
            p2 = subprocess.run(cmd_reencode, capture_output=True, text=True, timeout=60)
            if p2.returncode == 0 and os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
                print(json.dumps({"success": True, "filePath": output_path, "size": os.path.getsize(output_path)}))
                return 0
        except Exception as stream_err:
            pass

    # 3. Standard Fallback via yt-dlp download_ranges
    ydl_opts = {
        'format': 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best',
        'download_ranges': yt_dlp.utils.download_range_func(None, [(int(start_sec), int(end_sec))]),
        'outtmpl': output_path,
        'force_keyframes_at_cuts': True,
        'quiet': True,
        'no_warnings': True,
        'overwrites': True
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([video_url])
        
        actual_path = output_path
        if not os.path.exists(actual_path) and os.path.exists(output_path + '.mp4'):
            actual_path = output_path + '.mp4'

        if os.path.exists(actual_path) and os.path.getsize(actual_path) > 1000:
            print(json.dumps({"success": True, "filePath": actual_path, "size": os.path.getsize(actual_path)}))
            return 0
        else:
            print(json.dumps({"success": False, "error": "Output file not found or empty"}))
            return 1
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        return 1

if __name__ == "__main__":
    if len(sys.argv) < 5:
        print(json.dumps({"success": False, "error": "Usage: python clipper.py <videoId> <startSec> <endSec> <outputPath>"}))
        sys.exit(1)

    v_id = sys.argv[1]
    s_sec = int(float(sys.argv[2]))
    e_sec = int(float(sys.argv[3]))
    out_file = sys.argv[4]

    ret = download_clip(v_id, s_sec, e_sec, out_file)
    sys.exit(ret)
