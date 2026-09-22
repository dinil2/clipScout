import sys
import os
import json
import yt_dlp

def download_clip(video_id, start_sec, end_sec, output_path):
    video_url = f"https://www.youtube.com/watch?v={video_id}"
    
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
        
        # Check if file was created (might have extension added by yt-dlp)
        actual_path = output_path
        if not os.path.exists(actual_path) and os.path.exists(output_path + '.mp4'):
            actual_path = output_path + '.mp4'

        if os.path.exists(actual_path):
            print(json.dumps({"success": True, "filePath": actual_path, "size": os.path.getsize(actual_path)}))
            return 0
        else:
            print(json.dumps({"success": False, "error": "Output file not found"}))
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
