import io
import subprocess

def transcode_and_trim_audio(input_audio: io.BytesIO, duration: int) -> io.BytesIO:
    # Ensure input audio is not empty
    if input_audio.getbuffer().nbytes == 0:
        raise ValueError("Input audio buffer is empty.")

    # Prepare the output buffer for the transcoded and trimmed audio
    output_audio = io.BytesIO()

    # FFmpeg command to transcode audio with settings optimized for voice data
    ffmpeg_cmd = [
        'ffmpeg',
        '-i',   'pipe:0',            # Read from stdin
        '-t',   str(duration),       # Set duration
        '-c:a', 'aac',               # Use AAC codec
        '-b:a', '128k',              # Bitrate
        '-ar',  '44100',             # Sample rate
        '-ac',  '1',                 # Set audio to mono
        '-f',   'adts',              # Set format to AAC
        'pipe:1'                     # Output to stdout
    ]

    # Run FFmpeg as a subprocess
    process = subprocess.Popen(
        ffmpeg_cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    # Send input data to FFmpeg and capture the output
    stdout_data, stderr_data = process.communicate(input=input_audio.getvalue())

    # Check if the transcoding was successful
    if process.returncode != 0:
        raise RuntimeError(f"FFmpeg error: {stderr_data.decode()}")

    # Check for empty output
    if not stdout_data:
        raise RuntimeError("FFmpeg produced an empty output file.")

    # Write the transcoded audio to the output buffer
    output_audio.write(stdout_data)
    output_audio.seek(0)  # Reset buffer position to the start

    return output_audio
